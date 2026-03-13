# X Unfollow Radar - Architecture (EN)

This document describes the high-level architecture of the X Unfollow Radar Chrome extension, its main components, and how they communicate.

## 1. Overview

- **Goal**: Detect users on Twitter/X who do not follow you back and automatically unfollow them.
- **Tech stack**:
  - Chrome Extension Manifest V3
  - Vanilla JavaScript (no framework)
  - Chrome Storage API
  - Chrome Messaging API
  - Chartist.js (charts)

The extension is split into three main parts:

1. **Content script** → Automation engine that runs on the Twitter/X page
2. **Popup** → UI for starting/stopping, filters, and statistics
3. **Background service worker** → Message relay and status broadcasting

## 2. Directory Structure (Relevant Parts)

- `manifest.json`  
  Main extension manifest: defines permissions, content scripts, background worker, popup, and web accessible resources.

- `src/content/index.js`  
  Core automation logic:
  - Scans user cells in the main column (`USER_CELL_MAIN`).
  - Queues users who do **not** have the \"Follows you\" badge.
  - Applies whitelist and keyword filters.
  - Clicks the \"Following\" button and the confirmation button to unfollow.
  - Detects rate limit situations and manages waiting / resume logic.

- `src/popup/popup.html / popup.js / popup.css`  
  Three-tab popup UI (Main / Filters / Statistics):
  - **Main tab**: start/stop, dry-run, undo, real-time processed user list.
  - **Filters tab**: keyword filter and whitelist management.
  - **Statistics tab**: last 30 days chart and CSV export.

- `src/background/index.js`  
  Service worker which receives messages from the content script (status, rate limit, test complete, user processed) and relays them to the popup.

- `src/shared/constants.js`  
  Central configuration:
  - Timing (delays, scroll intervals, human-like pauses)
  - Limits (session size, batch size, history retention, etc.)
  - DOM selectors and text patterns (e.g. \"Follows you\" / \"Takip ediyor\")
  - Storage keys, message types, actions, themes, locales

- `src/shared/i18n.js` + `locales/*.json`  
  Internationalization module and translation files for TR/EN.
  - Detects default locale from browser language (with storage override).
  - Loads `locales/{locale}.json` via `chrome.runtime.getURL`.
  - Applies translations to elements with `data-i18n` and related attributes.

## 3. Component Communication

### 3.1 Popup → Content Script

The popup talks to the content script via `chrome.tabs.sendMessage`:

- **Start**:
  - `popup.js` sends `{ action: Constants.ACTIONS.START }`.
  - The content script's message listener picks this up, sets `isRunning = true`, and starts `mainLoop()`.

- **Stop / Continue test / Dry-run toggle / Undo / Filters**:
  - All implemented as `ACTION` messages (`STOP`, `CONTINUE_TEST`, `TOGGLE_DRY_RUN`, `UNDO_LAST`, `UNDO_SINGLE`, `UPDATE_KEYWORDS`, `UPDATE_WHITELIST`).
  - The content script updates its in-memory state and mirrors changes into `chrome.storage.local`.

### 3.2 Content Script → Popup

The content script pushes updates back via `chrome.runtime.sendMessage`:

1. **Status updates** (`STATUS_UPDATE`):
   - `sendStatus(status, data)` wraps current state (session count, total unfollowed, flags) plus additional info.
   - Popup’s `handleStatusUpdate` updates UI, button states, and alerts.

2. **Per-user updates** (`USER_PROCESSED`):
   - Carries `username`, an action from `Constants.USER_ACTIONS` (unfollowed, dry-run, skipped:*), and a timestamp.
   - Popup appends entries to the \"Processed Users\" list with proper styling (success, dry-run, skipped).

The background worker simply listens for these messages and relays them to the popup, creating a loose coupling between page context (content script) and UI context (popup).

## 4. Main Processing Loop

The heart of the extension is `mainLoop()` in `src/content/index.js`:

1. **Initialization** – `initStorage()`:
   - Reads all relevant keys from `chrome.storage.local`:
     - Session counters and timestamps
     - Total unfollowed count
     - Test mode / batch completion flags
     - Filters (keywords, whitelist)
     - Dry-run mode
     - Undo queue
     - Rate limit timestamp
     - Stats and history
   - Resets the session counter if more than 24 hours have passed.
   - Initializes missing structures (stats, history).

2. **Loop**:
   - Call `scanUsers()` to inspect currently visible user cells in the primary column.
   - For each user:
     - Extract username from the profile link.
     - Skip if already processed.
     - If user has a \"Follows you\" badge → skip.
     - Apply whitelist + keyword checks:
       - Whitelisted or matched keyword → mark as skipped (`USER_PROCESSED`), do not queue.
       - Otherwise, push the cell into `unfollowQueue`.
   - Process the `unfollowQueue`:
     - Respect session and batch limits.
     - For each user, call `unfollowUser(cell)`:
       - Dry-run: simulate delay, increment counters, send status and `USER_PROCESSED` (DRY_RUN), update stats.
       - Real mode: click \"Following\" and confirmation button, update counters, store undo info in `undoQueue`, write stats/history, send status + `USER_PROCESSED` (UNFOLLOWED).
   - Scroll the page using `autoScroll()` when queue empties, wait a random scroll delay, and repeat scanning.
   - Stop when:
     - 24h session limit is reached (`STATUS.LIMIT_REACHED`), or
     - No more users are found even after multiple scrolls (`STATUS.COMPLETED`), or
     - Test batch hits 50 users and requires confirmation (`STATUS.TEST_COMPLETE`), or
     - Rate limit is reached (`STATUS.RATE_LIMIT`).

## 5. Rate Limiting & Safety

- **Rate limit detection**:
  - Any 429-like scenario (or other heuristics) triggers `handleRateLimit()`.
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

- **Undo system**:
  - For each real unfollow, an entry is added to `undoQueue` and persisted.
  - Popup can send `UNDO_LAST` or `UNDO_SINGLE` actions.
  - The extension attempts to refollow the user or at least route the user to their profile for manual follow.

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

- Supported locales: **Turkish (tr)** and **English (en)**.
- Startup logic in `i18n.js`:
  1. Check stored language preference in `chrome.storage.local['language']`.
  2. If none or invalid:
     - Inspect `navigator.languages` / `navigator.language`.
     - If it starts with `tr` → `tr`, otherwise `en`.
     - Persist the detected locale to storage for future runs.
  3. Load `locales/{locale}.json` and apply translations.

- Runtime switching:
  - The popup header provides a TR/EN dropdown.
  - Selecting an option calls `I18n.setLocale(locale)`, which:
    - Saves the new locale.
    - Reloads translations.
    - Re-applies `data-i18n` values across the popup.

This architecture keeps the content script focused on automation and state, while the popup focuses on user interaction and visualization, with the background worker acting as a thin communication layer between the two contexts.

