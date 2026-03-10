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

let theme: Theme | undefined;

const checkTheme = (): Theme =>
    document.querySelector('[dark]') ? 'dark' : 'light';

const createUiElement = (currentTheme: Theme): PlaylistElements => {
    const divDurationBlock = document.createElement('div');
    divDurationBlock.setAttribute(currentTheme, '');
    divDurationBlock.id = 'duration-block-playlist';
    divDurationBlock.className = 'duration-block';

    const durationTotal = document.createElement('span');
    durationTotal.setAttribute(currentTheme, '');
    durationTotal.id = 'duration-total-playlist';
    durationTotal.className = 'duration-content';
    durationTotal.title = 'Only count video shown in the playlist panel.';

    const videoCounted = document.createElement('span');
    videoCounted.setAttribute(currentTheme, '');
    videoCounted.id = 'video-counted';
    videoCounted.className = 'duration-content';
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
    // YouTube has two responsive modes for the playlist page that share the same DOM:
    //   Wide viewport  → side panel (yt-page-header-view-model floats as left column)
    //   Narrow viewport → top header (yt-page-header-view-model spans full width)
    // In both modes yt-description-preview-view-model is the last visible item —
    // inject after it. findRendered() skips the always-hidden duplicate copy in
    // ytd-tabbed-page-header and returns the actually rendered element.
    //
    // Fallback for Watch Later / legacy playlists that still use the old
    // immersive-header layout with .metadata-action-bar.
    const candidates: Array<{ selector: string; position: InsertPosition }> = [
        {
            selector: 'yt-description-preview-view-model',
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

    if (durationTotal) durationTotal.textContent = 'Total duration: ' + totalTs;
    if (videoCounted) videoCounted.textContent = 'Videos counted: ' + count;
};

export const updateDurationPlaylist = (): void => {
    if (theme === undefined) {
        theme = checkTheme();
    }

    const { count, fullList } = getVideoTimeList();
    const totalSeconds = timeListToSeconds(fullList);
    const totalTs = secondsToTs(totalSeconds);

    if (document.getElementById('duration-block-playlist') === null) {
        const els = createUiElement(theme);
        appendUiElement(els);
    }

    updateUI(totalTs, count);
};
