/**
 * Manual browser test: launches Chrome with the extension loaded and
 * navigates to a YouTube playlist page to verify the duration bar appears.
 *
 * Usage: node tests/browser-test.mjs
 * Prerequisites: npm run build:chrome must have been run first.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(__dirname, '../dist');

if (!existsSync(extensionPath)) {
    console.error('ERROR: dist/ not found. Run: npm run build:chrome');
    process.exit(1);
}

console.log('Extension path:', extensionPath);
console.log('Launching Chromium with extension...');

// Use a fresh temp profile dir so extensions load cleanly every run.
const userDataDir = mkdtempSync(resolve(tmpdir(), 'yt-ext-test-'));

const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
    ],
    timeout: 30000,
});

// Wait for extension service worker to start
await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => {
    console.log('Note: service worker event not captured (may already be running)');
});

// Check the extension is installed
const bgPage = await context.newPage();
await bgPage.goto('chrome://extensions');
await bgPage.waitForTimeout(1000);
const extTitle = await bgPage.evaluate(() => {
    // Look for extension info in the DOM
    const shadow = document.querySelector('extensions-manager')?.shadowRoot;
    const items = shadow?.querySelectorAll('extensions-item');
    return Array.from(items ?? []).map(item => {
        const s = item.shadowRoot;
        return s?.querySelector('#name')?.textContent ?? 'unknown';
    });
});
console.log('Installed extensions:', extTitle);
await bgPage.close();

const page = await context.newPage();

// Capture console messages from the page (extension logs will appear here)
const consoleLogs = [];
page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
});
page.on('pageerror', err => consoleLogs.push(`[pageerror] ${err.message}`));

// Navigate to a YouTube playlist (video watch page with playlist sidebar)
const playlistUrl = 'https://www.youtube.com/watch?v=fOT0BUpITw8&list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI';
console.log('Navigating to YouTube playlist...');
await page.goto(playlistUrl, { waitUntil: 'networkidle', timeout: 30000 });

// Wait for YouTube's SPA content to render
console.log('Waiting for YouTube content to load...');
await page.waitForTimeout(6000);

// This is a watch page with a playlist sidebar — check for the playing view block
const durationBlockPlaying = await page.$('#duration-block-playing');
if (durationBlockPlaying) {
    const text = await durationBlockPlaying.textContent();
    console.log('✓ SUCCESS: Extension duration block (playing view) found!');
    console.log('  Content:', text?.trim());
} else {
    console.log('  duration-block-playing not found yet, waiting longer...');
    await page.waitForTimeout(5000);
    const retryBlock = await page.$('#duration-block-playing');
    if (retryBlock) {
        const text = await retryBlock.textContent();
        console.log('✓ SUCCESS: Extension duration block (playing view) found!');
        console.log('  Content:', text?.trim());
    } else {
        console.log('✗ FAIL: Extension did not inject the duration block.');
    }
}

// Also probe key DOM elements to help diagnose issues
const diagnostics = await page.evaluate(() => {
    return {
        hasPlaylist:        !!document.querySelector('#playlist'),
        hasPlaylistItems:   !!document.querySelector('#page-manager > ytd-watch-flexy #playlist #items'),
        hasHeaderContents:  !!document.querySelector('#page-manager > ytd-watch-flexy #playlist #header-contents'),
        hasDurationBlock:   !!document.getElementById('duration-block-playing'),
    };
});
console.log('DOM diagnostics:', diagnostics);

// Print any extension-related console messages
const extLogs = consoleLogs.filter(l =>
    l.includes('START') || l.includes('END') || l.includes('duration') || l.includes('error') || l.includes('Error')
);
if (extLogs.length) {
    console.log('Relevant console messages:');
    extLogs.forEach(l => console.log(' ', l));
} else {
    console.log('No extension console messages captured.');
    console.log('All console messages:', consoleLogs.slice(0, 10));
}

// Take a screenshot
const screenshotPath = resolve(__dirname, '../screenshot/browser-test.png');
await page.screenshot({ path: screenshotPath, fullPage: false });
console.log('Screenshot saved to:', screenshotPath);

await context.close();

// Clean up temp profile
try { rmSync(userDataDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
