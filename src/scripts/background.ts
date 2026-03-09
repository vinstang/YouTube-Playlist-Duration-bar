export {};

const DEBUG = import.meta.env.DEV;

chrome.runtime.onInstalled.addListener(async () => {
    for (const cs of chrome.runtime.getManifest().content_scripts ?? []) {
        const tabs = await chrome.tabs.query({ url: cs.matches });
        for (const tab of tabs) {
            if (tab.id === undefined) continue;
            if (DEBUG) console.log(`Injecting ${cs.js?.join(', ')} into ${tab.url}`);
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: cs.js ?? [],
                });
            } catch (err) {
                // Tab may have been closed or navigated away — swallow expected lifecycle errors.
                if (DEBUG) console.log('executeScript failed:', err);
            }
        }
    }
});
