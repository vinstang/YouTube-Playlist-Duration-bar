export {};

const DEBUG = import.meta.env.DEV;

const updateDurationPlaying = async (): Promise<void> => {
    const { updateDurationPlaying: update } = await import(
        chrome.runtime.getURL('scripts/duration-playing.js')
    );
    update();
};

const updateDurationPlaylist = async (): Promise<void> => {
    const { updateDurationPlaylist: update } = await import(
        chrome.runtime.getURL('scripts/duration-playlist.js')
    );
    update();
};

let playingObserverStarted = false;
let playlistObserverStarted = false;
let timeoutId: ReturnType<typeof setTimeout> | undefined;
let playingRetryId1: ReturnType<typeof setTimeout> | undefined;
let playingRetryId2: ReturnType<typeof setTimeout> | undefined;
let playlistRetryId1: ReturnType<typeof setTimeout> | undefined;
let playlistRetryId2: ReturnType<typeof setTimeout> | undefined;

const startObserver = (): void => {
    const pageManagerObserver = new MutationObserver(() => {
        if (!playingObserverStarted) {
            const playlistElement = document.querySelector(
                '#page-manager > ytd-watch-flexy #playlist #items'
            );

            if (playlistElement) {
                const playingObserver = new MutationObserver(() => {
                    // Cancel pending init retries — observer firing means DOM is ready.
                    clearTimeout(playingRetryId1);
                    clearTimeout(playingRetryId2);
                    updateDurationPlaying();

                    // updateDurationPlaying is not triggered after finishing video reordering.
                    // Run again 2 seconds later to ensure the UI stays in sync.
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(updateDurationPlaying, 2000);
                });

                playingObserver.observe(playlistElement, { childList: true, subtree: true });
                playingObserverStarted = true;
                if (DEBUG) console.log('START :: Playing list observer started');
                // Call immediately and retry to handle the race where #header-contents
                // isn't in the DOM yet at the time the first call runs.
                updateDurationPlaying();
                playingRetryId1 = setTimeout(updateDurationPlaying, 1000);
                playingRetryId2 = setTimeout(updateDurationPlaying, 3000);
            }
        }

        if (!playlistObserverStarted) {
            const playlistContents = document.querySelector(
                '#page-manager [page-subtype="playlist"] #contents #contents #contents'
            );

            if (playlistContents) {
                const playlistObserver = new MutationObserver(() => {
                    // Cancel pending init retries — observer firing means DOM is ready.
                    clearTimeout(playlistRetryId1);
                    clearTimeout(playlistRetryId2);
                    updateDurationPlaylist();
                });

                playlistObserver.observe(playlistContents, { childList: true, subtree: true });
                playlistObserverStarted = true;
                if (DEBUG) console.log('START :: Playlist observer started');
                // Call immediately and retry — header elements (yt-description-preview-view-model
                // etc.) may not be laid out yet when the video list first appears.
                updateDurationPlaylist();
                playlistRetryId1 = setTimeout(updateDurationPlaylist, 1000);
                playlistRetryId2 = setTimeout(updateDurationPlaylist, 3000);
            }
        }

        if (playingObserverStarted && playlistObserverStarted) {
            pageManagerObserver.disconnect();
            if (DEBUG) console.log('END :: #page-manager observer stopped');
        }
    });

    pageManagerObserver.observe(document.documentElement, { childList: true, subtree: true });
    if (DEBUG) console.log('START :: #page-manager observer started');
};

startObserver();
