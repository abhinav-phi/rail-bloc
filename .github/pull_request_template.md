<!--
Thanks for contributing to RAIL-BLOC. Keep the PR small; one logical change per PR.
Link the tracked issue so the audit trail stays intact (Fixes #NNN).
-->

## What does this PR change?

<!-- One or two sentences: the problem and the fix. -->

## Linked issue

Fixes #

## Type of change

- [ ] Bug fix (non-breaking, closes a tracked issue)
- [ ] Security hardening
- [ ] New feature (backend)
- [ ] Frontend (Atlas console)
- [ ] Docs / Tracker sync
- [ ] Refactor / cleanup (no behavior change)
- [ ] Test-only change

## How was this tested?

- [ ] `python -m pytest tests -q` — green (X passed, X skipped)
- [ ] `cd apps/web && npm run typecheck && npm run test` — green
- [ ] `ruff check .` — clean
- [ ] CI run on this branch — green
- [ ] N/A — docs only

## Safety checklist (backend changes only)

- [ ] Sentinel checks were **not** weakened or bypassed to make a test pass
- [ ] If a plan revision flow was touched: supersede clears the old sentinel verdict, new `content_hash` is sealed
- [ ] `TRANSMITTED_COA` is still set **only** on COA acknowledgment, never on send
- [ ] No direct writes to `audit.ledger_events` (append-only via `audit.append_event()`)
- [ ] Ingestion remains fail-closed (no default-assume on stale/contradicted feeds)
- [ ] New/changed SQL applied through `migrations/` (Alembic), not by editing built databases
