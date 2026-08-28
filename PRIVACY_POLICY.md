# Privacy Policy - X Unfollow Radar

**Last updated: August 26, 2026**

X Unfollow Radar is a browser extension that analyzes the X/Twitter “Following” page and assists the user with managing accounts they follow. This policy describes the data used by version 2.0.3 and later.

## 1. Data processed on the device

The extension uses `chrome.storage.local` to keep the following information on the user's device:

- Timestamps of successful real actions and the latest batch confirmation retained for rolling 24-hour safety controls
- Total operation count and last-run timestamp
- Daily real-operation and dry-run statistics
- Up to 30 days of unfollow history, including X usernames, timestamps, and action reasons
- The latest run's queued, attempting, successful, failed, and skipped usernames, status timestamps, and reasons
- The latest candidate preview, including candidate usernames, visible profile preview text, selection state, and scan timestamps
- Up to 10 recently unfollowed usernames used by the “Open profile” feature
- User-created keyword filters and whitelisted X usernames
- Dry-run, language, and theme preferences
- Temporary rate-limit expiry time
- Selected plan, Gumroad license key, original activation/purchase time, and last verification time

The extension reads visible account cards, usernames, profile text, follow state, and relevant buttons from the open X/Twitter “Following” page. Page content that is not included in the history, whitelist, filters, or recent-profile list is processed transiently and is not retained after the page session ends.

## 2. Data sent to third parties

The extension does not use analytics, advertising, telemetry, or a developer-operated backend.

When a user activates or periodically revalidates a Pro license, the entered license key is sent directly to Gumroad's license verification API at `api.gumroad.com`. Gumroad may also receive standard network information such as the user's IP address and request headers as part of providing that service. The extension uses Gumroad's response to check purchase, refund, dispute, chargeback, subscription, and expiry status.

No X usernames, following lists, keyword filters, whitelist entries, history records, or X authentication credentials are sent to Gumroad by the extension.

For information about Gumroad's own processing, see [Gumroad's Privacy Policy](https://gumroad.com/privacy).

## 3. Data not accessed by the extension

The extension does not intentionally access or store:

- The user's X/Twitter password
- Private or direct messages
- Payment-card information
- Posts outside the visible information required on the Following page

The extension operates inside the user's existing X/Twitter browser session. It does not receive the user's X password.

## 4. Retention

- Unfollow history is automatically limited to the most recent 30 days.
- The recent-profile list is limited to 10 entries.
- Detailed per-user run state is limited to the latest run, retains at most 500 action records and 500 skipped-user records, and is replaced when a new run starts. Aggregate counts for that run remain complete.
- Candidate previews retain at most 500 records and are replaced when a new scan starts.
- Counters, filters, preferences, and license information remain until the user resets or deletes them, or uninstalls the extension.
- Gumroad verification records held by Gumroad are governed by Gumroad's own policies.

## 5. User controls and deletion

The popup provides two separate controls:

1. **Reset statistics** deletes the total statistic, charts, action history, recent-profile list, and latest run state. It preserves the active 24-hour safety-window count, filters, preferences, and license information.
2. **Delete all local data** clears all data owned by the extension from `chrome.storage.local`, including filters, history, preferences, rate-limit state, and license information.

Uninstalling the extension also removes its local Chrome storage according to Chrome's extension-storage behavior.

## 6. Permissions

- **storage**: Stores the local information listed in this policy.
- **activeTab**: Communicates with the active X/Twitter tab after user interaction.
- **Host access for `x.com` and `twitter.com`**: Runs the content script on Following pages and reads/modifies the visible page to perform requested actions.
- **Host access for `api.gumroad.com`**: Verifies Pro license keys when licensing features are used.

The extension does not request the Chrome `scripting` permission.

## 7. Security

Local extension storage is accessible to the extension and to anyone with sufficient access to the user's browser profile or device. License keys are stored locally so that they can be revalidated. Users should secure their browser profile and device and should not share their license keys.

No storage or network system can be guaranteed to be completely secure. The extension minimizes external transmission by sending only the license key required for Gumroad verification and by keeping X account-management data on the device.

## 8. Changes to this policy

Material changes will be reflected in this file with an updated date. Users should review the policy when installing a new version.

## 9. Contact

For questions or deletion/support issues, open an issue at:

- [GitHub repository](https://github.com/berkayismus/x-unfollow-radar)
