import { calculateTotalTime, splitDurationAtPlayhead } from './utils.js';

type Theme = 'dark' | 'light';

interface PlayingElements {
    divDurationBlock: HTMLDivElement;
    divDurationProgress: HTMLDivElement;
    divTotalBlock: HTMLDivElement;
    durationTotal: HTMLSpanElement;
    divCurrentBlock: HTMLDivElement;
    durationWatched: HTMLSpanElement;
    durationPercent: HTMLSpanElement;
    durationRemaining: HTMLSpanElement;
}

interface VideoTimeList {
    watchedList: string[];
    remainingList: string[];
}

let activeVideo: HTMLVideoElement | null = null;
let playbackInterval: ReturnType<typeof setInterval> | undefined;

const handlePlaybackChange = (): void => updateDurationPlaying();

const bindPlaybackUpdates = (): void => {
    const video = document.querySelector<HTMLVideoElement>(
        '#page-manager > ytd-watch-flexy video.html5-main-video'
    );

    if (video !== activeVideo) {
        activeVideo?.removeEventListener('seeking', handlePlaybackChange);
        activeVideo?.removeEventListener('seeked', handlePlaybackChange);
        activeVideo?.removeEventListener('pause', handlePlaybackChange);
        activeVideo?.removeEventListener('ended', handlePlaybackChange);
        activeVideo?.removeEventListener('emptied', handlePlaybackChange);
        activeVideo?.removeEventListener('loadedmetadata', handlePlaybackChange);
        activeVideo?.removeEventListener('playing', handlePlaybackChange);
        activeVideo = video;

        activeVideo?.addEventListener('seeking', handlePlaybackChange);
        activeVideo?.addEventListener('seeked', handlePlaybackChange);
        activeVideo?.addEventListener('pause', handlePlaybackChange);
        activeVideo?.addEventListener('ended', handlePlaybackChange);
        activeVideo?.addEventListener('emptied', handlePlaybackChange);
        activeVideo?.addEventListener('loadedmetadata', handlePlaybackChange);
        activeVideo?.addEventListener('playing', handlePlaybackChange);
    }

    if (playbackInterval === undefined) {
        playbackInterval = setInterval(handlePlaybackChange, 1000);
    }
};

const checkTheme = (): Theme =>
    document.documentElement.hasAttribute('dark') ? 'dark' : 'light';

const createUiElement = (theme: Theme): PlayingElements => {
    const divDurationBlock = document.createElement('div');
    divDurationBlock.setAttribute(theme, '');
    divDurationBlock.id = 'duration-block-playing';
    divDurationBlock.className = 'duration-block';

    const divDurationProgress = document.createElement('div');
    divDurationProgress.setAttribute(theme, '');
    divDurationProgress.id = 'progress-bar-playing';
    divDurationProgress.className = 'progress-bar';

    const divTotalBlock = document.createElement('div');
    divTotalBlock.id = 'total-block';
    divTotalBlock.style.display = 'flex';
    divTotalBlock.style.justifyContent = 'center';

    const durationTotal = document.createElement('span');
    durationTotal.setAttribute(theme, '');
    durationTotal.id = 'duration-total-playing';
    durationTotal.className = 'duration-content';
    durationTotal.title = 'Total playlist duration.\nOnly count video shown in the playlist panel.';

    const divCurrentBlock = document.createElement('div');
    divCurrentBlock.id = 'current-block';
    divCurrentBlock.className = 'current-block';

    const durationWatched = document.createElement('span');
    durationWatched.setAttribute(theme, '');
    durationWatched.id = 'duration-watched';
    durationWatched.className = 'played-content';
    durationWatched.title = 'Time watched';

    const durationPercent = document.createElement('span');
    durationPercent.setAttribute(theme, '');
    durationPercent.id = 'duration-percent';
    durationPercent.className = 'played-content';
    durationPercent.title = '% of time watched';

    const durationRemaining = document.createElement('span');
    durationRemaining.setAttribute(theme, '');
    durationRemaining.id = 'duration-remaining';
    durationRemaining.className = 'played-content';
    durationRemaining.title = 'Time remaining';

    return {
        divDurationBlock,
        divDurationProgress,
        divTotalBlock,
        durationTotal,
        divCurrentBlock,
        durationWatched,
        durationPercent,
        durationRemaining,
    };
};

const appendUiElement = (els: PlayingElements): void => {
    const headerContents = document.querySelector<HTMLElement>(
        '#page-manager > ytd-watch-flexy #playlist #header-contents'
    );
    if (!headerContents) return;

    headerContents.appendChild(els.divDurationBlock);
    els.divDurationBlock.appendChild(els.divDurationProgress);
    els.divDurationBlock.appendChild(els.divTotalBlock);
    els.divTotalBlock.appendChild(els.durationTotal);
    els.divDurationBlock.appendChild(els.divCurrentBlock);
    els.divCurrentBlock.appendChild(els.durationWatched);
    els.divCurrentBlock.appendChild(els.durationPercent);
    els.divCurrentBlock.appendChild(els.durationRemaining);
};

const getVideoTimeList = (): VideoTimeList => {
    const container = document.querySelector(
        '#page-manager > ytd-watch-flexy #playlist #items'
    );
    if (!container) return { watchedList: [], remainingList: [] };

    const videos = container.children;
    let isWatched = true;
    const watchedList: string[] = [];
    const remainingList: string[] = [];
    const currentTime = activeVideo?.currentTime ?? 0;

    for (const video of videos) {
        const indexEl = video.querySelector('#index');
        if (isWatched && indexEl?.textContent?.trim() === '▶') {
            isWatched = false;
        }

        const videoTimeElement = video.querySelector<HTMLElement>('#text');
        const ts = (!videoTimeElement || videoTimeElement.innerText === '')
            ? '00:00'
            : videoTimeElement.innerText.trim();

        if (indexEl?.textContent?.trim() === '▶') {
            const split = splitDurationAtPlayhead(ts, currentTime);
            if (split.watched !== '0:00') watchedList.push(split.watched);
            if (split.remaining !== '0:00') remainingList.push(split.remaining);
        } else if (isWatched) {
            watchedList.push(ts);
        } else {
            remainingList.push(ts);
        }
    }

    return { watchedList, remainingList };
};

const updateUI = (watchedTs: string, remainingTs: string, totalTs: string, watchedPercent: number): void => {
    const durationTotal = document.getElementById('duration-total-playing');
    const durationWatched = document.getElementById('duration-watched');
    const durationRemaining = document.getElementById('duration-remaining');
    const durationPercent = document.getElementById('duration-percent');
    const divDurationProgress = document.getElementById('progress-bar-playing');

    if (durationTotal) durationTotal.textContent = 'Total: ' + totalTs;
    if (durationWatched) durationWatched.textContent = watchedTs;
    if (durationRemaining) durationRemaining.textContent = '- ' + remainingTs;
    if (durationPercent) durationPercent.textContent = watchedPercent + '%';
    if (divDurationProgress) divDurationProgress.style.width = watchedPercent + '%';
};

export const updateDurationPlaying = (): void => {
    bindPlaybackUpdates();
    const theme = checkTheme();
    const { watchedList, remainingList } = getVideoTimeList();
    const { watchedTs, remainingTs, totalTs, watchedPercent } = calculateTotalTime(watchedList, remainingList);

    if (document.getElementById('duration-block-playing') === null) {
        const els = createUiElement(theme);
        appendUiElement(els);
    } else {
        // Keep theme attributes in sync on all styled elements when theme changes.
        const other: Theme = theme === 'dark' ? 'light' : 'dark';
        const ids = [
            'duration-block-playing', 'progress-bar-playing',
            'duration-total-playing', 'duration-watched', 'duration-percent', 'duration-remaining',
        ];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) { el.removeAttribute(other); el.setAttribute(theme, ''); }
        }
    }

    updateUI(watchedTs, remainingTs, totalTs, watchedPercent);
};

export const stopDurationPlaying = (): void => {
    activeVideo?.removeEventListener('seeking', handlePlaybackChange);
    activeVideo?.removeEventListener('seeked', handlePlaybackChange);
    activeVideo?.removeEventListener('pause', handlePlaybackChange);
    activeVideo?.removeEventListener('ended', handlePlaybackChange);
    activeVideo?.removeEventListener('emptied', handlePlaybackChange);
    activeVideo?.removeEventListener('loadedmetadata', handlePlaybackChange);
    activeVideo?.removeEventListener('playing', handlePlaybackChange);
    activeVideo = null;

    if (playbackInterval !== undefined) {
        clearInterval(playbackInterval);
        playbackInterval = undefined;
    }
};
