# 🛡️ Judge Q&A Card — RAIL-BLOC v1.1 (attack-surface answers)

## Q1. "PS bola Monthly. Dikhao?"
**A:** `/planner/weekly` → Monthly tab. 7 MONTHLY plans live, har ek content_hash-sealed. Beat cron `0 6 1 * *` hai; solver horizon-agnostic hai — weekly/monthly/26W ek hi CP-SAT formulation share karte hain. Migration `20260905_plan_horizon_monthly` dikha sakta hoon. *(PS Req 4 ✓)*

## Q2. "Tumhara freight number greedy se worse hai. Kyun?"
**A:** "By design — Rules §2 **hard-blocking of forecast freight forbid karta hai**; hum low-confidence freight pe expected-delay accept karte hain (fail-closed forecast policy). Dense-cell numbers published hain, measured: B0 4132.1 / B1 0.0 / RAIL-BLOC 1416.3, solver 35s NFR-001 budget me budget-bound. Honest differentiation: formal 10-check verification + VRP machine rosters + reproducibility — not KPI dominance on a synthetic cell." *(Summary freight callout dikhao.)*

## Q3. "Kya tumhara frontend kabhi browser me khula hai?"
**A:** "Haan — aaj hi, runtime smoke pass: login → JWT → SSE one-time-ticket → live stream, STALE-overlay cycle (Redis stop → overlay ON → start → clear), String Chart median ≈145 fps (PERF-003, 1075 rAF samples). Screenshots `docs/evidence/atlas-*.png`." *(2 runtime bugs bhi isi smoke me mile the — persona auth + reload token wipe — dono fixed.)*

## Q4. "2 critical npm advisories?"
**A:** "Ab **1 critical hai, wo bhi dev-only** — vitest UI server (GHSA-5xrq-8626-4rwp), shipped static export me exist hi nahi karta. `next` 13.5.11 bump se zod critical gaya; findings 21→10. Per-advisory waiver table CONTRIBUTING.md me hai — dev-only vs runtime surface mapped. Framework majors post-SIH tracked."

## Q5. "Ledger sach me tamper-proof hai?"
**A:** "**Tamper-EVIDENT** — hum kabhi tamper-proof claim nahi karte. Watch:" → live `UPDATE audit.action_ledger` → exception (guard trigger) → `/ledger/verify` → `chain_ok=true`. "8-process stress bhi green hai — advisory-lock serialization DB-001b. Ek bhi fork nahi."

## Q6. "AI kahan hai actually? Solver to CP-SAT hai."
**A:** "Teen jagah, har ek measured: (1) **PyTorch urgency estimator** — ML_ESTIMATED lineage, calibrated ECE 0.0331 ±20% perturbation ≤0.095 shift; (2) **XGBoost freight forecaster** — confidence bounds soft-cost gate karte hain (0.60 threshold ke neeche hard-block kabhi nahi); (3) solver **ML-informed urgency se prioritize** karta hai. Aur poora system benchmarked hai vs B0 manual aur B1 greedy — seeds fixed, protocol published."

## Q7. "Pyomo kyun nahi?"
**A:** "Pyomo modeling layer hai, solver nahi. Interval problem — OptionalIntervalVar, NoOverlap, horizon windows — CP-SAT-native hai; Pyomo wrapper translation risk hota bina benefit ke. TechSpec me documented."

## Q8. "Multi-department coordination kahan dikh raha hai?"
**A:** Dashboard pe shadow blocks (striped cells Block Planning me), `shadow_ratio_pct` benchmark KPI, aur MILP-C3 shadow-containment check. Ek block me 3 departments ka kaam ek hi closure me — ki manual process me 3 alag closures lagti.

## Q9. "Security?"
**A:** Per-user PBKDF2 salts (600k) + transparent legacy re-salting, login rate-limit 5/min, JWT `jti` + Redis revocation, SSE one-time tickets (URL me JWT kabhi nahi), Redis requirepass, RBAC + division scoping, idempotency keys. Full triage: CONTRIBUTING.md.

## Q10. "Reproducible kaise hai?"
**A:** Seeds fixed (42/44/52/53), benchmark protocol published (B1 tuning on held-out 900+ split), CI har PR pe 76-test suite chalata hai real PG/PostGIS+Redis pe. `docker compose up --build` kisi bhi machine pe same state produce karta hai — migrate 0.78s, seed 1.26s.
