# Privacy Policy — X Unfollow Radar

**Last updated:** August 29, 2026 · **Documented version:** 2.0.4

X Unfollow Radar analyzes the visible X/Twitter Following page and performs actions requested by the user.

## Data stored on the device

The extension uses `chrome.storage.local` for:

- Rolling 24-hour real-action and preview timestamps
- Real-action and preview totals and daily statistics
- Up to 30 days of real unfollow history, including usernames and timestamps
- The latest run's queued, attempted, successful, failed, and skipped user records; at most 500 action and 500 skipped records
- Up to 10 recently unfollowed usernames for **Open profile**
- Keyword filters and whitelisted usernames
- Preview mode, language, and theme preferences
- Temporary rate-limit expiry time
- Plan, Gumroad license key, activation time, and last verification time

Visible usernames, profile text, follow state, and controls are read from the open Following page. Page data not saved in the items above is processed only during the page session.

## Data sent outside the device

The extension has no analytics, advertising, telemetry, or developer-operated backend.

When Pro is activated or revalidated, the license key is sent directly to Gumroad's license API at `api.gumroad.com`. Gumroad may also receive normal connection data such as the IP address and request headers. The response is used to evaluate purchase, refund, dispute, chargeback, subscription, and expiry status.

X usernames, following lists, filters, history, page content, and X credentials are not sent to Gumroad by the extension. See [Gumroad's Privacy Policy](https://gumroad.com/privacy) for Gumroad's own practices.

## Data not intentionally accessed

- X/Twitter passwords
- Direct messages
- Payment-card information
- Posts outside the visible information needed on the Following page

The extension works inside the user's existing X session and never receives the X password.

## Retention and deletion

- Real unfollow history is limited to 30 days.
- The recent-profile list is limited to 10 entries.
- Detailed user records belong only to the latest run and use the limits stated above.
- Real and preview timestamps leave their rolling counters after 24 hours.
- **Reset statistics** clears totals, preview counters, charts, history, recent profiles, and latest run state. It preserves the active real-action safety window, filters, preferences, and license.
- **Delete all local data** clears all extension-owned `chrome.storage.local` data.
- Uninstalling the extension removes its local extension storage according to Chrome behavior.

Gumroad retains its own verification records under its policies.

## Permissions

- `storage`: Save the local data listed above.
- `activeTab`: Communicate with the active X tab after user interaction.
- `x.com` and `twitter.com` host access: Run on Following pages and read or modify the visible controls needed for requested actions.
- `api.gumroad.com` host access: Verify Pro licenses.

The extension does not request the `scripting` permission.

## Security

Local data and license keys may be accessible to anyone with sufficient access to the user's browser profile or device. Users should secure both and should not share license keys. No storage or network system can be guaranteed completely secure.

## Changes and contact

Material policy changes will update this file and its date. For questions or deletion/support issues, use the [GitHub repository](https://github.com/berkayismus/x-unfollow-radar/issues).
