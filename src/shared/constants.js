/**
 * @fileoverview Constants module for Twitter Auto Unfollow Extension
 * @description Centralizes all magic numbers, DOM selectors, and configuration values
 * @version 1.0.0
 */

/**
 * Constants namespace containing all configuration values
 * @namespace Constants
 */
const Constants = (function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // TIMING CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Timing-related constants in milliseconds
     * @constant {Object}
     */
    const TIMING = Object.freeze({
        /** Minimum delay between unfollow actions (ms) */
        MIN_DELAY: 2000,
        /** Maximum delay between unfollow actions (ms) */
        MAX_DELAY: 5000,
        /** Delay after scrolling to load new content (ms) */
        SCROLL_DELAY: 1500,
        /** Extra random scroll delay range (ms) */
        SCROLL_DELAY_EXTRA: 1000,
        /** Delay after clicking Following button (ms) */
        BUTTON_CLICK_MIN: 500,
        /** Maximum delay after clicking Following button (ms) */
        BUTTON_CLICK_MAX: 1000,
        /** Pause check interval when paused (ms) */
        PAUSE_CHECK_INTERVAL: 1000,
        /** Random human-like pause minimum (ms) */
        HUMAN_PAUSE_MIN: 5000,
        /** Random human-like pause maximum (ms) */
        HUMAN_PAUSE_MAX: 10000,
        /** Session duration - 24 hours (ms) */
        SESSION_DURATION: 24 * 60 * 60 * 1000,
        /** Rate limit wait time - 15 minutes (ms) */
        RATE_LIMIT_WAIT: 15 * 60 * 1000,
        /** Rate limit wait time in minutes */
        RATE_LIMIT_MINUTES: 15,
        /** Maximum wait for newly rendered user cards after scrolling */
        USER_LIST_MUTATION_TIMEOUT: 3000
    });

    // ═══════════════════════════════════════════════════════════════
    // LIMITS CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Limit-related constants
     * @constant {Object}
     */
    const LIMITS = Object.freeze({
        /** Maximum unfollows per 24-hour session (free plan default) */
        MAX_SESSION: 50,
        /** Free plan daily unfollow limit */
        FREE_MAX_SESSION: 50,
        /** Pro plan daily unfollow limit */
        PRO_MAX_SESSION: 500,
        /** Batch size for test mode confirmation */
        BATCH_SIZE: 50,
        /** Maximum items in undo queue */
        MAX_UNDO_QUEUE: 10,
        /** History retention in days */
        HISTORY_RETENTION_DAYS: 30,
        /** Maximum users to display in popup list */
        MAX_USER_LIST_DISPLAY: 100,
        /** Maximum skipped-user records retained for the latest run */
        MAX_RUN_SKIPPED_RECORDS: 500,
        /** Maximum action-state records retained for the latest run */
        MAX_RUN_ITEM_RECORDS: 500,
        /** Maximum candidates retained in one preview scan */
        MAX_CANDIDATES: 500,
        /** Number of scroll cycles before processing */
        SCROLL_CYCLES_BEFORE_PROCESS: 8,
        /** Users to process per cycle */
        PROCESS_BATCH_SIZE: 5,
        /** Consecutive empty scans before stopping */
        MAX_EMPTY_SCANS: 8,
        /** Same user count streak before stopping scroll */
        MAX_SAME_COUNT_STREAK: 3,
        /** Stop after this many consecutive action failures */
        MAX_CONSECUTIVE_FAILURES: 3,
        /** Days for chart display */
        CHART_DAYS: 30
    });

    // ═══════════════════════════════════════════════════════════════
    // UI CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * UI-related constants
     * @constant {Object}
     */
    const UI = Object.freeze({
        /** Scroll amount in pixels */
        SCROLL_AMOUNT: 400,
        /** Probability of random human-like pause (0-1) */
        HUMAN_PAUSE_PROBABILITY: 0.15
    });

    // ═══════════════════════════════════════════════════════════════
    // DOM SELECTORS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Twitter/X DOM selectors
     * @constant {Object}
     */
    const SELECTORS = Object.freeze({
        /** Primary column container (main content area, excludes sidebar) */
        PRIMARY_COLUMN: '[data-testid="primaryColumn"]',
        /** User cell container */
        USER_CELL: '[data-testid="UserCell"]',
        /** User cell within primary column only (excludes "Who to follow" sidebar) */
        USER_CELL_MAIN: '[data-testid="primaryColumn"] [data-testid="UserCell"]',
        /** Confirmation button for unfollow dialog */
        CONFIRM_BUTTON: '[data-testid="confirmationSheetConfirm"]',
        /** Modal dialog containing the unfollow confirmation */
        DIALOG: '[role="dialog"]',
        /** X surfaces commonly used for errors and rate-limit notices */
        RATE_LIMIT_SIGNAL: '[data-testid="toast"], [role="alert"], [role="dialog"]',
        /** Button with role attribute */
        ROLE_BUTTON: 'button[role="button"]',
        /** Link with role attribute */
        ROLE_LINK: 'a[role="link"][href*="/"]'
    });

    // ═══════════════════════════════════════════════════════════════
    // TEXT PATTERNS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Text patterns for detecting UI elements (multi-language)
     * @constant {Object}
     */
    const TEXT_PATTERNS = Object.freeze({
        /** "Follows you" badge patterns */
        FOLLOWS_YOU: ['Follows you', 'Seni takip ediyor'],
        /** "Following" button patterns */
        FOLLOWING_BUTTON: ['Following', 'Takip ediliyor'],
        /** X rate-limit/error messages in supported UI languages */
        RATE_LIMIT: [
            'rate limit',
            'too many requests',
            'try again later',
            'you have reached the limit',
            'çok fazla istek',
            'daha sonra tekrar dene',
            'işlem sınırına ulaştın',
            'zu viele anfragen',
            'später erneut versuchen'
        ]
    });

    // ═══════════════════════════════════════════════════════════════
    // STORAGE KEYS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Chrome storage key names
     * @constant {Object}
     */
    const STORAGE_KEYS = Object.freeze({
        SESSION_COUNT: 'sessionCount',
        SESSION_START: 'sessionStart',
        ACTION_TIMESTAMPS: 'actionTimestamps',
        TOTAL_UNFOLLOWED: 'totalUnfollowed',
        LAST_RUN: 'lastRun',
        TEST_MODE: 'testMode',
        TEST_COMPLETE: 'testComplete',
        TEST_COMPLETED_AT: 'testCompletedAt',
        KEYWORDS: 'keywords',
        WHITELIST: 'whitelist',
        DRY_RUN_MODE: 'dryRunMode',
        UNDO_QUEUE: 'undoQueue',
        RATE_LIMIT_UNTIL: 'rateLimitUntil',
        UNFOLLOW_STATS: 'unfollowStats',
        UNFOLLOW_HISTORY: 'unfollowHistory',
        RUN_STATE: 'runState',
        CANDIDATE_SCAN: 'candidateScan',
        THEME: 'theme',
        LANGUAGE: 'language',
        PLAN: 'plan',
        LICENSE_KEY: 'licenseKey',
        LICENSE_ACTIVATED_AT: 'licenseActivatedAt',
        LICENSE_LAST_VERIFIED_AT: 'licenseLastVerifiedAt'
    });

    // ═══════════════════════════════════════════════════════════════
    // MESSAGE TYPES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Chrome runtime message types
     * @constant {Object}
     */
    const MESSAGE_TYPES = Object.freeze({
        STATUS_UPDATE: 'STATUS_UPDATE',
        TEST_COMPLETE: 'TEST_COMPLETE',
        RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
        USER_PROCESSED: 'USER_PROCESSED',
        RUN_STATE_UPDATED: 'RUN_STATE_UPDATED',
        CANDIDATES_UPDATED: 'CANDIDATES_UPDATED'
    });

    /**
     * Message action types
     * @constant {Object}
     */
    const ACTIONS = Object.freeze({
        START: 'START',
        SCAN_CANDIDATES: 'SCAN_CANDIDATES',
        EXECUTE_SELECTED: 'EXECUTE_SELECTED',
        STOP: 'STOP',
        CONTINUE_TEST: 'CONTINUE_TEST',
        GET_STATUS: 'GET_STATUS',
        UPDATE_KEYWORDS: 'UPDATE_KEYWORDS',
        UPDATE_WHITELIST: 'UPDATE_WHITELIST',
        TOGGLE_DRY_RUN: 'TOGGLE_DRY_RUN',
        RESET_STATS: 'RESET_STATS',
        DELETE_ALL_DATA: 'DELETE_ALL_DATA',
        UNDO_LAST: 'UNDO_LAST',
        UNDO_SINGLE: 'UNDO_SINGLE',
        VERIFY_LICENSE: 'VERIFY_LICENSE',
        GET_PLAN: 'GET_PLAN'
    });

    // ═══════════════════════════════════════════════════════════════
    // STATUS TYPES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Status types for UI updates
     * @constant {Object}
     */
    const STATUS = Object.freeze({
        READY: 'ready',
        IDLE: 'idle',
        STARTED: 'started',
        SCANNING: 'scanning',
        CANDIDATE_SCANNING: 'candidate_scanning',
        CANDIDATE_SCAN_COMPLETE: 'candidate_scan_complete',
        UNFOLLOWED: 'unfollowed',
        STOPPED: 'stopped',
        COMPLETED: 'completed',
        LIMIT_REACHED: 'limit_reached',
        TEST_COMPLETE: 'test_complete',
        RATE_LIMIT: 'rate_limit',
        RESUMED: 'resumed',
        ERROR: 'error'
    });

    // ═══════════════════════════════════════════════════════════════
    // USER ACTION TYPES
    // ═══════════════════════════════════════════════════════════════

    /**
     * User action types for history/display
     * @constant {Object}
     */
    const USER_ACTIONS = Object.freeze({
        UNFOLLOWED: 'unfollowed',
        DRY_RUN: 'dry-run',
        SKIPPED_WHITELIST: 'skipped:whitelist',
        SKIPPED_KEYWORD: 'skipped:keyword',
        MANUAL: 'manual'
    });

    // ═══════════════════════════════════════════════════════════════
    // THEME TYPES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Theme types
     * @constant {Object}
     */
    const THEMES = Object.freeze({
        LIGHT: 'light',
        DARK: 'dark'
    });

    // ═══════════════════════════════════════════════════════════════
    // PLAN TYPES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Plan tier identifiers
     * @constant {Object}
     */
    const PLANS = Object.freeze({
        FREE: 'free',
        PRO: 'pro',
        EXPIRED: 'expired'
    });

    /**
     * Returns the daily operation limit for a plan.
     * Keeps popup and automation engine on the same source of truth.
     * @param {string} plan
     * @returns {number}
     */
    function getSessionLimit(plan) {
        return plan === PLANS.PRO
            ? LIMITS.PRO_MAX_SESSION
            : LIMITS.FREE_MAX_SESSION;
    }

    // ═══════════════════════════════════════════════════════════════
    // GUMROAD CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Gumroad integration settings
     * @constant {Object}
     */
    const GUMROAD = Object.freeze({
        VERIFY_URL: 'https://api.gumroad.com/v2/licenses/verify',
        PRODUCT_ID: 'XOdP9O_AruVvy5u7zkmD9Q==',
        /** License validity duration: 365 days in milliseconds */
        LICENSE_DURATION_MS: 365 * 24 * 60 * 60 * 1000,
        /** Warn user when license expires within this many days */
        EXPIRY_WARNING_DAYS: 14,
        /** Revalidate active licenses once per day */
        VERIFY_INTERVAL_MS: 24 * 60 * 60 * 1000,
        /** Keep the last valid entitlement briefly during network outages */
        OFFLINE_GRACE_MS: 7 * 24 * 60 * 60 * 1000
    });

    // ═══════════════════════════════════════════════════════════════
    // SUPPORTED LOCALES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Supported locale codes
     * @constant {Object}
     */
    const LOCALES = Object.freeze({
        TURKISH: 'tr',
        ENGLISH: 'en',
        GERMAN: 'de',
        DEFAULT: 'tr',
        SUPPORTED: ['tr', 'en', 'de']
    });

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    return Object.freeze({
        TIMING,
        LIMITS,
        UI,
        SELECTORS,
        TEXT_PATTERNS,
        STORAGE_KEYS,
        MESSAGE_TYPES,
        ACTIONS,
        STATUS,
        USER_ACTIONS,
        THEMES,
        LOCALES,
        PLANS,
        GUMROAD,
        getSessionLimit
    });
})();

// Expose globally for other scripts
if (typeof window !== 'undefined') {
    window.Constants = Constants;
}
if (typeof self !== 'undefined') {
    self.Constants = Constants;
}
