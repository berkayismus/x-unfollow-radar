/**
 * Pure helpers for the rolling 24-hour action safety window.
 */
const SafetyWindow = (function () {
    'use strict';

    function prune(timestamps, now, durationMs) {
        const cutoff = now - durationMs;
        return (Array.isArray(timestamps) ? timestamps : [])
            .filter((timestamp) => Number.isFinite(timestamp) && timestamp > cutoff)
            .sort((a, b) => a - b);
    }

    function fromStorage({ timestamps, legacyCount, legacyStart, now, durationMs, maxLegacyCount }) {
        if (Array.isArray(timestamps)) return prune(timestamps, now, durationMs);

        const count = Math.min(Math.max(0, Math.floor(Number(legacyCount) || 0)), maxLegacyCount);
        if (count === 0) return [];

        const parsedStart = Number(legacyStart);
        if (Number.isFinite(parsedStart) && parsedStart <= now - durationMs) return [];

        const safeStart = Number.isFinite(parsedStart) && parsedStart <= now ? parsedStart : now;
        return Array(count).fill(safeStart);
    }

    function nextSlotAt(timestamps, durationMs) {
        return timestamps.length > 0 ? timestamps[0] + durationMs : null;
    }

    return Object.freeze({ prune, fromStorage, nextSlotAt });
})();

if (typeof window !== 'undefined') window.SafetyWindow = SafetyWindow;
