/**
 * @fileoverview X Unfollow Radar - Popup Script
 * @description Handles the popup UI, user interactions, and communication with content script
 */

/**
 * X Unfollow Radar Popup Module
 * @namespace XUnfollowRadarPopup
 */
const XUnfollowRadarPopup = (function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE STATE
    // ═══════════════════════════════════════════════════════════════

    /** @type {chrome.tabs.Tab|null} Current active tab */
    let currentTab = null;

    /** @type {boolean} Whether unfollow operation is running */
    let isRunning = false;

    /** @type {Chartist.Line|null} Chart instance */
    let chart = null;

    /** @type {number|null} Rate limit countdown interval ID */
    let rateLimitInterval = null;

    /** @type {Object<string, HTMLElement>} Cached DOM elements */
    let elements = {};

    /** @type {Set<string>} Set of displayed users to prevent duplicates */
    let displayedUsers = new Set();

    /** @type {string} Current plan tier ('free' or 'pro') */
    let currentPlan = Constants.PLANS.FREE;

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - DOM Utilities
    // ═══════════════════════════════════════════════════════════════

    /**
     * Caches all DOM elements for efficient access
     * @returns {void}
     */
    function cacheElements() {
        elements = {
            // Tabs
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),

            // Main tab
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            resetBtn: document.getElementById('resetBtn'),
            deleteAllDataBtn: document.getElementById('deleteAllDataBtn'),
            undoBtn: document.getElementById('undoBtn'),
            undoCount: document.getElementById('undoCount'),
            dryRunMode: document.getElementById('dryRunMode'),
            sessionCount: document.getElementById('sessionCount'),
            totalCount: document.getElementById('totalCount'),
            lastRun: document.getElementById('lastRun'),
            runRealCount: document.getElementById('runRealCount'),
            runDryCount: document.getElementById('runDryCount'),
            runSkippedCount: document.getElementById('runSkippedCount'),
            runFailedCount: document.getElementById('runFailedCount'),
            runStatusBadge: document.getElementById('runStatusBadge'),

            statusText: document.getElementById('statusText'),
            statusIndicator: document.getElementById('statusIndicator'),

            userList: document.getElementById('userList'),

            rateLimitAlert: document.getElementById('rateLimitAlert'),
            rateLimitCountdown: document.getElementById('rateLimitCountdown'),
            limitReachedAlert: document.getElementById('limitReachedAlert'),

            // Filters tab
            keywordInput: document.getElementById('keywordInput'),
            addKeywordBtn: document.getElementById('addKeywordBtn'),
            keywordList: document.getElementById('keywordList'),

            whitelistInput: document.getElementById('whitelistInput'),
            addWhitelistBtn: document.getElementById('addWhitelistBtn'),
            whitelistList: document.getElementById('whitelistList'),

            // Stats tab
            chartContainer: document.getElementById('chart'),
            statsEmptyState: document.getElementById('statsEmptyState'),
            exportCsvBtn: document.getElementById('exportCsvBtn'),

            // Theme
            themeToggle: document.getElementById('themeToggle'),

            // Language dropdown
            langToggle: document.getElementById('langToggle'),
            langMenu: document.getElementById('langMenu'),
            langOptions: document.querySelectorAll('.lang-option'),

            // Pro / License
            proBadge: document.getElementById('proBadge'),
            upgradeCta: document.getElementById('upgradeCta'),
            showLicenseBtn: document.getElementById('showLicenseBtn'),
            csvLockOverlay: document.getElementById('csvLockOverlay'),
            csvUpgradeBtn: document.getElementById('csvUpgradeBtn'),
            licenseSection: document.getElementById('licenseSection'),
            licenseActivated: document.getElementById('licenseActivated'),
            licenseDaysRemaining: document.getElementById('licenseDaysRemaining'),
            licenseExpiredNotice: document.getElementById('licenseExpiredNotice'),
            licenseForm: document.getElementById('licenseForm'),
            licenseKeyInput: document.getElementById('licenseKeyInput'),
            activateLicenseBtn: document.getElementById('activateLicenseBtn'),
            deactivateLicenseBtn: document.getElementById('deactivateLicenseBtn'),
            licenseError: document.getElementById('licenseError'),
            licenseExpiredBanner: document.getElementById('licenseExpiredBanner'),
            licenseExpirySoonBanner: document.getElementById('licenseExpirySoonBanner'),
            licenseExpirySoonText: document.getElementById('licenseExpirySoonText')
        };
    }

    /**
     * Creates a DOM element safely without innerHTML
     * @param {string} tag - HTML tag name
     * @param {Object} [attributes={}] - Element attributes
     * @param {string} [textContent=''] - Text content
     * @returns {HTMLElement} Created element
     */
    function createElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('aria')) {
                element.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });

        if (textContent) {
            element.textContent = textContent;
        }

        return element;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Tab Management
    // ═══════════════════════════════════════════════════════════════

    /**
     * Switches to a different tab
     * @param {string} tabName - Name of the tab to switch to
     * @returns {void}
     */
    function switchTab(tabName) {
        elements.tabBtns.forEach((btn) => {
            const isActive = btn.dataset.tab === tabName;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
            btn.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        elements.tabContents.forEach((content) => {
            const isActive = content.id === `${tabName}-tab`;
            content.classList.toggle('active', isActive);
            content.hidden = !isActive;

            if (isActive) {
                content.focus();
            }
        });

        if (tabName === 'stats') {
            renderChart();
        }
    }

    /**
     * Handles keyboard navigation for tabs
     * @param {KeyboardEvent} e - Keyboard event
     * @returns {void}
     */
    function handleTabKeyboard(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const tabs = Array.from(document.querySelectorAll('.tab-btn'));
            const currentIndex = tabs.findIndex((t) => t === document.activeElement);

            if (currentIndex === -1) return;

            const nextIndex =
                e.key === 'ArrowRight'
                    ? (currentIndex + 1) % tabs.length
                    : (currentIndex - 1 + tabs.length) % tabs.length;

            tabs[nextIndex].focus();
            tabs[nextIndex].click();
            e.preventDefault();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Status Updates
    // ═══════════════════════════════════════════════════════════════

    /**
     * Updates the status display in the UI
     * @param {string} type - Status type ('active', 'stopped', 'ready', 'error')
     * @param {string} message - Status message to display
     * @returns {void}
     */
    function updateStatus(type, message) {
        elements.statusText.textContent = message;
        elements.statusIndicator.className = 'status-indicator';

        switch (type) {
            case 'active':
                elements.statusIndicator.classList.add('active');
                break;
            case 'stopped':
                elements.statusIndicator.classList.add('stopped');
                break;
            case 'ready':
                elements.statusIndicator.classList.add('ready');
                break;
            case 'error':
                elements.statusIndicator.classList.add('stopped');
                break;
        }
    }

    /**
     * Updates the undo button display
     * @param {number} count - Number of items in undo queue
     * @returns {void}
     */
    function updateUndoButton(count) {
        elements.undoCount.textContent = count;
        elements.undoBtn.style.display = count > 0 ? 'inline-block' : 'none';
        elements.undoBtn.setAttribute('aria-label', I18n.t('aria.undoButton', { count }));
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Data Loading
    // ═══════════════════════════════════════════════════════════════

    function renderRunSummary(summary = {}, status = null) {
        elements.runRealCount.textContent = summary.realSucceeded || 0;
        elements.runDryCount.textContent = summary.dryRunSucceeded || 0;
        elements.runSkippedCount.textContent = summary.skipped || 0;
        elements.runFailedCount.textContent = summary.failed || 0;
        elements.runStatusBadge.textContent = status ? I18n.t(`runSummary.status.${status}`) : '';
    }

    function actionForRunItem(item) {
        if (item.status === RunStateUtils.ITEM_STATUS.SUCCEEDED) {
            return item.mode === Constants.USER_ACTIONS.DRY_RUN
                ? Constants.USER_ACTIONS.DRY_RUN
                : Constants.USER_ACTIONS.UNFOLLOWED;
        }
        if (item.status === RunStateUtils.ITEM_STATUS.FAILED) {
            return `failed:${item.reason || 'unknown'}`;
        }
        return item.status;
    }

    function removeDisplayedUser(username) {
        Array.from(elements.userList.querySelectorAll('li')).forEach((item) => {
            if (item.dataset.username === username) item.remove();
        });
        Array.from(displayedUsers).forEach((key) => {
            if (key.startsWith(`${username}:`)) displayedUsers.delete(key);
        });
    }

    async function loadLastRunState() {
        const data = await chrome.storage.local.get([
            Constants.STORAGE_KEYS.RUN_STATE,
            Constants.STORAGE_KEYS.WHITELIST
        ]);
        const run = data[Constants.STORAGE_KEYS.RUN_STATE];
        renderRunSummary(run?.summary, run?.status);
        elements.userList.innerHTML = '';
        displayedUsers.clear();
        if (!run) return;

        const itemRecords = (run.items || []).map((item) => ({
            username: item.username,
            action: actionForRunItem(item),
            timestamp: item.completedAt || item.attemptedAt || item.queuedAt
        }));
        const skippedRecords = (run.skipped || []).map((item) => ({
            username: item.username,
            action: `skipped:${item.reason}`,
            timestamp: item.timestamp
        }));
        const records = [...itemRecords, ...skippedRecords]
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-Constants.LIMITS.MAX_USER_LIST_DISPLAY);

        for (const record of records) {
            await addUserToList(
                record.username,
                record.action,
                record.timestamp,
                data[Constants.STORAGE_KEYS.WHITELIST] || {}
            );
        }
    }

    /**
     * Loads and displays statistics from storage
     * @async
     * @returns {Promise<void>}
     */
    async function loadStats() {
        const data = await chrome.storage.local.get([
            Constants.STORAGE_KEYS.SESSION_COUNT,
            Constants.STORAGE_KEYS.TOTAL_UNFOLLOWED,
            Constants.STORAGE_KEYS.LAST_RUN,
            Constants.STORAGE_KEYS.SESSION_START,
            Constants.STORAGE_KEYS.ACTION_TIMESTAMPS
        ]);

        const now = Date.now();
        const actionTimestamps = SafetyWindow.fromStorage({
            timestamps: data[Constants.STORAGE_KEYS.ACTION_TIMESTAMPS],
            legacyCount: data[Constants.STORAGE_KEYS.SESSION_COUNT],
            legacyStart: data[Constants.STORAGE_KEYS.SESSION_START],
            now,
            durationMs: Constants.TIMING.SESSION_DURATION,
            maxLegacyCount: Constants.LIMITS.PRO_MAX_SESSION
        });
        const sessionCount = actionTimestamps.length;
        const totalUnfollowed = data[Constants.STORAGE_KEYS.TOTAL_UNFOLLOWED] || 0;
        const lastRun = data[Constants.STORAGE_KEYS.LAST_RUN] || '-';

        await chrome.storage.local.set({
            [Constants.STORAGE_KEYS.ACTION_TIMESTAMPS]: actionTimestamps,
            [Constants.STORAGE_KEYS.SESSION_COUNT]: sessionCount,
            [Constants.STORAGE_KEYS.SESSION_START]: actionTimestamps[0] || null
        });

        const maxSession = Constants.getSessionLimit(currentPlan);
        elements.sessionCount.textContent = `${sessionCount}/${maxSession}`;
        elements.totalCount.textContent = totalUnfollowed;

        if (lastRun !== '-') {
            const date = new Date(lastRun);
            const locale = I18n.getLocale?.() || 'en';
            elements.lastRun.textContent = date.toLocaleString(locale);
        } else {
            elements.lastRun.textContent = '-';
        }

        if (sessionCount >= maxSession) {
            const nextSlotAt = SafetyWindow.nextSlotAt(actionTimestamps, Constants.TIMING.SESSION_DURATION);
            const timeLeft = (nextSlotAt || now) - now;

            if (timeLeft > 0) {
                elements.limitReachedAlert.style.display = 'block';
                const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
                const alertText = elements.limitReachedAlert.querySelector('p:last-child');
                if (alertText) {
                    alertText.textContent = I18n.t('alerts.dailyLimitDesc', { hours: hoursLeft });
                }
            }
        } else {
            elements.limitReachedAlert.style.display = 'none';
            elements.startBtn.disabled = false;
        }
    }

    /**
     * Loads keywords from storage and renders them
     * @async
     * @returns {Promise<void>}
     */
    async function loadKeywords() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.KEYWORDS]);
        const keywords = data[Constants.STORAGE_KEYS.KEYWORDS] || [];
        renderKeywordList(keywords);
    }

    /**
     * Loads whitelist from storage and renders it
     * @async
     * @returns {Promise<void>}
     */
    async function loadWhitelist() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.WHITELIST]);
        const whitelist = data[Constants.STORAGE_KEYS.WHITELIST] || {};
        renderWhitelistList(whitelist);
    }

    /**
     * Loads and applies the saved theme
     * @async
     * @returns {Promise<void>}
     */
    async function loadTheme() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.THEME]);
        const theme = data[Constants.STORAGE_KEYS.THEME] || Constants.THEMES.LIGHT;
        applyTheme(theme);
    }

    /**
     * Loads the dry-run mode setting
     * @async
     * @returns {Promise<void>}
     */
    async function loadDryRunMode() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.DRY_RUN_MODE]);
        elements.dryRunMode.checked = data[Constants.STORAGE_KEYS.DRY_RUN_MODE] || false;
    }

    /**
     * Loads the undo queue and updates the button
     * @async
     * @returns {Promise<void>}
     */
    async function loadUndoQueue() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.UNDO_QUEUE]);
        const queue = data[Constants.STORAGE_KEYS.UNDO_QUEUE] || [];
        updateUndoButton(queue.length);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Plan & License
    // ═══════════════════════════════════════════════════════════════

    /**
     * Loads the current plan from the background, updates UI accordingly
     * @async
     * @returns {Promise<void>}
     */
    async function loadPlan() {
        try {
            const result = await chrome.runtime.sendMessage({ action: Constants.ACTIONS.GET_PLAN });
            currentPlan = result.plan || Constants.PLANS.FREE;
            applyPlanUi(result.daysRemaining ?? null);
        } catch (error) {
            currentPlan = Constants.PLANS.FREE;
            applyPlanUi(null);
        }
    }

    /**
     * Updates all plan-dependent UI elements based on currentPlan
     * @param {number|null} daysRemaining - Days left on Pro license, null if not Pro
     * @returns {void}
     */
    function applyPlanUi(daysRemaining) {
        const isPro = currentPlan === Constants.PLANS.PRO;
        const isExpired = currentPlan === Constants.PLANS.EXPIRED;
        const isFree = !isPro && !isExpired;

        // Pro badge
        if (elements.proBadge) {
            elements.proBadge.style.display = isPro ? 'inline-flex' : 'none';
        }

        // Upgrade CTA (free plan only)
        if (elements.upgradeCta) {
            elements.upgradeCta.style.display = isFree ? 'flex' : 'none';
        }

        // Expired banner (replaces upgrade CTA for expired users)
        if (elements.licenseExpiredBanner) {
            elements.licenseExpiredBanner.style.display = isExpired ? 'flex' : 'none';
        }

        // Expiry soon warning (Pro with <= 14 days remaining)
        const warningSoon = isPro && daysRemaining != null && daysRemaining <= Constants.GUMROAD.EXPIRY_WARNING_DAYS;
        if (elements.licenseExpirySoonBanner) {
            elements.licenseExpirySoonBanner.style.display = warningSoon ? 'flex' : 'none';
        }
        if (warningSoon && elements.licenseExpirySoonText) {
            elements.licenseExpirySoonText.textContent = I18n.t('license.expiresSoon', { days: daysRemaining });
        }

        // CSV lock
        if (isPro) {
            unlockCsvExport();
        } else {
            lockCsvExport();
        }

        // License section state
        if (isPro) {
            showLicenseActivatedState(daysRemaining);
        } else if (isExpired) {
            showLicenseExpiredState();
        }

        // Session limit display
        const limitEl = elements.sessionCount;
        if (limitEl) {
            const maxSession = Constants.getSessionLimit(currentPlan);
            const parts = limitEl.textContent.split('/');
            limitEl.textContent = `${parts[0] || '0'}/${maxSession}`;
        }
    }

    /**
     * Locks CSV export — shows lock overlay, disables the button
     * @returns {void}
     */
    function lockCsvExport() {
        if (elements.csvLockOverlay) {
            elements.csvLockOverlay.style.display = 'flex';
        }
        if (elements.exportCsvBtn) {
            elements.exportCsvBtn.style.visibility = 'hidden';
        }
    }

    /**
     * Unlocks CSV export — hides lock overlay, enables the button
     * @returns {void}
     */
    function unlockCsvExport() {
        if (elements.csvLockOverlay) {
            elements.csvLockOverlay.style.display = 'none';
        }
        if (elements.exportCsvBtn) {
            elements.exportCsvBtn.style.visibility = 'visible';
        }
    }

    /**
     * Shows the license section panel
     * @returns {void}
     */
    function showLicenseSection() {
        if (elements.licenseSection) {
            elements.licenseSection.style.display = 'block';
            elements.licenseSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Updates the license section to show the activated state with days remaining
     * @param {number|null} daysRemaining
     * @returns {void}
     */
    function showLicenseActivatedState(daysRemaining) {
        if (elements.licenseSection) {
            elements.licenseSection.style.display = 'block';
        }
        if (elements.licenseActivated) {
            elements.licenseActivated.style.display = 'flex';
        }
        if (elements.licenseExpiredNotice) {
            elements.licenseExpiredNotice.style.display = 'none';
        }
        if (elements.licenseForm) {
            elements.licenseForm.style.display = 'none';
        }
        if (elements.licenseDaysRemaining && daysRemaining != null) {
            const isWarning = daysRemaining <= Constants.GUMROAD.EXPIRY_WARNING_DAYS;
            elements.licenseDaysRemaining.textContent = I18n.t('license.daysRemaining', { days: daysRemaining });
            elements.licenseDaysRemaining.className = 'license-days-remaining' + (isWarning ? ' warning' : '');
        } else if (elements.licenseDaysRemaining) {
            elements.licenseDaysRemaining.textContent = '';
        }
    }

    /**
     * Updates the license section to show the expired state
     * @returns {void}
     */
    function showLicenseExpiredState() {
        if (elements.licenseSection) {
            elements.licenseSection.style.display = 'block';
        }
        if (elements.licenseActivated) {
            elements.licenseActivated.style.display = 'none';
        }
        if (elements.licenseExpiredNotice) {
            elements.licenseExpiredNotice.style.display = 'flex';
        }
        if (elements.licenseForm) {
            elements.licenseForm.style.display = 'none';
        }
    }

    /**
     * Handles the Activate License button click
     * @async
     * @returns {Promise<void>}
     */
    async function handleActivateLicense() {
        const key = elements.licenseKeyInput?.value?.trim();
        if (!key) return;

        elements.activateLicenseBtn.disabled = true;
        elements.activateLicenseBtn.textContent = I18n.t('license.activating');
        if (elements.licenseError) {
            elements.licenseError.style.display = 'none';
        }

        try {
            const result = await chrome.runtime.sendMessage({
                action: Constants.ACTIONS.VERIFY_LICENSE,
                licenseKey: key
            });

            if (result.success) {
                currentPlan = Constants.PLANS.PRO;
                applyPlanUi(result.daysRemaining ?? null);
                updateStatus('ready', `✓ ${I18n.t('license.success')}`);
            } else {
                if (elements.licenseError) {
                    elements.licenseError.textContent = I18n.t('license.error');
                    elements.licenseError.style.display = 'block';
                }
            }
        } catch (error) {
            if (elements.licenseError) {
                elements.licenseError.textContent = I18n.t('license.error');
                elements.licenseError.style.display = 'block';
            }
        } finally {
            elements.activateLicenseBtn.disabled = false;
            elements.activateLicenseBtn.textContent = I18n.t('license.activate');
        }
    }

    /**
     * Handles the Deactivate License button click
     * @async
     * @returns {Promise<void>}
     */
    async function handleDeactivateLicense() {
        await chrome.storage.local.remove([
            Constants.STORAGE_KEYS.PLAN,
            Constants.STORAGE_KEYS.LICENSE_KEY,
            Constants.STORAGE_KEYS.LICENSE_ACTIVATED_AT,
            Constants.STORAGE_KEYS.LICENSE_LAST_VERIFIED_AT
        ]);
        currentPlan = Constants.PLANS.FREE;
        applyPlanUi(null);
        if (elements.licenseActivated) {
            elements.licenseActivated.style.display = 'none';
        }
        if (elements.licenseForm) {
            elements.licenseForm.style.display = 'block';
        }
        if (elements.licenseKeyInput) {
            elements.licenseKeyInput.value = '';
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Event Handlers
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles the start button click
     * @async
     * @returns {Promise<void>}
     */
    async function handleStart() {
        if (!currentTab) return;

        try {
            await chrome.tabs.sendMessage(currentTab.id, { action: Constants.ACTIONS.START });
            isRunning = true;
            elements.startBtn.style.display = 'none';
            elements.stopBtn.style.display = 'block';
            elements.userList.innerHTML = '';
            displayedUsers.clear();
            updateStatus('active', `🔄 ${I18n.t('status.processing')}...`);
        } catch (error) {
            console.error('Failed to start:', error);
            if (confirm(I18n.t('messages.confirmReload'))) {
                await chrome.tabs.reload(currentTab.id);
                updateStatus('ready', `🔄 ${I18n.t('messages.pageReloaded')}`);
            } else {
                updateStatus('error', `❌ ${I18n.t('messages.startFailed')}`);
            }
        }
    }

    /**
     * Handles the stop button click
     * @async
     * @returns {Promise<void>}
     */
    async function handleStop() {
        if (!currentTab) return;

        try {
            await chrome.tabs.sendMessage(currentTab.id, { action: Constants.ACTIONS.STOP });
            isRunning = false;
            elements.startBtn.style.display = 'block';
            elements.stopBtn.style.display = 'none';
            updateStatus('stopped', `⏸ ${I18n.t('status.stopped')}`);
        } catch (error) {
            console.error('Failed to stop:', error);
        }
    }

    /**
     * Resets statistics while preserving the active safety window, filters,
     * preferences and license.
     * @async
     * @returns {Promise<void>}
     */
    async function handleReset() {
        if (isRunning) {
            alert(I18n.t('messages.stopBeforeReset'));
            return;
        }

        if (confirm(I18n.t('messages.confirmReset'))) {
            await chrome.storage.local.set({
                [Constants.STORAGE_KEYS.TOTAL_UNFOLLOWED]: 0,
                [Constants.STORAGE_KEYS.LAST_RUN]: null,
                [Constants.STORAGE_KEYS.UNDO_QUEUE]: [],
                [Constants.STORAGE_KEYS.UNFOLLOW_STATS]: { daily: {} },
                [Constants.STORAGE_KEYS.UNFOLLOW_HISTORY]: [],
                [Constants.STORAGE_KEYS.RUN_STATE]: null
            });

            try {
                if (currentTab) {
                    await chrome.tabs.sendMessage(currentTab.id, { action: Constants.ACTIONS.RESET_STATS });
                }
            } catch (_) {
                /* Content script may not be active. */
            }

            elements.totalCount.textContent = '0';
            elements.lastRun.textContent = '-';
            elements.userList.innerHTML = '';
            displayedUsers.clear(); // Clear the tracking Set
            updateUndoButton(0);
            renderRunSummary();

            updateStatus('ready', `✓ ${I18n.t('status.reset')}`);
        }
    }

    /**
     * Deletes every value owned by the extension, including filters,
     * preferences and license information.
     * @async
     * @returns {Promise<void>}
     */
    async function handleDeleteAllData() {
        if (!confirm(I18n.t('messages.confirmDeleteAllData'))) return;

        try {
            if (currentTab) {
                await chrome.tabs.sendMessage(currentTab.id, { action: Constants.ACTIONS.DELETE_ALL_DATA });
            }
        } catch (_) {
            /* Content script may not be active. */
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
        await chrome.storage.local.clear();
        window.location.reload();
    }

    /**
     * Opens the most recently unfollowed user's profile for manual re-follow.
     * The queue entry is retained because opening a profile is not an undo.
     * @async
     * @returns {Promise<void>}
     */
    async function handleUndo() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.UNDO_QUEUE]);
        const queue = data[Constants.STORAGE_KEYS.UNDO_QUEUE] || [];

        if (queue.length === 0) {
            alert(I18n.t('messages.noUndoAction'));
            return;
        }

        const lastUser = queue[queue.length - 1];

        // Open profile so user can re-follow
        const profileUrl = `https://x.com/${lastUser.username}`;
        await chrome.tabs.create({ url: profileUrl });

        updateStatus('ready', `↗ ${I18n.t('messages.profileOpened')}: @${lastUser.username}`);
    }

    /**
     * Handles dry-run mode toggle
     * @async
     * @param {Event} e - Change event
     * @returns {Promise<void>}
     */
    async function handleDryRunToggle(e) {
        const enabled = e.target.checked;

        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.DRY_RUN_MODE]: enabled });

        try {
            await chrome.tabs.sendMessage(currentTab.id, {
                action: Constants.ACTIONS.TOGGLE_DRY_RUN,
                enabled
            });
        } catch (error) {
            console.log('Content script not loaded, but settings saved');
        }

        if (enabled) {
            updateStatus('ready', `🧪 ${I18n.t('messages.dryRunActive')}`);
        } else {
            updateStatus('ready', `✓ ${I18n.t('messages.normalMode')}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Keyword Handlers
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles adding a new keyword
     * @async
     * @returns {Promise<void>}
     */
    async function handleAddKeyword() {
        const keyword = elements.keywordInput.value.trim();
        if (!keyword) return;

        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.KEYWORDS]);
        const keywords = data[Constants.STORAGE_KEYS.KEYWORDS] || [];

        if (!keywords.includes(keyword.toLowerCase())) {
            keywords.push(keyword.toLowerCase());
            await chrome.storage.local.set({ [Constants.STORAGE_KEYS.KEYWORDS]: keywords });

            try {
                await chrome.tabs.sendMessage(currentTab.id, {
                    action: Constants.ACTIONS.UPDATE_KEYWORDS,
                    keywords
                });
            } catch (error) {
                console.log('Content script not loaded, but settings saved');
            }

            renderKeywordList(keywords);
        }

        elements.keywordInput.value = '';
    }

    /**
     * Handles removing a keyword
     * @async
     * @param {string} keyword - Keyword to remove
     * @returns {Promise<void>}
     */
    async function handleRemoveKeyword(keyword) {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.KEYWORDS]);
        const keywords = data[Constants.STORAGE_KEYS.KEYWORDS] || [];

        const filtered = keywords.filter((k) => k !== keyword);
        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.KEYWORDS]: filtered });

        try {
            await chrome.tabs.sendMessage(currentTab.id, {
                action: Constants.ACTIONS.UPDATE_KEYWORDS,
                keywords: filtered
            });
        } catch (error) {
            console.log('Content script not loaded, but settings saved');
        }

        renderKeywordList(filtered);
    }

    /**
     * Renders the keyword list in the UI
     * @param {string[]} keywords - Array of keywords
     * @returns {void}
     */
    function renderKeywordList(keywords) {
        elements.keywordList.innerHTML = '';

        keywords.forEach((keyword) => {
            const li = createElement('li');

            const span = createElement('span', {}, keyword);
            li.appendChild(span);

            const removeBtn = createElement(
                'button',
                {
                    className: 'remove-btn',
                    'aria-label': I18n.t('aria.removeKeyword', { keyword }),
                    dataset: { keyword }
                },
                '✕'
            );

            removeBtn.addEventListener('click', () => handleRemoveKeyword(keyword));
            li.appendChild(removeBtn);

            elements.keywordList.appendChild(li);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Whitelist Handlers
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles adding a user to whitelist
     * @async
     * @returns {Promise<void>}
     */
    async function handleAddWhitelist() {
        let username = elements.whitelistInput.value.trim();
        if (!username) return;

        username = username.replace('@', '').toLowerCase();

        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.WHITELIST]);
        const whitelist = data[Constants.STORAGE_KEYS.WHITELIST] || {};

        if (!whitelist[username]) {
            whitelist[username] = { addedDate: Date.now() };
            await chrome.storage.local.set({ [Constants.STORAGE_KEYS.WHITELIST]: whitelist });

            try {
                await chrome.tabs.sendMessage(currentTab.id, {
                    action: Constants.ACTIONS.UPDATE_WHITELIST,
                    whitelist
                });
            } catch (error) {
                console.log('Content script not loaded, but settings saved');
            }

            renderWhitelistList(whitelist);
        }

        elements.whitelistInput.value = '';
    }

    /**
     * Handles removing a user from whitelist
     * @async
     * @param {string} username - Username to remove
     * @returns {Promise<void>}
     */
    async function handleRemoveWhitelist(username) {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.WHITELIST]);
        const whitelist = data[Constants.STORAGE_KEYS.WHITELIST] || {};

        delete whitelist[username];
        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.WHITELIST]: whitelist });

        try {
            await chrome.tabs.sendMessage(currentTab.id, {
                action: Constants.ACTIONS.UPDATE_WHITELIST,
                whitelist
            });
        } catch (error) {
            console.log('Content script not loaded, but settings saved');
        }

        renderWhitelistList(whitelist);
    }

    /**
     * Renders the whitelist in the UI
     * @param {Object<string, Object>} whitelist - Whitelist object
     * @returns {void}
     */
    function renderWhitelistList(whitelist) {
        elements.whitelistList.innerHTML = '';

        Object.keys(whitelist).forEach((username) => {
            const li = createElement('li');

            const span = createElement('span', {}, `@${username}`);
            li.appendChild(span);

            const removeBtn = createElement(
                'button',
                {
                    className: 'remove-btn',
                    'aria-label': I18n.t('aria.removeWhitelist', { username }),
                    dataset: { username }
                },
                '✕'
            );

            removeBtn.addEventListener('click', () => handleRemoveWhitelist(username));
            li.appendChild(removeBtn);

            elements.whitelistList.appendChild(li);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Theme Handlers
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles theme toggle
     * @async
     * @returns {Promise<void>}
     */
    async function handleThemeToggle() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        const newTheme = isDark ? Constants.THEMES.LIGHT : Constants.THEMES.DARK;

        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.THEME]: newTheme });
        applyTheme(newTheme);
    }

    /**
     * Applies the specified theme to the document
     * @param {string} theme - Theme to apply ('light' or 'dark')
     * @returns {void}
     */
    function applyTheme(theme) {
        const isDark = theme === Constants.THEMES.DARK;

        document.documentElement.classList.toggle('dark-mode', isDark);
        elements.themeToggle.textContent = isDark ? '☀️' : '🌙';
        elements.themeToggle.setAttribute('aria-pressed', isDark);
        elements.themeToggle.setAttribute('aria-label', I18n.t('aria.themeToggle'));
    }

    /**
     * Handles language dropdown button click (open/close menu)
     * @param {MouseEvent} e
     */
    function handleLanguageToggle(e) {
        e.stopPropagation();
        if (!elements.langMenu) return;
        const isHidden = elements.langMenu.hasAttribute('hidden');
        if (isHidden) {
            elements.langMenu.removeAttribute('hidden');
            elements.langToggle.setAttribute('aria-expanded', 'true');
        } else {
            elements.langMenu.setAttribute('hidden', '');
            elements.langToggle.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Handles selecting a specific locale from dropdown
     * @param {MouseEvent} e
     */
    async function handleLanguageSelect(e) {
        const btn = e.currentTarget;
        const locale = btn?.dataset?.locale;
        if (!locale) return;

        await I18n.setLocale(locale);
        applyAriaLabels();

        if (elements.langMenu) {
            elements.langMenu.setAttribute('hidden', '');
        }
        if (elements.langToggle) {
            elements.langToggle.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Closes language dropdown when clicking outside
     * @param {MouseEvent} e
     */
    function handleDocumentClick(e) {
        if (!elements.langMenu || !elements.langToggle) return;
        if (elements.langMenu.hasAttribute('hidden')) return;

        const target = e.target;
        if (target === elements.langToggle || elements.langMenu.contains(target)) {
            return;
        }
        elements.langMenu.setAttribute('hidden', '');
        elements.langToggle.setAttribute('aria-expanded', 'false');
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Chart & Export
    // ═══════════════════════════════════════════════════════════════

    /**
     * Renders the statistics chart
     * @async
     * @returns {Promise<void>}
     */
    async function renderChart() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.UNFOLLOW_STATS]);
        const stats = data[Constants.STORAGE_KEYS.UNFOLLOW_STATS] || { daily: {} };

        const labels = [];
        const series = [];

        for (let i = Constants.LIMITS.CHART_DAYS - 1; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            labels.push(date.getDate() + '/' + (date.getMonth() + 1));
            series.push(stats.daily[dateStr]?.unfollowed || 0);
        }

        const hasAnyData = series.some((v) => v > 0);
        if (elements.statsEmptyState) {
            elements.statsEmptyState.style.display = hasAnyData ? 'none' : 'block';
        }
        if (elements.chartContainer) {
            elements.chartContainer.style.display = hasAnyData ? 'block' : 'none';
        }
        if (elements.exportCsvBtn) {
            elements.exportCsvBtn.disabled = !hasAnyData;
        }

        if (!hasAnyData) {
            return;
        }

        if (chart) {
            chart.update({ labels, series: [series] });
        } else {
            chart = new Chartist.Line(
                elements.chartContainer,
                {
                    labels,
                    series: [series]
                },
                {
                    fullWidth: true,
                    chartPadding: { right: 20 },
                    low: 0,
                    showArea: true,
                    axisX: {
                        labelInterpolationFnc: function (value, index) {
                            // Keep labels readable: show roughly weekly ticks
                            const step = 7;
                            return index % step === 0 ? value : null;
                        }
                    }
                }
            );
        }
    }

    /**
     * Handles CSV export
     * @async
     * @returns {Promise<void>}
     */
    async function handleExportCsv() {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.UNFOLLOW_HISTORY]);
        const history = data[Constants.STORAGE_KEYS.UNFOLLOW_HISTORY] || [];

        if (history.length === 0) {
            alert(I18n.t('messages.noHistory'));
            return;
        }

        const rows = [
            ['Username', 'Date', 'Reason'],
            ...history.map((item) => [item.username, item.date, item.reason])
        ];
        const csvContent = `\uFEFF${CsvUtils.serialize(rows)}`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `x-unfollow-radar-history-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - User List
    // ═══════════════════════════════════════════════════════════════

    /**
     * Adds a user to the processed users list
     * @async
     * @param {string} username - Username to add
     * @param {string} action - Action performed (unfollowed, dry-run, skipped)
     * @param {number} timestamp - Timestamp of the action
     * @returns {Promise<void>}
     */
    async function addUserToList(username, action, timestamp, knownWhitelist = null) {
        // Create unique key for this user+action combination
        const userKey = `${username}:${action}`;

        // Check for duplicates using Set (more reliable than DOM query)
        if (displayedUsers.has(userKey)) {
            return; // Skip duplicate
        }

        // Add to tracking Set
        displayedUsers.add(userKey);

        const li = createElement('li');
        const time = new Date(timestamp).toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Check if user is already in whitelist
        const data =
            knownWhitelist === null ? await chrome.storage.local.get([Constants.STORAGE_KEYS.WHITELIST]) : null;
        const whitelist = knownWhitelist || data?.[Constants.STORAGE_KEYS.WHITELIST] || {};
        const cleanUsername = username.replace('@', '').toLowerCase();
        const isInWhitelist = !!whitelist[cleanUsername];

        let icon = '';
        let className = '';
        let statusLabel = '';

        if (action === Constants.USER_ACTIONS.UNFOLLOWED) {
            icon = '✓';
            className = 'unfollowed';
            statusLabel = I18n.t('userList.succeeded');
        } else if (action === Constants.USER_ACTIONS.DRY_RUN) {
            icon = '🧪';
            className = 'dry-run';
            statusLabel = I18n.t('userList.dryRunSucceeded');
        } else if (action.startsWith('skipped:')) {
            icon = '⊘';
            className = 'skipped';
            statusLabel = I18n.t('userList.skipped');
        } else if (action === RunStateUtils.ITEM_STATUS.QUEUED) {
            icon = '○';
            className = 'queued';
            statusLabel = I18n.t('userList.queued');
        } else if (action === RunStateUtils.ITEM_STATUS.ATTEMPTING) {
            icon = '…';
            className = 'attempting';
            statusLabel = I18n.t('userList.attempting');
        } else if (action.startsWith('failed:')) {
            icon = '✕';
            className = 'failed';
            statusLabel = I18n.t('userList.failed');
        }

        li.className = className;
        li.dataset.username = username;
        li.dataset.action = action;

        // Build the list item using DOM methods
        const iconSpan = createElement(
            'span',
            {
                className: 'user-icon',
                title: statusLabel,
                'aria-label': statusLabel
            },
            icon
        );
        const nameSpan = createElement('span', { className: 'user-name' }, `@${username}`);
        const timeSpan = createElement('span', { className: 'user-time' }, time);
        const actionsDiv = createElement('div', { className: 'user-actions' });

        li.appendChild(iconSpan);
        li.appendChild(nameSpan);
        li.appendChild(timeSpan);

        // Add undo button for unfollowed users
        if (action === Constants.USER_ACTIONS.UNFOLLOWED) {
            const undoBtn = createElement(
                'button',
                {
                    className: 'action-btn undo-btn',
                    title: I18n.t('userList.undoBtn'),
                    'aria-label': I18n.t('aria.undoUser', { username })
                },
                '↶'
            );
            undoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleUndoSingleUser(username);
            });
            actionsDiv.appendChild(undoBtn);
        }

        // Add whitelist button if not in whitelist
        if (!isInWhitelist) {
            const whitelistBtn = createElement(
                'button',
                {
                    className: 'action-btn whitelist-btn',
                    title: I18n.t('userList.addToWhitelist'),
                    'aria-label': I18n.t('aria.whitelistUser', { username })
                },
                '⭐'
            );
            whitelistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAddToWhitelistFromList(username, whitelistBtn);
            });
            actionsDiv.appendChild(whitelistBtn);
        }

        li.appendChild(actionsDiv);
        elements.userList.appendChild(li);

        // Limit list size
        if (elements.userList.children.length > Constants.LIMITS.MAX_USER_LIST_DISPLAY) {
            elements.userList.removeChild(elements.userList.firstChild);
        }

        elements.userList.scrollTop = elements.userList.scrollHeight;
    }

    /**
     * Opens a user's profile so the user can manually re-follow them.
     * @async
     * @param {string} username - Username whose profile should be opened
     * @returns {Promise<void>}
     */
    async function handleUndoSingleUser(username) {
        // Open profile so user can re-follow
        await chrome.tabs.create({ url: `https://x.com/${username}` });

        updateStatus('ready', `↗ ${I18n.t('messages.profileOpened')}: @${username}`);
    }

    /**
     * Handles adding a user to whitelist from the list
     * @async
     * @param {string} username - Username to whitelist
     * @param {HTMLElement} btnElement - Button element
     * @returns {Promise<void>}
     */
    async function handleAddToWhitelistFromList(username, btnElement) {
        const cleanUsername = username.replace('@', '').toLowerCase();

        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.WHITELIST]);
        const whitelist = data[Constants.STORAGE_KEYS.WHITELIST] || {};

        if (!whitelist[cleanUsername]) {
            whitelist[cleanUsername] = { addedDate: Date.now() };
            await chrome.storage.local.set({ [Constants.STORAGE_KEYS.WHITELIST]: whitelist });

            try {
                await chrome.tabs.sendMessage(currentTab.id, {
                    action: Constants.ACTIONS.UPDATE_WHITELIST,
                    whitelist
                });
            } catch (error) {
                console.log('Content script not loaded, but settings saved');
            }

            renderWhitelistList(whitelist);

            btnElement.textContent = '✓';
            btnElement.disabled = true;
            btnElement.classList.add('added');
            btnElement.title = I18n.t('userList.addedToWhitelist');

            updateStatus('ready', `⭐ ${I18n.t('messages.addedToWhitelist')}: @${cleanUsername}`);
        } else {
            btnElement.textContent = '✓';
            btnElement.disabled = true;
            btnElement.classList.add('added');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Message Handling
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles messages from the content script
     * @param {Object} message - Message object
     * @returns {void}
     */
    function handleMessage(message) {
        switch (message.type) {
            case Constants.MESSAGE_TYPES.STATUS_UPDATE:
                handleStatusUpdate(message);
                break;
            case Constants.MESSAGE_TYPES.RATE_LIMIT_HIT:
                handleRateLimitMessage(message.data);
                break;
            case Constants.MESSAGE_TYPES.USER_PROCESSED:
                addUserToList(message.data.username, message.data.action, message.data.timestamp);
                loadUndoQueue();
                break;
            case Constants.MESSAGE_TYPES.RUN_STATE_UPDATED:
                renderRunSummary(message.data.summary, message.data.status);
                if (message.data.record?.username) {
                    const record = message.data.record;
                    removeDisplayedUser(record.username);
                    addUserToList(
                        record.username,
                        actionForRunItem(record),
                        record.completedAt || record.attemptedAt || record.queuedAt
                    );
                }
                break;
        }
    }

    /**
     * Handles status update messages
     * @param {Object} data - Status update data
     * @returns {void}
     */
    function handleStatusUpdate(data) {
        if (data.sessionCount !== undefined) {
            const maxSession = Constants.getSessionLimit(currentPlan);
            elements.sessionCount.textContent = `${data.sessionCount}/${maxSession}`;
        }

        if (data.totalUnfollowed !== undefined) {
            elements.totalCount.textContent = data.totalUnfollowed;
        }

        switch (data.status) {
            case Constants.STATUS.STARTED:
                updateStatus('active', `🔄 ${I18n.t('status.processing')}...`);
                break;
            case Constants.STATUS.SCANNING:
                updateStatus(
                    'active',
                    `🔍 ${I18n.t('status.scanning')}... (${data.queueSize || 0} ${I18n.t('aria.found')})`
                );
                break;
            case Constants.STATUS.UNFOLLOWED:
                const prefix = data.dryRun ? '[DRY RUN] ' : '';
                updateStatus('active', `${prefix}✓ ${I18n.t('messages.unfollowed')}: @${data.username || 'user'}`);
                break;
            case Constants.STATUS.STOPPED:
                updateStatus('stopped', `⏸ ${I18n.t('status.stopped')}`);
                isRunning = false;
                elements.startBtn.style.display = 'block';
                elements.stopBtn.style.display = 'none';
                break;
            case Constants.STATUS.COMPLETED:
                updateStatus('ready', `✅ ${I18n.t('status.completed')}`);
                isRunning = false;
                elements.startBtn.style.display = 'block';
                elements.stopBtn.style.display = 'none';
                break;
            case Constants.STATUS.LIMIT_REACHED:
                updateStatus('stopped', `🚫 ${I18n.t('alerts.dailyLimitReached')}`);
                elements.limitReachedAlert.style.display = 'block';
                isRunning = false;
                elements.startBtn.style.display = 'block';
                elements.stopBtn.style.display = 'none';
                elements.startBtn.disabled = false;
                break;
            case Constants.STATUS.READY:
                updateStatus('ready', `✓ ${I18n.t('status.ready')}`);
                break;
            case Constants.STATUS.IDLE:
                isRunning = false;
                elements.startBtn.style.display = 'block';
                elements.stopBtn.style.display = 'none';
                updateStatus('ready', `✓ ${I18n.t('status.ready')}`);
                break;
            case Constants.STATUS.RATE_LIMIT:
                handleRateLimitMessage({
                    remainingMinutes: data.remainingMinutes || Constants.TIMING.RATE_LIMIT_MINUTES
                });
                break;
            case Constants.STATUS.RESUMED:
                elements.rateLimitAlert.style.display = 'none';
                isRunning = true;
                elements.startBtn.style.display = 'none';
                elements.stopBtn.style.display = 'block';
                updateStatus('active', `🔄 ${I18n.t('status.processing')}...`);
                break;
            case Constants.STATUS.ERROR:
                isRunning = false;
                elements.startBtn.style.display = 'block';
                elements.stopBtn.style.display = 'none';
                updateStatus(
                    'stopped',
                    `⚠️ ${I18n.t(
                        data.reason === 'circuit_breaker' ? 'messages.tooManyFailures' : 'messages.operationFailed'
                    )}`
                );
                break;
        }

        loadStats();
    }

    /**
     * Handles rate limit notification
     * @param {Object} data - Rate limit data
     * @returns {void}
     */
    function handleRateLimitMessage(data) {
        elements.rateLimitAlert.style.display = 'block';
        updateStatus('stopped', `🚫 ${I18n.t('alerts.rateLimit')}`);
        isRunning = true;
        elements.startBtn.style.display = 'none';
        elements.stopBtn.style.display = 'block';

        let remainingSeconds = data.remainingMinutes * 60;

        if (rateLimitInterval) {
            clearInterval(rateLimitInterval);
        }

        rateLimitInterval = setInterval(() => {
            remainingSeconds--;

            if (remainingSeconds <= 0) {
                clearInterval(rateLimitInterval);
                elements.rateLimitAlert.style.display = 'none';
                updateStatus('ready', `✓ ${I18n.t('status.ready')}`);
                return;
            }

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            elements.rateLimitCountdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} ${I18n.t('aria.rateLimitCountdown')}`;
        }, 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Accessibility
    // ═══════════════════════════════════════════════════════════════

    /**
     * Applies ARIA labels to interactive elements
     * @returns {void}
     */
    function applyAriaLabels() {
        // Start button
        if (elements.startBtn) {
            elements.startBtn.setAttribute('aria-label', I18n.t('aria.startButton'));
        }

        // Stop button
        if (elements.stopBtn) {
            elements.stopBtn.setAttribute('aria-label', I18n.t('aria.stopButton'));
        }

        // Reset button
        if (elements.resetBtn) {
            elements.resetBtn.setAttribute('aria-label', I18n.t('aria.resetButton'));
        }

        if (elements.deleteAllDataBtn) {
            elements.deleteAllDataBtn.setAttribute('aria-label', I18n.t('aria.deleteAllDataButton'));
        }

        // Theme toggle
        if (elements.themeToggle) {
            elements.themeToggle.setAttribute('aria-label', I18n.t('aria.themeToggle'));
        }

        // Language toggle
        if (elements.langToggle) {
            elements.langToggle.setAttribute('aria-label', I18n.t('aria.languageToggle'));
        }

        // Export button
        if (elements.exportCsvBtn) {
            elements.exportCsvBtn.setAttribute('aria-label', I18n.t('aria.exportCsvButton'));
        }

        // Keyword input
        if (elements.keywordInput) {
            elements.keywordInput.setAttribute('aria-label', I18n.t('aria.keywordInput'));
        }

        // Whitelist input
        if (elements.whitelistInput) {
            elements.whitelistInput.setAttribute('aria-label', I18n.t('aria.whitelistInput'));
        }

        // Add keyword button
        if (elements.addKeywordBtn) {
            elements.addKeywordBtn.setAttribute('aria-label', I18n.t('aria.addKeywordButton'));
        }

        // Add whitelist button
        if (elements.addWhitelistBtn) {
            elements.addWhitelistBtn.setAttribute('aria-label', I18n.t('aria.addWhitelistButton'));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Event Listeners Setup
    // ═══════════════════════════════════════════════════════════════

    /**
     * Sets up all event listeners
     * @returns {void}
     */
    function setupEventListeners() {
        // Tab switching with click
        elements.tabBtns.forEach((btn) => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Tab keyboard navigation
        const tabContainer = document.querySelector('.tabs');
        if (tabContainer) {
            tabContainer.addEventListener('keydown', handleTabKeyboard);
        }

        // Main controls
        elements.startBtn.addEventListener('click', handleStart);
        elements.stopBtn.addEventListener('click', handleStop);
        elements.resetBtn.addEventListener('click', handleReset);
        elements.deleteAllDataBtn.addEventListener('click', handleDeleteAllData);
        elements.undoBtn.addEventListener('click', handleUndo);
        elements.dryRunMode.addEventListener('change', handleDryRunToggle);

        // Filters
        elements.addKeywordBtn.addEventListener('click', handleAddKeyword);
        elements.keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddKeyword();
        });

        elements.addWhitelistBtn.addEventListener('click', handleAddWhitelist);
        elements.whitelistInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddWhitelist();
        });

        // Stats
        elements.exportCsvBtn.addEventListener('click', handleExportCsv);

        // Pro / License
        if (elements.showLicenseBtn) {
            elements.showLicenseBtn.addEventListener('click', showLicenseSection);
        }
        if (elements.csvUpgradeBtn) {
            elements.csvUpgradeBtn.addEventListener('click', showLicenseSection);
        }
        if (elements.activateLicenseBtn) {
            elements.activateLicenseBtn.addEventListener('click', handleActivateLicense);
        }
        if (elements.deactivateLicenseBtn) {
            elements.deactivateLicenseBtn.addEventListener('click', handleDeactivateLicense);
        }

        // Theme
        elements.themeToggle.addEventListener('click', handleThemeToggle);

        // Language
        elements.langToggle.addEventListener('click', handleLanguageToggle);
        elements.langOptions.forEach((option) => {
            option.addEventListener('click', handleLanguageSelect);
        });

        document.addEventListener('click', handleDocumentClick);

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener(handleMessage);
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the popup
     * @async
     * @returns {Promise<void>}
     */
    async function init() {
        // Cache DOM elements first
        cacheElements();

        await StorageMigrations.migrate(chrome.storage.local, {
            maxLegacyCount: Constants.LIMITS.PRO_MAX_SESSION
        });

        // Initialize i18n
        await I18n.init();

        // Load plan first so plan-dependent renders are correct
        await loadPlan();

        // Load data — always, regardless of which page is open
        await loadStats();
        await loadKeywords();
        await loadWhitelist();
        await loadTheme();
        await loadDryRunMode();
        await loadUndoQueue();
        await loadLastRunState();

        // Setup event listeners — always
        setupEventListeners();

        // Apply ARIA labels
        applyAriaLabels();

        // Get current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];

        const onTwitter =
            currentTab?.url && (currentTab.url.includes('twitter.com') || currentTab.url.includes('x.com'));
        const onFollowing = onTwitter && currentTab.url.includes('/following');

        if (!onTwitter) {
            updateStatus('error', `❌ ${I18n.t('messages.notOnTwitter')}`);
            elements.startBtn.disabled = true;
            return;
        }

        if (!onFollowing) {
            updateStatus('error', `❌ ${I18n.t('messages.goToFollowing')}`);
            elements.startBtn.disabled = true;
            return;
        }

        // Check if content script is loaded and sync button state
        try {
            const response = await chrome.tabs.sendMessage(currentTab.id, { action: Constants.ACTIONS.GET_STATUS });
            if (response && response.isRunning) {
                isRunning = true;
                elements.startBtn.style.display = 'none';
                elements.stopBtn.style.display = 'block';
            } else {
                isRunning = false;
                elements.startBtn.style.display = 'block';
                elements.stopBtn.style.display = 'none';
            }
            updateStatus('ready', `✓ ${I18n.t('status.ready')}`);
        } catch (error) {
            console.log('Content script not loaded yet');
            isRunning = false;
            elements.startBtn.style.display = 'block';
            elements.stopBtn.style.display = 'none';
            updateStatus('ready', `⚠️ ${I18n.t('status.ready')}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RETURN PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    return {
        init
    };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    XUnfollowRadarPopup.init();
});
