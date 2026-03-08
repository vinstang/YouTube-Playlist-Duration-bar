import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
            // Disable auto-launching a browser in watch mode.
            // Load dist/ manually via chrome://extensions "Load unpacked".
            disableAutoLaunch: true,
        }),
        // Copy static assets that the plugin doesn't handle automatically.
        viteStaticCopy({
            targets: [
                { src: 'icons/*', dest: 'icons' },
                // Copy these ES modules as-is rather than bundling them.
                // The plugin's script bundler outputs IIFE format which breaks
                // dynamic import() in content.js — named exports disappear.
                // These source files are already valid ES modules, so a direct
                // copy preserves the export statements that import() requires.
                // When migrated to src/*.ts, Vite will compile them correctly.
                { src: 'scripts/duration-playing.js', dest: 'scripts' },
                { src: 'scripts/duration-playlist.js', dest: 'scripts' },
            ],
        }),
    ],
});
