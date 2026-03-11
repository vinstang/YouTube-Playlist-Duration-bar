export {};

const permissionNeeded: chrome.permissions.Permissions = {
    origins: ['*://www.youtube.com/*'],
};

const clearUpdateState = async (): Promise<void> => {
    await chrome.storage.local.remove(['updatePending', 'updateReason']);
    await chrome.action.setBadgeText({ text: '' });
};

document.addEventListener('DOMContentLoaded', async () => {
    // ── Icon & version ──────────────────────────────────────────────────────
    const iconEl = document.getElementById('popup-icon') as HTMLImageElement | null;
    if (iconEl) {
        iconEl.src = chrome.runtime.getURL('icons/icon-48.png');
    }

    const versionEl = document.getElementById('popup-version');
    if (versionEl) {
        versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
    }

    // ── Update / install notice ─────────────────────────────────────────────
    const notice      = document.getElementById('update-notice');
    const noticeTitle = document.getElementById('update-notice-title');
    const noticeBody  = document.getElementById('update-notice-body');
    const dismissBtn  = document.getElementById('update-dismiss');
    const reloadBtn   = document.getElementById('update-reload');

    const { updatePending, updateReason } = await chrome.storage.local.get([
        'updatePending',
        'updateReason',
    ]) as { updatePending?: boolean; updateReason?: string };

    if (updatePending && notice && noticeTitle && noticeBody) {
        const isInstall = updateReason === 'install';

        noticeTitle.textContent = isInstall ? 'Extension installed' : 'Extension updated';
        noticeBody.textContent  = isInstall
            ? 'Reload any open YouTube tabs to activate the extension.'
            : 'Reload any open YouTube tabs to apply the latest changes.';

        notice.classList.remove('hidden');

        dismissBtn?.addEventListener('click', async () => {
            await clearUpdateState();
            notice.classList.add('hidden');
        });

        reloadBtn?.addEventListener('click', async () => {
            const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
            for (const tab of tabs) {
                if (tab.id !== undefined) chrome.tabs.reload(tab.id);
            }
            await clearUpdateState();
            notice.classList.add('hidden');
        });
    }

    // ── Permissions ─────────────────────────────────────────────────────────
    const grantButton = document.getElementById('grantButton') as HTMLButtonElement | null;
    if (!grantButton) return;

    const granted = await chrome.permissions.contains(permissionNeeded);
    if (granted) {
        grantButton.disabled = true;
        grantButton.textContent = 'Granted';
    }

    grantButton.addEventListener('click', () => {
        chrome.permissions.request(permissionNeeded);
    });
});
