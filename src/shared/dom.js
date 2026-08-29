/**
 * Small, testable helpers for interpreting X DOM text and dialogs.
 */
const DomUtils = (function () {
    'use strict';

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
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

    function findButtons(root, selector, patterns) {
        const selectedButtons = Array.from(root?.querySelectorAll?.(selector) || []);
        const textButtons = Array.from(root?.querySelectorAll?.('button, [role="button"]') || []).filter((button) => {
            const buttonText = normalizeText(button.innerText || button.textContent);
            return patterns.some((pattern) => buttonText === normalizeText(pattern));
        });

        return Array.from(new Set([...selectedButtons, ...textButtons]));
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

    function findUsernameAncestor(element, username, boundary) {
        let current = element?.parentElement || null;

        while (current && current !== boundary && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
            if (dialogMatchesUsername(current, username)) return current;
            current = current.parentElement;
        }

        return null;
    }

    /**
     * Finds X's current unfollow confirmation action across dialog and sheet variants.
     * A username match is preferred. A unique confirmation button is returned as a
     * fallback so callers can safely use it immediately after opening the dialog.
     */
    function findDialogAction(root, { dialogSelector, buttonSelector, buttonPatterns, username } = {}) {
        if (!root || !dialogSelector || !buttonSelector || !Array.isArray(buttonPatterns)) return null;

        const dialogs = Array.from(root.querySelectorAll?.(dialogSelector) || []);
        if (username) {
            const matchingDialog = dialogs.find(
                (dialog) =>
                    dialogMatchesUsername(dialog, username) &&
                    findButtons(dialog, buttonSelector, buttonPatterns).length
            );
            if (matchingDialog) {
                return {
                    dialog: matchingDialog,
                    button: findButtons(matchingDialog, buttonSelector, buttonPatterns)[0],
                    matchedUsername: true
                };
            }
        }

        const buttons = findButtons(root, buttonSelector, buttonPatterns);
        if (buttons.length !== 1) return null;

        const button = buttons[0];
        const usernameAncestor = username ? findUsernameAncestor(button, username, root.body) : null;
        const declaredDialog = button.closest?.(dialogSelector) || null;

        return {
            dialog: usernameAncestor || declaredDialog,
            button,
            matchedUsername: Boolean(
                usernameAncestor || (username && declaredDialog && dialogMatchesUsername(declaredDialog, username))
            )
        };
    }

    return Object.freeze({
        normalizeText,
        containsAnyPattern,
        findButtonByText,
        findButtons,
        dialogMatchesUsername,
        findDialogAction
    });
})();

if (typeof window !== 'undefined') window.DomUtils = DomUtils;
