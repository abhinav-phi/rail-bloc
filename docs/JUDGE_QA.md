# 🛡️ Judge Q&A Card — RAIL-BLOC v1.1 (attack-surface answers)

## Q1. "PS bola Monthly. Dikhao?"
**A:** `/planner/weekly` → Monthly tab. 7 MONTHLY plans live, har ek content_hash-sealed. Beat cron `0 6 1 * *` hai; solver horizon-agnostic hai — weekly/monthly/26W ek hi CP-SAT formulation share karte hain. Migration `20260905_plan_horizon_monthly` dikha sakta hoon. *(PS Req 4 ✓)*

## Q2. "Tumhara freight number greedy se worse hai. Kyun? Aur seedha poochta hoon — greedy 130/130 schedule karta hai, tumhara solver 126. Why CP-SAT?"

**A:** "Kyunki **scheduled-count aur certifiable-count alag cheez hai.** Humne B1 ke schedule ko hamare hi 10-check Sentinel rule set se audit kiya (`apps/eval/b1_audit.py`, measured): **B0 aur B1 dono 0/130 plans certify karte hain** — B1 ke 106/106 candidates MILP-C5 machine-travel violation karte hain, plus OHE isolation aur headway spills. Wo schedule machine fleet ke liye physically unflyable hai. RAIL-BLOC 129 schedule karta hai, **100 outright certifiable** (sirf by-design G&SR-2 dual-ack pending) aur 29 auto-retry. Freight trade-off Rules §2 ka design hai — forecast freight kabhi hard-block nahi hota. Warm-start hint bhi dense scenarios me INFEASIBLE nikla (fix-to-hint probe) — isliye solver ko feasible solution khud derive karna padta hai. Aur haan — **B0 ke against hum har cell me 3x better hain (4132 → 1416), kyunki manual process hi asli current-state competitor hai.**"

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
**A:** Seeds fixed (42/44/52/53), benchmark protocol published (B1 tuning on held-out 900+ split), CI har PR pe 77-test suite chalata hai real PG/PostGIS+Redis pe. `docker compose up --build` kisi bhi machine pe same state produce karta hai — migrate 0.78s, seed 1.26s.

## Q11. "CORS `allow_origins=["*"]` wildcard hai — production me kyun?"
**A:** "Conscious demo tradeoff, aur honest jawab ye hai: hamara production topology me frontend aur backend **same-origin nahi hain** — Vercel pe static export hai, backend Railway pe alag domain pe, aur `/api/*` Vercel rewrite ke through jata hai jo server-side hota hai. Wildcard isliye rakha ki demo host badle (Vercel preview URL, Railway URL swap) to kabhi CORS break na ho. **JWT auth har effectful route pe lagao hai** — CORS sirf browser read-access govern karta hai, aur humara data simulated hai (`[SIMULATED]` watermark globally). Real deployment me ye ek-line change hai: `allow_origins` ko exact Vercel domain pe pin karna, aur wo TechSpec me listed hai as hardening."

## Q12. "Tumhara `.env.example` me JWT_SECRET plain-text hai. Demo secrets?"
**A:** "`.env.example` variable **documentation** hai — live deployment us file se boot nahi hota. Deployed Railway services me `JWT_SECRET` freshly generated 64-hex value hai jo kisi file me committed nahi (per-service env vars). `SEED_PASSWORD=railbloc` jaan-boojh ke demo hai — 7 public personas simulated data ke liye, taaki judges khud login kar sakein; login rate-limited hai (5/min). 480-min token expiry demo session length hai. Kisi bhi real credential ki exposure nahi hai — DB hosted hai restricted credentials ke saath, aur poora ledger tamper-evident hai."

## Q13. "145 FPS claim — mera laptop pe chal ke dikha do."
**A:** "Ye figure honestly scoped hai: median **≈145 fps** measured on **dev-class hardware** (in-app Chromium, 1280×720, 1075 rAF samples — PERF-003, 2026-09-05), 60 fps NFR target exceed karta hai. Re-verification note bhi humne publish kiya: background tabs me Chromium rAF sampling throttle hota hai, isliye dobara capture pe idle-cadence record hua — load figure first measurement se hai. Judge hardware pe number alag ho sakta hai — **claim smoothness hai, specific FPS nahi**: chart pan/zoom stalls ke bina chalta hai, 23 real train paths + striped shadow blocks ke saath. Aapke laptop pe bhi wahi smoothness milegi — number benchmark hardware ka hai."
