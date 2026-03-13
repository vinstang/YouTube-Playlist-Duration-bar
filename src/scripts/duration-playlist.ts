import { timeListToSeconds, secondsToTs } from './utils.js';

type Theme = 'dark' | 'light';

interface PlaylistElements {
    divDurationBlock: HTMLDivElement;
    durationTotal: HTMLSpanElement;
    videoCounted: HTMLSpanElement;
}

interface VideoTimeList {
    count: number;
    fullList: string[];
}

let resizeObserver: ResizeObserver | undefined;

const checkTheme = (): Theme =>
    document.querySelector('[dark]') ? 'dark' : 'light';

const createUiElement = (theme: Theme): PlaylistElements => {
    const divDurationBlock = document.createElement('div');
    divDurationBlock.setAttribute(theme, '');
    divDurationBlock.id = 'duration-block-playlist';
    divDurationBlock.className = 'duration-block';

    // The playlist header always renders on a dark background (playlist artwork),
    // regardless of YouTube's light/dark theme — always apply the 'dark' attribute
    // so the CSS dark-mode text colors (white/light) are used.
    const durationTotal = document.createElement('span');
    durationTotal.setAttribute('dark', '');
    durationTotal.id = 'duration-total-playlist';
    durationTotal.className = 'duration-content';
    durationTotal.title = 'Only count video shown in the playlist panel.';

    const videoCounted = document.createElement('span');
    videoCounted.setAttribute('dark', '');
    videoCounted.id = 'video-counted';
    videoCounted.className = 'played-content';
    videoCounted.title = 'If this number not matching the total number of videos in this playlist,\nscroll down to load more video, or some videos are hidden.';

    return { divDurationBlock, durationTotal, videoCounted };
};

// YouTube renders duplicate hidden copies of some elements alongside the visible
// ones (e.g. one inside ytd-tabbed-page-header that is always 0×0, and another
// inside ytd-browse that is the real rendered element). querySelector returns the
// first match which is the hidden copy. Use querySelectorAll and return the first
// element that has a non-zero bounding rect instead.
const findRendered = (selector: string): HTMLElement | null => {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) return el;
    }
    return null;
};

const appendUiElement = (els: PlaylistElements): void => {
    // YouTube uses different rendered layouts depending on login state and viewport:
    //
    //   A. yt-page-header-view-model (logged-out or new layout):
    //      - Wide  → floats as left side panel
    //      - Narrow → spans full width as top header
    //      Inject after yt-description-preview-view-model (last item before actions).
    //
    //   B. ytd-playlist-sidebar-primary-info-renderer (logged-in, wide view):
    //      The sidebar with thumbnail, title, stats and play buttons.
    //      Inject after #play-buttons (below the action row).
    //
    //   C. .metadata-action-bar (Watch Later / legacy immersive header layout).
    //
    // findRendered() skips always-hidden duplicate copies (0×0 bounding rect)
    // and returns the first element that is actually painted on screen.
    const candidates: Array<{ selector: string; position: InsertPosition }> = [
        {
            selector: 'yt-description-preview-view-model',
            position: 'afterend',
        },
        {
            selector: 'ytd-playlist-sidebar-primary-info-renderer #play-buttons',
            position: 'afterend',
        },
        {
            selector: '#page-manager [page-subtype="playlist"] .metadata-action-bar',
            position: 'afterend',
        },
    ];

    for (const { selector, position } of candidates) {
        const anchor = findRendered(selector);
        if (anchor) {
            anchor.insertAdjacentElement(position, els.divDurationBlock);
            els.divDurationBlock.appendChild(els.durationTotal);
            els.divDurationBlock.appendChild(els.videoCounted);
            return;
        }
    }
};

const getVideoTimeList = (): VideoTimeList => {
    const videosList = document.querySelector(
        '#page-manager [page-subtype="playlist"] #contents #contents #contents'
    );
    const videos = videosList ? videosList.children : [];
    let count = 0;
    const fullList: string[] = [];

    for (const video of videos) {
        const videoTimeElement = video.querySelector<HTMLElement>('#text');
        const ts = (!videoTimeElement || videoTimeElement.innerText === '')
            ? '00:00'
            : videoTimeElement.innerText.trim();
        fullList.push(ts);
        count++;
    }

    return { count, fullList };
};

const updateUI = (totalTs: string, count: number): void => {
    const durationTotal = document.getElementById('duration-total-playlist');
    const videoCounted = document.getElementById('video-counted');

    if (durationTotal) durationTotal.textContent = 'Total: ' + totalTs;
    if (videoCounted) videoCounted.textContent = 'Videos counted: ' + count;
};

// Watch for layout switches (wide side-panel ↔ narrow top-header).
// YouTube keeps both layouts in the DOM simultaneously and toggles visibility
// via CSS as the viewport resizes. When the block's bounding rect collapses to
// 0×0 the layout it was injected into has been hidden — remove the block so
// updateDurationPlaylist re-injects it into the now-active layout.
const startResizeWatcher = (): void => {
    if (resizeObserver) return;
    resizeObserver = new ResizeObserver(() => {
        const block = document.getElementById('duration-block-playlist');
        if (!block) return;
        const r = block.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
            block.remove();
            updateDurationPlaylist();
        }
    });
    resizeObserver.observe(document.documentElement);
};

export const updateDurationPlaylist = (): void => {
    const theme = checkTheme();
    const { count, fullList } = getVideoTimeList();
    const totalSeconds = timeListToSeconds(fullList);
    const totalTs = secondsToTs(totalSeconds);

    if (document.getElementById('duration-block-playlist') === null) {
        const els = createUiElement(theme);
        appendUiElement(els);
        startResizeWatcher();
    } else {
        // Keep background/border theme attribute in sync when theme changes.
        const block = document.getElementById('duration-block-playlist');
        if (block) {
            const other: Theme = theme === 'dark' ? 'light' : 'dark';
            block.removeAttribute(other);
            block.setAttribute(theme, '');
        }
    }

    updateUI(totalTs, count);
};
