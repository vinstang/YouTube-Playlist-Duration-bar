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

const appendUiElement = (els: PlaylistElements): void => {
    const headerContents = document.querySelector<HTMLElement>(
        '#page-manager [page-subtype="playlist"] > ytd-playlist-header-renderer > div > ' +
        'div.immersive-header-content.style-scope.ytd-playlist-header-renderer > ' +
        'div.thumbnail-and-metadata-wrapper.style-scope.ytd-playlist-header-renderer > ' +
        'div > div.metadata-action-bar.style-scope.ytd-playlist-header-renderer'
    );
    if (!headerContents) return;

    headerContents.insertAdjacentElement('afterend', els.divDurationBlock);
    els.divDurationBlock.appendChild(els.durationTotal);
    els.divDurationBlock.appendChild(els.videoCounted);
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
