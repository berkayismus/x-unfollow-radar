/**
 * @fileoverview X Unfollow Radar - Content Script
 * @description Handles the automatic unfollowing of non-followers on X
 */

/**
 * X Unfollow Radar Content Script Module
 * @namespace XUnfollowRadarContent
 */
const XUnfollowRadarContent = (function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE STATE
    // ═══════════════════════════════════════════════════════════════

    /** @type {boolean} Whether the unfollow operation is currently running */
    let isRunning = false;

    /** @type {boolean} Whether the operation is paused by a detected rate limit */
    let isPaused = false;

    /** @type {HTMLElement[]} Queue of user cells to process */
    let unfollowQueue = [];

    /** @type {Set<string>} Set of already processed usernames */
    let processedUsers = new Set();

    /** @type {number} Number of users unfollowed in current session */
    let sessionCount = 0;

    /** @type {number[]} Successful real-action timestamps inside the rolling 24-hour window */
    let actionTimestamps = [];

    /** @type {number} Total number of users unfollowed all-time */
    let totalUnfollowed = 0;

    /** @type {string[]} Keywords to skip when found in user profiles */
    let keywords = [];

    /** @type {Object<string, Object>} Whitelisted usernames that should never be unfollowed */
    let whitelist = {};

    /** @type {boolean} Whether dry-run mode is enabled (simulate without actual unfollowing) */
    let dryRunMode = false;

    /** @type {Array<{username: string, timestamp: number}>} Queue of recent unfollows for undo */
    let undoQueue = [];

    /** @type {number|null} Timestamp when rate limit expires */
    let rateLimitUntil = null;

    /** @type {number|null} Timer used to resume after a persisted rate limit */
    let rateLimitTimer = null;

    /** @type {string} Active entitlement plan */
    let currentPlan = Constants.PLANS.FREE;

    /** @type {number} Effective daily limit for the active plan */
    let sessionLimit = Constants.getSessionLimit(Constants.PLANS.FREE);

    /** @type {boolean} Prevents late async work from recreating deleted storage */
    let suppressPersistence = false;

    /** @type {AbortController|null} Cancels the active operation immediately */
    let operationController = null;

    /** @type {number} Consecutive action failures used by the circuit breaker */
    let consecutiveFailures = 0;

    /** @type {Object|null} Persisted state machine for the latest run */
    let runState = null;

    /** @type {number|null} Timestamp when current operation started */
    let operationStartedAt = null;

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Utilities
    // ═══════════════════════════════════════════════════════════════

    /**
     * Creates a promise that resolves after a random delay
     * @param {number} min - Minimum delay in milliseconds
     * @param {number} max - Maximum delay in milliseconds
     * @returns {Promise<void>} Promise that resolves after the delay
     */
    function randomDelay(min, max, signal = operationController?.signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(new DOMException('Operation aborted', 'AbortError'));
                return;
            }

            const timeout = setTimeout(
                () => {
                    signal?.removeEventListener('abort', handleAbort);
                    resolve();
                },
                Math.floor(Math.random() * (max - min + 1)) + min
            );

            function handleAbort() {
                clearTimeout(timeout);
                reject(new DOMException('Operation aborted', 'AbortError'));
            }

            signal?.addEventListener('abort', handleAbort, { once: true });
        });
    }

    /**
     * Waits until a condition is true or the timeout expires.
     * @param {function(): boolean} condition
     * @param {number} timeoutMs
     * @param {number} [intervalMs=100]
     * @returns {Promise<boolean>}
     */
    async function waitForCondition(condition, timeoutMs, intervalMs = 100, signal = operationController?.signal) {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            if (condition()) return true;
            await randomDelay(intervalMs, intervalMs, signal);
        }

        return condition();
    }

    function stopActiveOperation() {
        operationController?.abort();
        operationController = null;
    }

    async function refreshSafetyWindow(now = Date.now()) {
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.ACTION_TIMESTAMPS]);
        if (suppressPersistence) return;
        const storedTimestamps = data[Constants.STORAGE_KEYS.ACTION_TIMESTAMPS];
        const source = Array.isArray(storedTimestamps) ? storedTimestamps : actionTimestamps;
        const pruned = SafetyWindow.prune(source, now, Constants.TIMING.SESSION_DURATION);
        const changed =
            pruned.length !== source.length || pruned.some((timestamp, index) => timestamp !== source[index]);
        actionTimestamps = pruned;
        sessionCount = actionTimestamps.length;

        if (changed && !suppressPersistence) {
            await chrome.storage.local.set({
                [Constants.STORAGE_KEYS.ACTION_TIMESTAMPS]: actionTimestamps,
                [Constants.STORAGE_KEYS.SESSION_COUNT]: sessionCount,
                [Constants.STORAGE_KEYS.SESSION_START]: actionTimestamps[0] || null
            });
        }
    }

    function findRateLimitSignal() {
        return (
            Array.from(document.querySelectorAll(Constants.SELECTORS.RATE_LIMIT_SIGNAL)).find((element) =>
                DomUtils.containsAnyPattern(
                    element.innerText || element.textContent,
                    Constants.TEXT_PATTERNS.RATE_LIMIT
                )
            ) || null
        );
    }

    async function pauseIfRateLimited() {
        if (!findRateLimitSignal()) return false;
        await handleRateLimit();
        return true;
    }

    function findConfirmationDialog(username) {
        return (
            Array.from(document.querySelectorAll(Constants.SELECTORS.DIALOG)).find((dialog) =>
                DomUtils.dialogMatchesUsername(dialog, username)
            ) || null
        );
    }

    function findDialogButton(dialog, selector, patterns) {
        const selectedButton = dialog?.querySelector(selector);
        if (selectedButton) return selectedButton;

        return DomUtils.findButtonByText(dialog, patterns);
    }

    function findOpenUnfollowDialog() {
        return (
            Array.from(document.querySelectorAll(Constants.SELECTORS.DIALOG)).find((dialog) =>
                findDialogButton(
                    dialog,
                    Constants.SELECTORS.CONFIRM_BUTTON,
                    Constants.TEXT_PATTERNS.CONFIRM_UNFOLLOW_BUTTON
                )
            ) || null
        );
    }

    async function dismissUnfollowDialog(dialog) {
        if (!dialog || !document.contains(dialog)) return;
        const cancelButton = findDialogButton(
            dialog,
            Constants.SELECTORS.CANCEL_BUTTON,
            Constants.TEXT_PATTERNS.CANCEL_UNFOLLOW_BUTTON
        );
        cancelButton?.click();
        if (cancelButton) {
            await waitForCondition(() => !document.contains(dialog), Constants.TIMING.DIALOG_APPEAR_TIMEOUT);
        }
    }

    /**
     * Sends a status update message to the popup
     * @param {string} status - Status type from Constants.STATUS
     * @param {Object} [data={}] - Additional data to send with the status
     * @returns {void}
     */
    function sendStatus(status, data = {}) {
        chrome.runtime.sendMessage({
            type: Constants.MESSAGE_TYPES.STATUS_UPDATE,
            status,
            sessionCount,
            totalUnfollowed,
            ...data
        });
    }

    async function persistRunState(record = null) {
        if (!runState || suppressPersistence) return;
        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.RUN_STATE]: runState });
        chrome.runtime.sendMessage({
            type: Constants.MESSAGE_TYPES.RUN_STATE_UPDATED,
            data: { summary: runState.summary, status: runState.status, record }
        });
    }

    async function updateRunStatus(status, finished = false) {
        if (!runState) return;
        RunStateUtils.setStatus(runState, status, Date.now(), finished);
        await persistRunState();
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - User Detection
    // ═══════════════════════════════════════════════════════════════

    /**
     * Checks if a user cell contains the "Follows you" badge
     * @param {HTMLElement} userCell - The user cell DOM element
     * @returns {boolean} True if user follows back
     */
    function hasFollowsYouBadge(userCell) {
        return UserDetection.hasFollowsYouBadge(userCell, Constants.TEXT_PATTERNS);
    }

    /**
     * Determines if a user should be skipped based on whitelist or keywords
     * @param {HTMLElement} userCell - The user cell DOM element
     * @param {string} username - The username to check
     * @returns {{skip: boolean, reason: string|null}} Skip decision and reason
     */
    function shouldSkipUser(userCell, username) {
        return UserDetection.shouldSkipUser(userCell, username, whitelist, keywords);
    }

    /**
     * Finds the "Following" button within a user cell
     * @param {HTMLElement} userCell - The user cell DOM element
     * @returns {HTMLElement|null} The Following button or null if not found
     */
    function findFollowingButton(userCell) {
        return UserDetection.findFollowingButton(userCell, Constants.SELECTORS, Constants.TEXT_PATTERNS);
    }

    /**
     * Extracts the username from a user cell element
     * @param {HTMLElement} userCell - The user cell DOM element
     * @returns {string} The extracted username or 'Unknown'
     */
    function getUsernameFromCell(userCell) {
        return UserDetection.getUsernameFromCell(userCell, Constants.SELECTORS);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Storage Operations
    // ═══════════════════════════════════════════════════════════════

    /**
     * Updates daily statistics in storage
     * @async
     * @returns {Promise<void>}
     */
    async function updateDailyStats(action = Constants.USER_ACTIONS.UNFOLLOWED) {
        if (suppressPersistence) return;

        const today = new Date().toISOString().split('T')[0];
        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.UNFOLLOW_STATS]);
        if (suppressPersistence) return;
        const stats = data[Constants.STORAGE_KEYS.UNFOLLOW_STATS] || { daily: {} };

        if (!stats.daily[today]) {
            stats.daily[today] = { unfollowed: 0, dryRun: 0, timestamp: Date.now() };
        }

        if (action === Constants.USER_ACTIONS.DRY_RUN) {
            stats.daily[today].dryRun = (stats.daily[today].dryRun || 0) + 1;
        } else {
            stats.daily[today].unfollowed = (stats.daily[today].unfollowed || 0) + 1;
        }

        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.UNFOLLOW_STATS]: stats });
    }

    /**
     * Adds an unfollow action to the history
     * @async
     * @param {string} username - The unfollowed username
     * @param {string} reason - The reason for unfollowing
     * @returns {Promise<void>}
     */
    async function addToHistory(username, reason) {
        if (suppressPersistence) return;

        const data = await chrome.storage.local.get([Constants.STORAGE_KEYS.UNFOLLOW_HISTORY]);
        if (suppressPersistence) return;
        const history = data[Constants.STORAGE_KEYS.UNFOLLOW_HISTORY] || [];

        history.push({
            username,
            date: new Date().toISOString(),
            reason
        });

        // Cleanup old history
        const retentionMs = Constants.LIMITS.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - retentionMs;
        const filtered = history.filter((item) => new Date(item.date).getTime() > cutoffTime);

        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.UNFOLLOW_HISTORY]: filtered });
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Rate Limiting
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles rate limit detection and sets up recovery
     * @async
     * @returns {Promise<void>}
     */
    async function handleRateLimit() {
        if (suppressPersistence) return;

        const now = Date.now();
        rateLimitUntil = now + Constants.TIMING.RATE_LIMIT_WAIT;

        await chrome.storage.local.set({ [Constants.STORAGE_KEYS.RATE_LIMIT_UNTIL]: rateLimitUntil });

        isPaused = true;
        chrome.runtime.sendMessage({
            type: Constants.MESSAGE_TYPES.RATE_LIMIT_HIT,
            data: { until: rateLimitUntil, remainingMinutes: Constants.TIMING.RATE_LIMIT_MINUTES }
        });

        sendStatus(Constants.STATUS.RATE_LIMIT, { remainingMinutes: Constants.TIMING.RATE_LIMIT_MINUTES });

        scheduleRateLimitExpiry();
        await updateRunStatus('paused');
    }

    /**
     * Schedules a resumable timeout using the persisted expiry timestamp.
     * @returns {void}
     */
    function scheduleRateLimitExpiry() {
        if (rateLimitTimer) {
            clearTimeout(rateLimitTimer);
        }

        const remaining = Math.max(0, (rateLimitUntil || 0) - Date.now());
        rateLimitTimer = setTimeout(checkRateLimitExpiry, remaining);
    }

    /**
     * Checks if rate limit has expired and resumes operation
     * @returns {void}
     */
    function checkRateLimitExpiry() {
        const now = Date.now();
        if (rateLimitUntil && now >= rateLimitUntil) {
            console.log('Rate limit expired, resuming...');
            rateLimitUntil = null;
            rateLimitTimer = null;
            isPaused = false;
            chrome.storage.local.set({ [Constants.STORAGE_KEYS.RATE_LIMIT_UNTIL]: null });

            if (isRunning) {
                updateRunStatus('running');
                sendStatus(Constants.STATUS.RESUMED, { message: 'Rate limit cleared, resuming operation' });
            }
        } else if (rateLimitUntil) {
            isPaused = true;
            scheduleRateLimitExpiry();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Unfollow Operations
    // ═══════════════════════════════════════════════════════════════

    /**
     * Unfollows a single user
     * @async
     * @param {HTMLElement} userCell - The user cell DOM element
     * @returns {Promise<boolean>} True if unfollow was successful
     */
    async function unfollowUser(userCell) {
        const username = getUsernameFromCell(userCell);

        try {
            // Dry-run mode - simulate without actual unfollowing
            if (dryRunMode) {
                console.log(`[DRY RUN] Would unfollow ${username}`);
                await randomDelay(Constants.TIMING.MIN_DELAY, Constants.TIMING.MAX_DELAY);

                if (suppressPersistence) return false;

                sendStatus(Constants.STATUS.UNFOLLOWED, { username, dryRun: true });
                chrome.runtime.sendMessage({
                    type: Constants.MESSAGE_TYPES.USER_PROCESSED,
                    data: { username, action: Constants.USER_ACTIONS.DRY_RUN, timestamp: Date.now() }
                });

                await updateDailyStats(Constants.USER_ACTIONS.DRY_RUN);
                return true;
            }

            // A dialog left open by a previous failed/interrupted action would
            // make every subsequent username fail the target check.
            await dismissUnfollowDialog(findOpenUnfollowDialog());

            // Find and click Following button
            const followingBtn = findFollowingButton(userCell);
            if (!followingBtn) {
                console.log('Following button not found');
                return false;
            }

            followingBtn.click();
            const dialogAppeared = await waitForCondition(
                () => !!findConfirmationDialog(username),
                Constants.TIMING.DIALOG_APPEAR_TIMEOUT
            );

            if (!isRunning || isPaused) {
                return false;
            }

            // Only accept a confirmation dialog that identifies the queued user.
            const confirmationDialog = dialogAppeared ? findConfirmationDialog(username) : null;
            const confirmBtn = findDialogButton(
                confirmationDialog,
                Constants.SELECTORS.CONFIRM_BUTTON,
                Constants.TEXT_PATTERNS.CONFIRM_UNFOLLOW_BUTTON
            );
            if (confirmationDialog && confirmBtn) {
                confirmBtn.click();
                const actionSucceeded = await waitForCondition(
                    () => !document.contains(confirmationDialog) && !findFollowingButton(userCell),
                    Constants.TIMING.ACTION_VERIFY_TIMEOUT
                );

                if (!actionSucceeded) {
                    console.warn(`Unfollow could not be verified for ${username}`);
                    await dismissUnfollowDialog(confirmationDialog);
                    await pauseIfRateLimited();
                    return false;
                }

                if (suppressPersistence) return false;

                await randomDelay(Constants.TIMING.MIN_DELAY, Constants.TIMING.MAX_DELAY);

                if (suppressPersistence) return false;

                const actionTimestamp = Date.now();
                await refreshSafetyWindow(actionTimestamp);
                actionTimestamps = SafetyWindow.prune(
                    [...actionTimestamps, actionTimestamp],
                    actionTimestamp,
                    Constants.TIMING.SESSION_DURATION
                );
                sessionCount = actionTimestamps.length;
                totalUnfollowed++;

                // Add to undo queue
                undoQueue.push({
                    username,
                    timestamp: Date.now(),
                    userCell: username
                });

                // Limit undo queue size
                if (undoQueue.length > Constants.LIMITS.MAX_UNDO_QUEUE) {
                    undoQueue.shift();
                }

                await chrome.storage.local.set({
                    [Constants.STORAGE_KEYS.SESSION_COUNT]: sessionCount,
                    [Constants.STORAGE_KEYS.SESSION_START]: actionTimestamps[0],
                    [Constants.STORAGE_KEYS.ACTION_TIMESTAMPS]: actionTimestamps,
                    [Constants.STORAGE_KEYS.TOTAL_UNFOLLOWED]: totalUnfollowed,
                    [Constants.STORAGE_KEYS.LAST_RUN]: new Date().toISOString(),
                    [Constants.STORAGE_KEYS.UNDO_QUEUE]: undoQueue
                });

                await updateDailyStats();
                await addToHistory(username, Constants.USER_ACTIONS.MANUAL);

                sendStatus(Constants.STATUS.UNFOLLOWED, { username });
                chrome.runtime.sendMessage({
                    type: Constants.MESSAGE_TYPES.USER_PROCESSED,
                    data: { username, action: Constants.USER_ACTIONS.UNFOLLOWED, timestamp: Date.now() }
                });

                return true;
            }

            await pauseIfRateLimited();
            await dismissUnfollowDialog(findOpenUnfollowDialog());
            console.warn(`Confirmation dialog did not match target user: ${username}`);

            return false;
        } catch (error) {
            if (error.name === 'AbortError') return false;
            console.error('Unfollow error:', error);

            if ((error.message && error.message.includes('429')) || findRateLimitSignal()) {
                await handleRateLimit();
            }

            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Scanning & Scrolling
    // ═══════════════════════════════════════════════════════════════

    /**
     * Scans currently visible users and adds non-followers to the queue
     * Only scans users in the primary column (excludes "Who to follow" sidebar)
     * @returns {void}
     */
    async function scanUsers() {
        const userCells = document.querySelectorAll(Constants.SELECTORS.USER_CELL_MAIN);
        let newUsersFound = 0;
        let runChanged = false;

        userCells.forEach((cell) => {
            const username = getUsernameFromCell(cell);
            if (!username || username === 'Unknown') return;
            if (processedUsers.has(username)) return;

            processedUsers.add(username);

            if (!hasFollowsYouBadge(cell)) {
                const skipCheck = shouldSkipUser(cell, username);
                if (skipCheck.skip) {
                    RunStateUtils.skip(
                        runState,
                        username,
                        skipCheck.reason,
                        Date.now(),
                        Constants.LIMITS.MAX_RUN_SKIPPED_RECORDS
                    );
                    runChanged = true;
                    chrome.runtime.sendMessage({
                        type: Constants.MESSAGE_TYPES.USER_PROCESSED,
                        data: { username, action: `skipped:${skipCheck.reason}`, timestamp: Date.now() }
                    });
                    return;
                }

                unfollowQueue.push(cell);
                RunStateUtils.queue(
                    runState,
                    username,
                    Date.now(),
                    dryRunMode ? Constants.USER_ACTIONS.DRY_RUN : Constants.USER_ACTIONS.UNFOLLOWED
                );
                runChanged = true;
                newUsersFound++;
            }
        });

        if (runChanged) await persistRunState();

        if (newUsersFound > 0) {
            console.log(`Found ${newUsersFound} non-followers`);
            sendStatus(Constants.STATUS.SCANNING, { found: newUsersFound, queueSize: unfollowQueue.length });
        }
    }

    /**
     * Waits for X's virtualized list to render at least one unseen user card.
     * Resolves on timeout as well so an exhausted list can still be detected.
     * @param {Set<string>} usernamesBeforeScroll
     * @param {AbortSignal} signal
     * @returns {Promise<boolean>}
     */
    function waitForNewUserCards(usernamesBeforeScroll, signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(new DOMException('Operation aborted', 'AbortError'));
                return;
            }

            let observer;
            const timeout = setTimeout(() => finish(false), Constants.TIMING.USER_LIST_MUTATION_TIMEOUT);

            function hasNewUsername() {
                return Array.from(document.querySelectorAll(Constants.SELECTORS.USER_CELL_MAIN)).some((cell) => {
                    const username = getUsernameFromCell(cell);
                    return username !== 'Unknown' && !usernamesBeforeScroll.has(username);
                });
            }

            function handleAbort() {
                cleanup();
                reject(new DOMException('Operation aborted', 'AbortError'));
            }

            function cleanup() {
                clearTimeout(timeout);
                observer?.disconnect();
                signal?.removeEventListener('abort', handleAbort);
            }

            function finish(found) {
                cleanup();
                resolve(found);
            }

            observer = new MutationObserver(() => {
                if (hasNewUsername()) finish(true);
            });
            observer.observe(document.body, { childList: true, subtree: true });
            signal?.addEventListener('abort', handleAbort, { once: true });

            if (hasNewUsername()) finish(true);
        });
    }

    /**
     * Scrolls the page to load more users
     * @async
     * @returns {Promise<number>} The current count of user cells in primary column
     */
    async function autoScroll() {
        console.log('Scrolling...');
        const usernamesBeforeScroll = new Set(
            Array.from(document.querySelectorAll(Constants.SELECTORS.USER_CELL_MAIN))
                .map(getUsernameFromCell)
                .filter((username) => username !== 'Unknown')
        );
        const scrollRoot = document.scrollingElement || document.documentElement;
        const targetScrollTop = Math.max(
            scrollRoot.scrollHeight,
            document.documentElement.scrollHeight,
            document.body?.scrollHeight || 0
        );
        window.scrollTo(0, targetScrollTop);
        if (scrollRoot.scrollTop < targetScrollTop) {
            scrollRoot.scrollTop = targetScrollTop;
        }
        await Promise.all([
            randomDelay(
                Constants.TIMING.SCROLL_DELAY,
                Constants.TIMING.SCROLL_DELAY + Constants.TIMING.SCROLL_DELAY_EXTRA
            ),
            waitForNewUserCards(usernamesBeforeScroll, operationController?.signal)
        ]);

        const userCellsCount = document.querySelectorAll(Constants.SELECTORS.USER_CELL_MAIN).length;
        console.log('UserCells count:', userCellsCount);
        return userCellsCount;
    }

    /**
     * Checks if the page scroll is at the bottom (with small threshold)
     * @returns {boolean}
     */
    function isScrollAtBottom() {
        const el = document.scrollingElement || document.documentElement;
        const threshold = 150;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    }

    /**
     * Processes the current queue while respecting limits and pause state.
     * @async
     * @returns {Promise<boolean>} False when the run reached a terminal/pause boundary
     */
    async function processQueue() {
        while (unfollowQueue.length > 0 && isRunning && !isPaused) {
            await refreshSafetyWindow();
            if (!dryRunMode && sessionCount >= sessionLimit) {
                isRunning = false;
                await updateRunStatus('limit_reached', true);
                sendStatus(Constants.STATUS.LIMIT_REACHED);
                return false;
            }

            const userCell = unfollowQueue.shift();
            const username = userCell ? getUsernameFromCell(userCell) : null;
            if (userCell && document.contains(userCell)) {
                const attemptingRecord = RunStateUtils.transition(
                    runState,
                    username,
                    RunStateUtils.ITEM_STATUS.ATTEMPTING,
                    Date.now()
                );
                await persistRunState(attemptingRecord);
                const success = await unfollowUser(userCell);
                if (success) {
                    const succeededRecord = RunStateUtils.transition(
                        runState,
                        username,
                        RunStateUtils.ITEM_STATUS.SUCCEEDED,
                        Date.now()
                    );
                    RunStateUtils.trimCompleted(runState, Constants.LIMITS.MAX_RUN_ITEM_RECORDS);
                    await persistRunState(succeededRecord);
                    consecutiveFailures = 0;
                } else {
                    const failureReason = isPaused ? 'rate_limited' : !isRunning ? 'stopped' : 'verification_failed';
                    const failedRecord = RunStateUtils.transition(
                        runState,
                        username,
                        RunStateUtils.ITEM_STATUS.FAILED,
                        Date.now(),
                        failureReason
                    );
                    RunStateUtils.trimCompleted(runState, Constants.LIMITS.MAX_RUN_ITEM_RECORDS);
                    await persistRunState(failedRecord);

                    if (isRunning && !isPaused) {
                        consecutiveFailures++;
                        console.log('Unfollow could not be completed or verified');
                    }
                    if (isRunning && !isPaused && consecutiveFailures >= Constants.LIMITS.MAX_CONSECUTIVE_FAILURES) {
                        isRunning = false;
                        await updateRunStatus('error', true);
                        sendStatus(Constants.STATUS.ERROR, { reason: 'circuit_breaker' });
                        return false;
                    }
                }
            } else if (username) {
                const failedRecord = RunStateUtils.transition(
                    runState,
                    username,
                    RunStateUtils.ITEM_STATUS.FAILED,
                    Date.now(),
                    'dom_removed'
                );
                RunStateUtils.trimCompleted(runState, Constants.LIMITS.MAX_RUN_ITEM_RECORDS);
                await persistRunState(failedRecord);
            }
        }

        return isRunning && !isPaused;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE METHODS - Main Loop
    // ═══════════════════════════════════════════════════════════════

    /**
     * Main operation loop that coordinates scanning, scrolling, and unfollowing
     * @async
     * @returns {Promise<void>}
     */
    async function mainLoop() {
        console.log('mainLoop started, isRunning:', isRunning);
        await initStorage();
        if (!isRunning || operationController?.signal.aborted) return;
        if (!runState) {
            const startedAt = operationStartedAt || Date.now();
            runState = RunStateUtils.create({
                id: `${startedAt}-${Math.random().toString(36).slice(2, 10)}`,
                startedAt,
                dryRun: dryRunMode
            });
            if (isPaused) RunStateUtils.setStatus(runState, 'paused', Date.now());
            await persistRunState();
        }
        console.log('Storage initialized, sessionCount:', sessionCount);
        if (isPaused && rateLimitUntil) {
            const remainingMinutes = Math.ceil((rateLimitUntil - Date.now()) / 60000);
            sendStatus(Constants.STATUS.RATE_LIMIT, { remainingMinutes });
        } else {
            sendStatus(Constants.STATUS.STARTED);
        }

        let noNewUserStreak = 0;

        while (isRunning) {
            if (isPaused) {
                checkRateLimitExpiry();
                await randomDelay(Constants.TIMING.PAUSE_CHECK_INTERVAL, Constants.TIMING.PAUSE_CHECK_INTERVAL);
                continue;
            }

            await refreshSafetyWindow();

            if (!dryRunMode && sessionCount >= sessionLimit) {
                isRunning = false;
                await updateRunStatus('limit_reached', true);
                sendStatus(Constants.STATUS.LIMIT_REACHED);
                break;
            }

            const seenBeforeCycle = processedUsers.size;

            // Scan and process the current viewport before scrolling so X's
            // virtualized list cannot remove queued DOM nodes first.
            await scanUsers();
            if (!(await processQueue())) {
                if (isPaused && !rateLimitUntil) return;
                continue;
            }

            // Scroll to load more users
            await autoScroll();
            await scanUsers();
            if (!(await processQueue())) {
                if (isPaused && !rateLimitUntil) return;
                continue;
            }

            const newUniqueUsers = processedUsers.size - seenBeforeCycle;
            noNewUserStreak = newUniqueUsers === 0 ? noNewUserStreak + 1 : 0;

            const exhausted =
                noNewUserStreak >= Constants.LIMITS.MAX_EMPTY_SCANS ||
                (isScrollAtBottom() && noNewUserStreak >= Constants.LIMITS.MAX_SAME_COUNT_STREAK);

            if (exhausted && unfollowQueue.length === 0) {
                console.log('No more unique users found - exhausted following list');
                isRunning = false;
                await updateRunStatus('completed', true);
                sendStatus(Constants.STATUS.COMPLETED);
                break;
            }

            // Random pause to appear more human
            if (Math.random() < Constants.UI.HUMAN_PAUSE_PROBABILITY) {
                await randomDelay(Constants.TIMING.HUMAN_PAUSE_MIN, Constants.TIMING.HUMAN_PAUSE_MAX);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC METHODS - Initialization
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes storage and loads saved settings
     * @async
     * @returns {Promise<void>}
     */
    async function initStorage() {
        if (suppressPersistence) return;

        await StorageMigrations.migrate(chrome.storage.local, {
            maxLegacyCount: Constants.LIMITS.PRO_MAX_SESSION
        });
        if (suppressPersistence) return;

        const storageKeys = [
            Constants.STORAGE_KEYS.SESSION_COUNT,
            Constants.STORAGE_KEYS.SESSION_START,
            Constants.STORAGE_KEYS.ACTION_TIMESTAMPS,
            Constants.STORAGE_KEYS.TOTAL_UNFOLLOWED,
            Constants.STORAGE_KEYS.LAST_RUN,
            Constants.STORAGE_KEYS.KEYWORDS,
            Constants.STORAGE_KEYS.WHITELIST,
            Constants.STORAGE_KEYS.DRY_RUN_MODE,
            Constants.STORAGE_KEYS.UNDO_QUEUE,
            Constants.STORAGE_KEYS.RATE_LIMIT_UNTIL,
            Constants.STORAGE_KEYS.UNFOLLOW_STATS,
            Constants.STORAGE_KEYS.UNFOLLOW_HISTORY,
            Constants.STORAGE_KEYS.RUN_STATE
        ];

        const data = await chrome.storage.local.get(storageKeys);
        if (suppressPersistence) return;
        const now = Date.now();

        try {
            const planResult = await Promise.race([
                chrome.runtime.sendMessage({ action: Constants.ACTIONS.GET_PLAN }),
                new Promise((resolve) => setTimeout(() => resolve(null), Constants.TIMING.PLAN_LOOKUP_TIMEOUT))
            ]);
            currentPlan = planResult?.plan || Constants.PLANS.FREE;
        } catch (error) {
            console.warn('Plan could not be loaded; using free limits:', error);
            currentPlan = Constants.PLANS.FREE;
        }
        if (suppressPersistence) return;
        sessionLimit = Constants.getSessionLimit(currentPlan);

        actionTimestamps = SafetyWindow.fromStorage({
            timestamps: data[Constants.STORAGE_KEYS.ACTION_TIMESTAMPS],
            legacyCount: data[Constants.STORAGE_KEYS.SESSION_COUNT],
            legacyStart: data[Constants.STORAGE_KEYS.SESSION_START],
            now,
            durationMs: Constants.TIMING.SESSION_DURATION,
            maxLegacyCount: Constants.LIMITS.PRO_MAX_SESSION
        });
        sessionCount = actionTimestamps.length;

        totalUnfollowed = data[Constants.STORAGE_KEYS.TOTAL_UNFOLLOWED] || 0;
        keywords = data[Constants.STORAGE_KEYS.KEYWORDS] || [];
        whitelist = data[Constants.STORAGE_KEYS.WHITELIST] || {};
        dryRunMode = data[Constants.STORAGE_KEYS.DRY_RUN_MODE] || false;
        undoQueue = data[Constants.STORAGE_KEYS.UNDO_QUEUE] || [];
        rateLimitUntil = data[Constants.STORAGE_KEYS.RATE_LIMIT_UNTIL] || null;

        const storedRunState = data[Constants.STORAGE_KEYS.RUN_STATE];
        if (!isRunning && storedRunState && ['running', 'paused'].includes(storedRunState.status)) {
            RunStateUtils.setStatus(storedRunState, 'interrupted', now, true);
            await chrome.storage.local.set({ [Constants.STORAGE_KEYS.RUN_STATE]: storedRunState });
        }

        await chrome.storage.local.set({
            [Constants.STORAGE_KEYS.ACTION_TIMESTAMPS]: actionTimestamps,
            [Constants.STORAGE_KEYS.SESSION_COUNT]: sessionCount,
            [Constants.STORAGE_KEYS.SESSION_START]: actionTimestamps[0] || null
        });

        // Initialize stats if not exists
        if (!data[Constants.STORAGE_KEYS.UNFOLLOW_STATS]) {
            await chrome.storage.local.set({ [Constants.STORAGE_KEYS.UNFOLLOW_STATS]: { daily: {} } });
        }

        // Initialize history if not exists
        if (!data[Constants.STORAGE_KEYS.UNFOLLOW_HISTORY]) {
            await chrome.storage.local.set({ [Constants.STORAGE_KEYS.UNFOLLOW_HISTORY]: [] });
        }

        // Check if rate limit is still active
        if (rateLimitUntil && now < rateLimitUntil) {
            const waitTime = Math.ceil((rateLimitUntil - now) / 1000 / 60);
            console.log(`Rate limit active. Waiting ${waitTime} minutes`);
            isPaused = true;
            scheduleRateLimitExpiry();
            sendStatus(Constants.STATUS.RATE_LIMIT, { remainingMinutes: waitTime });
        } else if (rateLimitUntil) {
            rateLimitUntil = null;
            await chrome.storage.local.set({ [Constants.STORAGE_KEYS.RATE_LIMIT_UNTIL]: null });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MESSAGE LISTENER
    // ═══════════════════════════════════════════════════════════════

    /**
     * Sets up the message listener for popup communication
     * @returns {void}
     */
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case Constants.ACTIONS.START:
                    console.log('START message received');
                    if (!isRunning) {
                        stopActiveOperation();
                        operationController = new AbortController();
                        isRunning = true;
                        isPaused = false;
                        suppressPersistence = false;
                        consecutiveFailures = 0;
                        runState = null;
                        unfollowQueue = [];
                        processedUsers = new Set();
                        operationStartedAt = Date.now();
                        mainLoop().catch((err) => {
                            if (err.name === 'AbortError') return;
                            console.error('mainLoop error:', err);
                            isRunning = false;
                            updateRunStatus('error', true);
                            sendStatus(Constants.STATUS.ERROR);
                        });
                    }
                    sendResponse({ success: true });
                    break;

                case Constants.ACTIONS.STOP:
                    isRunning = false;
                    isPaused = false;
                    stopActiveOperation();
                    updateRunStatus('stopped', true);
                    sendStatus(Constants.STATUS.STOPPED);
                    sendResponse({ success: true });
                    break;

                case Constants.ACTIONS.GET_STATUS:
                    sendResponse({
                        success: true,
                        isRunning,
                        runStatus: runState?.status || null
                    });
                    break;

                case Constants.ACTIONS.UPDATE_KEYWORDS:
                    keywords = message.keywords || [];
                    chrome.storage.local.set({ [Constants.STORAGE_KEYS.KEYWORDS]: keywords });
                    sendResponse({ success: true });
                    break;

                case Constants.ACTIONS.UPDATE_WHITELIST:
                    whitelist = message.whitelist || {};
                    chrome.storage.local.set({ [Constants.STORAGE_KEYS.WHITELIST]: whitelist });
                    sendResponse({ success: true });
                    break;

                case Constants.ACTIONS.TOGGLE_DRY_RUN:
                    dryRunMode = message.enabled;
                    chrome.storage.local.set({ [Constants.STORAGE_KEYS.DRY_RUN_MODE]: dryRunMode });
                    sendResponse({ success: true });
                    break;

                case Constants.ACTIONS.RESET_STATS:
                    totalUnfollowed = 0;
                    undoQueue = [];
                    runState = null;
                    sendResponse({ success: true });
                    break;

                case Constants.ACTIONS.DELETE_ALL_DATA:
                    isRunning = false;
                    isPaused = false;
                    stopActiveOperation();
                    suppressPersistence = true;
                    sessionCount = 0;
                    actionTimestamps = [];
                    totalUnfollowed = 0;
                    undoQueue = [];
                    keywords = [];
                    whitelist = {};
                    dryRunMode = false;
                    runState = null;
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, message: 'Unknown action' });
            }
            return true;
        });
    }

    /**
     * Checks if the extension is on the correct page and initializes
     * @returns {void}
     */
    function checkPage() {
        const url = window.location.href;
        if (url.includes('/following')) {
            console.log('🚀 Twitter Auto Unfollow Extension LOADED and READY');
            console.log(`Extension version: ${chrome.runtime.getManifest().version}`);
            initStorage().then(() => {
                sendStatus(Constants.STATUS.READY);
                console.log('✅ Storage initialized');
            });
        } else {
            console.log('⚠️ Twitter Auto Unfollow Extension loaded but not on following page');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the content script
     * @returns {void}
     */
    function init() {
        console.log('🔵 Twitter Auto Unfollow Extension - content.js executing...');
        setupMessageListener();
        checkPage();
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    return {
        init,
        initStorage,
        sendStatus
    };
})();

// Auto-initialize
XUnfollowRadarContent.init();
