export {};

const DEBUG = import.meta.env.DEV;

// Holds the install/update reason until the popup consumes it.
// Intentionally in-memory only — the state is immediately discardable.
let pendingUpdate: { reason: string } | null = null;

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason !== 'install' && details.reason !== 'update') return;

    pendingUpdate = { reason: details.reason };

    // Badge on the extension icon draws the user's attention passively.
    // The popup clears this when the user acknowledges the notice.
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });

    // Open the popup automatically (Chrome 127+, recent Firefox).
    // Gracefully degrade on older browsers — the badge still signals the user.
    try {
        await chrome.action.openPopup();
    } catch {
        if (DEBUG) console.log('openPopup() not supported in this browser version');
    }

    if (DEBUG) console.log(`onInstalled(${details.reason}): badge set`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'getUpdateState') return false;
    sendResponse(pendingUpdate);
    pendingUpdate = null;
    return false;
});
