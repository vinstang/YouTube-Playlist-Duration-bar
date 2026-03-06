import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

const target = process.env['TARGET'] ?? 'chrome';
const manifest = target === 'firefox' ? './manifest-firefox.json' : './manifest-chrome.json';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: process.env['NODE_ENV'] !== 'production',
    },
    plugins: [
        webExtension({
            manifest,
            // These ES modules are loaded at runtime via chrome.runtime.getURL()
            // and must be bundled as standalone files in web_accessible_resources.
            additionalInputs: [
                'scripts/duration-playing.js',
                'scripts/duration-playlist.js',
            ],
        }),
    ],
});
