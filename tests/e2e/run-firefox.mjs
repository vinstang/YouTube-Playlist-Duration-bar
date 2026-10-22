import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
    ARTIFACTS_DIR,
    DIST_DIR,
    STATE_DIR,
    assertBuildTarget,
    ensureDirs,
    parseArgs,
    runBuild,
    sanitizeName,
    sleep,
} from './lib/env.mjs';
import {
    ACCOUNT_PLAYLISTS,
    PUBLIC_PLAYLISTS,
    asPlaylist,
    dedupePlaylists,
    playlistId,
    playlistUrl,
} from './lib/fixtures.mjs';
import {
    COLLECT_PLAYLIST_LINKS,
    DIAGNOSE_PLAYING,
    DIAGNOSE_STANDALONE,
    IS_SIGNED_IN,
    SCROLL_TO_BOTTOM,
    SIGN_IN_URL,
} from './lib/diagnose.mjs';
import {
    evaluatePlaying,
    evaluateStandalone,
    hasFailures,
    printJson,
    printReport,
} from './lib/report.mjs';

const require = createRequire(import.meta.url);
const { Builder, By } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

const PROFILE_DIR = path.join(STATE_DIR, 'firefox-profile');
const FIREFOX_DIST = path.join(STATE_DIR, 'firefox-dist');
const XPI_PATH = path.join(STATE_DIR, 'firefox-temp.xpi');
const ARTIFACT_DIR = path.join(ARTIFACTS_DIR, 'firefox');
const ENGINE = 'firefox';
const COOKIE_DB = path.join(PROFILE_DIR, 'cookies.sqlite');

ensureDirs(STATE_DIR, PROFILE_DIR, ARTIFACT_DIR);

const args = parseArgs();

const resolveFirefoxBinary = () => {
    const candidates = [
        process.env.FIREFOX_BIN,
        '/Applications/Firefox.app/Contents/MacOS/firefox',
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }

    try {
        return execFileSync('which', ['firefox'], { encoding: 'utf8' }).trim();
    } catch {
        throw new Error('Firefox binary not found. Set FIREFOX_BIN to the Firefox executable.');
    }
};

const hasLoginCookie = () => {
    if (!existsSync(COOKIE_DB)) return false;

    const query = "select count(*) from moz_cookies where name='LOGIN_INFO'";
    const attempts = [
        ['-readonly', COOKIE_DB],
        [`file:${COOKIE_DB}?immutable=1`],
    ];

    for (const args of attempts) {
        try {
            const output = execFileSync('sqlite3', [...args, query], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            return Number(output) > 0;
        } catch {
            // Try the next read strategy.
        }
    }

    // Fall back to Node's built-in SQLite when the sqlite3 CLI is missing/locked.
    try {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(COOKIE_DB, { readOnly: true });
        try {
            const row = db.prepare("select count(*) as count from moz_cookies where name='LOGIN_INFO'").get();
            return Number(row.count) > 0;
        } finally {
            db.close();
        }
    } catch {
        return false;
    }
};

const login = async () => {
    if (hasLoginCookie()) {
        console.log(`Firefox profile is already signed in: ${PROFILE_DIR}`);
        return 0;
    }

    const binary = resolveFirefoxBinary();
    console.log('Opening normal Firefox (not Selenium) for Google login...');
    console.log('Google rejects sign-in in an automated browser, so this step is manual.');
    console.log('Sign in, then close Firefox to save the profile.');

    const child = spawn(binary, ['-no-remote', '-profile', PROFILE_DIR, SIGN_IN_URL], {
        stdio: 'ignore',
    });

    const deadline = Date.now() + 10 * 60 * 1000;
    let detected = false;

    while (Date.now() < deadline) {
        await sleep(2000);
        if (!detected && hasLoginCookie()) {
            detected = true;
            console.log('Login detected. Close Firefox to finish saving the profile.');
        }
        if (child.exitCode !== null) break;
    }

    if (child.exitCode === null) {
        if (!detected) child.kill('SIGTERM');
        await new Promise((resolve) => child.once('exit', resolve));
    }

    if (!hasLoginCookie()) {
        console.error('Login was not detected. Run this command again and sign in.');
        return 2;
    }

    console.log(`Firefox profile saved at ${PROFILE_DIR}`);
    return 0;
};

const open = async (driver, url) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await driver.get(url);
            break;
        } catch (error) {
            if (attempt === 1) throw error;
            await sleep(2000);
        }
    }
    await sleep(2500);
};

const waitForBlock = async (driver, selector, timeout = 10000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const found = await driver.findElements(By.css(selector));
        if (found.length > 0) return true;
        await sleep(300);
    }
    return false;
};

const getRootTheme = (driver) => driver.executeScript(
    'return document.documentElement.hasAttribute("dark") ? "dark" : "light"',
);

const findDisplayed = async (driver, selector) => {
    const elements = await driver.findElements(By.css(selector));
    for (const element of elements) {
        if (await element.isDisplayed().catch(() => false)) return element;
    }
    return null;
};

const setTheme = async (driver, theme) => {
    await open(driver, 'https://www.youtube.com/');
    if (await getRootTheme(driver) === theme) return;

    const menuButton = await findDisplayed(driver, '#avatar-btn, ytd-topbar-menu-button-renderer button');
    if (!menuButton) throw new Error('YouTube account menu button was not found');
    await menuButton.click();
    await sleep(1200);

    const appearance = await findDisplayed(driver, 'ytd-toggle-theme-compact-link-renderer');
    if (!appearance) throw new Error('YouTube appearance entry was not found');
    await appearance.click();
    await sleep(1000);

    const labels = theme === 'dark' ? ['深色主題', 'dark theme'] : ['淺色主題', 'light theme'];
    const options = await driver.findElements(By.css('ytd-compact-link-renderer'));
    let clicked = false;

    for (const option of options) {
        if (!(await option.isDisplayed().catch(() => false))) continue;
        const text = (await option.getText()).toLowerCase();
        if (labels.some((label) => text.includes(label.toLowerCase()))) {
            await option.click();
            clicked = true;
            break;
        }
    }

    if (!clicked) throw new Error(`YouTube ${theme} theme option was not found`);

    for (let i = 0; i < 10; i += 1) {
        if (await getRootTheme(driver) === theme) return;
        await sleep(500);
    }

    throw new Error(`YouTube did not switch to the ${theme} theme`);
};

const saveScreenshot = async (driver, index, label, suffix = '') => {
    const base = path.join(
        ARTIFACT_DIR,
        `${String(index).padStart(2, '0')}-${sanitizeName(label)}${suffix}`,
    );

    try {
        const png = await driver.takeScreenshot();
        writeFileSync(`${base}.png`, png, 'base64');
    } catch {
        return;
    }

    try {
        for (const selector of ['#duration-block-playlist', '#duration-block-playing']) {
            try {
                const block = await driver.findElement(By.css(selector));
                if (!(await block.isDisplayed())) continue;
                const png = await block.takeScreenshot();
                writeFileSync(`${base}-block.png`, png, 'base64');
                break;
            } catch {
                // Try the other block selector.
            }
        }
    } catch {
        // Block screenshots are best-effort.
    }
};

const buildFirefoxPackage = () => {
    if (!args.noBuild) {
        runBuild('firefox');
    } else {
        assertBuildTarget('firefox');
    }

    rmSync(FIREFOX_DIST, { recursive: true, force: true });
    cpSync(DIST_DIR, FIREFOX_DIST, { recursive: true });
    rmSync(XPI_PATH, { force: true });

    try {
        execFileSync('zip', ['-qr', XPI_PATH, '.'], { cwd: FIREFOX_DIST, stdio: 'inherit' });
    } catch (error) {
        throw new Error(`Could not create the Firefox XPI. Install the "zip" CLI. ${error.message}`);
    }
};

const audit = async () => {
    if (!hasLoginCookie()) {
        throw new Error('Firefox profile is not signed in. Run `npm run e2e:login:firefox` first.');
    }

    const builtFirefox = !args.noBuild;
    let driver;
    let originalTheme = null;
    let appliedTheme = null;

    try {
        buildFirefoxPackage();

        // A stale lock file from a previous session makes Firefox refuse the profile.
        rmSync(path.join(PROFILE_DIR, 'lock'), { force: true });
        rmSync(path.join(PROFILE_DIR, '.parentlock'), { force: true });

        const options = new firefox.Options()
            .setProfile(PROFILE_DIR)
            .addArguments('-no-remote', '--width=1440', '--height=900');

        driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(options)
            .build();

        await driver.manage().setTimeouts({ pageLoad: 60000, script: 30000, implicit: 0 });

        const notes = [];
        const rows = [];
        await driver.installAddon(XPI_PATH, true);
        await open(driver, 'https://www.youtube.com/');

        const signedIn = await driver.executeScript(`return ${IS_SIGNED_IN}`).catch(() => false);
        if (!signedIn) {
            throw new Error('The Firefox profile lost its YouTube session. Rerun `npm run e2e:login:firefox`.');
        }

        originalTheme = await getRootTheme(driver);
        if (args.theme) {
            await setTheme(driver, args.theme);
            appliedTheme = await getRootTheme(driver);
            notes.push(`Requested theme "${args.theme}"; applied "${appliedTheme}".`);
        } else {
            appliedTheme = originalTheme;
            notes.push(`Using the profile's current theme "${appliedTheme}".`);
        }

        const playlists = [];
        if (args.url) {
            playlists.push(asPlaylist(args.url));
        } else {
            if (!args.publicOnly) {
                playlists.push(...ACCOUNT_PLAYLISTS.map((playlist) => ({
                    ...playlist,
                    url: playlistUrl(playlist.id),
                })));
            }
            playlists.push(...PUBLIC_PLAYLISTS.map((playlist) => ({
                ...playlist,
                url: playlistUrl(playlist.id),
            })));

            if (!args.publicOnly) {
                await open(driver, 'https://www.youtube.com/feed/playlists');
                for (let i = 0; i < 6; i += 1) {
                    await driver.executeScript(SCROLL_TO_BOTTOM).catch(() => {});
                    await sleep(600);
                }
                const discovered = await driver
                    .executeScript(`return ${COLLECT_PLAYLIST_LINKS}`)
                    .catch(() => []);
                playlists.push(...discovered.map((item) => {
                    const id = playlistId(item.href);
                    return {
                        id,
                        label: item.label || id,
                        url: item.href,
                    };
                }));
            }
        }

        const uniquePlaylists = dedupePlaylists(playlists);

        for (let i = 0; i < uniquePlaylists.length; i += 1) {
            const playlist = uniquePlaylists[i];
            await open(driver, playlist.url);
            await waitForBlock(driver, '#duration-block-playlist', 10000);

            const diag = await driver
                .executeScript(`return ${DIAGNOSE_STANDALONE}`)
                .catch((error) => ({
                    error: error.message,
                    injected: false,
                    rows: { visible: 0 },
                    ui: {},
                    theme: {},
                }));
            const result = evaluateStandalone(diag);
            rows.push({
                label: playlist.label,
                url: playlist.url,
                flags: result.flags,
                diag,
                result,
            });

            if (result.flags.length > 0 || args.screenshots) {
                await saveScreenshot(driver, i + 1, playlist.label);
            }
        }

        // Watch panel + SPA lifecycle samples.
        const sampleCandidates = [];
        if (args.url) sampleCandidates.push(asPlaylist(args.url));
        const byId = new Map(uniquePlaylists.map((playlist) => [playlist.id, playlist]));
        if (byId.has('WL')) sampleCandidates.push(byId.get('WL'));
        for (const fixture of PUBLIC_PLAYLISTS) {
            if (byId.has(fixture.id)) sampleCandidates.push(byId.get(fixture.id));
        }
        const firstOwned = uniquePlaylists.find((playlist) => ![
            'WL',
            'LL',
            ...PUBLIC_PLAYLISTS.map((fixture) => fixture.id),
        ].includes(playlist.id));
        if (firstOwned) sampleCandidates.push(firstOwned);

        const samples = dedupePlaylists(sampleCandidates).slice(0, 3);

        for (let i = 0; i < samples.length; i += 1) {
            const playlist = samples[i];
            await open(driver, playlist.url);
            await waitForBlock(driver, '#duration-block-playlist', 10000);

            const watchHref = await driver.executeScript(`
                const scope = document.querySelector('#primary') ?? document;
                const anchor = scope.querySelector('a[href*="/watch?v="][href*="list="]')
                    ?? scope.querySelector('a[href*="/watch?v="]');
                return anchor?.href ?? null;
            `).catch(() => null);

            if (!watchHref) {
                notes.push(`No watch link found for SPA sample "${playlist.label}".`);
                continue;
            }

            await driver.executeScript(`
                const scope = document.querySelector('#primary') ?? document;
                const anchor = scope.querySelector('a[href*="/watch?v="][href*="list="]')
                    ?? scope.querySelector('a[href*="/watch?v="]');
                anchor?.click();
            `).catch(() => {});
            await sleep(6000);
            await waitForBlock(driver, '#duration-block-playing', 15000);

            const playingDiag = await driver
                .executeScript(`return ${DIAGNOSE_PLAYING}`)
                .catch((error) => ({
                    error: error.message,
                    injected: false,
                    theme: {},
                }));
            const playingResult = evaluatePlaying(playingDiag);
            rows.push({
                label: `SPA watch: ${playlist.label}`,
                url: watchHref,
                flags: playingResult.flags,
                diag: playingDiag,
                result: playingResult,
            });

            if (playingResult.flags.length > 0 || args.screenshots) {
                await saveScreenshot(
                    driver,
                    uniquePlaylists.length + i + 1,
                    `SPA-watch-${playlist.label}`,
                );
            }

            await driver.navigate().back().catch(() => {});
            await sleep(3000);
            await waitForBlock(driver, '#duration-block-playlist', 10000);

            const backDiag = await driver
                .executeScript(`return ${DIAGNOSE_STANDALONE}`)
                .catch((error) => ({
                    error: error.message,
                    injected: false,
                    rows: { visible: 0 },
                    ui: {},
                    theme: {},
                }));
            const backResult = evaluateStandalone(backDiag);
            rows.push({
                label: `SPA back: ${playlist.label}`,
                url: playlist.url,
                flags: backResult.flags,
                diag: backDiag,
                result: backResult,
            });
        }

        notes.push('Firefox does not expose content-script console logs through Selenium; visual/DOM checks only.');

        const payload = {
            engine: ENGINE,
            signedIn,
            theme: appliedTheme,
            requestedTheme: args.theme,
            playlists: rows.map((row) => ({
                label: row.label,
                url: row.url,
                flags: row.flags,
                ...row.result,
            })),
            consoleIssues: [],
            notes,
        };

        if (args.json) printJson(payload);
        else printReport({ engine: ENGINE, rows, notes, theme: appliedTheme });

        return hasFailures(rows) ? 1 : 0;
    } finally {
        if (driver && args.theme && !args.keepTheme && originalTheme && appliedTheme !== originalTheme) {
            await setTheme(driver, originalTheme).catch(() => {});
        }
        if (driver) await driver.quit().catch(() => {});
        if (builtFirefox) {
            runBuild('chrome');
        }
    }
};

const main = async () => {
    const code = args.login ? await login() : await audit();
    process.exitCode = code;
};

main().catch((error) => {
    console.error(`\nFATAL: ${error.stack ?? error.message}`);
    process.exitCode = 2;
});
