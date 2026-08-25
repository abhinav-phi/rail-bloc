# Contributing to RAIL-BLOC

Thank you for your interest in contributing to **RAIL-BLOC** — the AI-powered, mathematically bounded block scheduling optimization platform for Indian Railways maintenance planning (SIH26027). We welcome contributors of all skill levels, but please understand this is a **safety-critical decision-support system**: changes to Sentinel rules, solver constraints, ledger integrity, or approval gates have real-world operational safety implications.

Before starting, read the 8 canonical specification documents in [`docs/`](docs/) — `PRD.md`, `TechSpec.md`, `AppFlow.md`, `Design.md`, `Schema.md`, `ImplementationPlan.md`, `Tracker.md`, `Rules.md` — plus the executive [`docs/Summary.md`](docs/Summary.md). For significant changes, open an issue first and discuss the proposal before writing code.

**Governing principle you must not violate:** *"ML estimates parameters (Π_k, ρ_f); CP-SAT solver decides; Sentinel verifies; humans authorize; COA executes."*

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Git Workflow & Branching Strategy](#git-workflow--branching-strategy)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Code Style & Quality Standards](#code-style--quality-standards)
- [Safety-Critical Change Policy](#safety-critical-change-policy)
- [Pull Request Process](#pull-request-process)
- [Versioning Policy](#versioning-policy)

---

## Code of Conduct

This project adopts the **Contributor Covenant v2.1**, embedded in full in the
[Community & Code of Conduct Details](#community--code-of-conduct-details) section at the bottom of
this document. By participating you are expected to uphold it. Report unacceptable behaviour to the
maintainers via GitHub Issues (label `conduct`) or the maintainer contact listed in the repo profile.

---

## How Can I Contribute?

### Reporting Bugs
1. Search existing Issues (open + closed) for duplicates.
2. Open a Bug Report with:
   - Minimal reproducible steps (commands/curls/SQL),
   - Expected vs actual behavior,
   - `docker --version` and `docker compose version`,
   - Relevant `docker compose logs api worker` excerpts,
   - Whether it reproduces on the synthetic seed dataset (`docker compose run --rm seeder`) — almost everything should.
3. Bugs touching a safety-critical path (see the [policy table](#safety-critical-change-policy)) MUST be labelled `SAFETY-CRITICAL` and will be triaged before all other work.

### Suggesting Enhancements
Check closed issues/discussions first. Proposals that violate the project's non-negotiables will be declined without review; specifically these are rejected upfront per `Rules.md §2` and `ADR-002/004/006`:
- LLM/RL-based dispatch or autonomous scheduling,
- ML outputs inside feasibility constraints,
- "Sentinel should execute revocations" (it is a validator only),
- Real IR API integrations or blockchain anything.

Enhancements that keep the shape *ML estimates → CP-SAT decides → Sentinel verifies → humans authorize → COA executes* are very welcome: better bundling objectives, VRP refinements, UI ergonomics on the Action Preview Card, test coverage, docs clarity.

### Submitting Pull Requests
Small, focused PRs win. One logical change per PR; tests included; canonical docs updated in the same PR when behaviour they describe changes (see [Doc-Sync Rule](#pull-request-process)).

---

## Development Setup

Hard host requirements: **Docker Desktop ≥ 4.30 (Engine ≥ 26)** and **Git ≥ 2.40**. Python 3.11 / Node 20 are optional for local (non-Docker) development.

```bash
# 1. Fork + clone
git clone https://github.com/<your-username>/rail-bloc.git
cd rail-bloc

# 2. Environment (the only MANUAL step)
cp .env.example .env
openssl rand -hex 32   # → paste into JWT_SECRET
openssl rand -hex 16   # → paste into POSTGRES_PASSWORD (hex only — embedded in DSNs)
# then update DATABASE_URL and DATABASE_URL_SYNC to match the new password

# 3. Launch the full stack (single command; seeder runs once automatically)
docker compose up --build        # first build ~10–25 min; later builds cached

# 4. Verify liveness
curl http://localhost:8000/health          # {"status":"ok",...}
docker compose logs seeder | tail -1       # Seeded: 12 sections, 286 demands, 276 paths.
curl -I http://localhost:5173              # Atlas console up ([SIMULATED] watermark visible)

# 5. Tests
pytest -q                                  # host run (needs DATABASE_URL_SYNC env; skips DB-less suites gracefully)
docker compose exec api pytest -q          # in-container equivalent
cd apps/web && npm install && npm run build   # frontend strict-TS build gate
```

> Note on Python path: containers set `PYTHONPATH=/srv:/srv/packages`. For host runs export the same two paths pointing at your checkout root (repo root + nothing else needed — packages resolve as top-level namespaces).

---

## Git Workflow & Branching Strategy

Branch pattern: `<type>/<scope>-<short-description>` where **scope ∈ {sentinel, optima, ledger, approval, emergency, coa, nexus, atlas, schema, eval, docs}**.

```bash
git checkout main && git pull origin main

git checkout -b feat/sentinel-ohe-boundary-check
git checkout -b fix/ledger-append-event-snapshot-race
git checkout -b refactor/optima-interval-warm-start
git checkout -b docs/schema-db001b-change-log
```

Keep `main` green: every merged PR must leave `pytest`, `npm run build` passing and the seeded stack bootable via `docker compose up --build`.

---

## Commit Message Guidelines

Conventional Commits with RAIL-BLOC scopes:

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:** `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `security`
**Scopes:** `sentinel` `optima` `ledger` `approval` `emergency` `coa` `nexus` `atlas` `schema` `eval` `docs` `ml` `config`

Real examples from this repo's history:

```text
feat(sentinel): add OHE feeding-section boundary containment check (G&SR-4)
fix(ledger): acquire advisory lock pre-statement via audit.append_event (DB-001b)
security(approval): enforce distinct-approver CHECK at DB layer (APP-001)
refactor(optima): per-train NoOverlap replaces aggregate binary exclusion (MILP-002)
docs(schema): record append_event change-log row (POST-BUILD FIX)
test(approval): idempotency replay yields exactly one ledger row (FR-027)
```

---

## Code Style & Quality Standards

Project-standard gates to run before committing:

```bash
# Python formatting & linting (project standard: ruff — NOT black/flake8)
pip install ruff mypy
ruff check . && ruff format --check .

# Type checking (strict intent on packages/ and apps/api/)
mypy packages/ apps/api/

# Backend tests
pytest -q

# Frontend gates (TypeScript strict noImplicitAny is MANDATORY — Rules.md §4)
cd apps/web && npm install
npm run build            # tsc --noEmit + vite production build
```

> **Tooling adoption note (honesty):** ruff/mypy configs and frontend ESLint/Prettier/vitest wiring are the declared standard but CI enforcement is still landing (Tracker TASK-057/059). Until then these gates are reviewer-enforced: expect review comments if skipped. Pydantic v2 schemas are mandatory at every API boundary. Zero-hardcoding policy (`Rules.md §4`): operational parameters, penalty coefficients and scheduling cadences come from env/config — never literals.

---

## Safety-Critical Change Policy

This is the heart of this guide. Changes to ANY path below require the **`SAFETY-CRITICAL` label** and **two maintainer approvals, at least one being a designated Safety Reviewer**:

| Path | What It Guards |
|---|---|
| `packages/sentinel/rules.py` | The check-ID enum — adding/removing/renaming changes the Preview Card and Tracker counts |
| `packages/sentinel/validator.py` | The 10 enumerated G&SR/MILP checks — last deterministic barrier before humans |
| `packages/optima/formulations.py` | CP-SAT model: NoOverlap semantics, shadow containment, machine disjunctive |
| `packages/optima/objectives.py` | Π_k time-weighting, headway mapping, replay detention scoring |
| `packages/chronicle/canonical.py` | The content_hash payload definition — drift silently breaks SAFE-002 binding |
| `data/sql/01_init_postgis.sql` | pgcrypto-first ordering (SAFE-001) + role bootstrap |
| `data/sql/02_schema_ddl.sql` | All CHECK/EXCLUDE constraints, junctions, grants |
| `data/sql/03_ledger_triggers.sql` | Seal/guard triggers, verify_ledger(), append_event() locking contract |
| `apps/api/services/plan_lifecycle.py` | Revision creation, hash recomputation, supersedes linkage, overlap complement |
| `apps/api/services/emergency_service.py` | Coalescing, advisory revoke semantics, PROVISIONAL persistence |
| `apps/api/routers/approvals.py` | Distinct approver, hash re-verification, transition legality, idempotency usage |
| `apps/api/routers/plans.py` | Transmit T−2h gate, acknowledge-signal state flip, lifecycle transitions |
| `apps/api/services/coa_adapter.py` | Outbox ack-gated TRANSMITTED_COA (never on send) |

**Safety Reviewer checklist (paste into the PR description):**

```markdown
### SAFETY-CRITICAL REVIEW CHECKLIST
- [ ] Alters any invariant in Rules.md §1/§2? (if yes → which)
- [ ] Alters Sentinel checks in rules.py/validator.py? (which check IDs)
- [ ] Alters content_hash canonical payload in chronicle/canonical.py?
- [ ] Alters any DB CHECK/EXCLUDE constraint or trigger? (constraint names)
- [ ] Alters approval-chain preconditions or emergency gating?
- [ ] Canonical doc(s) updated in THIS PR? (list files)
- [ ] Property/fuzz/integration tests added or updated? (test ids)
- Reviewed-by Safety Reviewer: @<handle>
```

---

## Pull Request Process

1. **No artifacts:** never commit `.env`, `__pycache__/`, `node_modules/`, `dist/`, `build_wheels/`, `*.log`.
2. **Doc-Sync Rule:** any PR changing API routes, DB schema, FSM states, Sentinel checks, env vars, or safety invariants updates the relevant canonical docs **in the same PR** — from the 8: `PRD.md`, `TechSpec.md`, `AppFlow.md`, `Design.md`, `Schema.md`, `ImplementationPlan.md`, `Tracker.md`, `Rules.md`.
3. **Tests:** every behaviour change ships a test whose result is its evidence (Rules.md R6.6). Tracker status claims must cite runnable evidence.
4. **Gates green:** `pytest -q`, `cd apps/web && npm run build`, plus lint/type gates above once wired.
5. **Review:** non-safety PRs need 1 maintainer; SAFETY-CRITICAL PRs need 2 incl. one Safety Reviewer. Address feedback with follow-up commits; no force-push during active review.
6. **Honesty:** benchmark/KPI claims in docs or UI text must cite their measurement or be labelled Design Target `[SIMULATED]`.

## Versioning Policy

Semantic Versioning `MAJOR.MINOR.PATCH`. **Safety-invariant changes are BREAKING → MAJOR**: Sentinel check add/remove/rename, content_hash payload format change, FSM state additions/removals, ledger chain-format changes. Solver-internal refactors preserving all check semantics and hashes → MINOR/PATCH. Docs-only corrections → PATCH.

---

## Community & Code of Conduct Details

### Contributor Covenant Code of Conduct — v2.1

#### Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, caste, color, religion, or sexual identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming, diverse, inclusive, and healthy community.

#### Our Standards

Examples of behavior that contributes to a positive environment for our community include:

* Demonstrating empathy and kindness toward other people
* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive feedback
* Accepting responsibility and apologizing to those affected by our mistakes, and learning from the experience
* Focusing on what is best not just for us as individuals, but for the overall community

Examples of unacceptable behavior include:

* The use of sexualized language or imagery, and sexual attention or advances of any kind
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or email address, without their explicit permission
* Other conduct which could reasonably be considered inappropriate in a professional setting

#### Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of acceptable behavior and will take appropriate and fair corrective action in response to any behavior that they deem inappropriate, threatening, offensive, or harmful.

Community leaders have the right and responsibility to remove, edit, or reject comments, commits, code, wiki edits, issues, and other contributions that are not aligned to this Code of Conduct, and will communicate reasons for moderation decisions when appropriate.

#### Scope

This Code of Conduct applies within all community spaces, and also applies when an individual is officially representing the community in public spaces. Examples of representing our community include using an official e-mail address, posting via an official social media account, or acting as an appointed representative at an online or offline event.

#### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the community leaders responsible for enforcement via GitHub Issues (label `conduct`) or the maintainer contact on the repository profile. All complaints will be reviewed and investigated promptly and fairly.

All community leaders are obligated to respect the privacy and security of the reporter of any incident.

##### Enforcement Guidelines

Community leaders will follow these Community Impact Guidelines in determining the consequences for any action they deem in violation of this Code of Conduct:

**1. Correction**

**Community Impact:** Use of inappropriate language or other behavior deemed unprofessional or unwelcome in the community.

**Consequence:** A private, written warning from community leaders, providing clarity around the nature of the violation and an explanation of why the behavior was inappropriate. A public apology may be requested.

**2. Warning**

**Community Impact:** A violation through a single incident or series of actions.

**Consequence:** A warning with consequences for continued behavior. No interaction with the people involved, including unsolicited interaction with those enforcing the Code of Conduct, for a specified period of time. This includes avoiding interactions in community spaces as well as external channels like social media. Violating these terms may lead to a temporary or permanent ban.

**3. Temporary Ban**

**Community Impact:** A serious violation of community standards, including sustained inappropriate behavior.

**Consequence:** A temporary ban from any sort of interaction or public communication with the community for a specified period of time. No public or private interaction with the people involved, including unsolicited interaction with those enforcing the Code of Conduct, is allowed during this period. Violating these terms may lead to a permanent ban.

**4. Permanent Ban**

**Community Impact:** Demonstrating a pattern of violation of community standards, including sustained inappropriate behavior, harassment of an individual, or aggression toward or disparagement of classes of individuals.

**Consequence:** A permanent ban from any sort of public interaction within the community.

#### Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 2.1, available at
https://www.contributor-covenant.org/version/2/1/code_of_conduct.html.

Community Impact Guidelines were inspired by
[Mozilla's code of conduct enforcement ladder](https://github.com/mozilla/diversity).

[homepage]: https://www.contributor-covenant.org

For answers to common questions about this code of conduct, see https://www.contributor-covenant.org/faq/
