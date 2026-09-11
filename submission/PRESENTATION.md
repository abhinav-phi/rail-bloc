# Final Presentation — RAIL-BLOC

**PPT links (6 slides, official SIH template — viewable without permission):**

- **Google Drive (pptx):** <https://drive.google.com/file/d/1qfgUEQA6ZH0lPdPvUzN7G3Nw-ggC9uNH/view>
- **Dropbox (pptx):** <https://www.dropbox.com/scl/fi/bwvbh2e9r8q3r20hlyzbr/Insomnia_SIH2026_Presentation.pptx?rlkey=mgfx2flirivrgjbz7fhjqxbyf&st=yz7atabh&dl=0>

Portal rule: submit the **PDF export** of the deck (≤6 slides including title);
the `.pptx` above is the editable source.

## Deck outline (6 slides, per official SIH template)

1. **Title** — RAIL-BLOC · SIH26027 · Transportation & Logistics · Software · Team
2. **Idea Title & Proposed Solution** — "Optima proposes · Sentinel disposes · humans authorize"; problem-vs-pipeline diagram (Nexus → Optima → Sentinel → Lifecycle → Chronicle); USP chips: independent verifier, content-hash sealing, ≤45 s emergency re-plan, DB-enforced two-person rule
3. **Technical Approach** — architecture diagram, tech-stack chips (Python/FastAPI/CP-SAT/PostGIS/Redis-Celery/Next.js/Docker), methodology Ingest→Bundle→Verify→Authorize, prototype-status proof chips (77 CI tests, 8.2 s dev solve, 351/351 chain, QR to live site)
4. **Feasibility & Viability** — three feasibility cards + four challenge→mitigation rows (data access / solver budget published as open NFR-001 / fail-closed networking / trust via full auditability) + pilot→shadow-mode→production path
5. **Impact & Benefits** — five persona rows (what changes for each) + four measured stat cards (−66% freight detention · 126/130 vs 0/130 certification · +0.5 pp availability · ≤45 s emergency) + social/economic/environmental pillars
6. **Research & References** — G&SR basis, CP-SAT/OR-Tools docs, Cordeau–Toth–Vigo (1998) survey, data.gov.in + IRFCA, in-repo fixed-seed harness; integrity strip: every figure traces to a cited run

## Benchmark framing (Slide 5 — the highest-risk numbers)

The raw benchmark can read like a loss without its frame on the same view:
freight detention B1 0.0 min vs RAIL-BLOC 1505.2 min (seed=100 cell); dense
cell B1 schedules 130/130 vs RAIL-BLOC 126/130.

Keep this framing together on the slide:

- Headline: **"We don't just schedule — we certify."**
- B1 (greedy) schedules 130/130 — but under the 10-check Sentinel rule set,
  **B0 and B1 certify 0/130 plans** (`apps/eval/b1_audit.py`: B1's 106/106
  candidates violate MILP-C5 machine-travel + OHE-isolation + headway checks).
- RAIL-BLOC schedules 126/130 under the same hard-path density and certifies
  them (the only outstanding check is the by-design G&SR-2 human dual-ack).
- Freight 1505.2 vs B1 0.0 is **not a regression** — Rules §2 forbids
  hard-blocking low-confidence freight forecasts. Against B0 (the actual
  manual process) we are 3× better: **4132 → 1416 freight minutes**.
- Footnote: *"Simulated-scenario measurements, fixed seeds, protocol published
  (`apps/eval/b1_audit.py`). B1 lacks any mechanism to detect these violations;
  RAIL-BLOC detects, rejects, and retries."*

Never say "B1 is unsafe/broken" — say "B1 lacks any detection mechanism; we
detect, reject, and retry." (B1-framing rule from the advisor verification
round.)
