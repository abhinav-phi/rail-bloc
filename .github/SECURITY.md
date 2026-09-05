# Security Policy

RAIL-BLOC is a **simulated-data** planning system built for SIH26027. It handles no real passenger or railway operational data — but the security architecture is built as if it would, because the whole point is demonstrating a deployable safety posture.

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.1.x   | ✅ |
| 1.0.x   | ❌ (superseded by the post-audit hardening release) |

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting:
**https://github.com/abhinav-phi/rail-bloc/security/advisories/new**

Include: affected component, reproduction steps, and impact assessment. You will get an acknowledgment within **72 hours**. Credit is given in the fix's changelog entry unless you prefer otherwise.

## Security-relevant architecture (what to attack)

- **Authentication** — JWT bearer tokens (`jti`, revocable via Redis deny list), per-user PBKDF2 salts (600k iterations) with transparent legacy re-salting, login rate limiting (5/min), per-source machine keys for ingestion (timing-safe comparison).
- **Plan integrity** — `content_hash` (SHA-256) seals exactly what Sentinel verified; any post-verification mutation forces a new revision through the full chain.
- **Audit ledger** — SHA-256 hash chain in `audit.ledger_events`; written only through `audit.append_event()` under an advisory lock; an INSERT-only DB role plus UPDATE/DELETE guard triggers enforce append-only storage. Tamper-evident (not claimed tamper-proof).
- **Fail-closed ingestion** — stale or self-contradicted departmental feeds are rejected with diagnostics; weather defaults to *defer*, never *assume*.
- **Transport** — tokens reach the browser over the API origin only; SSE uses short-lived one-time tickets instead of URL-borne JWTs.

## Dependency audit triage (2026-09-06)

`npm audit` (apps/web): **10 findings — 1 critical / 6 high / 3 moderate** (down from 21 / 2-critical after `next@13.5.11` + non-breaking fixes). Full per-advisory waiver table lives in `CONTRIBUTING.md`; summary:

| Group | Severity | Surface | Disposition |
|---|---|---|---|
| vitest UI server (GHSA-5xrq-8626-4rwp) | critical | dev-only test runner | never ships in the static export; vitest 5 upgrade post-SIH |
| `next` remainder | high | server-runtime paths (`next dev`/`start`) | production artifact is a static export served by nginx — next server never runs; client-side items accepted until the v14/15 upgrade |
| `yaml` (build config parser) | moderate | build tooling | never ships |
| remainder | low–moderate | dev tooling | same class |

## Scope notes

- **In scope:** auth/session handling, plan-lifecycle state machine bypasses, ledger tampering paths, ingestion spoofing, SSRF/injection in any router, secret handling in Compose/CI.
- **Out of scope:** the synthetic data generators' randomness, demo credentials shipped in seeds, volumetric DoS against a local demo stack.
