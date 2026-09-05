# 🚆 RAIL-BLOC — Complete User Walkthrough (Jab Website Ready Hogi)

Poora flow ekdum start se end tak. Isko padh ke frontend design kar sakte ho — har page, har button, har click ka result.

---

## 1️⃣ Sabse Pehle: Login Page (`/login`)

**Kya dikhega:** Dark navy (#0B111E) background, center mein white card — "RAIL-BLOC Atlas Console" title, Username box, Password box, "Sign in" button. Neeche chhota text: *"SIH26027 · all data is SIMULATED"*.

**Buttons:**
- **Sign in** → POST `/api/v1/auth/login` → success pe `/dashboard` redirect, token clipboard/localStorage mein save
- Login fail → red error box: "invalid credentials"

**Role ke hisaab se focus:** 7 demo users hain:
| User | Kya kar sakta hai |
|---|---|
| `srdom_dli` | Approve plans |
| `drm_dli` | Authorize plans (dusra user ho!) |
| `controller_dli` | Emergency trigger + Controller ack |
| `engineer_dli` | Manual upload + fitness certify |
| `sm_dli` | S&T signal acknowledgment |
| `auditor` | Ledger verify |
| `admin` | Solve trigger, everything |

---

## 2️⃣ Home: Dashboard (`/dashboard`)

**Kya dikhega:** Top mein "Divisional Overview" heading. 4 bade KPI cards:

| Card | Kya dikhata hai |
|---|---|
| **Active blocks** | ⛔ red number = TRANSMITTED_COA + ACTIVE_GRANTED plans count |
| **Predicted pax delay** | Amber number (min) + "model estimate (B1-relative, simulated data)" label |
| **Predicted freight detention** | Blue number (min) + model estimate label |
| **Escalated overdue** | ✗ number = ESCALATED_OVERDUE demands (FSM-002 cap exhausted) |

**Neeche 2 sections:**
- **Overdue / Escalated demands table** — jinki scheduling 3 attempts fail, human review chahiye. Red/amber rows with urgency score.
- **Machine fleet utilization** — kaunsi machine kitne jobs + travel minutes.

**Neeche Plan lifecycle distribution** — saare status badges (SENTINEL_PASSED, APPROVED_SR_DOM, PROVISIONAL etc.) with counts.

**Auto-refresh:** Har 15 sec data refresh hota hai (background polling). 

**Sidebar navigation** (left side, hamesha visible):
```
Dashboard | Corridor Map | String Chart | 26-Week Calendar | Weekly Planner | Approvals | Disruptions | Audit Ledger
```
Role ke hisaab se kuch items chhup jaate hain (sirf APPROVALS roles ko, sirf AUDITOR ko Audit Ledger, etc.)

---

## 3️⃣ Corridor Map (`/corridor-map`)

**Kya dikhega:** Full-width MapLibre map (Google Maps jaisa dark theme). NDLS→CNB corridor ki track lines visible.

**Layers:**
- 🟡 Neele line = track centerline (normal)
- 🔴 Rati red = **blocked section** (live block)
- 🟠 Dashed cyan = **OHE feeding boundaries** (power isolation)
- 🚆 Moving train markers (every 10s update — RTIS mock, timetable se interpolate)

**Interactions:**
- **Hover section** → popup: section code, KM range, GMT index, defect count, *"SIMULATED health indices"*
- **Click section** → popup larger
- **Zoom/pan** mouse se

**Buttons:**
- Zoom controls (+/-) top-right
- (No action buttons — purely view + LIVE)

**Important:** Hamesha bottom-right **"SIMULATED DATA"** watermark, aur agar SSE stream drop ho toh top pe **"STALE DATA — actions disabled"** red banner.

---

## 4️⃣ String Chart (`/string-chart`)

**Kya dikhega:** Full-width HTML5 Canvas chart. X-axis = distance (0–250 km), Y-axis = time (00:00–23:59 = 24h window perfect).

**Elements:**
- 🟣 Purple diagonal lines = Vande Bharat/Rajdhani (priority 1-2)
- 🔵 Blue lines = Mail/Express (priority 3-4)
- 🟡 Amber lines = Passenger + Freight
- ⬛ Semi-transparent rectangles = **block windows** (time × km position)
- 🟨 Diagonal stripes wale boxes = **shadow bundles** (multi-department co-allocated)

**Buttons/Controls:**
- **◀ prev day / today / next day ▶** — day navigation
- **Scroll** = zoom (distance axis)
- **Ctrl+Scroll** = zoom (time axis)
- **Drag** = pan
- **Hover** = tooltip: jog KM + section + GMT + defects + scheduled block info

---

## 5️⃣ 26-Week Calendar (`/planner/26-week`)

**Kya dikhega:** Grid table. Rows = 12 sections (NDLS-GZB-UP, GZB-ALJN-DN, etc.), Columns = 26 weeks (W2026-08-26 se…).

**Cells mein:** Status badge chips (SENTINEL_PASSED, AUTHORIZED_DRM, PROVISIONAL etc.) + revision number.

**Minimal buttons:**
- Sirf view — no actions. Strategic 26-week horizon plans database se aate hain. Agar empty ho: message *"No strategic plans yet — trigger a STRATEGIC_26W solve from the weekly planner."*

---

## 6️⃣ Weekly Planner (`/planner/weekly`) — THE BIG ONE

**Kya dikhega:** 2-column layout — left: plans list, right: selected plan detail.

**Left side (plans list):**
- ▶ **"Trigger weekly solve"** button (top-right) — POST `/optimize/solve` → 202 task id → 8-20 sec baad list refresh
  - Click hote hi: "Solve queued: task_id..." message → background polling → naye plans aate hain
- Plan rows: section code, time range, `rev1` badge, **"est. pax Xm · frt Ym (model estimate)"**

**Right side (Modify Parameters):**
- Selected plan ka detail: status badge, content_hash (chhota), **New start / New end** datetime inputs
- ✎ **"Revise → re-enter Sentinel chain"** button:
  - POST `/plans/{id}/revise` → naya revision banta hai (rev2) — purana plan SUPERSEDED, naya DRAFT + `sentinel_verified: false`
  - Message: *"Revision created: rev 2 (...) — new revision re-enters the Sentinel chain"*
- Neeche chhota text: *"FR-026: any mutation after SENTINEL_PASSED creates revision+1 at DRAFT, clears sentinel_verified and restarts the approval chain (SAFE-002)."*
- Status badge update hogi: `DRAFT` (spinning/pulsing)

**Behind the scenes (solve pipeline):**
```
POST /optimize/solve
  → Redis lock (division+horizon) [agar lock busy: "a solve already running" 409]
  → solver_runs table mein QUEUED row
  → Celery worker picks it up
  → Weather fail-closed check (stale IMD → outdoor work deferred)
  → Demands (SUBMITTED/NORMALIZED) load karta hai
  → Optional ML urgency refresh (PyTorch)
  → B1 greedy warm-start hint
  → OR-Tools CP-SAT solve (default 35s budget)
  → Sentinel 10-check validation
  → Sab pass → plans persist (SENTINEL_PASSED ya DRAFT agar GSR-2 pending)
  → machine_rosters persist
  → Ledger event + SSE publish
  → solver_runs COMPLETED
```

---

## 7️⃣ Approvals (`/approvals`) — SAFETY-CRITICAL SCREEN

**Kya dikhega:** 2-column — left: queue, right: **Action Preview Card**.

**Left (queue):** Plans `SENTINEL_PASSED` (Sr. DOM ke liye) aur `APPROVED_SR_DOM` (DRM ke liye). Click select karo.

**Right — Action Preview Card** (ye Design.md ka hero component hai):
```
┌───────────────────────────────────────┐
│  Action Preview          [STATE BADGE] │
├───────────────────────────────────────┤
│ WHAT: NDLS-GZB-UP                    │
│   01:30 – 05:00 · 210 mins · rev1    │
│   hash: 4f8ab2… (chhota)             │
│                                       │
│ WHY: DTT_TAMPING  Π≈0.812            │
│   🕓 TEL-001 freshness: ingested     │
│   2026-08-26 01:00Z (2h ago) [green] │
│                                       │
│ SHADOW CLUSTER: 2 co-allocated works  │
│   (Track Tamping + OHE Cantilever)    │
│                                       │
│ IMPACT ANALYSIS:                     │
│   predicted pax 55m · frt 120m       │
│   [model estimate (B1-relative,      │
│    simulated data)] — italic label   │
│                                       │
│ SAFETY VERIFICATION: 10/10 CHECKS    │
│   ✓ 1. G&SR-1 Absolute Block          │
│   ✓ 2. G&SR-2 Interlocking Precedence│
│   ✓ 3. G&SR-3 Fail-Closed Consistency│
│   ✓ 4. G&SR-4 Power Isolation        │
│   ✓ 5. G&SR-5 Headway Margin         │
│   ✓ 6. MILP-C1 Section Exclusion      │
│   ✓ 7. MILP-C2 Maintenance Enclosure  │
│   ✓ 8. MILP-C3 Shadow Bundling        │
│   ✓ 9. MILP-C4 Non-Fragmented         │
│   ✓ 10. MILP-C5 Machine Conservation  │
├───────────────────────────────────────┤
│ REVISION INTEGRITY:                  │
│  local 4f8ab2… · server 4f8ab2…     │
│  decided_by [name]                  │
│  authorized_by: — pending—          │
├───────────────────────────────────────┤
│ [✔ Approve & Digitally Sign]         │
│ [✗ Reject Plan]                      │
└───────────────────────────────────────┘
```

**Buttons & kya hota hai:**
- **✔ Approve & Digitally Sign** (Sr. DOM):
  - POST `/approvals/decide` {plan_id, decision: APPROVE, signature, idempotency_key}
  - Server: hash re-verify → status SENTINEL_PASSED → **APPROVED_SR_DOM**, `decided_by` record
  - Response: *"APPROVED_SR_DOM · ledger 0x4f8ab2…"*
  - **Hash mismatch** → red banner: *"Plan changed — reload to review latest revision. Approve disabled while the locally-held hash is stale."* — button disabled
  - **Same actor self-authorize (DRM)** → red: *"distinct-approver violation"*
- **(DRM ke liye button label change)** → **[🔒 Authorize & Seal]** — DRM step, different label!
  - POST decide → status **AUTHORIZED_DRM**, `authorized_by` record
  - Footer shows: `decided_by: srdom_dli · authorized_by: drm_dli`
- **✗ Reject Plan** → status CANCELLED, demands CANCELLED
- Agar plan DRAFT (S&T pending acks) → yellow info box: *"G&SR-2 pending acknowledgments"* + **"Acknowledge as Station Master"** / **"Acknowledge as Controller"** buttons (sirf STATION_MASTER/CONTROLLER roles ko)

**Special case — S&T plan (G&SR-2):**
```
DRAFT (signals pending)
  → SM acknowledge → controller acknowledge
  → plan → SENTINEL_PASSED (hash sealed)
  → phir approve → authorize flow
```

---

## 8️⃣ Disruptions (`/disruptions`) — EMERGENCY CONSOLE

**Kya dikhega:** Left: incident log form + list. Right: semantic notes card.

**Button flow:**
1. **⚡ Preview blast radius** button:
   - Section ID select (12 sections)
   - Type select (TRACK_FRACTURE, OHE_BREAKDOWN, SIGNAL_FAILURE, OTHER)
   - Duration input (15-1440 min)
   - Click → **Blast Radius Modal** khulta hai:
     ```
     ⚠ Emergency Confirmation Modal — blast radius
     • Trains currently held: 3
     • Plans that will be superseded: 2
     • Affected sections (incl. adjacent via feeding map): 4
     [ ] I acknowledge the blast radius above (API-001 modal).
        Advisory revocations will be issued by the Emergency Service;
        the re-plan is PROVISIONAL until I acknowledge it.
     [🚨 Fire emergency breakdown]
     ```
   - Checkbox ke bina "Fire" button disabled — **pehle confirmation chahiye** (API-001)
   
2. **🚨 Fire emergency breakdown**:
   - POST `/emergency/breakdown` → 201
   - System kya karta hai (behind the scenes):
     ```
     1. Section pe active/planned block check (pass/fail)
     2. Incident create (adjacent sections check → coalesce)
     3. Advisory revocation → TRANSMITTED_COA/ACTIVE_GRANTED plans → SUPERSEDED_EMERGENCY
     4. Displaced demands → SUBMITTED
     5. Corridor-scoped CP-SAT re-plan (≤35s budget)
     6. Sentinel structural checks (synchronous, sub-second)
     7. Plan persist → PROVISIONAL (incident bound) + ledger + SSE
     8. Response + measured wall time
     ```
   - Response message: *"✓ PROVISIONAL plan 8f2ab1… created in 12.3s (NFR-002 budget incl. synchronous structural re-check). Coalesced: no. Superseded: 2 plan(s). Awaiting Controller acknowledgment."*
   
3. **PROVISIONAL plan item** → purple badge + "**Acknowledge as Controller**" button:
   - POST `/emergency/incidents/{id}/acknowledge`
   - → incident ack → outbox transmit allowed → COA bridge ack → TRANSMITTED_COA
   - Controller ke ack ke bina plan ka kuch nahi hota (deadlock gate — by design)

**List mein incidents:** Section, type, est duration, coalesced tag (⧉), provisional plan id, controller ack status.

---

## 9️⃣ Audit Ledger (`/audit-ledger`)

**Kya dikhega:** Full-width table (sirf AUDITOR/ADMIN).

| seq | event | actor | prev_seq | prev_hash→hash | payload | at |
|---|---|---|---|---|---|---|
| 12 | PLAN_SENTINEL_PASSED | worker | 11 | 4f8ab…→0x… | {"plan_id":...} | ... |

**Buttons:**
- **🔐 Verify chain (REPEATABLE READ)**:
  - GET `/ledger/verify` → result card:
    ```
    ✓ tamper-EVIDENT chain intact — verified 54/54
    Method: full re-hash from sequence 1 under REPEATABLE READ snapshot isolation (FR-023).
    ```
  - Broken chain → red *"✗ CHAIN BROKEN"*
- **Search input** (event_type filter)
- Infinite scroll/pagination

**Neeche chhota text:** *"tamper-evident, not tamper-proof — Rules.md §3"*

---

## 🔁 COMPLETE E2E DEMO FLOW (Demo script ke liye — 5 min)

| Time | Kya karte ho | Kya hota hai system mein |
|---|---|---|
| 0:00 | Login `srdom_dli` | JWT mint hua |
| 0:20 | Dashboard | KPIs + escalated table |
| 0:40 | Weekly Planner → **Trigger solve** | CP-SAT solve, 8-20s |
| 1:00 | Plans list refresh | SENTINEL_PASSED plans dikhte hain |
| 1:15 | Approvals → plan select | Action Preview Card: 10/10 checks |
| 1:30 | **Approve** (Sr. DOM) | APPROVED_SR_DOM + decided_by |
| 1:45 | Login `drm_dli` → **Authorize & Seal** | AUTHORIZED_DRM + authorized_by (distinct!) |
| 2:00 | Login `controller_dli` → Plans → plan info | Plan AUTHORIZED_DRM |
| 2:15 | **Transmit** button | T-2h structural re-check → outbox → COA ack → TRANSMITTED_COA |
| 2:30 | **Activate** → **Complete-fitness** → **Archive** | ACTIVE_GRANTED → COMPLETED_FITNESS → ARCHIVED_SEALED |
| 3:00 | Disruptions → Preview → Fire breakdown | Blast radius modal → PROVISIONAL plan |
| 3:20 | **Acknowledge as Controller** | PROVISIONAL → transmit → TRANSMITTED_COA |
| 3:40 | Login `auditor` → **Verify chain** | 54/54 unbroken |
| 4:00 | Modify-after-verify attempt (pehle wala plan revise karo) | rev2 → DRAFT; approve kiro → **409 HASH_MISMATCH** |
| 4:30 | **SIMULATED DATA** watermark dikhao | Honesty label |
| 5:00 | Summary: "ML estimates; CP-SAT decides; Sentinel verifies; humans authorize; COA executes." | Wrap-up |

---

## 🛡️ HARR BHI KYA HAIN — STATUS BADGES (har jagah same)

| Badge | Color | Matlab |
|---|---|---|
| `DRAFT` | Gray ○ | Abhi banaya, Sentinel pending |
| `SENTINEL_PASSED` | Green 🛡 | 10/10 checks pass, approval ready |
| `APPROVED_SR_DOM` | Blue ✔ | Sr. DOM ne decide kiya |
| `AUTHORIZED_DRM` | Amber 🔒 | DRM ne authorize kiya |
| `TRANSMITTED_COA` | Blue 📡 | COA ko mila (ack hua) |
| `ACTIVE_GRANTED` | Red ⛔ | Line isolated, work chalu |
| `COMPLETED_FITNESS` | Green ✓ | Khuli line |
| `ARCHIVED_SEALED` | Gray 🗄 | History sealed |
| `SUPERSEDED` | Gray ⤴ | Revision replace hua |
| `SUPERSEDED_EMERGENCY` | Amber ⚠ | Emergency ne replace kiya |
| `CANCELLED` | Gray ✕ | Reject/cancel |
| `FAILED_ESCALATE` | Red ✗ | 3 attempts fail — human review |
| `PROVISIONAL` | **Purple ◆** | Emergency plan, Controller ack pending |

**Har badge automatically 3 cheezein dikhata hai:** icon + text + color (WCAG 1.4.1 colorblind-safe).

---

## 📌 IMPORTANT DESIGN POINTS

1. **STALE DATA overlay:** SSE stream drop hote hi (Redis down/crash) → **sab action buttons DISABLED** + persistent top banner. Controller kabhi bhi stale data pe action nahi kar sakta.
2. **SIMULATED DATA watermark:** Hamesha bottom-right, non-dismissible (har synthetic layer pe).
3. **Model estimates label:** Har delay figure ke saath *"model estimate (B1-relative, simulated data)"* — fake fact kabhi nahi.
4. **Hash mismatch banner:** Approve button disabled agar local hash ≠ server hash.
5. **Distinct approver:** DRM button label ALAG ("Authorize & Seal") + footer mein decided_by/authorized_by display.
6. **Emergency modal:** BLAST RADIUS dikhana mandatory — confirmation checkbox ke bina fire nahi ho sakta.

---

## 🏗️ FRONTEND ARCHITECTURE (design ke liye)

- **Pages (9):** Login, Dashboard, CorridorMap, StringChart, Planner26Week, PlannerWeekly, Approvals, Disruptions, AuditLedger
- **Shared components:** NavDrawer (role-filtered), StatusBadge, Card, ActionButton (stale pe disabled), PreviewCard, StaleOverlay, SimulatedWatermark
- **Live events (SSE):** BLOCK_ACTIVATED, PLAN_REVISED, SIGNAL_ACK, BLOCK_TRANSMITTED, PROVISIONAL_PLAN_CREATED, SOLVE_COMPLETED, SOLVE_FAILED — inko live badges/markers update karne ke liye use kar sakte ho
- **Auth:** localStorage token, JWT claims role/division — nav + permissions isi se
- **Strict TypeScript** — `tsc --noEmit` build gate

---

**Ab jo bhi design karna hain — login card, dashboard grid, map, string chart, 10-check card, emergency modal, ledger table, badges — sab ka exact behavior upar hai.** Isi hisaab se polish kar do, aur frontend-ready. Koi aur cheez chahiye toh bolo! 🚆