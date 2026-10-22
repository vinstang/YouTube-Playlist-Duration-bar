import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// lib/ -> e2e/ -> tests/ -> repository root
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const STATE_DIR = path.join(ROOT, '.e2e');
export const ARTIFACTS_DIR = path.join(STATE_DIR, 'artifacts');
export const DIST_DIR = path.join(ROOT, 'dist');

export const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export const ensureDirs = (...dirs) => {
    for (const dir of dirs) mkdirSync(dir, { recursive: true });
};

export const parseArgs = (argv = process.argv.slice(2)) => {
    const flags = new Set();
    const values = {};

    for (const arg of argv) {
        if (!arg.startsWith('--')) continue;
        const [key, ...rest] = arg.slice(2).split('=');
        if (rest.length > 0) values[key] = rest.join('=');
        else flags.add(key);
    }

    if (values.theme && !['light', 'dark'].includes(values.theme)) {
        throw new Error('--theme must be "light" or "dark"');
    }

    return {
        login: flags.has('login'),
        publicOnly: flags.has('public-only'),
        noBuild: flags.has('no-build'),
        screenshots: flags.has('screenshots'),
        json: flags.has('json'),
        keepTheme: flags.has('keep-theme'),
        theme: values.theme ?? null,
        url: values.url ?? null,
    };
};

export const runBuild = (target) => {
    execFileSync(npmCmd, ['run', `build:${target}`], { cwd: ROOT, stdio: 'inherit' });
};

export const readDistManifest = () => {
    const manifestPath = path.join(DIST_DIR, 'manifest.json');
    if (!existsSync(manifestPath)) {
        throw new Error('dist/manifest.json is missing. Build the extension first.');
    }
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
};

export const assertBuildTarget = (target) => {
    const manifest = readDistManifest();
    const isChrome = Boolean(manifest.background?.service_worker);
    const isFirefox = Boolean(manifest.background?.scripts);

    if (target === 'chrome' && !isChrome) {
        throw new Error('dist/ is a Firefox build. Rerun without --no-build (or run npm run build:chrome).');
    }
    if (target === 'firefox' && !isFirefox) {
        throw new Error('dist/ is a Chrome build. Rerun without --no-build (or run npm run build:firefox).');
    }
};

export const sanitizeName = (value) => String(value ?? 'playlist')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'playlist';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
