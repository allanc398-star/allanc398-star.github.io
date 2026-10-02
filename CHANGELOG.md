# Changelog

## Source-owned base build

- Moved the primary interface to GitHub Pages.
- Moved persistent Javis data to Supabase.
- Added Allan-only authentication and row-level security.
- Added project streams, command queue, tasks, notes and verified learning.
- Added Pippa and Lexie tester-feedback display.
- Added voice dictation and spoken command-result handling.
- Added installable PWA support and offline shell.
- Added network status and manual refresh.
- Added approval queue with approve and decline controls.
- Added audit trail.
- Added command cancellation.
- Added cloud-worker heartbeat and system-health panel.
- Added signed-in JSON backup export.
- Added browser content-security restrictions.

- Added immediate Supabase local worker plus one-minute cron fallback.
- Added five-minute stale-job recovery and maintenance worker.
- Added persistent build-completion checks.
- Added automatic DOM-reference regression checking during stability work.
- Restored dropped install, backup, refresh and network-status controls.
- Restored service-worker registration and install prompt handling.
