/**
 * Versioned and idempotent migrations for chrome.storage.local.
 */
const StorageMigrations = (function () {
    'use strict';

    const CURRENT_SCHEMA_VERSION = 2;
    const SCHEMA_VERSION_KEY = Constants.STORAGE_KEYS.SCHEMA_VERSION;

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function valuesEqual(left, right) {
        return JSON.stringify(left) === JSON.stringify(right);
    }

    function legacyActionTimestamps(snapshot, now, maxLegacyCount) {
        if (Array.isArray(snapshot.actionTimestamps)) {
            return snapshot.actionTimestamps.filter(Number.isFinite).sort((left, right) => left - right);
        }

        const count = Math.min(Math.max(0, Number(snapshot.sessionCount) || 0), maxLegacyCount);
        const timestamp = Number.isFinite(snapshot.sessionStart) ? snapshot.sessionStart : now;
        return Array(count).fill(timestamp);
    }

    function migrateVersionZero(snapshot, options) {
        const actionTimestamps = legacyActionTimestamps(snapshot, options.now, options.maxLegacyCount);
        return {
            ...snapshot,
            actionTimestamps,
            sessionCount: actionTimestamps.length,
            sessionStart: actionTimestamps[0] || null,
            unfollowStats: isPlainObject(snapshot.unfollowStats) ? snapshot.unfollowStats : { daily: {} },
            unfollowHistory: Array.isArray(snapshot.unfollowHistory) ? snapshot.unfollowHistory : [],
            keywords: Array.isArray(snapshot.keywords) ? snapshot.keywords : [],
            whitelist: isPlainObject(snapshot.whitelist) ? snapshot.whitelist : {},
            undoQueue: Array.isArray(snapshot.undoQueue) ? snapshot.undoQueue : [],
            [SCHEMA_VERSION_KEY]: 1
        };
    }

    function migrateVersionOne(snapshot) {
        const next = { ...snapshot, [SCHEMA_VERSION_KEY]: 2 };
        delete next.candidateScan;
        return next;
    }

    const migrations = Object.freeze({
        0: migrateVersionZero,
        1: migrateVersionOne
    });

    function plan(snapshot = {}, options = {}) {
        const migrationOptions = {
            now: options.now ?? Date.now(),
            maxLegacyCount: options.maxLegacyCount ?? 500
        };
        const storedVersion = Number.isInteger(snapshot[SCHEMA_VERSION_KEY]) ? snapshot[SCHEMA_VERSION_KEY] : 0;

        if (storedVersion > CURRENT_SCHEMA_VERSION) {
            return Object.freeze({
                fromVersion: storedVersion,
                toVersion: storedVersion,
                updates: Object.freeze({}),
                removals: Object.freeze([])
            });
        }

        let next = { ...snapshot };
        let version = storedVersion;
        while (version < CURRENT_SCHEMA_VERSION) {
            const migration = migrations[version];
            if (!migration) throw new Error(`Missing storage migration from schema version ${version}`);
            next = migration(next, migrationOptions);
            version = next[SCHEMA_VERSION_KEY];
        }

        const updates = {};
        Object.entries(next).forEach(([key, value]) => {
            if (!valuesEqual(snapshot[key], value)) updates[key] = value;
        });
        const removals = Object.keys(snapshot).filter((key) => !Object.prototype.hasOwnProperty.call(next, key));

        return Object.freeze({
            fromVersion: storedVersion,
            toVersion: version,
            updates: Object.freeze(updates),
            removals: Object.freeze(removals)
        });
    }

    async function migrate(storageArea, options = {}) {
        const snapshot = await storageArea.get(null);
        const migrationPlan = plan(snapshot, options);
        if (Object.keys(migrationPlan.updates).length > 0) {
            await storageArea.set(migrationPlan.updates);
        }
        if (migrationPlan.removals.length > 0) {
            await storageArea.remove(migrationPlan.removals);
        }
        return migrationPlan;
    }

    return Object.freeze({ CURRENT_SCHEMA_VERSION, plan, migrate });
})();

if (typeof window !== 'undefined') window.StorageMigrations = StorageMigrations;
if (typeof self !== 'undefined') self.StorageMigrations = StorageMigrations;
