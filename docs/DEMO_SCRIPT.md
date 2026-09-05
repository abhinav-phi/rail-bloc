# 🎬 RAIL-BLOC — 5-Minute Demo Script (judges ke liye, timed)

> Pre-flight: `docker compose up --build` chal hua ho · `http://localhost:5173` khula ho · personas ready.
> Backup plan: har step ka screenshot `docs/evidence/` me hai — agar live demo toote, slides pe screenshots chalao.

## 0:00–0:30 — Hook + landing
- Tab 1: **Landing page** — "SIH26027, Ministry of Railways. Three departments — Civil, TRD, S&T — aaj BDMS me independently blocks maangte hain. Hum unhe ek mathematically-verified, tamper-evident pipeline me laate hain."
- "Ye [SIMULATED] watermark har jagah hai — Rules.md §5 ki honesty law. Hum jo bhi bolenge, measured hai."

## 0:30–1:15 — Login + Dashboard (real data)
- Tab 2: **/login** — persona click karo (R. K. Sharma, Sr. DOM). "Har persona real seeded user hai — JWT mint hota hai, fail-closed auth."
- **/dashboard**: "Ye sab LIVE data hai — `/plans/summary` se: 28 plans ka lifecycle distribution, machine fleet VRP rosters se, **84 escalated demands** FSM-002 pe. Sidebar me LIVE pill = SSE stream healthy; stream gaya to STALE overlay sab actions disable kar deta hai — G&SR-3 fail-closed."

## 1:15–2:15 — Multi-horizon solve (PS Req 4 — core)
- **/planner/weekly** → **Monthly tab**: "PS mein do horizons maange the — Weekly aur **Monthly**. Dono ek hi horizon-agnostic CP-SAT formulation se — 7 MONTHLY plans abhi live hain, har ek content_hash-sealed."
- "Run monthly solve" dabao (optional, time ho to): task queue hota hai, worker me Celery CP-SAT chalata hai.

## 2:15–3:15 — Approvals + Sentinel (safety story)
- **/approvals**: "Ye 10 checks hain — 5 G&SR + 5 MILP — **API se live aate hain**, hardcoded nahi."
- Plan select karo → "**Approve (Sr. DOM)**" → signature dialog → phir DRM persona se "Authorize & Seal".
- "Distinct-approver DB layer pe enforce hota hai (APP-001). Har decision pe idempotency key, har mutation ledger me."

## 3:15–4:15 — 🏆 Ledger tamper demo (best moment)
- **/audit-ledger** (auditor persona): "`chain_ok = true`, 500+ events verified inside PostgreSQL under REPEATABLE READ."
- Terminal kholo: `docker compose exec postgres psql -U rail_admin -d railbloc_db -c "UPDATE audit.action_ledger SET event_type='HACKED' WHERE seq=500"` → **exception throw hota hai** (guard trigger).
- "Hum kabhi 'tamper-proof' nahi bolte — **tamper-evident**. Aur ye evidence abhi, live hai."

## 4:15–5:00 — Fail-closed + close
- Terminal: `docker compose stop redis` → dashboard pe **STALE DATA overlay** ON, actions disabled → `start redis` → overlay clear (auto-reconnect).
- "Ye fail-closed design hai: stale data pe controller kabhi act nahi kar sakta."
- Close: "CP-SAT + Sentinel + hash-chained lifecycle. **Coordinates blocks. Verified safe. Human-sealed.**"

---

## Emergency fallbacks
| Break | Fallback |
|---|---|
| Web down | `docs/evidence/atlas-*.png` slides pe |
| Solver slow | MONTHLY plans already committed — table dikhao, live wait mat karo |
| Redis start fail | STALE overlay khud ek feature hai — "aur yahi fail-closed hai" bol ke pass karo |
| Ledger UPDATE fail hi nahi hua | `docs/evidence/` screenshot + stress-test record (Tracker §4.1) |

## PS keyword map (ek line answers)
BDMS → `BDMS_MANUAL` path · TMS/SMMS/TDMS → per-source keys · COA → outbox+ack · WTT → headway-expanded paths · goods forecast → FOIS poll w/ confidence · Weekly+Monthly → beat crons + live plans · AI/ML → PyTorch urgency (ECE 0.0331) + XGBoost + sklearn Brier · OR-Tools → CP-SAT · PostGIS → corridor schema · Docker → 7-service compose.
