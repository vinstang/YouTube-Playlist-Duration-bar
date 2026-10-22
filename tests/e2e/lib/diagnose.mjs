// Page-side diagnostics shared by the Chrome (Playwright) and Firefox (Selenium)
// runners. Each export is a self-contained JavaScript expression so it can be
// passed to `page.evaluate()` and `driver.executeScript('return ' + code)`.
//
// Keep this file free of Node imports: it is only ever evaluated in the page.

export const SIGN_IN_URL =
    'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Ffeed%2Fplaylists&hl=en';

export const IS_SIGNED_IN = String.raw`Boolean(
    document.querySelector('ytd-masthead #avatar-btn, ytd-masthead button#avatar-btn, ytd-masthead img#img')
) && !document.querySelector('ytd-masthead a[href*="ServiceLogin"]')`;

export const SCROLL_TO_BOTTOM = 'window.scrollTo(0, document.body.scrollHeight)';

export const COLLECT_PLAYLIST_LINKS = String.raw`(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/playlist?list="]'));
    return links.map((a) => {
        const container = a.closest('ytd-grid-playlist-renderer, ytd-rich-item-renderer, ytd-playlist-renderer, ytd-lockup-view-model, yt-lockup-view-model');
        const label = (a.getAttribute('aria-label') || a.getAttribute('title') || container?.innerText || '')
            .split('\n')
            .map((s) => s.trim())
            .find((s) => s.length > 0) || '';
        return { href: a.href, label };
    });
})()`;

export const DIAGNOSE_STANDALONE = String.raw`(() => {
    const TIME = /^\d{1,2}:\d{2}(:\d{2})?$/;

    const toSeconds = (ts) => {
        const parts = ts.split(':').map(Number);
        return parts.length === 3
            ? parts[0] * 3600 + parts[1] * 60 + parts[2]
            : parts[0] * 60 + parts[1];
    };

    const toTs = (total) => {
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h > 0
            ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
            : m + ':' + String(s).padStart(2, '0');
    };

    const durationOf = (row) => {
        const legacy = row.querySelector('#text')?.textContent?.trim() ?? '';
        if (TIME.test(legacy)) return legacy;
        for (const badge of row.querySelectorAll('yt-thumbnail-badge-view-model')) {
            const text = badge.textContent?.trim() ?? '';
            if (TIME.test(text)) return text;
        }
        return '00:00';
    };

    const describe = (el) => el ? {
        tag: el.tagName.toLowerCase(),
        id: el.id,
        cls: String(el.className ?? '').slice(0, 70),
        children: el.children.length,
        lockups: el.querySelectorAll('yt-lockup-view-model').length,
        renderers: el.querySelectorAll('ytd-playlist-video-renderer').length,
    } : null;

    const selectors = [
        'ytd-browse[page-subtype="playlist"] ytd-two-column-browse-results-renderer #primary #contents',
        '#page-manager [page-subtype="playlist"] #contents #contents #contents',
    ];

    const scope = document.querySelector('ytd-browse[page-subtype="playlist"] #primary') ?? document;
    const allRows = Array.from(scope.querySelectorAll('yt-lockup-view-model, ytd-playlist-video-renderer'));
    const topRows = allRows.filter((el) => !el.parentElement?.closest('yt-lockup-view-model, ytd-playlist-video-renderer'));
    const visibleRows = topRows.filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    });
    const durations = visibleRows.map(durationOf);
    const expectedSeconds = durations.reduce((sum, ts) => sum + toSeconds(ts), 0);

    const block = document.getElementById('duration-block-playlist');
    const totalEl = document.getElementById('duration-total-playlist');
    const countEl = document.getElementById('video-counted');
    const rect = block?.getBoundingClientRect();
    const headerMatch = document.body.innerText.match(/([\d,]+)\s*(?:部影片|videos?)/i);
    const darkNodes = Array.from(document.querySelectorAll('[dark]'));

    return {
        url: location.href,
        title: document.title,
        headerCount: headerMatch ? Number(headerMatch[1].replace(/,/g, '')) : null,
        rows: {
            all: allRows.length,
            top: topRows.length,
            visible: visibleRows.length,
            parseable: durations.filter((ts) => ts !== '00:00').length,
            byTag: topRows.reduce((acc, el) => {
                const key = el.tagName.toLowerCase();
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
            }, {}),
        },
        expectedTotal: toTs(expectedSeconds),
        matches: selectors.map((sel) => ({ sel, node: describe(document.querySelector(sel)) })),
        injected: Boolean(block),
        blockRect: rect ? { width: rect.width, height: rect.height } : null,
        ui: {
            total: totalEl?.textContent ?? null,
            count: countEl?.textContent ?? null,
            totalColor: totalEl ? getComputedStyle(totalEl).color : null,
            countColor: countEl ? getComputedStyle(countEl).color : null,
        },
        theme: {
            rootDark: document.documentElement.hasAttribute('dark'),
            appDark: document.querySelector('ytd-app')?.hasAttribute('dark') ?? null,
            blockDark: block?.hasAttribute('dark') ?? null,
            blockLight: block?.hasAttribute('light') ?? null,
            darkNodeCount: darkNodes.length,
        },
    };
})()`;

export const DIAGNOSE_PLAYING = String.raw`(() => {
    const block = document.getElementById('duration-block-playing');
    const totalEl = document.getElementById('duration-total-playing');
    const watchedEl = document.getElementById('duration-watched');
    const percentEl = document.getElementById('duration-percent');
    const remainingEl = document.getElementById('duration-remaining');
    const barEl = document.getElementById('progress-bar-playing');
    const rect = block?.getBoundingClientRect();

    return {
        url: location.href,
        title: document.title,
        injected: Boolean(block),
        blockRect: rect ? { width: rect.width, height: rect.height } : null,
        total: totalEl?.textContent ?? null,
        watched: watchedEl?.textContent ?? null,
        percent: percentEl?.textContent ?? null,
        remaining: remainingEl?.textContent ?? null,
        barWidth: barEl?.style.width ?? null,
        rows: document.querySelectorAll('#playlist #items > *').length,
        totalColor: totalEl ? getComputedStyle(totalEl).color : null,
        watchedColor: watchedEl ? getComputedStyle(watchedEl).color : null,
        theme: {
            rootDark: document.documentElement.hasAttribute('dark'),
            blockDark: block?.hasAttribute('dark') ?? null,
            blockLight: block?.hasAttribute('light') ?? null,
            darkNodeCount: document.querySelectorAll('[dark]').length,
        },
    };
})()`;
