# PS 027 (SIH26027) — Problem-Statement Keyword → Artifact Mapping

Judge-facing map: every literal term in the SIH portal problem statement and where it lives in this repository. All references verified 2026-09-05 (v1.1.0).

## Background terms

| PS term | Our artifact |
|---|---|
| Engineering / Traction Distribution / S&T departments | `demands.block_demands.department` ∈ {ENGINEERING, TRACTION, SIGNAL_TELECOM}; bundling spans all three (shadow blocks) |
| **BDMS** (block demand system) | `BDMS_MANUAL` ingestion path (`apps/api/routers/demands.py`, ENGINEER RBAC) + `BDMS_MANUAL` external_source |
| **TMS, SMMS, TDMS** separate systems | Per-source machine credentials (`INGEST_KEY_TMS/TDMS/SMMS`), staleness TTLs, plausibility checks — `apps/api/routers/demands.py`, `test_ingest.py` |
| **COA** (Control Office Application) | COA outbox pattern (`optimization.coa_outbox`), `TRANSMITTED_COA` set **only on acknowledgment** (`apps/api/services/coa_adapter.py`); rationale row: TechSpec stack table |
| **Train Time Table** | WTT ingestion (seed 52) → headway-expanded train paths → CP-SAT `NoOverlap`; T-2h structural re-check vs latest paths |
| **Goods-train forecast** | FOIS forecast poll (hourly, calendar-seeded) with confidence bounds → soft-cost weighting below `FREIGHT_HARD_CONFIDENCE` |
| **Defects & overdue maintenance** | PyTorch degradation model (tgi/gmt/imr/wear features), `ESCALATED_OVERDUE` FSM state, escalation after retry cap |
| Decentralized & manual (current state) | Baseline B0 — "manual BDMS disconnected allocation" simulator in `apps/eval/benchmark.py` |

## Expected-solution items

| PS item | Our artifact (evidence) |
|---|---|
| 1. Integration | Ingestion chain above + corridor (PostGIS), weather fail-closed adapter; 76/76 suite incl. TEL-001 |
| 2. AI/ML prioritization (criticality, urgency, impact) | urgency_score (B1-relative), PyTorch urgency with **ECE 0.0331 / Brier 0.1766** (scikit-learn cross-check, `apps/eval/calibrate.py`), XGBoost freight forecaster |
| 3. Optimize (uptime, downtime, multi-department) | CP-SAT interval model (OR-Tools), B1 warm start, VRP machine rosters, shadow bundling; KPIs incl. `asset_availability_pct` (`apps/eval/benchmark.py`) |
| 4. Multi-horizon **Weekly + Monthly** | WEEKLY beat (`WEEKLY_PLAN_CRON`) + **MONTHLY beat (`MONTHLY_PLAN_CRON`, rolling 4-week)** + REALTIME + STRATEGIC_26W; migration `20260905_plan_horizon_monthly`; live E2E: 8 MONTHLY plans committed 2026-09-05 |

## Demo script pointer

Live tamper-evidence demo: `UPDATE audit.action_ledger …` → exception (guard trigger) → `GET /api/v1/ledger/verify` → `chain_ok=true`. Redis stop → STALE overlay → Redis start → auto-reconnect. Full playbook: `MANUAL_STEPS.md §9`.
