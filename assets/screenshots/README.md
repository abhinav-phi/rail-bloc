# Screenshots — RAIL-BLOC

Redesigned "control room" UI (Rev 2.0 — dark brass instrument theme, primary;
a railway-skyblue light variant toggles from the header sun/moon control).
Captured against the running docker-compose stack with seeded demo data
(seeds 42–53; every surface carries the SIMULATED DATA watermark).
Display sizes vary (1440×900 / 1920×1080) by capture session.

## Index

| File                      | Screen          | What it shows                                                                                      |
| ------------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `01-landing.png`          | Public landing  | Vande Bharat hero with RAIL-BLOC livery, decision-pipeline section, chronicle hash-chain            |
| `02-login.png`            | Login           | Persona selection (7 seeded operators) — real JWT flow                                              |
| `03-dashboard.png`        | Operations      | KPI stat cards, 7-day block-window grid, pipeline health, live incident feed                        |
| `04-block-planning.png`   | Weekly planner  | Multi-horizon work queue, solve trigger, committed plan rows with Sentinel status + content hashes  |
| `05-approvals.png`        | Approvals       | Lifecycle pipeline stepper, G&SR-2 pending-ack queue, distinct-approver actions                     |
| `06-audit-ledger.png`     | Audit ledger    | Chain verification verdict, event rows with hash links (auditor persona)                            |
| `07-corridor-map - 1.png` | Corridor map    | MapLibre corridor — sections, active blocks, OHE boundaries from `/plans/geo`                       |
| `07-corridor-map - 2.png` | Corridor map    | Zoomed live-block detail over the corridor                                                          |
| `08-string-chart.png`     | String chart    | Time–distance diagram: train paths vs brass maintenance windows                                     |
| `09-26-week.png`          | 26-week horizon | Possession heatmap — 26 weeks × CIVIL/TRD/SNT lanes from committed plans                            |
| `10-disruptions.png`     | Disruptions     | P0 drill form, blast-radius preview, Controller acknowledgment gate ("disruptions" is a kept-for-link-stability filename typo) |

## Conventions

- Numbered `NN-<screen>.png`, captured in the primary dark theme.
- Historical evidence screenshots from earlier development phases live in
  `docs/evidence/` (referenced by `docs/7__Tracker.md` tasks).
