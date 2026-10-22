// Playlist fixtures. Public URLs are safe to commit; account playlists are
// discovered at runtime, so no personal playlist IDs are stored here.

export const PUBLIC_PLAYLISTS = [
    { id: 'PLMOZDTW7ZvXM', label: 'Public control' },
];

export const ACCOUNT_PLAYLISTS = [
    { id: 'WL', label: 'Watch Later' },
    { id: 'LL', label: 'Liked videos' },
];

export const playlistUrl = (id) => `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`;

export const playlistId = (value) => {
    if (!value) return null;
    try {
        return new URL(value).searchParams.get('list') ?? value;
    } catch {
        return value;
    }
};

export const asPlaylist = (value, label = 'Custom playlist') => {
    const id = playlistId(value);
    if (!id) throw new Error(`Cannot determine playlist id from "${value}"`);
    return {
        id,
        label,
        url: value.startsWith('http') ? value : playlistUrl(id),
    };
};

export const dedupePlaylists = (playlists) => {
    const seen = new Set();
    return playlists.filter((playlist) => {
        if (!playlist?.id || seen.has(playlist.id)) return false;
        seen.add(playlist.id);
        return true;
    });
};
