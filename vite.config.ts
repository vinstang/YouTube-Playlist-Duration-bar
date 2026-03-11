import { defineConfig, transformWithEsbuild } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const target = process.env['TARGET'] ?? 'chrome';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: process.env['NODE_ENV'] !== 'production',
    },
    plugins: [
        webExtension({
            manifest: './manifest.json',
            // Disable auto-launching a browser in watch mode.
            // Load dist/ manually via chrome://extensions "Load unpacked".
            disableAutoLaunch: true,
            // Inject web_accessible_resources into the output manifest here rather
            // than listing them in the source manifests. The plugin treats WAR script
            // paths as Rollup inputs and tries to bundle them as IIFE, breaking the
            // named exports that dynamic import() requires. By omitting WAR from the
            // source manifests, the plugin never processes those files; viteStaticCopy
            // below compiles them as proper ESM and places them at dist/scripts/*.js.
            transformManifest: (m) => {
                const base = {
                    ...m,
                    web_accessible_resources: [
                        {
                            matches: ['*://www.youtube.com/*'],
                            resources: [
                                'scripts/utils.js',
                                'scripts/duration-playing.js',
                                'scripts/duration-playlist.js',
                            ],
                        },
                    ],
                };
                if (target !== 'firefox') return base;
                // Firefox does not support background.service_worker;
                // replace it with background.scripts (persistent background page).
                const { background, ...rest } = base;
                const serviceWorker = (background as { service_worker?: string }).service_worker;
                return {
                    ...rest,
                    background: {
                        scripts: [serviceWorker ?? 'src/scripts/background.js'],
                    },
                    browser_specific_settings: {
                        gecko: {
                            id: 'wai462149@gmail.com',
                        },
                    },
                };
            },
        }),
        // Copy static assets that the plugin doesn't handle automatically.
        viteStaticCopy({
            targets: [
                { src: 'icons/*', dest: 'icons' },
                // Compile these ES modules from TypeScript source and copy to dist/scripts/.
                // They must stay as ES modules (not IIFE) so dynamic import() in content.ts
                // can import named exports at runtime. vite-plugin-web-extension bundles WAR
                // script entries as IIFE; this static copy overwrites that output with the
                // correct ESM-formatted JS compiled directly from the TypeScript source.
                {
                    src: 'src/scripts/utils.ts',
                    dest: 'scripts',
                    rename: 'utils.js',
                    transform: async (content: string, filename: string) => {
                        const result = await transformWithEsbuild(content, filename, {
                            loader: 'ts',
                            format: 'esm',
                            target: 'es2020',
                        });
                        return result.code;
                    },
                },
                {
                    src: 'src/scripts/duration-playing.ts',
                    dest: 'scripts',
                    rename: 'duration-playing.js',
                    transform: async (content: string, filename: string) => {
                        const result = await transformWithEsbuild(content, filename, {
                            loader: 'ts',
                            format: 'esm',
                            target: 'es2020',
                        });
                        return result.code;
                    },
                },
                {
                    src: 'src/scripts/duration-playlist.ts',
                    dest: 'scripts',
                    rename: 'duration-playlist.js',
                    transform: async (content: string, filename: string) => {
                        const result = await transformWithEsbuild(content, filename, {
                            loader: 'ts',
                            format: 'esm',
                            target: 'es2020',
                        });
                        return result.code;
                    },
                },
            ],
        }),
    ],
});
