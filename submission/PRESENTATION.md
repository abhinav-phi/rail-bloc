# Final Presentation — RAIL-BLOC

> **STATUS: PLACEHOLDER** — the final PPT is being prepared. This file will be
> updated with either the committed PPTX or an accessible viewer link before
> submission.

## Option A — committed file (preferred)

`submission/RAIL-BLOC_SIH2026_Presentation.pptx`

## Option B — cloud viewer link (if the file is too large for GitHub)

<!-- Paste the Google Drive / OneDrive link below once uploaded. -->

`<PASTE_DRIVE_VIEWER_LINK_HERE>`

## Expected deck outline (10 slides)

1. Title — RAIL-BLOC · SIH26027 · Team
2. Problem — decentralized maintenance planning on Indian Railways (BDMS/TMS/TDMS/SMMS silos)
3. Proposed solution — unified demands → CP-SAT optimized shadow blocks → Sentinel → human chain
4. Architecture — Nexus → Optima → Sentinel → Approval → Chronicle pipeline
5. Tech stack — FastAPI · Next.js · PostgreSQL/PostGIS · Redis · Celery · CP-SAT (OR-Tools) · MapLibre
6. Live demo — control room walkthrough (personas: Sr. DOM → DRM → COA)
7. Safety verification — 10-check Sentinel, content-hash binding (SAFE-002), distinct approvers
8. Benchmark — scheduled-count vs Sentinel-certifiable count vs baselines (measured, simulated-scenario)
9. Impact — asset availability, fewer fragmented closures, audit-ready operations
10. Roadmap & team

## Slide-8 guidance — the benchmark slide (read before making the deck)

Slide 8 is the highest-risk slide of the deck. The raw benchmark table shows a
number that reads like a loss if presented without its frame in the same view:
**freight detention B1 0.0 min vs RAIL-BLOC 1505.2 min** (seed=100 cell), and in
the dense cell B1 schedules 130/130 while RAIL-BLOC schedules 126/130.

**Do NOT put that table on the slide by itself.** Same-slide framing (exact
suggested bullets):

- Headline: **"We don't just schedule — we certify."**
- Line 1: B1 (greedy) schedules 130/130 — but under our 10-check Sentinel rule
  set, **B0 and B1 certify 0/130 plans** (`apps/eval/b1_audit.py`, measured:
  B1's 106/106 candidates violate MILP-C5 machine-travel + OHE-isolation +
  headway checks). An unsafety-audited schedule is paper compliance.
- Line 2: RAIL-BLOC schedules 126/130 under the same hard-path density and
  **certifies 100 outright** (+29 auto-retried; the only outstanding check is
  the by-design G&SR-2 human dual-ack).
- Line 3: Freight 1505.2 vs B1 0.0 is **not a regression** — Rules §2 forbids
  hard-blocking low-confidence freight forecasts; B1 "wins" by ignoring the
  risk we refuse to ignore. Against B0 (the actual current manual process) we
  are 3× better: **4132 → 1416 freight minutes**.
- Footnote on the slide: *"Simulated-scenario measurements, fixed seeds,
  protocol published (`apps/eval/b1_audit.py`). B1 is not unsafe — it lacks any
  mechanism to detect these violations; RAIL-BLOC detects, rejects, and retries."*

**30-second spoken line for the slide:**
"Greedy schedules everything because it checks nothing — under our rulebook it
certifies zero trains. We schedule almost everything AND certify what we
schedule. The freight gap is us refusing to hard-block on low-confidence
forecasts; against the real manual baseline we're 3× better. Safety isn't our
constraint — it's our product."

Never say "B1 is unsafe/broken" — say "B1 lacks any detection mechanism; we
detect, reject, and retry." (B1-framing rule from the advisor verification
round.)
