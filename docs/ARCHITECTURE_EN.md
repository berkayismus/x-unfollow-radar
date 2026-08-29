# Architecture (EN)

X Unfollow Radar is a framework-free Chrome Manifest V3 extension.

## Components

| Component                 | Responsibility                                                             |
| ------------------------- | -------------------------------------------------------------------------- |
| `src/content/index.js`    | Scans the X Following page, applies filters, and performs actions          |
| `src/popup/`              | Start/stop, Preview mode, filters, counters, and chart UI                  |
| `src/background/index.js` | Gumroad license verification and storage migration startup                 |
| `src/shared/`             | Constants, migration, DOM, detection, safety-window, and run-state helpers |
| `locales/`                | Turkish, English, and German popup strings                                 |

The background worker does not relay status messages. The content script sends updates directly to the popup, helping prevent duplicate user records.

## Processing flow

1. The popup sends `START` to the active tab.
2. The content script runs storage migration and loads saved settings.
3. It scans `UserCell` elements in the primary column.
4. It skips accounts with “Follows you,” whitelist matches, or keyword matches.
5. It processes the rest through `queued → attempting → succeeded/failed` states.
6. In real mode it verifies the target X dialog and clicks the confirmation automatically.
7. When the queue is empty it scrolls for more cards and completes when no new users appear.

`STOP`, `TOGGLE_DRY_RUN`, `UPDATE_KEYWORDS`, and `UPDATE_WHITELIST` travel from popup to content script. `STATUS_UPDATE`, `USER_PROCESSED`, and `RUN_STATE_UPDATED` travel in the other direction.

## Safety behavior

- Real actions use a random 2–5 second delay.
- The rolling 24-hour limit is 50 real actions for Free and 500 for Pro.
- Each real action leaves the safety count 24 hours after its own timestamp.
- Reset clears statistics but preserves the active real-action safety window.
- Stop aborts active waits and click chains with `AbortController`.
- Three consecutive unverifiable actions trigger the circuit breaker.
- A visible rate-limit signal starts a persisted 15-minute wait.

These controls do not guarantee that account restrictions cannot occur.

## Preview mode

The UI calls this **Preview mode**; code and storage use the internal name `dryRun`.

- Accounts use the same scan and filter flow.
- No unfollow is performed on X.
- Rolling 24-hour and all-time preview counters are stored separately.
- The real safety quota is not consumed.

## Local data

The main values in `chrome.storage.local` are:

- Real and preview timestamps and totals
- Latest run state and bounded per-user records
- 30-day real-action history and the latest 10 profiles
- Whitelist, keywords, theme, language, and Preview preference
- Rate-limit timestamp, plan, and Gumroad license data
- `schemaVersion: 4`

Reset statistics and delete all local data are separate controls. See [../PRIVACY_POLICY.md](../PRIVACY_POLICY.md) for details.

## Licensing

The popup sends `VERIFY_LICENSE` and `GET_PLAN` to the background worker. The worker verifies the key with Gumroad using `product_id`. If 24 hours have passed since the last verification, the next plan lookup revalidates entitlement; network failures can use up to a seven-day offline grace period.

## Tests

- Syntax, smoke, and unit tests
- UserCell DOM fixture tests
- Playwright unpacked-extension test
- ESLint, Prettier, package, and release checks

GitHub Actions runs the same checks on pushes and pull requests.
