/**
 * Helpers for the persisted, user-approved candidate workflow.
 */
const CandidateUtils = (function () {
    'use strict';

    function create(startedAt) {
        return {
            status: 'scanning',
            startedAt,
            completedAt: null,
            candidates: [],
            excluded: { whitelist: 0, keyword: 0 },
            truncated: false
        };
    }

    function add(scan, candidate, maxCandidates) {
        if (!scan || scan.candidates.some(item => item.username === candidate.username)) return false;
        if (scan.candidates.length >= maxCandidates) {
            scan.truncated = true;
            return false;
        }
        scan.candidates.push({ ...candidate, selected: false });
        return true;
    }

    function exclude(scan, reason) {
        if (!scan) return;
        const key = reason === 'whitelist' ? 'whitelist' : 'keyword';
        scan.excluded[key] = (scan.excluded[key] || 0) + 1;
    }

    function setSelection(scan, usernames) {
        const selected = new Set(usernames || []);
        scan.candidates.forEach(candidate => {
            candidate.selected = selected.has(candidate.username);
        });
    }

    function selectedUsernames(scan) {
        return (scan?.candidates || [])
            .filter(candidate => candidate.selected)
            .map(candidate => candidate.username);
    }

    function complete(scan, timestamp) {
        scan.status = 'ready';
        scan.completedAt = timestamp;
    }

    return Object.freeze({ create, add, exclude, setSelection, selectedUsernames, complete });
})();

if (typeof window !== 'undefined') window.CandidateUtils = CandidateUtils;
