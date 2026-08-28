# DESIGN_PROMPT.md — RAIL-BLOC UI/UX Design Specification
## Basis: Documentation in `refer/` folder (Documents 1–8, Revision 1.1)
## Constraint: No color palette, branding, or visual styling analysis. Focus on structure, hierarchy, usability, layout, and information architecture only.

---

## 1. Project Overview

### Purpose

RAIL-BLOC (Automated Unified Rail Availability and Block Layout Optimization Coordinator) is an AI-powered maintenance block scheduling and safety verification platform for Indian Railways divisional control offices. It automates multi-department track maintenance planning across three engineering departments (Civil, Traction/TRD, Signal & Telecom) by mathematically solving scheduling conflicts, verifying safety rules, and managing a cryptographic approval chain.

The interface surfaces complex optimization outputs (block plans, train path conflicts, safety verification results) to human decision-makers who are the final authority before plans are transmitted to the Control Office Application (COA) for field execution.

### Target Users

Five distinct personas interact with the system, each with unique permissions and primary tasks:

| Persona | Role | Primary Interface Concern |
|---|---|---|
| Sr. DOM (Divisional Operations Manager) | Approves weekly block schedules; reviews delay impact | Approval workflow, impact summaries, safety verification card |
| DRM (Divisional Railway Manager) | Authorizes and locks the divisional schedule | Authorization lock interface, cross-departmental concurrence |
| Chief Controller (COA Dispatcher) | Executes digital block authorities in real-time | Live corridor map, disruption console, emergency response |
| Sr. DEN / Co (Civil Infrastructure Lead) | Views mechanized fleet allocations | 26-week calendar, tactical planner, machine rosters |
| SSE / Station Master | Certifies work completion and track fitness | Field clearance interface, signal acknowledgment |

### Core Objectives

1. Surface AI-optimized maintenance block schedules with full safety verification provenance
2. Enforce a multi-stage human approval chain with cryptographic binding
3. Provide real-time spatial and temporal situational awareness for live operations
4. Handle P0 emergency situations with a controlled provisional re-planning flow
5. Maintain a tamper-evident audit trail for all scheduling decisions

---

## 2. Information Architecture

### Page Hierarchy (AppFlow.md §1)

```
RAIL-BLOC Application
├── /login                        — Role-authenticated entry point
├── /dashboard                    — Executive overview (default landing after login)
├── /corridor-map                 — GIS spatial situational awareness
├── /string-chart                 — Time-distance train graph
├── /planner
│   ├── /planner/26-week          — Strategic rolling calendar
│   └── /planner/weekly           — Tactical block planning console
├── /approvals                    — Multi-stage approval workflow
├── /disruptions                  — Real-time incident & emergency console
└── /audit-ledger                 — Cryptographic audit trail browser
```

### Navigation Structure

- **Primary navigation:** Persistent sidebar visible on all authenticated pages. Contains links to all 8 functional routes. Collapsible for screen real estate.
- **Global header:** Present on all authenticated pages. Contains: system identity (RAIL-BLOC branding), live system status (solver latency, Sentinel verification state), live clock (IST), persona/role switcher, quick-access Emergency Override trigger, Audit Ledger shortcut, SSE connection health indicator.
- **No breadcrumbs documented.** Each page is accessed directly from sidebar navigation.
- **Modals / overlays:** Used for: Emergency Confirmation (blast-radius preview), Approval Action Preview Card, Audit Ledger Explorer (may be standalone page or modal — both patterns are implied).

### User Journeys (AppFlow.md §2)

**Primary Operational Flow (Routine):**
```
Login → Dashboard (demand overview) → Planner/26-week (strategic view) →
Planner/weekly (slot assignment) → Approvals (Sr. DOM review & sign-off) →
Approvals (DRM authorization) → Dashboard (dispatch status) → Disruptions (if incident)
```

**Emergency Re-planning Flow (P0):**
```
Dashboard or Corridor-Map (incident detected) → Disruptions (incident logged) →
Emergency Confirmation Modal (blast-radius review) → Disruptions (PROVISIONAL plan presented) →
Controller Acknowledgment Gate → Corridor-Map (updated live state)
```

**Audit / Verification Flow:**
```
Any page → Audit Ledger (hash chain browser) → Ledger Integrity Verification
```

### Content Organization Principles

- **Mission-critical data first:** Safety-critical states (`ESCALATED_OVERDUE`, `PROVISIONAL`, `STALE DATA`) must be surfaced at the top of any page or panel, never buried.
- **Every status has three representations:** color token + icon + text label (WCAG 1.4.1 requirement — no status conveyed by color alone).
- **Synthetic data is always labeled:** Any layer or data element sourced from simulated data carries a persistent, non-dismissible "SIMULATED DATA" watermark or label. This is a hard requirement, not a styling choice.
- **Model estimates are explicitly qualified:** Every metric derived from ML models (delay predictions, freight detention estimates, urgency scores) is labeled "model estimate (B1-relative, simulated data)".
- **Stale state disables actions:** When the SSE live feed disconnects, all action buttons (Approve, Authorize, Emergency Trigger) are disabled with a persistent "STALE DATA — actions disabled" overlay.

---

## 3. Screen-by-Screen Breakdown

### 3.1 `/login` — Authentication Page

**Purpose:** Role-based entry point. Authenticates users against their Indian Railways SSO credentials and establishes their persona (role + division scope).

**Key Sections:**
- Application identity (RAIL-BLOC name, system description)
- Credential entry form (SSO username, password)
- Division selector (after initial authentication)
- Role confirmation display (shows resolved role + division scope before proceeding)

**Required Components:**
- Login form with username/password fields
- Division scope selector (dropdown)
- Role display card (shows resolved persona: role name, division, badge ID)
- Error/rejection state display

**User Actions:**
- Enter credentials → Submit → Select division → Confirm role → Enter dashboard

**Data Displayed:** Resolved user persona (role, division, badge), authentication error messages

**Interactions:** Form submission, division selection, role confirmation

---

### 3.2 `/dashboard` — Executive Operations Overview

**Purpose:** Primary landing page post-login. Provides a high-level operational snapshot for Sr. DOM, DRM, and supervisory roles. Surfaces escalated/overdue demands that require human intervention (FSM-002).

**Key Sections:**
1. **KPI Ribbon** — 4 key performance indicators shown horizontally: Asset Availability, Multi-Department Bundling Efficiency, Passenger Punctuality Impact, Active Safety Gate (Sentinel verification rate). Each KPI shows: current value, unit, target, delta vs reference period, and a directional indicator.
2. **Escalated Demand List** — P0 priority panel showing demands in `ESCALATED_OVERDUE` state (failed 3 solver retry cycles). Each entry shows: demand ID, department, section, failure reason, timestamp. Requires human dispatch action.
3. **Active Block Count Summary** — Count of blocks in each lifecycle state (AUTHORIZED_DRM, TRANSMITTED_COA, ACTIVE_GRANTED, COMPLETED_FITNESS).
4. **Machine Utilization Summary** — Counts of assigned vs idle mechanized machines.
5. **Quick Navigation Cards** — Shortcuts to Planner, Approvals, Corridor Map, String Chart.

**Required Components:**
- `KpiRibbon` (4 metrics)
- `DemandEscalationList` (NEW — overdue demands, mandatory per FSM-002)
- `BlockCountSummary` (state distribution widget)
- `MachineUtilizationSummary`
- `StaleStateOverlay` (persistent when SSE disconnected)
- `SimulatedDataWatermark` (on synthetic metric layers)

**User Actions:** Review escalated demands → Navigate to Planner or Approvals to resolve. Click block counts to filter view.

**Data Displayed:** KPI values (labeled as model estimates), escalated demand list, block state counts, machine counts

**Interactions:** Click escalated demand → Navigate to `/approvals` or `/planner/weekly`. Click KPI card → Drill-down detail.

---

### 3.3 `/corridor-map` — GIS Corridor Spatial Map

**Purpose:** Real-time spatial situational awareness. Shows the rail network with active maintenance blocks, live train positions (RTIS), and OHE feeding-section boundaries. Primary view for the Chief Controller during live operations.

**Key Sections:**
1. **Map Canvas (Full Screen)** — MapLibre GL JS vector tile map occupying the main content area.
2. **Layer Control Panel** — Toggles for: track centerlines, station markers, active block hazard corridors, live RTIS train positions, OHE feeding-section boundary overlays.
3. **Section Detail Popover** — Hover/click on a track section to display: section code, current health indices (GMT, defect count), scheduled maintenance windows, active block status.
4. **SIMULATED DATA Watermark** — Non-dismissible, persistent overlay on the map canvas for all synthetic data layers.
5. **Stale-State Overlay** — Covers the entire map when SSE disconnects; disables all action buttons.
6. **Live Train Markers** — Animated position markers for trains from RTIS feed.
7. **Block Heatmap** — Colored corridor overlays indicating block density and department type.

**Required Components:**
- `GISCorridorMap` (MapLibre GL JS — core component)
- `LayerControlPanel` (toggle panel)
- `SectionDetailPopover` (hover/click context)
- `SimulatedDataWatermark` (persistent, non-dismissible)
- `StaleStateOverlay` (persistent when SSE disconnected)
- `BlockHeatmapLegend` (color/status legend)

**User Actions:** Pan/zoom map, toggle layers, hover/click sections for detail, trigger Emergency Override from header.

**Data Displayed:** Track geometries, station markers, block zones (by department and status), live train positions (RTIS), OHE feeding boundaries, section health indices on hover.

**Interactions:** Map pan/zoom, section hover (popover), section click (detailed side panel), layer toggle, block zone click (link to plan detail).

---

### 3.4 `/string-chart` — Time-Distance Train Graph

**Purpose:** Interactive time-distance (string chart) view showing train trajectory lines and maintenance block intervals on a single corridor section. Used by Traffic Controllers to visualize conflicts between passenger/freight trains and maintenance blocks.

**Key Sections:**
1. **Canvas Area** — HTML5 Canvas rendering the time-distance graph. X-axis: kilometer distance (0–250 km). Y-axis: 24-hour time window.
2. **Train Path Lines** — Sloped lines per train. Direction indicated by slope. Train classification distinguishable by visual encoding (shape/pattern, not color alone).
3. **Maintenance Block Rectangles** — Semi-transparent rectangular overlays. Multi-department shadow blocks display a striped diagonal pattern combining department visual encodings.
4. **Section / Date Selector** — Dropdown/filters to select the corridor section and date window.
5. **Tooltip** — On hover over train line or block rectangle: shows train number/type, block ID, department, status, time window.
6. **Legend** — Train types, block types, department encodings.
7. **SIMULATED DATA Watermark** — Non-dismissible on all synthetic layers.
8. **Stale-State Overlay** — Persistent when SSE disconnects.

**Required Components:**
- `TimeDistanceStringChart` (HTML5 Canvas — core component)
- `SectionDateSelector` (filter panel)
- `StringChartTooltip` (hover context)
- `StringChartLegend`
- `SimulatedDataWatermark`
- `StaleStateOverlay`

**User Actions:** Pan/zoom the chart on both axes, hover train/block to see detail, filter by section, filter by date.

**Data Displayed:** Train paths (from WTT + RTIS), maintenance block windows (from block plan), headway margins, shadow block co-allocations.

**Interactions:** Canvas pan/zoom (dual-axis), element hover (tooltip), click block → link to plan detail, section/date filter.

---

### 3.5 `/planner/26-week` — 26-Week Rolling Calendar

**Purpose:** Strategic-horizon view showing the 26-week rolling block allocation calendar for divisional coordination. Used by DRM and Branch Officers to oversee long-term maintenance scheduling.

**Key Sections:**
1. **26-Week Gantt Timeline** — Horizontal scrollable timeline. X-axis: 26-week sliding window (labeled by week number and date range). Y-axis: Track sections or corridors.
2. **Block Allocation Bars** — Colored bars indicating allocated maintenance windows per section per week. Bar width represents duration. Department encoded via visual pattern.
3. **Workload Heatmap Indicators** — Per-week load intensity shown in row or column header (e.g., % utilization).
4. **Current Week Indicator** — Vertical marker on the current week.
5. **Filter Panel** — Filter by division, section, department, block status.
6. **Block Detail Popover** — Click a block bar to see: plan ID, section, primary demand, shadow demands, status, approval state.

**Required Components:**
- `TwentySixWeekGanttCalendar` (core component — custom Gantt, not a day picker)
- `WeekLoadHeatmapIndicator`
- `BlockDetailPopover`
- `GanttFilterPanel`
- `SimulatedDataWatermark`

**User Actions:** Scroll timeline, click block bar for detail, filter by section/department, navigate to weekly planner for a specific week.

**Data Displayed:** 26-week block allocation map, per-week load indicators, block approval statuses, section identifiers.

**Interactions:** Horizontal scroll, click block bar (popover), filter controls, week → navigate to `/planner/weekly`.

---

### 3.6 `/planner/weekly` — Tactical Weekly Block Planning Console

**Purpose:** Granular week-level planning console. Displays the current 7-day operational window with minute-level slot assignments. Used by Sr. DOM and Sr. DEN to review, fine-tune, and submit block plans for approval. Any edit to a plan after `SENTINEL_PASSED` creates a new revision and clears sentinel verification.

**Key Sections:**
1. **Week Navigator** — Shows the current planning week (default: next Thursday 15:00 trigger) and allows navigation to adjacent weeks.
2. **Demand Queue Panel** — List of pending maintenance demands (from TMS/TDMS/SMMS) with: ID, department, asset, urgency score (labeled "ML estimate"), priority, requested slot, status.
3. **Block Schedule Grid** — Time-slot grid (per section, per day). Allocated blocks shown as colored intervals. Shadow bundles shown with multi-department visual encoding.
4. **Shadow Bundle Indicator** — Highlight for co-allocated multi-department blocks. Expandable to show all co-allocated demands.
5. **Solver Status Banner** — Shows the last solver run's CP-SAT status (OPTIMAL/FEASIBLE/INFEASIBLE/UNKNOWN) and best bound. Always present, not dismissible.
6. **Machine Roster Panel** — Shows mechanized machine assignments from the VRP sub-model (machine ID, assigned section, travel window, depot origin).
7. **Action Buttons** — "Trigger Solver" (Sr. DOM only), "Submit for Approval" (navigates to /approvals), "View Impact Summary".
8. **Revision Warning Banner** — If the plan in view has been edited after `SENTINEL_PASSED`, displays "Plan changed — new revision created, Sentinel re-verification required."

**Required Components:**
- `WeekNavigator`
- `DemandQueuePanel` (with urgency score freshness badges)
- `BlockScheduleGrid` (time-slot visualization)
- `ShadowBundleIndicator`
- `SolverStatusBanner` (OPTIMAL/FEASIBLE/INFEASIBLE/UNKNOWN — always visible)
- `MachineRosterPanel`
- `RevisionWarningBanner`
- `SimulatedDataWatermark`
- `StaleStateOverlay`

**User Actions:** Review demand queue, view block allocations, fine-tune slots (triggers revision), trigger solver run, navigate to `/approvals`.

**Data Displayed:** 7-day block schedule, demand queue (with ML-labeled urgency scores), shadow bundle details, machine rosters, solver status + bound.

**Interactions:** Block slot interaction (triggers revision warning), solver trigger, demand detail expand, navigate to approvals.

---

### 3.7 `/approvals` — Multi-Stage Approval Workflow

**Purpose:** Administrative sign-off interface for Sr. DOM (decides) and DRM (authorizes). The central safety-critical UI surface — the Action Preview Card shown here is the last human review gate before a plan reaches COA. Contains the enumerated 10-check Sentinel verification display.

**Key Sections:**
1. **Plan Queue** — List of plans awaiting action for the current persona's role. Shows: plan ID, section, start/end time, department, current status badge, hash-match state.
2. **Action Preview Card (Hardened)** — The primary detail view for a selected plan. Contains:
   - **WHAT:** Section name, start time, end time, duration
   - **WHY:** Ingested defect severity, asset ID, freshness badge (showing `source_ingested_at` staleness)
   - **SHADOW CLUSTER:** Co-allocated demands (department, work type)
   - **IMPACT ANALYSIS:** Predicted passenger delay, freight detention, machine utilization — each labeled "model estimate (B1-relative, simulated data)"
   - **SAFETY VERIFICATION:** Enumerated 10-check list (G&SR-1 through G&SR-5, MILP-C1 through MILP-C5), each with pass/fail indicator (icon + text, not color alone). Headline reads "SAFETY VERIFICATION: N/10 CHECKS PASSED" where N is computed from actual check results.
   - **STATE BADGE:** Current lifecycle state of the plan (SENTINEL_PASSED, APPROVED_SR_DOM, AUTHORIZED_DRM, PROVISIONAL, etc.)
   - **REVISION INTEGRITY BANNER:** If local `content_hash` does not match server's current hash — shows "Plan changed — reload to review latest revision" and disables the Approve button.
3. **Approval Action Row:**
   - **[ Approve & Digitally Sign ]** — Enabled only for the correct role and when plan is in the correct state with hash match. Disabled when stale or hash-mismatched.
   - **[ Modify Parameters ]** — Creates new plan revision immediately; clears `sentinel_verified`; resets state badge to DRAFT.
   - **[ Reject Plan ]** — Rejects with mandatory reason entry.
4. **Distinct-Approver Guard Display** — When the DRM authorization step is active, shows whether the current actor is the same as `decided_by`. If they match, the Authorize button is permanently disabled with an explanatory message.
5. **Approval Chain Progress** — Visual timeline showing the full approval chain states: DRAFT → SENTINEL_PASSED → APPROVED_SR_DOM → AUTHORIZED_DRM → TRANSMITTED_COA.

**Required Components:**
- `PlanApprovalQueue` (list with status badges and hash-match indicators)
- `ActionPreviewCard` (hardened — the critical component)
  - `SentinelCheckList` (10 enumerated checks, icon + text per check)
  - `ImpactSummaryPanel` (with model-estimate labels)
  - `ShadowClusterPanel`
  - `FreshnessBadge` (per ingested source)
  - `RevisionIntegrityBanner` (hash-mismatch state)
  - `StateBadge` (12-state FSM-aligned)
- `ApprovalActionRow` (Approve / Modify / Reject buttons)
- `DistinctApproverGuard` (blocks self-authorization)
- `ApprovalChainProgress` (state timeline)
- `StaleStateOverlay`

**User Actions:** Review plan queue → Select plan → Review Action Preview Card → Approve/Modify/Reject. DRM: Authorize (only if distinct from Sr. DOM who decided).

**Data Displayed:** Plan details, defect severity + freshness, shadow cluster, impact estimates (labeled), 10-check Sentinel results, current state badge, revision hash state, approver identity.

**Interactions:** Plan selection, Approve (triggers digital signature flow), Modify (triggers revision creation), Reject (requires reason), Authorize (DRM step, blocks if same actor).

---

### 3.8 `/disruptions` — Real-Time Incident Response Console

**Purpose:** Full-page incident management and emergency re-planning console for the Chief Controller. Handles P0 emergency events (rail fractures, OHE breakdowns, signal failures, severe weather). Shows the PROVISIONAL re-plan output and requires Controller acknowledgment before treating it as authoritative.

**Key Sections:**
1. **Active Incidents Panel** — List of open incidents with: section, type, severity, reported time, coalescing status (if merged with adjacent incident), current response state.
2. **Incident Detail View** — Selected incident shows: affected sections, trains currently held, plans being superseded, estimated restoration time.
3. **Emergency Action Trigger** — "Trigger P0 Override" button. Always requires the Emergency Confirmation Modal before firing.
4. **Emergency Confirmation Modal (Blast Radius Preview)** — Shown before `/api/v1/emergency/breakdown` is called. Displays:
   - Trains currently held
   - Plans being superseded (list with plan IDs and sections)
   - Affected sections
   - Incident coalescing alert (if a concurrent adjacent incident exists)
   - Confirmation checkbox ("I acknowledge the blast radius of this action")
   - Incident type selector (TRACK_FRACTURE, OHE_BREAKDOWN, SIGNAL_FAILURE, OTHER)
5. **PROVISIONAL Plan Display** — After emergency solver completes: shows the resulting re-plan with `PROVISIONAL` state badge, Sentinel verification status, and the Controller Acknowledgment Gate.
6. **Controller Acknowledgment Gate** — "Acknowledge as Authoritative" button. Only the Chief Controller can press this. Until pressed, the plan is `PROVISIONAL` and not treated as authoritative.
7. **Incident Coalescing Indicator** — If a second incident was opened on an adjacent section within the same window, it is shown as coalesced into the primary incident.
8. **Disruption Scenario Panel** — Shows re-planning details: freight rakes held at loop lines, passenger diversions, single-line working status.

**Required Components:**
- `ActiveIncidentsList`
- `IncidentDetailView`
- `EmergencyTriggerButton` (always requires confirmation modal)
- `EmergencyConfirmModal` (blast-radius preview — mandatory before API call)
  - `BlastRadiusPanel` (trains held, plans superseded, affected sections)
  - `IncidentTypeSelector` (4 types)
  - `CoalescingAlert`
  - `AcknowledgmentCheckbox`
- `ProvisionalPlanDisplay` (with PROVISIONAL badge and Sentinel verification token)
- `ControllerAcknowledgmentGate`
- `CoalescingStatusIndicator`
- `StaleStateOverlay`
- `SimulatedDataWatermark`

**User Actions:** Review active incidents, select incident, trigger emergency override (confirmation required), review PROVISIONAL plan, acknowledge as authoritative.

**Data Displayed:** Active incidents (type, section, time, coalescing), blast radius summary, PROVISIONAL re-plan details, Sentinel structural check results (pass/fail, 4-check subset for emergency), trains held, plans superseded.

**Interactions:** Incident selection, Emergency Trigger (multi-step: button → confirmation modal → API call), PROVISIONAL plan review, Controller acknowledgment.

---

### 3.9 `/audit-ledger` — Cryptographic Audit Ledger Browser

**Purpose:** Tamper-evident audit trail for Vigilance Officers and Auditors. Allows browsing and verifying the SHA-256 hash chain. The ledger is labeled tamper-evident (not tamper-proof) throughout the interface.

**Key Sections:**
1. **Ledger Event Table** — Paginated table of all ledger events, each row showing: sequence number, event ID, event type, actor, timestamp, block ID, hash (truncated), prev hash (truncated), verification badge.
2. **Hash Chain Verification Banner** — Shows last verification run result: "N events verified, unbroken chain" or "Chain broken at sequence X". Labeled "tamper-evident verification".
3. **Verify Chain Button** — Triggers the full chain verification pass (calls `/api/v1/ledger/verify`). Shows a progress indicator during verification.
4. **Event Detail Drawer** — Click an event to expand: full hash, full prev hash, full payload JSON, actor details, timestamp, linked plan/block ID.
5. **Search / Filter** — Filter by: event type, actor, date range, block ID.

**Required Components:**
- `LedgerEventTable` (with hash, prev hash, verification badge per row)
- `HashChainVerificationBanner` (tamper-evident terminology enforced)
- `VerifyChainButton` (with loading state)
- `EventDetailDrawer`
- `LedgerSearchFilter`

**User Actions:** Browse events, filter by type/actor/date, click event for full detail, trigger chain verification.

**Data Displayed:** All audit events (actor, type, timestamp, block ID, hash, prev hash, verification status), chain continuity status.

**Interactions:** Table pagination, row click (detail drawer), filter controls, verify chain trigger.

---

## 4. Component Architecture

### 4.1 Global / Shell Components

| Component | Purpose | Used On |
|---|---|---|
| `Sidebar` | Primary navigation — links to all 8 routes, collapsible | All authenticated pages |
| `Header` | System status, persona switcher, emergency shortcut, ledger shortcut, SSE health | All authenticated pages |
| `StaleStateOverlay` | Non-dismissible overlay when SSE feed is disconnected; disables all action buttons | All pages with live data |
| `SimulatedDataWatermark` | Non-dismissible watermark on all synthetic data layers | Corridor Map, String Chart, all dashboards |
| `StateBadge` | 12-state FSM-aligned plan state display — always icon + text + color | Approvals, Plan Queue, Disruptions |
| `SolverStatusBanner` | CP-SAT solver status (OPTIMAL/FEASIBLE/INFEASIBLE/UNKNOWN) + best bound | Weekly Planner |

### 4.2 Shared Data Display Components

| Component | Purpose |
|---|---|
| `KpiMetricCard` | Single KPI display: value, unit, target, delta, tone |
| `DemandEscalationRow` | Single escalated demand row: ID, department, failure reason, timestamp |
| `BlockStatusPill` | Inline block status badge: icon + text + color token (WCAG 1.4.1) |
| `FreshnessBadge` | Shows `source_ingested_at` staleness for ingested data items |
| `ModelEstimateLabel` | Inline label appended to any ML-derived metric: "(model estimate — B1-relative, simulated data)" |
| `DepartmentTag` | Department identifier (Civil, TRD, S&T) — always with icon + text, never color only |
| `SentinelCheckRow` | Single Sentinel check result: rule ID, rule name, pass/fail icon, detail text |
| `SentinelCheckList` | 10-check enumerated list composing `SentinelCheckRow` items |

### 4.3 Form Components (Used in Approvals and Emergency Flows)

| Component | Purpose |
|---|---|
| `ApprovalDecisionForm` | Approve or Reject a plan with digital signature entry |
| `RejectionReasonInput` | Free-text reason entry required on plan rejection |
| `EmergencyIncidentForm` | Incident type selection, section ID entry, duration estimate, confirmation checkbox |
| `AcknowledgmentCheckbox` | Explicit acknowledgment of blast-radius consequences (Emergency flow) |

### 4.4 Modal / Overlay Components

| Component | Purpose |
|---|---|
| `ActionPreviewCard` | Full plan detail modal for Sr. DOM approval — the primary safety review surface |
| `EmergencyConfirmModal` | Blast-radius preview before emergency API is called — mandatory step |
| `EventDetailDrawer` | Audit ledger event full-detail side drawer |
| `SectionDetailPopover` | GIS map section hover popover |
| `BlockDetailPopover` | 26-week Gantt block bar click popover |

### 4.5 Specialized Visualization Components

| Component | Purpose | Technology |
|---|---|---|
| `GISCorridorMap` | Interactive rail network spatial map with live overlays | MapLibre GL JS |
| `TimeDistanceStringChart` | Time-distance train graph with block intervals | HTML5 Canvas |
| `TwentySixWeekGanttCalendar` | 26-week rolling block allocation Gantt | Custom (horizontal scroll, React) |
| `BlockScheduleGrid` | 7-day tactical block slot grid | Custom (React) |
| `ApprovalChainProgress` | Visual timeline of approval chain states | Custom (React) |

---

## 5. Layout Guidelines

### 5.1 Global Page Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│ HEADER (fixed, 64px height)                                              │
│ [Logo + Title] [System Status Pills] [Live Clock] [Actions] [Persona]    │
├────────────┬─────────────────────────────────────────────────────────────┤
│ SIDEBAR    │ MAIN CONTENT AREA (scrollable)                              │
│ (248px or  │                                                             │
│  76px      │ [Page Title + Division Badge]                               │
│  collapsed)│ [Page-specific content — see per-page layout below]         │
│            │                                                             │
│ [Nav Items]│ [Footer: version info + simulated data notice]             │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 5.2 Per-Page Layout Patterns

**Dashboard (`/dashboard`) — Vertical Stack:**
```
[KPI Ribbon — 4 cards, horizontal]
[Escalated Demand List — full width, priority panel]
[Block State Count Summary + Machine Utilization — 2-column grid]
[Quick Navigation Cards — 4-card grid]
```

**Corridor Map (`/corridor-map`) — Map-Dominant:**
```
[Layer Control Panel — left sidebar overlay, 280px]
[Map Canvas — fills remaining space]
[Section Detail Popover — on hover/click]
[SIMULATED DATA Watermark — absolute, persistent on map]
[Stale-State Overlay — absolute, covers map when SSE down]
```

**String Chart (`/string-chart`) — Chart-Dominant:**
```
[Section / Date Selector — top bar, 48px]
[Canvas Chart — fills remaining height]
[Legend — bottom strip]
[SIMULATED DATA Watermark — absolute, persistent]
[Stale-State Overlay — absolute, covers canvas when SSE down]
```

**26-Week Planner (`/planner/26-week`) — Horizontal Scroll Gantt:**
```
[Filter Panel — top bar]
[Section Labels — left column, fixed 200px]
[Gantt Timeline — horizontally scrollable, fills remaining]
[Current Week Marker — vertical overlay]
```

**Weekly Planner (`/planner/weekly`) — Multi-Panel:**
```
[Week Navigator + Solver Status Banner — top bar]
[Demand Queue — left panel, 320px]
[Block Schedule Grid — center, fills remaining]
[Machine Roster Panel — right panel, 280px]
[Revision Warning Banner — sticky below top bar, only when hash mismatch]
```

**Approvals (`/approvals`) — Split Panel:**
```
[Plan Queue — left panel, 360px, scrollable]
[Action Preview Card — right panel, fills remaining]
  ├── [WHAT: section details]
  ├── [WHY: defect + freshness badge]
  ├── [SHADOW CLUSTER: co-allocated demands]
  ├── [IMPACT ANALYSIS: model-estimated metrics]
  ├── [SAFETY VERIFICATION: 10-check list]
  ├── [STATE BADGE]
  ├── [REVISION INTEGRITY BANNER — conditional]
  └── [APPROVAL ACTION ROW: Approve / Modify / Reject]
```

**Disruptions (`/disruptions`) — Incident-Focus:**
```
[Active Incidents Panel — left panel, 360px]
[Incident Detail View — right panel, fills remaining]
  ├── [Blast Radius Summary]
  ├── [PROVISIONAL Plan Display — appears after solver]
  ├── [Sentinel Check Results — emergency subset]
  └── [Controller Acknowledgment Gate]
[Emergency Confirm Modal — overlay on trigger]
```

**Audit Ledger (`/audit-ledger`) — Table-Dominant:**
```
[Hash Chain Verification Banner — top bar]
[Search/Filter Panel — below banner]
[Ledger Event Table — main content, paginated]
[Event Detail Drawer — right-side overlay on row click]
```

### 5.3 Content Grouping Rules

1. **Safety-critical alerts always appear above the fold.** `StaleStateOverlay`, `RevisionIntegrityBanner`, `DemandEscalationList`, and `ProvisionBadge` are never scrolled below the initial viewport.
2. **Model estimates are grouped together.** In the Action Preview Card, the IMPACT ANALYSIS section groups all ML-derived figures and labels them collectively with the model-estimate disclaimer.
3. **Sentinel checks are always enumerated, never summarized alone.** The count "N/10 CHECKS PASSED" appears alongside the full enumerated list — never as the only representation.
4. **Department groupings are consistent.** Civil (ENG), TRD, and S&T are always displayed in this order in all multi-department contexts (shadow cluster, block schedule legend, filter dropdowns).
5. **Status tokens are tripled.** Every status is always color + icon + text. No exceptions per WCAG 1.4.1.

### 5.4 Responsive Behavior

- **Large screens (≥1280px):** Full sidebar expanded (248px) + full content width. All panels visible simultaneously (split panels, multi-column grids).
- **Medium screens (768–1279px):** Sidebar collapsible (defaults to 76px icon-only). Some right-side panels collapse into tabs.
- **Small screens (<768px):** Sidebar hidden (hamburger trigger). Content panels stack vertically. Map and canvas charts remain full-width but controls move to top/bottom bars.
- **The GIS map and string chart canvas always maintain their visual prominence regardless of breakpoint.**

### 5.5 Visual Hierarchy Principles

1. **Information density is high.** This is a mission-critical operations console, not a marketing surface. Dense information presentation with clear typographic hierarchy is preferred over sparse whitespace.
2. **Monospaced numeric figures for operational data.** All times, distances, durations, speeds, and identifiers (train numbers, block IDs, hash values) use tabular/monospaced typeface.
3. **State is always explicit.** Nothing is implied. Every plan, demand, block, and system component shows its current state label.
4. **Human authority is clear.** Actions available to the current persona are highlighted; actions outside their permission are either hidden or explicitly disabled with a reason.
5. **The approval button is the most important interactive element on the approvals page.** Its enabled/disabled state must be visually unambiguous and its enabling conditions (hash match, correct role, correct plan state) must be visible nearby.

---

## 6. Functional Requirements Mapping

| FR ID | Feature | Page | Component | User Interaction |
|---|---|---|---|---|
| FR-001 | TMS Ingestion Engine | `/planner/weekly` | `DemandQueuePanel` (shows ingested demands) | View ingested demands with freshness badges |
| FR-002 | TDMS Ingestion Engine | `/planner/weekly` | `DemandQueuePanel` (TRD demands) | View ingested TRD demands |
| FR-003 | SMMS Ingestion Engine | `/planner/weekly` | `DemandQueuePanel` (S&T demands) | View ingested S&T demands |
| FR-004 | WTT Corridor Parser | `/string-chart` | `TimeDistanceStringChart` (train paths) | View train paths derived from WTT |
| FR-005 | FOIS Freight Forecaster | `/string-chart`, `/planner/weekly` | `StringChart` freight lines, `DemandQueue` | View freight forecasts with confidence labels |
| FR-006 | Mathematical Graph Assembler | Backend only | `SolverStatusBanner` (shows when graph assembly is running) | No direct interaction |
| FR-007 | CP-SAT Multi-Horizon Solver | `/planner/weekly` | `SolverStatusBanner`, Trigger button | Initiate solver run (Sr. DOM), view solver status + bound |
| FR-008 | Multi-Department Shadow Bundling | `/planner/weekly`, `/approvals` | `ShadowBundleIndicator`, `ShadowClusterPanel` | View co-allocated shadow bundles |
| FR-009 | Track Machine Route Optimizer | `/planner/weekly` | `MachineRosterPanel` | View machine assignments and travel windows |
| FR-010 | Deterministic Sentinel Verification | `/approvals` | `SentinelCheckList` (10-check enumeration) | Review each check result in Action Preview Card |
| FR-011 | Fail-Closed Violation Interceptor | `/dashboard`, `/planner/weekly` | `DemandEscalationList`, `RevisionWarningBanner` | View escalated demands after retry cap |
| FR-012 | 26-Week Rolling Calendar View | `/planner/26-week` | `TwentySixWeekGanttCalendar` | Scroll and inspect 26-week plan |
| FR-013 | Tactical Weekly Schedule Generator | `/planner/weekly` | `BlockScheduleGrid`, `WeekNavigator` | View and interact with weekly block schedule |
| FR-014 | Sr. DOM Approval Workflow | `/approvals` | `ActionPreviewCard`, `ApprovalActionRow` | Approve/Modify/Reject plan; digital signature |
| FR-015 | DRM Divisional Locking Gate | `/approvals` | `DistinctApproverGuard`, `ApprovalActionRow` | Authorize (only if distinct from decided_by) |
| FR-016 | COA Real-Time Dispatch Adapter | `/dashboard`, `/disruptions` | `BlockCountSummary` (TRANSMITTED_COA state) | View transmission status; no manual trigger in UI |
| FR-017 | Digital Disconnection / Reconnection | `/disruptions`, `/audit-ledger` | `LedgerEventTable` (field clearance events) | View SSE field certification events |
| FR-018 | P0 Emergency Breakdown Override | `/disruptions` | `EmergencyTriggerButton`, `EmergencyConfirmModal` | Trigger emergency; review blast radius; confirm |
| FR-019 | Weather Risk Adapter | `/disruptions`, `/planner/weekly` | Weather alert banner (on affected sections) | View weather-deferred demands |
| FR-020 | Time-Distance Train Graph | `/string-chart` | `TimeDistanceStringChart` | Pan/zoom, hover for train/block detail |
| FR-021 | GIS Corridor Spatial Map | `/corridor-map` | `GISCorridorMap` | Pan/zoom map, hover sections, toggle layers |
| FR-022 | Cryptographic Ledger Append | `/audit-ledger` | `LedgerEventTable` | Browse all ledger events |
| FR-023 | Ledger Integrity Verification Suite | `/audit-ledger` | `VerifyChainButton`, `HashChainVerificationBanner` | Trigger verification; view result |
| FR-024 | Simulation Benchmarking Suite | Admin only (not in main nav) | Separate admin console | Run benchmark (Admin role) |
| FR-025 | Role-Based Access Control (RBAC) | All pages | `Header` (persona display), all action buttons | Action buttons show/hide/disable based on persona role |
| FR-026 | Plan Revision & Content-Hash Binding | `/approvals`, `/planner/weekly` | `RevisionIntegrityBanner`, `StateBadge` | See revision state; Approve button disabled on hash mismatch |
| FR-027 | Distinct-Approver Enforcement | `/approvals` | `DistinctApproverGuard` | DRM authorize blocked if same actor as Sr. DOM |
| FR-028 | Emergency PROVISIONAL Workflow | `/disruptions` | `ProvisionalPlanDisplay`, `ControllerAcknowledgmentGate` | View PROVISIONAL plan; acknowledge as authoritative |
| FR-029 | OHE Boundary & Interlocking Acknowledgment | `/approvals`, `/planner/weekly` | `SentinelCheckList` (G&SR-2, G&SR-4), `SignalAcknowledgmentGate` | View check results; S&T plans require SM + Controller ack |
| FR-030 | Ingestion Source Authentication | `/planner/weekly` | `FreshnessBadge` (per demand) | View source freshness/staleness on each demand |

---

## 7. Missing Requirements and Documentation Gaps

### 7.1 Ambiguous Requirements

| Item | Source | Ambiguity |
|---|---|---|
| `/login` route implementation | AppFlow.md §1 | Documentation states "Indian Railways SSO credentials" but does not specify whether the frontend should implement SSO directly, a mock login form, or a redirect flow. The existing Bolt scaffold has no login page at all. |
| 26-week Gantt Y-axis structure | FR-012, AppFlow.md §1 | It is unclear whether the Y-axis represents individual track sections, corridors, or departments. The documentation says "corridor block allocations" without specifying the unit. |
| MapLibre GL JS tile source | FR-021, Design.md §3 | Documentation specifies MapLibre GL JS vector rendering with "custom rail vector tiles" but does not specify where tile data comes from (synthetic seed data, OpenRailwayMap, Indian Railways GIS) or the tile server endpoint. |
| SSE stream connection management | Design.md §3, TechSpec §4 | The Stale-State Overlay triggers when the SSE heartbeat lapses, but no timeout duration is specified in any document. |
| Digital signature implementation | FR-014, Design.md §3 | "Captures cryptographic digital signature upon approval" — the UI component for this is not specified. Is it a PIN entry, a typed passphrase, a PKI-backed signature, or a mock? The PRD does not specify. |
| Field Mobile Terminal | FR-017, ImplementationPlan TASK-039 | Described as a "mock API" for SSE track fitness clearance. No UI surface is described for this in any of the 8 documents. |

### 7.2 Missing Flows

| Flow | Source | Gap |
|---|---|---|
| Weather-deferred demand display | FR-019 | AppFlow.md Scenario C describes automatic deferral of outdoor work under weather alerts, but no UI surface (page, panel, or component) is specified for showing weather-deferred demands to the user. |
| Simulation Benchmarking UI | FR-024 | The benchmarking suite is documented as an "Admin console execution" but no page or route for this admin console is defined in AppFlow.md §1's sitemap. |
| Freight forecaster confidence bounds | FR-005 | TechSpec §2 specifies that FOIS forecasts include probabilistic occupancy weights (confidence bounds), but no UI component is documented to display these bounds on the String Chart or elsewhere. |
| Machine breakdown sub-flow | AppFlow.md Scenario B | The machine in-block breakdown scenario (SSE logs breakdown → Actuator freezes train authorities → rescue engine routed) does not map to any documented UI surface in the `/disruptions` page spec. |
| BDMS Manual Upload | TechSpec §4 | The `/api/v1/demands/ingest` endpoint has a `BDMS_MANUAL` path for manual engineer uploads, but no UI form or page for manual demand upload is documented in any of the 8 files. |

### 7.3 Potential Gaps in Documentation

| Item | Notes |
|---|---|
| Benchmark / Admin Console route | FR-024 requires a simulation benchmarking suite executable from an "Admin console." No route or page is listed in AppFlow.md §1's sitemap for this. A route like `/admin/benchmark` is implied but never stated. |
| Sr. DEN and SSE personas on specific pages | PRD §3 names Sr. DEN and SSE as users but AppFlow.md §1 does not describe any page specifically tailored to their view (e.g., a machine fleet schedule page for Sr. DEN, or a field clearance page for SSE). Their needs are partially served by the Weekly Planner and Audit Ledger. |
| OHE feeding-section boundary display | FR-021 / SAFE-004 mentions OHE feeding-section boundaries as a layer on the GIS map. The map layer toggle and visual encoding for this boundary are not described beyond "OHE feeding-section boundaries" in Design.md §3. |
| Notification / alert system | No toast, notification, or push-alert system for real-time state transitions (e.g., "plan authorized by DRM") is described in any document. |
| Pagination / scrolling specification | The Audit Ledger table may contain very large numbers of events but no pagination size, infinite scroll, or virtualization specification is given. |

---

*Design prompt generated from documentation basis: `refer/1__PRD.md`, `refer/2__TechSpec.md`, `refer/3__AppFlow.md`, `refer/4__Design.md`, `refer/5__Schema.md`, `refer/6__ImplementationPlan.md`, `refer/7__Tracker.md`, `refer/8__Rules.md` (all Revision 1.1 — Post-Audit Hardened). No color palette, branding, or visual styling assumptions introduced beyond what is explicitly documented.*
