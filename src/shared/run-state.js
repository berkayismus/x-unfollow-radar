/**
 * State-machine helpers for a persisted extension run.
 */
const RunStateUtils = (function () {
    'use strict';

    const ITEM_STATUS = Object.freeze({
        QUEUED: 'queued',
        ATTEMPTING: 'attempting',
        SUCCEEDED: 'succeeded',
        FAILED: 'failed'
    });

    const ALLOWED_TRANSITIONS = Object.freeze({
        [ITEM_STATUS.QUEUED]: [ITEM_STATUS.ATTEMPTING, ITEM_STATUS.FAILED],
        [ITEM_STATUS.ATTEMPTING]: [ITEM_STATUS.SUCCEEDED, ITEM_STATUS.FAILED],
        [ITEM_STATUS.SUCCEEDED]: [],
        [ITEM_STATUS.FAILED]: []
    });

    function emptySummary() {
        return {
            queued: 0,
            attempting: 0,
            realSucceeded: 0,
            dryRunSucceeded: 0,
            skipped: 0,
            failed: 0
        };
    }

    function create({ id, startedAt, dryRun }) {
        return {
            id,
            status: 'running',
            startedAt,
            updatedAt: startedAt,
            finishedAt: null,
            dryRun: !!dryRun,
            items: [],
            skipped: [],
            summary: emptySummary()
        };
    }

    function queue(run, username, timestamp, mode) {
        if (!run || run.items.some((item) => item.username === username)) return null;
        const item = {
            username,
            status: ITEM_STATUS.QUEUED,
            mode,
            reason: null,
            queuedAt: timestamp,
            attemptedAt: null,
            completedAt: null
        };
        run.items.push(item);
        run.summary.queued++;
        run.updatedAt = timestamp;
        return item;
    }

    function transition(run, username, nextStatus, timestamp, reason = null) {
        if (!run) return null;
        const item = run.items.find((candidate) => candidate.username === username);
        if (!item || !ALLOWED_TRANSITIONS[item.status]?.includes(nextStatus)) return null;

        if (item.status === ITEM_STATUS.QUEUED) run.summary.queued--;
        if (item.status === ITEM_STATUS.ATTEMPTING) run.summary.attempting--;

        item.status = nextStatus;
        item.reason = reason;
        if (nextStatus === ITEM_STATUS.ATTEMPTING) {
            item.attemptedAt = timestamp;
            run.summary.attempting++;
        } else if (nextStatus === ITEM_STATUS.SUCCEEDED) {
            item.completedAt = timestamp;
            if (item.mode === 'dry-run') run.summary.dryRunSucceeded++;
            else run.summary.realSucceeded++;
        } else if (nextStatus === ITEM_STATUS.FAILED) {
            item.completedAt = timestamp;
            run.summary.failed++;
        }

        run.updatedAt = timestamp;
        return item;
    }

    function skip(run, username, reason, timestamp, maxRecords) {
        if (!run) return null;
        const record = { username, reason, timestamp };
        run.skipped.push(record);
        if (run.skipped.length > maxRecords) run.skipped.shift();
        run.summary.skipped++;
        run.updatedAt = timestamp;
        return record;
    }

    function setStatus(run, status, timestamp, finished = false) {
        if (!run) return;
        run.status = status;
        run.updatedAt = timestamp;
        run.finishedAt = finished ? timestamp : null;
    }

    function trimCompleted(run, maxRecords) {
        if (!run || run.items.length <= maxRecords) return;
        while (run.items.length > maxRecords) {
            const index = run.items.findIndex(
                (item) => item.status === ITEM_STATUS.SUCCEEDED || item.status === ITEM_STATUS.FAILED
            );
            if (index === -1) break;
            run.items.splice(index, 1);
        }
    }

    return Object.freeze({ ITEM_STATUS, create, queue, transition, skip, setStatus, trimCompleted });
})();

if (typeof window !== 'undefined') window.RunStateUtils = RunStateUtils;
