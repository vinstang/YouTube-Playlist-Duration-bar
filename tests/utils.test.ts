import { describe, it, expect } from 'vitest';
import { timeListToSeconds, secondsToTs, calculateTotalTime } from '../src/scripts/utils.js';

// ─── timeListToSeconds ────────────────────────────────────────────────────────

describe('timeListToSeconds', () => {
    it('returns 0 for an empty list', () => {
        expect(timeListToSeconds([])).toBe(0);
    });

    it('returns 0 for ["0:00"]', () => {
        expect(timeListToSeconds(['0:00'])).toBe(0);
    });

    it('handles MM:SS format', () => {
        expect(timeListToSeconds(['1:30'])).toBe(90);
    });

    it('handles MM:SS with double-digit minutes', () => {
        expect(timeListToSeconds(['10:00'])).toBe(600);
    });

    it('handles HH:MM:SS format', () => {
        expect(timeListToSeconds(['1:00:00'])).toBe(3600);
    });

    it('handles HH:MM:SS with non-zero minutes and seconds', () => {
        expect(timeListToSeconds(['1:01:01'])).toBe(3661);
    });

    it('sums multiple MM:SS entries', () => {
        expect(timeListToSeconds(['1:30', '2:00'])).toBe(210);
    });

    it('sums mixed HH:MM:SS and MM:SS entries', () => {
        expect(timeListToSeconds(['1:00:00', '30:00'])).toBe(5400);
    });

    it('handles zero-padded values', () => {
        expect(timeListToSeconds(['00:00'])).toBe(0);
    });
});

// ─── secondsToTs ─────────────────────────────────────────────────────────────

describe('secondsToTs', () => {
    it('returns "0:00" for 0 seconds', () => {
        expect(secondsToTs(0)).toBe('0:00');
    });

    it('zero-pads single-digit seconds', () => {
        expect(secondsToTs(9)).toBe('0:09');
    });

    it('returns "0:59" for 59 seconds', () => {
        expect(secondsToTs(59)).toBe('0:59');
    });

    it('returns "1:00" for 60 seconds', () => {
        expect(secondsToTs(60)).toBe('1:00');
    });

    it('returns "1:30" for 90 seconds', () => {
        expect(secondsToTs(90)).toBe('1:30');
    });

    it('returns "59:59" for 3599 seconds (no hours prefix)', () => {
        expect(secondsToTs(3599)).toBe('59:59');
    });

    it('returns "1:00:00" for exactly 3600 seconds (hours prefix appears)', () => {
        expect(secondsToTs(3600)).toBe('1:00:00');
    });

    it('returns "1:01:01" for 3661 seconds', () => {
        expect(secondsToTs(3661)).toBe('1:01:01');
    });

    it('returns "2:03:04" for 7384 seconds', () => {
        expect(secondsToTs(7384)).toBe('2:03:04');
    });
});

// ─── calculateTotalTime ───────────────────────────────────────────────────────

describe('calculateTotalTime', () => {
    it('returns zeros when both lists are empty', () => {
        const result = calculateTotalTime([], []);
        expect(result).toEqual({
            watchedTs: '0:00',
            remainingTs: '0:00',
            totalTs: '0:00',
            watchedPercent: 0,
        });
    });

    it('returns 0% watched when nothing is watched', () => {
        const result = calculateTotalTime([], ['1:00']);
        expect(result.watchedPercent).toBe(0);
        expect(result.watchedTs).toBe('0:00');
        expect(result.remainingTs).toBe('1:00');
        expect(result.totalTs).toBe('1:00');
    });

    it('returns 100% watched when everything is watched', () => {
        const result = calculateTotalTime(['1:00'], []);
        expect(result.watchedPercent).toBe(100);
        expect(result.watchedTs).toBe('1:00');
        expect(result.remainingTs).toBe('0:00');
        expect(result.totalTs).toBe('1:00');
    });

    it('returns 50% for an equal split', () => {
        const result = calculateTotalTime(['1:00'], ['1:00']);
        expect(result.watchedPercent).toBe(50);
        expect(result.totalTs).toBe('2:00');
    });

    it('rounds down correctly — 1 of 3 minutes watched → 33%', () => {
        const result = calculateTotalTime(['1:00'], ['1:00', '1:00']);
        expect(result.watchedPercent).toBe(33);
    });

    it('rounds up correctly — 2 of 3 minutes watched → 67%', () => {
        const result = calculateTotalTime(['1:00', '1:00'], ['1:00']);
        expect(result.watchedPercent).toBe(67);
    });

    it('computes correct timestamps across the return value', () => {
        const result = calculateTotalTime(['1:00:00'], ['30:00']);
        expect(result.watchedTs).toBe('1:00:00');
        expect(result.remainingTs).toBe('30:00');
        expect(result.totalTs).toBe('1:30:00');
        expect(result.watchedPercent).toBe(67);
    });
});
