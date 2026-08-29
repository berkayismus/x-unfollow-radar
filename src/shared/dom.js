/**
 * Small, testable helpers for interpreting X DOM text and dialogs.
 */
const DomUtils = (function () {
    'use strict';

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function containsAnyPattern(value, patterns) {
        const normalized = normalizeText(value);
        return patterns.some((pattern) => normalized.includes(normalizeText(pattern)));
    }

    function findButtonByText(root, patterns) {
        return (
            Array.from(root?.querySelectorAll?.('button, [role="button"]') || []).find((button) => {
                const buttonText = normalizeText(button.innerText || button.textContent);
                return patterns.some((pattern) => buttonText === normalizeText(pattern));
            }) || null
        );
    }

    function dialogMatchesUsername(dialog, username) {
        if (!dialog || !username) return false;

        const normalizedUsername = String(username).replace(/^@/, '').toLowerCase();
        const dialogText = normalizeText(dialog.innerText || dialog.textContent);
        if (dialogText.includes(`@${normalizedUsername}`)) return true;

        const links = dialog.querySelectorAll ? dialog.querySelectorAll('a[href]') : [];
        return Array.from(links).some((link) => {
            const href = link.getAttribute('href') || '';
            const pathUsername = href.split('/').filter(Boolean)[0] || '';
            return pathUsername.toLowerCase() === normalizedUsername;
        });
    }

    return Object.freeze({ normalizeText, containsAnyPattern, findButtonByText, dialogMatchesUsername });
})();

if (typeof window !== 'undefined') window.DomUtils = DomUtils;
