# Javis Windows Core worker

This is the free-first local worker for Javis Core. It keeps the existing Supabase backend and approval model, and adds a Windows process that can pick up deep-work jobs through the existing `javis-deep-bridge`.

## Current v1 scope

- Pull queued deep-work jobs from the existing Javis backend.
- Use a local Ollama model for read-only reasoning.
- Never claim an external action was performed unless a later, explicitly connected tool actually performs it.
- Pause commands containing consequential actions for approval.
- Write completion, failure or approval status back through the existing bridge.
- Keep the worker key and any account secrets out of Git.

## Next build steps

1. Register a local worker key securely for Allan's Windows computer.
2. Install Python and Ollama locally and select/test a model that runs well on the computer.
3. Run a bridge connectivity test and one harmless queued command.
4. Add local speech-to-text and text-to-speech as separate modules.
5. Add connector adapters one at a time for read-only checks, then approval-gated external actions.
6. Stress-test queue recovery, duplicate work prevention, network loss, stale jobs and approval continuation.
7. Only after those tests pass, merge the worker branch into the stable Core build.

## Security

Do not commit `JAVIS_WORKER_KEY`, passwords, refresh tokens, service-role keys, customer data or private business records. The public repository contains code only. Consequential actions remain approval-gated.
