// Pure result evaluation and reporting for the browser audit runners.

export const COLORS = {
    dark: { total: 'rgb(241, 241, 241)', played: 'rgb(170, 170, 170)' },
    light: { total: 'rgb(15, 15, 15)', played: 'rgb(96, 96, 96)' },
};

export const readCount = (text) => {
    const match = String(text ?? '').match(/\d+/);
    return match ? Number(match[0]) : NaN;
};

export const readTotal = (text) => String(text ?? '').replace(/^Total:\s*/, '');

// Browsers may serialize an opaque rgba color as either rgb(...) or rgba(..., 1).
const normalizeColor = (value) => String(value ?? '').replace(
    /^rgba\((.*),\s*1\)$/,
    'rgb($1)',
);

const themeOf = (theme) => {
    if (theme?.blockDark) return 'dark';
    if (theme?.blockLight) return 'light';
    return 'none';
};

const missingBlock = (diag) => !diag.injected || !diag.blockRect
    || diag.blockRect.width <= 0 || diag.blockRect.height <= 0;

export const evaluateStandalone = (diag) => {
    const flags = [];
    if (diag.error) flags.push(`ERROR ${diag.error}`);
    if (!diag.injected) flags.push('NOT_INJECTED');
    if (missingBlock(diag)) flags.push('ZERO_SIZE');
    if (diag.loadMoreFailed) flags.push('LOAD_MORE_NOT_REACHED');

    const uiCount = readCount(diag.ui?.count);
    const rowCount = diag.rows?.top ?? diag.rows?.visible ?? 0;
    if (!Number.isFinite(uiCount)) flags.push('NO_COUNT');
    else if (uiCount !== rowCount) flags.push(`COUNT ${uiCount}!=${rowCount}`);

    const uiTotal = readTotal(diag.ui?.total);
    if (!uiTotal) flags.push('NO_TOTAL');
    else if (uiTotal !== diag.expectedTotal) flags.push(`TOTAL ${uiTotal}!=${diag.expectedTotal}`);

    // The standalone block always sits on the playlist header artwork, so it is
    // expected to be dark in both page themes.
    const expectedTheme = 'dark';
    const actualTheme = themeOf(diag.theme);
    if (actualTheme !== expectedTheme) flags.push(`THEME ${actualTheme}!=${expectedTheme}`);

    const colors = COLORS[expectedTheme];
    if (diag.ui?.totalColor && normalizeColor(diag.ui.totalColor) !== colors.total) {
        flags.push(`COLOR total ${diag.ui.totalColor}`);
    }
    if (diag.ui?.countColor && normalizeColor(diag.ui.countColor) !== colors.played) {
        flags.push(`COLOR count ${diag.ui.countColor}`);
    }

    return {
        flags,
        headerCount: diag.headerCount ?? null,
        rows: rowCount,
        count: Number.isFinite(uiCount) ? uiCount : null,
        total: uiTotal || null,
        expectedTotal: diag.expectedTotal ?? null,
        theme: actualTheme,
    };
};

export const evaluatePlaying = (diag) => {
    const flags = [];
    if (diag.error) flags.push(`ERROR ${diag.error}`);
    if (!diag.injected) flags.push('NOT_INJECTED');
    if (missingBlock(diag)) flags.push('ZERO_SIZE');
    if (!diag.total) flags.push('NO_TOTAL');
    if (diag.rows > 0 && diag.currentRowIndex < 0) flags.push('NO_CURRENT_ROW');

    if (diag.expectedTotal && readTotal(diag.total) !== diag.expectedTotal) {
        flags.push(`TOTAL ${readTotal(diag.total)}!=${diag.expectedTotal}`);
    }
    if (diag.expectedWatched !== null && diag.watched !== diag.expectedWatched) {
        flags.push(`WATCHED ${diag.watched}!=${diag.expectedWatched}`);
    }
    const uiRemaining = String(diag.remaining ?? '').replace(/^\s*-\s*/, '').trim();
    if (diag.expectedRemaining !== null && uiRemaining !== diag.expectedRemaining) {
        flags.push(`REMAINING ${uiRemaining}!=${diag.expectedRemaining}`);
    }
    if (diag.expectedPercent !== undefined) {
        const uiPercent = readCount(diag.percent);
        if (uiPercent !== diag.expectedPercent) {
            flags.push(`PERCENT ${uiPercent}!=${diag.expectedPercent}`);
        }
    }

    const expectedTheme = diag.theme?.rootDark ? 'dark' : 'light';
    const actualTheme = themeOf(diag.theme);
    if (actualTheme !== expectedTheme) flags.push(`THEME ${actualTheme}!=${expectedTheme}`);

    const colors = COLORS[expectedTheme];
    if (diag.totalColor && normalizeColor(diag.totalColor) !== colors.total) {
        flags.push(`COLOR total ${diag.totalColor}`);
    }
    if (diag.watchedColor && normalizeColor(diag.watchedColor) !== colors.played) {
        flags.push(`COLOR watched ${diag.watchedColor}`);
    }
    if (diag.percent && diag.barWidth && diag.percent !== diag.barWidth) {
        flags.push(`PROGRESS ${diag.barWidth}!=${diag.percent}`);
    }

    return {
        flags,
        rows: diag.rows ?? null,
        total: readTotal(diag.total) || null,
        watched: diag.watched ?? null,
        remaining: uiRemaining || null,
        percent: diag.percent ?? null,
        theme: actualTheme,
    };
};

export const hasFailures = (rows) => rows.some((row) => row.flags.length > 0);

const pad = (value, width) => String(value ?? '').padEnd(width);

export const printReport = ({ engine, rows, notes = [], theme = null }) => {
    const headers = ['Playlist', 'Header', 'Rows', 'Count', 'Total', 'Expected', 'Theme', 'Flags'];
    const data = rows.map((row) => [
        row.label,
        row.result?.headerCount ?? '-',
        row.result?.rows ?? '-',
        row.result?.count ?? '-',
        row.result?.total ?? '-',
        row.result?.expectedTotal ?? '-',
        row.result?.theme ?? '-',
        row.flags.length ? row.flags.join(', ') : 'ok',
    ]);

    const widths = headers.map((header, index) => Math.max(
        header.length,
        ...data.map((line) => String(line[index] ?? '').length),
    ));

    console.log(`\nEngine: ${engine}${theme ? ` (theme: ${theme})` : ''}`);
    console.log(headers.map((header, index) => pad(header, widths[index])).join('  '));
    console.log(widths.map((width) => '-'.repeat(width)).join('  '));
    for (const line of data) {
        console.log(line.map((value, index) => pad(value, widths[index])).join('  '));
    }

    for (const note of notes) console.log(`\nNOTE: ${note}`);

    const failed = rows.filter((row) => row.flags.length > 0);
    console.log(`\n${rows.length - failed.length}/${rows.length} checks passed.`);
};

export const printJson = (payload) => {
    console.log(JSON.stringify(payload, null, 2));
};
