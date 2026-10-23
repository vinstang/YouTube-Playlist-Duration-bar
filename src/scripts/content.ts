export {};

const DEBUG = import.meta.env.DEV;
let playlistWatcherCleanup: Promise<void> = Promise.resolve();
let playlistObserverGeneration = 0;

const updateDurationPlaying = async (): Promise<void> => {
    const { updateDurationPlaying: update } = await import(
        chrome.runtime.getURL('scripts/duration-playing.js')
    );
    update();
};

const updateDurationPlaylist = async (): Promise<void> => {
    const generation = playlistObserverGeneration;
    await playlistWatcherCleanup;
    if (generation !== playlistObserverGeneration || !playlistObservedTarget) return;

    const { updateDurationPlaylist: update } = await import(
        chrome.runtime.getURL('scripts/duration-playlist.js')
    );
    if (generation !== playlistObserverGeneration || !playlistObservedTarget) return;
    update();
};

const stopDurationPlaylistWatcher = async (): Promise<void> => {
    const { stopDurationPlaylist: stop } = await import(
        chrome.runtime.getURL('scripts/duration-playlist.js')
    );
    stop();
};

let pageManagerObserver: MutationObserver | undefined;
let pageManagerObservedTarget: Element | null = null;
let playingObserver: MutationObserver | undefined;
let playingObservedTarget: Element | null = null;
let playlistObserver: MutationObserver | undefined;
let playlistObservedTarget: Element | null = null;
let timeoutId: ReturnType<typeof setTimeout> | undefined;
let playingRetryId1: ReturnType<typeof setTimeout> | undefined;
let playingRetryId2: ReturnType<typeof setTimeout> | undefined;
let playlistRetryId1: ReturnType<typeof setTimeout> | undefined;
let playlistRetryId2: ReturnType<typeof setTimeout> | undefined;

// Keep the editable playlist list first, then current lockup and legacy layouts.
const PLAYLIST_LIST_SELECTORS = [
    'ytd-playlist-video-list-renderer #contents',
    'ytd-browse[page-subtype="playlist"] ytd-two-column-browse-results-renderer #primary #contents',
    '#page-manager [page-subtype="playlist"] #contents #contents #contents',
];

const findPlaylistList = (): Element | null => {
    for (const selector of PLAYLIST_LIST_SELECTORS) {
        const list = document.querySelector(selector);
        if (list) return list;
    }
    return null;
};

const clearPlayingRetries = (): void => {
    clearTimeout(playingRetryId1);
    clearTimeout(playingRetryId2);
    clearTimeout(timeoutId);
    playingRetryId1 = undefined;
    playingRetryId2 = undefined;
    timeoutId = undefined;
};

const clearPlaylistRetries = (): void => {
    clearTimeout(playlistRetryId1);
    clearTimeout(playlistRetryId2);
    playlistRetryId1 = undefined;
    playlistRetryId2 = undefined;
};

const stopPlayingObserver = (): void => {
    if (playingObserver) {
        playingObserver.disconnect();
        playingObserver = undefined;
        if (DEBUG) console.log('END :: Playing list observer stopped');
    }
    playingObservedTarget = null;
    clearPlayingRetries();
};

const stopPlaylistObserver = (): void => {
    const wasObserving = Boolean(playlistObserver || playlistObservedTarget);
    if (playlistObserver) {
        playlistObserver.disconnect();
        playlistObserver = undefined;
        if (DEBUG) console.log('END :: Playlist observer stopped');
    }
    playlistObservedTarget = null;
    clearPlaylistRetries();
    if (wasObserving) {
        playlistObserverGeneration += 1;
        playlistWatcherCleanup = playlistWatcherCleanup
            .then(stopDurationPlaylistWatcher)
            .catch(() => {});
    }
};

const startPlayingObserver = (target: Element): void => {
    if (playingObservedTarget === target) return;
    stopPlayingObserver();
    playingObservedTarget = target;

    const observer = new MutationObserver(() => {
        if (playingObservedTarget !== target) return;

        // Cancel init retries — observer firing means the playlist DOM is ready.
        clearTimeout(playingRetryId1);
        clearTimeout(playingRetryId2);
        playingRetryId1 = undefined;
        playingRetryId2 = undefined;
        updateDurationPlaying();

        // Reorder mutations can finish before the final row positions settle.
        clearTimeout(timeoutId);
        timeoutId = setTimeout(updateDurationPlaying, 2000);
    });

    observer.observe(target, { childList: true, subtree: true });
    playingObserver = observer;
    if (DEBUG) console.log('START :: Playing list observer started');

    // The header can appear after the list, especially during slow page setup.
    updateDurationPlaying();
    playingRetryId1 = setTimeout(updateDurationPlaying, 1000);
    playingRetryId2 = setTimeout(updateDurationPlaying, 3000);
};

const startPlaylistObserver = (target: Element): void => {
    if (playlistObservedTarget === target) return;
    stopPlaylistObserver();
    playlistObservedTarget = target;

    const observer = new MutationObserver(() => {
        if (playlistObservedTarget !== target) return;

        // Cancel init retries — observer firing means the playlist DOM is ready.
        clearTimeout(playlistRetryId1);
        clearTimeout(playlistRetryId2);
        playlistRetryId1 = undefined;
        playlistRetryId2 = undefined;
        updateDurationPlaylist();
    });

    observer.observe(target, { childList: true, subtree: true });
    playlistObserver = observer;
    if (DEBUG) console.log('START :: Playlist observer started');

    // Header elements may not be laid out when the video list first appears.
    updateDurationPlaylist();
    playlistRetryId1 = setTimeout(updateDurationPlaylist, 1000);
    playlistRetryId2 = setTimeout(updateDurationPlaylist, 3000);
};

const reconcileFeatureObservers = (): void => {
    const playingTarget = document.querySelector(
        '#page-manager > ytd-watch-flexy #playlist #items'
    );
    if (playingTarget) startPlayingObserver(playingTarget);
    else if (playingObservedTarget) stopPlayingObserver();

    const playlistTarget = findPlaylistList();
    if (playlistTarget) startPlaylistObserver(playlistTarget);
    else if (playlistObservedTarget) stopPlaylistObserver();
};

const observePageManager = (): void => {
    const target = document.querySelector('#page-manager') ?? document.documentElement;
    if (target === pageManagerObservedTarget) return;

    pageManagerObserver?.disconnect();
    pageManagerObservedTarget = target;
    pageManagerObserver = new MutationObserver(() => {
        observePageManager();
        reconcileFeatureObservers();
    });
    pageManagerObserver.observe(target, { childList: true, subtree: true });
    if (DEBUG) console.log('START :: #page-manager observer attached');
};

const startObserver = (): void => {
    const handleNavigation = (): void => {
        observePageManager();
        reconcileFeatureObservers();
    };

    // YouTube can replace #page-manager during SPA navigation. The event lets us
    // rebind the narrower observer if that happens; DOM changes remain observed.
    document.addEventListener('yt-navigate-finish', handleNavigation);
    observePageManager();
    reconcileFeatureObservers();
};

startObserver();
