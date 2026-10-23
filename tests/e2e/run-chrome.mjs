import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
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
const { chromium } = require('playwright');

const PROFILE_DIR = path.join(STATE_DIR, 'chrome-profile');
const ENGINE = 'chrome';
const ARTIFACT_DIR = path.join(ARTIFACTS_DIR, ENGINE);

ensureDirs(STATE_DIR, PROFILE_DIR, ARTIFACT_DIR);

const args = parseArgs();

const launch = (withExtension) => {
    const extensionArgs = withExtension
        ? [`--disable-extensions-except=${DIST_DIR}`, `--load-extension=${DIST_DIR}`]
        : [];

    return chromium.launchPersistentContext(PROFILE_DIR, {
        headless: false,
        viewport: { width: 1440, height: 900 },
        locale: 'en-GB',
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            ...extensionArgs,
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
        ],
    });
};

const open = async (page, url) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            break;
        } catch (error) {
            if (attempt === 1) throw error;
            await page.waitForTimeout(2000);
        }
    }
    await page.waitForTimeout(2500);
};

const waitForBlock = async (page, selector, timeout = 10000) => {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch {
        return false;
    }
};

const waitForSignedIn = async (page, timeoutMs = 5 * 60 * 1000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (page.isClosed()) return false;
        try {
            if (await page.evaluate(IS_SIGNED_IN)) return true;
        } catch {
            // Navigation in progress (accounts.google.com -> youtube.com).
        }
        await page.waitForTimeout(3000);
    }
    return false;
};

const getRootTheme = (page) => page.evaluate(() => (
    document.documentElement.hasAttribute('dark') ? 'dark' : 'light'
));

const setTheme = async (page, theme) => {
    await open(page, 'https://www.youtube.com/');
    if (await getRootTheme(page) === theme) return;

    const menuButton = page.locator('#avatar-btn, ytd-topbar-menu-button-renderer button').first();
    await menuButton.click({ timeout: 10000 });
    await page.waitForTimeout(1200);

    const appearance = page.locator('ytd-toggle-theme-compact-link-renderer').first();
    await appearance.click({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const label = theme === 'dark' ? /深色主題|Dark theme/i : /淺色主題|Light theme/i;
    const option = page.locator('ytd-compact-link-renderer').filter({ hasText: label }).last();
    await option.click({ timeout: 10000 });

    for (let i = 0; i < 10; i += 1) {
        if (await getRootTheme(page) === theme) return;
        await page.waitForTimeout(500);
    }

    throw new Error(`YouTube did not switch to the ${theme} theme`);
};

const capture = async (page, index, label, suffix = '') => {
    const base = path.join(
        ARTIFACT_DIR,
        `${String(index).padStart(2, '0')}-${sanitizeName(label)}${suffix}`,
    );
    await page.screenshot({ path: `${base}.png` }).catch(() => {});
    for (const selector of ['#duration-block-playlist', '#duration-block-playing']) {
        const block = page.locator(selector).first();
        if (await block.count().catch(() => 0) && await block.isVisible().catch(() => false)) {
            await block.screenshot({ path: `${base}-block.png` }).catch(() => {});
            break;
        }
    }
    return `${base}.png`;
};

const discoverAccountPlaylists = async (page) => {
    await open(page, 'https://www.youtube.com/feed/playlists');
    for (let i = 0; i < 6; i += 1) {
        await page.evaluate(SCROLL_TO_BOTTOM).catch(() => {});
        await page.waitForTimeout(600);
    }
    return page.evaluate(COLLECT_PLAYLIST_LINKS).catch(() => []);
};

const clickVisibleRoute = async (page, route, listId = null) => page.evaluate(({ route, listId }) => {
    const link = Array.from(document.querySelectorAll('a[href]')).find((anchor) => {
        const url = new URL(anchor.href);
        const rect = anchor.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if (route === '/feed/playlists') return url.pathname === route;
        return url.pathname === '/playlist' && url.searchParams.get('list') === listId;
    });
    link?.click();
    return Boolean(link);
}, { route, listId });

const clickVideoInPanel = async (page, rowIndex) => page.evaluate((rowIndex) => {
    const row = document.querySelectorAll('#playlist #items > *')[rowIndex];
    if (!row) return null;
    const anchors = Array.from(row.querySelectorAll('a[href*="/watch?v="]'));
    const anchor = anchors.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }) ?? anchors[0];
    if (!anchor) return null;

    const videoId = new URL(anchor.href).searchParams.get('v');
    anchor.click();
    return videoId ? { videoId, rowIndex } : null;
}, rowIndex);

const waitForCurrentPanelRow = async (page, target, timeout = 30000) => {
    try {
        await page.waitForFunction(({ videoId, rowIndex }) => {
            const rows = document.querySelectorAll('#playlist #items > *');
            const currentIndex = rows[rowIndex]?.querySelector('#index')?.textContent?.trim();
            return new URL(location.href).searchParams.get('v') === videoId && currentIndex === '▶';
        }, target, { timeout });
        return true;
    } catch {
        return false;
    }
};

const loadMorePlaylistRows = async (page, initialDiag) => {
    let diag = initialDiag;
    if ((diag.headerCount ?? 0) <= 100 || (diag.rows?.top ?? 0) > 100) return diag;

    let noGrowth = 0;
    for (let attempt = 0; attempt < 12 && diag.rows.top <= 100 && noGrowth < 5; attempt += 1) {
        const previousCount = diag.rows.top;
        await page.evaluate(SCROLL_TO_BOTTOM).catch(() => {});
        await page.waitForTimeout(1200);
        diag = await page.evaluate(DIAGNOSE_STANDALONE).catch((error) => ({
            ...diag,
            error: error.message,
        }));
        noGrowth = diag.rows?.top > previousCount ? 0 : noGrowth + 1;
    }

    diag.loadMoreFailed = diag.rows?.top <= 100;
    return diag;
};

const login = async () => {
    const context = await launch(false);
    const page = context.pages()[0] ?? await context.newPage();

    try {
        await open(page, 'https://www.youtube.com/');
        if (await page.evaluate(IS_SIGNED_IN)) {
            console.log('Chrome profile is already signed in.');
            return 0;
        }

        await page.goto(SIGN_IN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('Log in to the Google account in the opened Chrome window.');
        const signedIn = await waitForSignedIn(page);
        console.log(signedIn
            ? `Signed in. Profile saved at ${PROFILE_DIR}`
            : 'Login was not detected before the timeout.');
        return signedIn ? 0 : 2;
    } finally {
        await context.close().catch(() => {});
    }
};

const audit = async () => {
    if (!args.noBuild) runBuild('chrome');
    assertBuildTarget('chrome');

    const context = await launch(true);
    const page = context.pages()[0] ?? await context.newPage();
    const notes = [];
    const consoleIssues = [];
    let originalTheme = null;
    let appliedTheme = null;

    page.on('console', (message) => {
        const url = message.location()?.url ?? '';
        if (url.startsWith('chrome-extension://')) {
            consoleIssues.push({ level: message.type(), text: message.text(), url });
        }
    });
    page.on('pageerror', (error) => {
        consoleIssues.push({ type: 'pageerror', text: error.message });
    });
    page.on('requestfailed', (request) => {
        if (request.url().startsWith('chrome-extension://')) {
            consoleIssues.push({
                type: 'requestfailed',
                url: request.url(),
                error: request.failure()?.errorText,
            });
        }
    });

    try {
        let worker = context.serviceWorkers()[0];
        if (!worker) {
            try {
                worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
            } catch {
                notes.push('Extension service worker was not detected; content-script checks still ran.');
            }
        }

        await open(page, 'https://www.youtube.com/');
        const signedIn = await page.evaluate(IS_SIGNED_IN).catch(() => false);
        if (!signedIn) {
            notes.push('Not signed in. Only public playlists ran. Run `npm run e2e:login:chrome` for account coverage.');
        }

        originalTheme = await getRootTheme(page);
        const requestedTheme = args.theme ?? 'dark';
        await setTheme(page, requestedTheme);
        appliedTheme = await getRootTheme(page);
        notes.push(`Requested theme "${requestedTheme}"; applied "${appliedTheme}".`);

        const playlists = [];
        if (args.url) {
            playlists.push(asPlaylist(args.url));
        } else {
            if (signedIn && !args.publicOnly) {
                playlists.push(...ACCOUNT_PLAYLISTS.map((playlist) => ({
                    ...playlist,
                    url: playlistUrl(playlist.id),
                })));
            }
            playlists.push(...PUBLIC_PLAYLISTS.map((playlist) => ({
                ...playlist,
                url: playlistUrl(playlist.id),
            })));
            if (signedIn && !args.publicOnly) {
                const discovered = await discoverAccountPlaylists(page);
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
        const rows = [];

        for (let i = 0; i < uniquePlaylists.length; i += 1) {
            const playlist = uniquePlaylists[i];
            await open(page, playlist.url);
            await waitForBlock(page, '#duration-block-playlist', 10000);

            let diag = await page.evaluate(DIAGNOSE_STANDALONE).catch((error) => ({
                error: error.message,
                injected: false,
                rows: { visible: 0 },
                ui: {},
                theme: {},
            }));
            diag = await loadMorePlaylistRows(page, diag);
            const result = evaluateStandalone(diag);
            const row = {
                label: playlist.label,
                url: playlist.url,
                flags: result.flags,
                diag,
                result,
            };
            rows.push(row);

            if (row.flags.length > 0 || args.screenshots) {
                await capture(page, i + 1, playlist.label);
            }
        }

        // Watch-page panel + SPA lifecycle samples.
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
            await open(page, playlist.url);
            await waitForBlock(page, '#duration-block-playlist', 10000);

            const watchHref = await page.evaluate(() => {
                const scope = document.querySelector('#primary') ?? document;
                const anchor = scope.querySelector('a[href*="/watch?v="][href*="list="]')
                    ?? scope.querySelector('a[href*="/watch?v="]');
                return anchor?.href ?? null;
            }).catch(() => null);

            if (!watchHref) {
                notes.push(`No watch link found for SPA sample "${playlist.label}".`);
                continue;
            }

            await page.evaluate(() => {
                const scope = document.querySelector('#primary') ?? document;
                const anchor = scope.querySelector('a[href*="/watch?v="][href*="list="]')
                    ?? scope.querySelector('a[href*="/watch?v="]');
                anchor?.click();
            }).catch(() => {});
            await page.waitForURL(/\/watch\?/, { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(6000);
            await waitForBlock(page, '#duration-block-playing', 15000);

            const playingDiag = await page.evaluate(DIAGNOSE_PLAYING).catch((error) => ({
                error: error.message,
                injected: false,
                theme: {},
            }));
            const playingResult = evaluatePlaying(playingDiag);
            const playingRow = {
                label: `SPA watch: ${playlist.label}`,
                url: watchHref,
                flags: playingResult.flags,
                diag: playingDiag,
                result: playingResult,
            };
            rows.push(playingRow);
            if (playingRow.flags.length > 0 || args.screenshots) {
                await capture(page, uniquePlaylists.length + i + 1, `SPA-watch-${playlist.label}`);
            }

            let videoSwitchCount = 0;
            for (const rowIndex of [1, 2]) {
                const panelRows = await page.evaluate(
                    () => document.querySelectorAll('#playlist #items > *').length,
                ).catch(() => 0);
                if (panelRows <= rowIndex) {
                    notes.push(`Only ${panelRows} watch-panel row(s) available for "${playlist.label}"; skipped row ${rowIndex + 1}.`);
                    break;
                }

                const switchedVideo = await clickVideoInPanel(page, rowIndex).catch(() => null);
                if (!switchedVideo) {
                    const failureDiag = await page.evaluate(DIAGNOSE_PLAYING).catch(() => ({ injected: false }));
                    const failureResult = evaluatePlaying(failureDiag);
                    failureResult.flags.push(`VIDEO_ROW_${rowIndex + 1}_NOT_SELECTABLE`);
                    rows.push({
                        label: `Video row ${rowIndex + 1} counter: ${playlist.label}`,
                        url: page.url(),
                        flags: failureResult.flags,
                        diag: failureDiag,
                        result: failureResult,
                    });
                    break;
                }

                videoSwitchCount += 1;
                const selected = await waitForCurrentPanelRow(page, switchedVideo);
                await page.waitForTimeout(1200);
                const switchDiag = await page.evaluate(DIAGNOSE_PLAYING).catch((error) => ({
                    error: error.message,
                    injected: false,
                    theme: {},
                }));
                const switchResult = evaluatePlaying(switchDiag);
                if (!selected || switchDiag.currentRowIndex !== rowIndex) {
                    switchResult.flags.push(`VIDEO_ROW_${rowIndex + 1}_NOT_CURRENT`);
                }
                rows.push({
                    label: `Video row ${rowIndex + 1} counter: ${playlist.label}`,
                    url: page.url(),
                    flags: switchResult.flags,
                    diag: switchDiag,
                    result: switchResult,
                });
                if (switchResult.flags.length > 0 || args.screenshots) {
                    await capture(
                        page,
                        uniquePlaylists.length + samples.length + i + rowIndex,
                        `Video-row-${rowIndex + 1}-${playlist.label}`,
                    );
                }
            }

            if (videoSwitchCount > 0) {
                for (let attempt = 0; attempt < 5; attempt += 1) {
                    const isWatchPage = await page.evaluate(() => location.pathname === '/watch').catch(() => false);
                    if (!isWatchPage) break;
                    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
                    await page.waitForTimeout(1000);
                }
            } else {
                await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
            }
            await page.waitForTimeout(3000);
            await waitForBlock(page, '#duration-block-playlist', 10000);

            const backDiag = await page.evaluate(DIAGNOSE_STANDALONE).catch((error) => ({
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

        // Exercise playlist A -> playlists hub -> playlist B without a document
        // reload. This catches observers left attached to the previous list node.
        const reservedIds = ['WL', 'LL', ...PUBLIC_PLAYLISTS.map((fixture) => fixture.id)];
        const spaSwitchCandidates = uniquePlaylists.filter((playlist) => (
            !reservedIds.includes(playlist.id)
            && rows.some((row) => row.url === playlist.url && (row.result?.rows ?? 0) > 0)
        ));

        if (spaSwitchCandidates.length >= 2) {
            const source = spaSwitchCandidates[0];
            const destination = spaSwitchCandidates[1];
            await open(page, source.url);
            await waitForBlock(page, '#duration-block-playlist', 10000);
            await page.evaluate(() => { window.__e2eSpaMarker = 'preserve-document'; });

            const openedHub = await clickVisibleRoute(page, '/feed/playlists');
            if (!openedHub) {
                notes.push('Could not find the YouTube Playlists navigation link for the cross-playlist SPA check.');
            } else {
                await page.waitForURL((url) => url.pathname === '/feed/playlists', { timeout: 15000 }).catch(() => {});
                await page.waitForTimeout(2500);
                const openedDestination = await clickVisibleRoute(page, '/playlist', destination.id);
                if (!openedDestination) {
                    notes.push(`Could not find the account playlist link for SPA target "${destination.label}".`);
                } else {
                    await page.waitForURL((url) => url.searchParams.get('list') === destination.id, { timeout: 15000 }).catch(() => {});
                    await page.waitForTimeout(2000);
                    await waitForBlock(page, '#duration-block-playlist', 10000);

                    const spaDiag = await page.evaluate(DIAGNOSE_STANDALONE).catch((error) => ({
                        error: error.message,
                        injected: false,
                        rows: { visible: 0 },
                        ui: {},
                        theme: {},
                    }));
                    const spaResult = evaluateStandalone(spaDiag);
                    const documentPreserved = await page.evaluate(
                        () => window.__e2eSpaMarker === 'preserve-document'
                    ).catch(() => false);
                    if (!documentPreserved) spaResult.flags.push('SPA_RELOADED_DOCUMENT');

                    rows.push({
                        label: `SPA switch: ${source.label} → ${destination.label}`,
                        url: destination.url,
                        flags: spaResult.flags,
                        diag: spaDiag,
                        result: spaResult,
                    });
                    if (spaResult.flags.length > 0 || args.screenshots) {
                        await capture(page, uniquePlaylists.length + samples.length + 1, 'SPA-switch-playlist');
                    }
                }
            }
        } else if (signedIn && !args.publicOnly) {
            notes.push('Cross-playlist SPA check skipped: fewer than two non-empty account playlists were discovered.');
        }

        if (consoleIssues.length > 0) {
            notes.push(`Extension console issues: ${JSON.stringify(consoleIssues)}`);
        }

        const payload = {
            engine: ENGINE,
            signedIn,
            theme: appliedTheme,
            requestedTheme: args.theme ?? 'dark',
            playlists: rows.map((row) => ({
                label: row.label,
                url: row.url,
                flags: row.flags,
                ...row.result,
            })),
            consoleIssues,
            notes,
        };

        if (args.json) printJson(payload);
        else printReport({ engine: ENGINE, rows, notes, theme: appliedTheme });

        return hasFailures(rows) || consoleIssues.length > 0 ? 1 : 0;
    } finally {
        if (!args.keepTheme && originalTheme && appliedTheme !== originalTheme) {
            await setTheme(page, originalTheme).catch(() => {});
        }
        await context.close().catch(() => {});
    }
};

const main = async () => {
    if (!existsSync(DIST_DIR) && !args.login) {
        throw new Error('dist/ does not exist. Run `npm run build:chrome` first.');
    }
    const code = args.login ? await login() : await audit();
    process.exitCode = code;
};

main().catch((error) => {
    console.error(`\nFATAL: ${error.stack ?? error.message}`);
    process.exitCode = 2;
});
