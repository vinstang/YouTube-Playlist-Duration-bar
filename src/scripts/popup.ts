export {};

const permissionNeeded: chrome.permissions.Permissions = {
    origins: ['*://www.youtube.com/*'],
};

document.addEventListener('DOMContentLoaded', () => {
    const grantButton = document.getElementById('grantButton') as HTMLButtonElement | null;
    if (!grantButton) return;

    grantButton.addEventListener('click', () => {
        chrome.permissions.request(permissionNeeded);
    });

    chrome.permissions.contains(permissionNeeded).then((granted) => {
        if (granted) {
            grantButton.disabled = true;
            grantButton.textContent = 'Granted';
        }
    });
});
