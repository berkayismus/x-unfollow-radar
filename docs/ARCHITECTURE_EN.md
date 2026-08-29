# X Unfollow Radar - Architecture (EN)

This document describes the high-level architecture of the X Unfollow Radar Chrome extension, its main components, and how they communicate.

## 1. Overview

- **Goal**: Scan for accounts that appear not to follow back and process them with controlled pacing in a user-started run.
- **Tech stack**:
    - Chrome Extension Manifest V3
    - Vanilla JavaScript (no framework)
    - Chrome Storage API
    - Chrome Messaging API
    - Chartist.js (charts)

The extension is split into three main parts:

1. **Content script** → Automation engine that runs on the Twitter/X page
2. **Popup** → UI for starting/stopping, filters, and statistics
3. **Background service worker** → License verification and storage migration startup

## 2. Directory Structure (Relevant Parts)

- `manifest.json`  
  Main extension manifest: defines permissions, content scripts, background worker, and popup.

- `src/content/index.js`  
  Core automation logic:
    - Scans user cells in the main column (`USER_CELL_MAIN`).
    - Adds users without the \"Follows you\" badge to a filtered processing queue.
    - Applies whitelist and keyword filters.
    - Processes queued accounts and verifies that the X confirmation dialog belongs to the target user.
    - Detects known rate-limit signals in visible X toast, alert, and dialog text and persists waiting/resume state.

- `src/popup/popup.html / popup.js / popup.css`  
  Three-tab popup UI (Main / Filters / Statistics):
    - **Main tab**: start/stop, dry-run, recent-profile opening, real-time processed user list.
    - **Filters tab**: keyword filter and whitelist management.
    - **Statistics tab**: last 30 days chart and CSV export.

- `src/background/index.js`  
  Service worker that verifies Gumroad licenses and starts storage migrations.

- `src/shared/constants.js`  
  Central configuration:
    - Timing (delays, scroll intervals, human-like pauses)
    - Limits (rolling 24-hour action limits, history retention, etc.)
    - DOM selectors and text patterns (e.g. \"Follows you\" / \"Takip ediyor\")
    - Storage keys, message types, actions, themes, locales

- `src/shared/i18n.js` + `locales/*.json`  
  Internationalization module and translation files for TR/EN/DE.
    - Detects default locale from browser language (with storage override).
    - Loads `locales/{locale}.json` via `chrome.runtime.getURL`.
    - Applies translations to elements with `data-i18n` and related attributes.

## 3. Component Communication

### 3.1 Popup → Content Script

The popup talks to the content script via `chrome.tabs.sendMessage`:

- **Start**:
    - `popup.js` sends `START`; scanning and controlled processing run in the same user-started operation.

- **Stop / Dry-run toggle / Filters**:
    - Implemented as `ACTION` messages (`STOP`, `TOGGLE_DRY_RUN`, `UPDATE_KEYWORDS`, `UPDATE_WHITELIST`).
    - The content script updates its in-memory state and mirrors changes into `chrome.storage.local`.

### 3.2 Content Script → Popup

The content script pushes updates back via `chrome.runtime.sendMessage`:

1. **Status updates** (`STATUS_UPDATE`):
    - `sendStatus(status, data)` wraps current state (session count, total unfollowed, flags) plus additional info.
    - Popup’s `handleStatusUpdate` updates UI, button states, and alerts.

2. **Per-user and persisted-run updates** (`USER_PROCESSED`, `RUN_STATE_UPDATED`):
    - Real and dry-run actions are emitted as per-user updates.
    - Skipped and failed records are represented in the persisted run state and summary.

Content-script messages reach the popup directly. The background worker does not relay status messages, preventing the same user update from being processed twice. The popup keeps one row per username and updates that row across `queued → attempting → succeeded/failed` transitions.

## 4. Main Processing Loop

The heart of the extension is `mainLoop()` in `src/content/index.js`:

1. **Initialization** – `initStorage()`:
    - Runs idempotent `schemaVersion` migrations before reading application state.
    - Reads all relevant keys from `chrome.storage.local`:
        - Successful real-action timestamps for the rolling 24-hour safety window
        - Separate rolling 24-hour and all-time dry-run counters
        - Total unfollowed count
        - Filters (keywords, whitelist)
        - Dry-run mode
        - Recent-profile queue
        - Rate limit timestamp
        - Stats and history
        - Latest run state and per-user `queued/attempting/succeeded/failed` transitions
    - Prunes each successful action timestamp individually after 24 hours and derives the safety count from the remaining records.
    - Shows dry-run counters in the primary cards while dry-run mode is enabled without consuming the real safety limit.
    - Initializes missing structures (stats, history).

2. **Scan and queue**:
    - Call `scanUsers()` to inspect currently visible user cells in the primary column.
    - For each user:
        - Extract username from the profile link.
        - Skip if already processed.
        - If user has a \"Follows you\" badge → skip.
        - Apply whitelist + keyword checks:
            - Whitelisted or matched keyword → mark as skipped (`USER_PROCESSED`), do not queue.
            - Otherwise, push the account into `unfollowQueue` and persist its queued run state.
3. **Execution in the same run**:
    - Process the `unfollowQueue`:
        - Respect the rolling 24-hour plan limit.
        - For each user, call `unfollowUser(cell)`:
            - Dry-run: simulate delay, send status and `USER_PROCESSED` (DRY_RUN), and update a separate dry-run statistic without consuming the real-operation limit.
            - Real mode: click \"Following\" and X's confirmation button automatically; combine dialog closure, button/cell changes, and visible failure signals before updating counters, history, and `USER_PROCESSED`.
    - Scroll the page using `autoScroll()` when queue empties, wait a random scroll delay, and repeat scanning.
    - Stop when:
        - 24h session limit is reached (`STATUS.LIMIT_REACHED`), or
        - No more users are found even after multiple scrolls (`STATUS.COMPLETED`), or
        - Rate limit is reached (`STATUS.RATE_LIMIT`).

## 5. Rate Limiting & Safety

- **Rate limit detection**:
    - Known patterns in visible X toast, alert, and dialog text trigger `handleRateLimit()`.
    - The function:
        - Sets `rateLimitUntil` to a future timestamp (`TIMING.RATE_LIMIT_WAIT`).
        - Persists this timestamp to storage.
        - Sets `isPaused = true`.
        - Sends a `RATE_LIMIT_HIT` message (with `remainingMinutes`) so the popup can show a countdown.

- **Automatic resume**:
    - A timeout is scheduled to re-check `rateLimitUntil`.
    - Once expired, `isPaused` is cleared and a `STATUS.RESUMED` update is sent if the extension is still running.

- **Dry-run mode**:
    - No real unfollow operations are executed when enabled.
    - The popup clearly indicates Dry Run mode in status messages.

- **Recent profiles**:
    - For each real unfollow, one of the last 10 usernames is retained locally.
    - The popup opens the selected profile in a new tab; following again remains a manual user action.

## 6. Themes and Accessibility

- **Themes**:
    - Two themes: `light` and `dark`.
    - User choice is stored under `Constants.STORAGE_KEYS.THEME`.
    - Popup reads and applies the theme via `applyTheme(theme)` by toggling the `dark-mode` class on `document.documentElement`.

- **Accessibility**:
    - ARIA attributes for all key buttons and dynamic regions:
        - `role="tab"`, `aria-selected`, `aria-controls` for tabbed navigation.
        - `role="status"` and `aria-live` for status updates and alerts.
        - Proper labels for keyword/whitelist inputs and buttons.
    - Keyboard navigation:
        - Arrow keys switch tabs via `handleTabKeyboard`.
        - Focus styles use `:focus-visible` and are tuned for both normal and high-contrast modes.

## 7. Internationalization (i18n)

- Supported locales: **Turkish (tr)**, **English (en)**, and **German (de)**.
- Startup logic in `i18n.js`:
    1. Check stored language preference in `chrome.storage.local['language']`.
    2. If none or invalid:
        - Inspect `navigator.languages` / `navigator.language`.
        - If it starts with `tr` → `tr`; if it starts with `de` → `de`; otherwise `en`.
        - Persist the detected locale to storage for future runs.
    3. Load `locales/{locale}.json` and apply translations.

- Runtime switching:
    - The popup header provides a TR/EN/DE dropdown.
    - Selecting an option calls `I18n.setLocale(locale)`, which:
        - Saves the new locale.
        - Reloads translations.
        - Re-applies `data-i18n` values across the popup.

This architecture keeps the content script focused on automation and state, while the popup focuses on user interaction and visualization, with the background worker acting as a thin communication layer between the two contexts.
