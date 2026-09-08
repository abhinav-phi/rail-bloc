# Screenshots — RAIL-BLOC

Redesigned "control room" UI (Rev 2.0 — dark brass instrument theme, primary;
a railway-skyblue light variant toggles from the header sun/moon control).
Captured at 1440×900 against the running docker-compose stack with seeded
demo data (seeds 42–53; every surface carries the SIMULATED DATA watermark).

## Index

| File                    | Screen                        | What it shows                                                                                      |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `01-landing.png`        | Public landing                | Vande Bharat hero with RAIL-BLOC livery, decision-pipeline section, chronicle hash-chain           |
| `02-dashboard.png`      | Operations Overview (Sr. DOM) | KPI stat cards, 7-day block-window grid, pipeline health, live incident feed                       |
| `03-block-planning.png` | Weekly planner                | Multi-horizon work queue, solve trigger, committed plan rows with Sentinel status + content hashes |
| `04-approvals.png`      | Approval Workflow             | Lifecycle pipeline stepper, G&SR-2 pending-ack queue, distinct-approver actions                    |
| `05-audit-ledger.png`   | Audit Ledger                  | Chain verification verdict, event rows with hash links (auditor persona)                           |
| `06-corridor-map.png`   | Corridor Map                  | Dark MapLibre view — sections, active blocks, OHE boundaries from `/plans/geo`                     |
| `07-string-chart.png`   | String Chart                  | Time–distance diagram: train paths vs brass maintenance windows                                    |
| `08-26-week.png`        | 26-Week Horizon               | Possession heatmap — 26 weeks × CIVIL/TRD/SNT lanes from committed plans                           |
| `09-login.png`          | Login                         | Persona selection (7 seeded operators) — real JWT flow                                             |

## Conventions

- Numbered `NN-<screen>.png`, captured in the primary dark theme.
- Historical evidence screenshots from earlier development phases live in
  `docs/evidence/` (referenced by `docs/7__Tracker.md` tasks).
