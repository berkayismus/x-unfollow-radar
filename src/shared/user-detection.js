/**
 * Pure, fixture-testable helpers for interpreting X user cells.
 */
const UserDetection = (function () {
    'use strict';

    function cellText(userCell) {
        return String(userCell?.innerText || userCell?.textContent || '');
    }

    function getUsernameFromCell(userCell, selectors) {
        const link = userCell?.querySelector(selectors.ROLE_LINK);
        if (!link) return 'Unknown';

        const pathSegments = (link.getAttribute('href') || '').split('/').filter(Boolean);
        return pathSegments[0] || 'Unknown';
    }

    function hasFollowsYouBadge(userCell, patterns) {
        const text = cellText(userCell);
        return patterns.FOLLOWS_YOU.some((pattern) => text.includes(pattern));
    }

    function findFollowingButton(userCell, selectors, patterns) {
        const buttons = userCell?.querySelectorAll(selectors.ROLE_BUTTON) || [];
        return (
            Array.from(buttons).find((button) => {
                const text = cellText(button);
                return patterns.FOLLOWING_BUTTON.some((pattern) => text.includes(pattern));
            }) || null
        );
    }

    function shouldSkipUser(userCell, username, whitelist = {}, keywords = []) {
        const normalizedUsername = String(username || '')
            .toLowerCase()
            .replace(/^@/, '');
        if (whitelist[normalizedUsername]) {
            return { skip: true, reason: 'whitelist' };
        }

        const text = cellText(userCell).toLowerCase();
        const matchingKeyword = keywords.find((keyword) => text.includes(String(keyword).toLowerCase()));
        if (matchingKeyword) {
            return { skip: true, reason: `keyword:${matchingKeyword}` };
        }

        return { skip: false, reason: null };
    }

    function inspectCandidate(userCell, options) {
        const username = getUsernameFromCell(userCell, options.selectors);
        const skipDecision = shouldSkipUser(userCell, username, options.whitelist, options.keywords);

        return Object.freeze({
            username,
            followsYou: hasFollowsYouBadge(userCell, options.patterns),
            followingButton: findFollowingButton(userCell, options.selectors, options.patterns),
            skip: skipDecision.skip,
            skipReason: skipDecision.reason
        });
    }

    return Object.freeze({
        getUsernameFromCell,
        hasFollowsYouBadge,
        findFollowingButton,
        shouldSkipUser,
        inspectCandidate
    });
})();

if (typeof window !== 'undefined') window.UserDetection = UserDetection;
