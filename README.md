# Javis

Javis is Allan's source-owned personal command centre.

## Architecture

- GitHub Pages serves the static interface.
- Supabase provides authentication, the secure browser API, Postgres storage and row-level security.
- ChatGPT cloud automations process the command queue and email-monitoring work.
- Floot is retained only as a secondary migration/fallback source.

## Security model

The public repository contains no Supabase service-role secret. Browser requests go through the `javis-api` Supabase Edge Function. The API restricts the allowed web origin and authenticates the signed-in user before accessing Javis data. Javis database tables use row-level security.

Consequential external actions use the approval queue. Routine internal work can proceed automatically. An approval applies only to the exact action described in that approval record.

## Main data

The backend currently uses these Javis tables:

- `javis_project_streams`
- `javis_commands`
- `javis_tasks`
- `javis_notes`
- `javis_learnings`
- `javis_tester_feedback`
- `javis_approvals`
- `javis_audit_log`
- `javis_worker_state`

ThinkLink tables remain separate.

## Recovery

Git history is the source rollback trail for the interface. Javis also has a signed-in **Backup** control that exports the user's current Javis data as JSON.

If a deployment introduces a fault, restore a known-good Git commit and redeploy GitHub Pages. Do not overwrite newer Supabase data with an older backup unless the data differences have been reviewed.

## Build checks

Before treating a material change as stable:

1. Parse-check `app.js`.
2. Confirm the GitHub Pages build and deployment succeed.
3. Run Supabase security and performance advisors after database changes.
4. Test the affected signed-in flow when user authentication is available.
5. Keep browser-only capabilities such as microphone permission as explicit user-acceptance checks.

## Cost control

The production path is designed to avoid paid builder actions. Do not enable paid resources, domains or APIs without explicit approval.
