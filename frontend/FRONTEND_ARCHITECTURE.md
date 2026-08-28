# FRONTEND_ARCHITECTURE.md — RAIL-BLOC Frontend Architecture
## Source: DESIGN_PROMPT.md (Revision 1.1 — Post-Audit Hardened)
## Framework: Next.js 13 App Router · TypeScript · Tailwind CSS · shadcn/ui

---

## 1. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 13 (App Router) | Current project baseline; supports server/client component split |
| Language | TypeScript (strict mode) | Required by Rules.md §4 |
| Styling | Tailwind CSS + shadcn/ui | Current project baseline; design tokens in `globals.css` |
| Animation | Framer Motion | Already in project; used for sidebar, status pills |
| Visualization — Map | MapLibre GL JS | Explicitly specified in FR-021, Design.md §3 |
| Visualization — Chart | HTML5 Canvas (custom) | Explicitly specified in FR-020, Design.md §3 |
| Visualization — Gantt | Custom React (horizontal scroll) | FR-012 requires a custom Gantt, not a day picker |
| Visualization — Grid | Custom React | FR-013 — 7-day block schedule grid |
| State Management | React Context + useReducer | See §5 — no external state library required given data scope |
| Server State / Caching | React Server Components + fetch | For static/infrequent data; SSE for live data |
| Live Data | Server-Sent Events (SSE) | TechSpec §4 — `/api/v1/stream/live-blocks` |
| Icons | Lucide React | Current project baseline (.bolt/prompt) |
| Type Safety | Zod | For API response validation at runtime |

---

## 2. React Folder Structure

```
/home/bharat_choudhary/railway/
├── app/                                        ← Next.js App Router root
│   ├── layout.tsx                              ← Root layout (fonts, global providers)
│   ├── globals.css                             ← Design tokens, Tailwind base
│   ├── page.tsx                                ← Redirect → /login
│   │
│   ├── (auth)/                                 ← Auth route group (no shell layout)
│   │   └── login/
│   │       └── page.tsx                        ← /login
│   │
│   └── (app)/                                  ← Authenticated route group (shell layout)
│       ├── layout.tsx                          ← AppShell: Header + Sidebar + StaleStateOverlay
│       ├── dashboard/
│       │   └── page.tsx                        ← /dashboard
│       ├── corridor-map/
│       │   └── page.tsx                        ← /corridor-map
│       ├── string-chart/
│       │   └── page.tsx                        ← /string-chart
│       ├── planner/
│       │   ├── layout.tsx                      ← Shared planner layout (WeekNavigator in header)
│       │   ├── 26-week/
│       │   │   └── page.tsx                    ← /planner/26-week
│       │   └── weekly/
│       │       └── page.tsx                    ← /planner/weekly
│       ├── approvals/
│       │   └── page.tsx                        ← /approvals
│       ├── disruptions/
│       │   └── page.tsx                        ← /disruptions
│       └── audit-ledger/
│           └── page.tsx                        ← /audit-ledger
│
├── components/
│   ├── ui/                                     ← shadcn/ui primitives (see §4)
│   │
│   ├── shell/                                  ← Global shell components
│   │   ├── header.tsx                          ← Global header (status pills, clock, persona)
│   │   ├── sidebar.tsx                         ← Navigation sidebar (collapsible)
│   │   ├── stale-state-overlay.tsx             ← SSE-disconnect overlay (non-dismissible)
│   │   └── simulated-data-watermark.tsx        ← Persistent SIMULATED DATA label
│   │
│   ├── shared/                                 ← Domain-aware shared display components
│   │   ├── state-badge.tsx                     ← 12-state FSM badge (icon + text + color)
│   │   ├── solver-status-banner.tsx            ← CP-SAT status (OPTIMAL/FEASIBLE/INFEASIBLE/UNKNOWN)
│   │   ├── kpi-metric-card.tsx                 ← Single KPI: value, unit, target, delta
│   │   ├── demand-escalation-row.tsx           ← Single escalated demand row
│   │   ├── block-status-pill.tsx               ← Inline status badge (WCAG 1.4.1 tripled)
│   │   ├── freshness-badge.tsx                 ← source_ingested_at staleness indicator
│   │   ├── model-estimate-label.tsx            ← ML metric disclaimer label
│   │   ├── department-tag.tsx                  ← Civil / TRD / S&T tag (icon + text)
│   │   ├── sentinel-check-row.tsx              ← Single check: rule ID, name, pass/fail
│   │   └── sentinel-check-list.tsx             ← 10-check enumerated list (composes rows)
│   │
│   ├── forms/                                  ← Form components for approval and emergency flows
│   │   ├── approval-decision-form.tsx          ← Approve / Reject with signature entry
│   │   ├── rejection-reason-input.tsx          ← Mandatory rejection reason text field
│   │   ├── emergency-incident-form.tsx         ← Type selector, section, duration, confirm
│   │   └── acknowledgment-checkbox.tsx         ← Blast-radius acknowledgment checkbox
│   │
│   ├── overlays/                               ← Modals, drawers, popovers
│   │   ├── action-preview-card.tsx             ← Sr. DOM approval review card (full modal)
│   │   ├── emergency-confirm-modal.tsx         ← Blast-radius preview + confirm step
│   │   ├── event-detail-drawer.tsx             ← Audit ledger event side drawer
│   │   ├── section-detail-popover.tsx          ← GIS map section hover/click context
│   │   └── block-detail-popover.tsx            ← 26-week Gantt block bar click context
│   │
│   ├── visualizations/                         ← Custom visualization components
│   │   ├── gis-corridor-map.tsx                ← MapLibre GL JS wrapper (FR-021)
│   │   ├── time-distance-string-chart.tsx      ← HTML5 Canvas train graph (FR-020)
│   │   ├── twenty-six-week-gantt.tsx           ← 26-week horizontal scroll Gantt (FR-012)
│   │   ├── block-schedule-grid.tsx             ← 7-day tactical block slot grid (FR-013)
│   │   └── approval-chain-progress.tsx         ← Approval state timeline visualization
│   │
│   ├── dashboard/                              ← /dashboard page-specific components
│   │   ├── kpi-ribbon.tsx                      ← 4-metric KPI row
│   │   ├── demand-escalation-list.tsx          ← P0 overdue demand panel (FSM-002)
│   │   ├── block-count-summary.tsx             ← Block lifecycle state distribution
│   │   ├── machine-utilization-summary.tsx     ← Assigned vs idle machine counts
│   │   └── quick-nav-cards.tsx                 ← 4-card navigation shortcuts
│   │
│   ├── corridor-map/                           ← /corridor-map page-specific components
│   │   ├── layer-control-panel.tsx             ← Layer toggles (track, stations, blocks, RTIS, OHE)
│   │   └── block-heatmap-legend.tsx            ← Map color/status legend
│   │
│   ├── string-chart/                           ← /string-chart page-specific components
│   │   ├── section-date-selector.tsx           ← Section + date filter bar
│   │   ├── string-chart-tooltip.tsx            ← Hover tooltip for train/block elements
│   │   └── string-chart-legend.tsx             ← Train type / block type legend strip
│   │
│   ├── planner/                                ← /planner/* page-specific components
│   │   ├── week-navigator.tsx                  ← Week selector (prev/next, current week display)
│   │   ├── demand-queue-panel.tsx              ← Pending demands list with freshness badges
│   │   ├── shadow-bundle-indicator.tsx         ← Multi-dept co-allocation highlight
│   │   ├── machine-roster-panel.tsx            ← VRP machine assignment display
│   │   ├── revision-warning-banner.tsx         ← "Plan changed — re-verify" sticky banner
│   │   ├── gantt-filter-panel.tsx              ← 26-week Gantt filter controls
│   │   └── week-load-heatmap-indicator.tsx     ← Per-week load intensity indicator
│   │
│   ├── approvals/                              ← /approvals page-specific components
│   │   ├── plan-approval-queue.tsx             ← Plan list with status + hash-match indicators
│   │   ├── impact-summary-panel.tsx            ← Model-estimated delay/detention metrics
│   │   ├── shadow-cluster-panel.tsx            ← Co-allocated demand display
│   │   ├── revision-integrity-banner.tsx       ← Hash-mismatch conditional banner
│   │   ├── approval-action-row.tsx             ← Approve / Modify / Reject buttons
│   │   ├── distinct-approver-guard.tsx         ← DRM self-authorization blocker
│   │   └── signal-acknowledgment-gate.tsx      ← SM + Controller ack enforcement (FR-029)
│   │
│   ├── disruptions/                            ← /disruptions page-specific components
│   │   ├── active-incidents-list.tsx           ← Open incident list with coalescing status
│   │   ├── incident-detail-view.tsx            ← Selected incident: trains held, plans superseded
│   │   ├── emergency-trigger-button.tsx        ← P0 trigger (always invokes confirm modal)
│   │   ├── blast-radius-panel.tsx              ← Trains held, plans superseded, sections
│   │   ├── incident-type-selector.tsx          ← TRACK_FRACTURE / OHE_BREAKDOWN / SIGNAL_FAILURE / OTHER
│   │   ├── coalescing-alert.tsx                ← Adjacent-incident merge notification
│   │   ├── provisional-plan-display.tsx        ← PROVISIONAL re-plan with badge + Sentinel token
│   │   ├── controller-acknowledgment-gate.tsx  ← Chief Controller ack button
│   │   └── coalescing-status-indicator.tsx     ← Inline coalescing merge badge
│   │
│   └── audit-ledger/                           ← /audit-ledger page-specific components
│       ├── ledger-event-table.tsx              ← Paginated event table with hash, prev hash, badge
│       ├── hash-chain-verification-banner.tsx  ← Verification result ("N events verified")
│       ├── verify-chain-button.tsx             ← Trigger full chain verification (with loading)
│       └── ledger-search-filter.tsx            ← Event type / actor / date / block ID filter
│
├── hooks/                                      ← Custom React hooks
│   ├── use-toast.ts                            ← Toast (existing)
│   ├── use-sse.ts                              ← SSE connection hook (live-blocks stream)
│   ├── use-persona.ts                          ← Current persona context accessor
│   ├── use-rbac.ts                             ← Permission check: canPerform(action, persona)
│   ├── use-solver-status.ts                    ← Polls/streams current solver run state
│   ├── use-sentinel-checks.ts                  ← Fetches + caches 10-check Sentinel results
│   └── use-hash-verify.ts                      ← Content-hash comparison for plan revisions
│
├── lib/
│   ├── utils.ts                                ← cn() utility (existing)
│   ├── data.ts                                 ← Mock data (existing — needs correction per CLEANUP_REPORT)
│   ├── types.ts                                ← Canonical TypeScript types (NEW — see §6)
│   ├── constants.ts                            ← FSM state enums, department order, sentinel rules
│   ├── api.ts                                  ← Typed API client (fetch wrappers per endpoint)
│   └── mock-sse.ts                             ← Mock SSE emitter for development (simulated data)
│
├── context/
│   ├── persona-context.tsx                     ← Auth persona (role + division) context
│   ├── sse-context.tsx                         ← SSE connection state + live-block data context
│   └── solver-context.tsx                      ← Current solver run status context
│
└── public/
    └── tiles/                                  ← (placeholder) MapLibre vector tiles for corridor map
```

---

## 3. Route Group Architecture

Next.js 13 App Router **route groups** (`(groupName)`) are used to apply different root layouts without affecting the URL.

### `(auth)` Group — No Shell
- Routes: `/login`
- Layout: bare page, no sidebar or header
- Client-side redirect from root `/` → `/login` if no session

### `(app)` Group — Authenticated Shell
- Routes: all 8 functional pages
- Layout: `app/(app)/layout.tsx` renders:
  1. `<Header />` — fixed 64px top bar
  2. `<Sidebar />` — 248px / 76px collapsed left sidebar
  3. `<StaleStateOverlay />` — conditionally rendered when SSE disconnects
  4. `<main>` — scrollable content area
- This layout is server-rendered once; child pages are rendered into the `<main>` slot

### `/planner` Sub-group
- Routes: `/planner/26-week`, `/planner/weekly`
- Layout: `app/(app)/planner/layout.tsx` adds `WeekNavigator` + `SolverStatusBanner` to the top of the planner content area only

---

## 4. shadcn/ui Component Mapping

### Primitives to RETAIN from current install

These shadcn/ui primitives are already installed and map directly to documented UI needs:

| shadcn/ui Component | Used By | Notes |
|---|---|---|
| `Button` | All action rows, confirmation modals | Primary CTA, destructive variants |
| `Badge` | `StateBadge`, `BlockStatusPill`, `DepartmentTag` | Foundation for status tokens |
| `Card` | All panel containers | Page sections, KPI cards |
| `Dialog` | `ActionPreviewCard`, `EmergencyConfirmModal` | Full-page modal overlays |
| `DropdownMenu` | Persona switcher in Header, section/date selectors | Multi-option pickers |
| `ScrollArea` | Sidebar nav, Plan Queue, Demand Queue, Ledger Table | Overflow containers |
| `Select` | `SectionDateSelector`, `GanttFilterPanel`, `IncidentTypeSelector` | Controlled dropdown pickers |
| `Separator` | Panel dividers, card sections | Structural dividers |
| `Table` | `LedgerEventTable`, `MachineRosterPanel` | Tabular data display |
| `Tabs` | Mobile-collapsed right panels on `/planner/weekly`, `/approvals` | Responsive panel collapse |
| `Tooltip` | All icon-only buttons (sidebar collapsed, header shortcuts) | Accessibility labels |
| `Alert` | `RevisionWarningBanner`, `RevisionIntegrityBanner`, `CoalescingAlert` | System alert messages |
| `Progress` | `WeekLoadHeatmapIndicator`, solver run progress | Percentage/progress bars |

### shadcn/ui Primitives NOT INSTALLED — Add When Needed

These are NOT in the current install and are needed for specific documented patterns:

| shadcn/ui Component | Needed For | Priority |
|---|---|---|
| `Checkbox` | `AcknowledgmentCheckbox` (emergency flow) | High |
| `Input` | `RejectionReasonInput`, Login form fields | High |
| `Textarea` | `RejectionReasonInput` (multi-line reason) | High |
| `Label` | All form fields | High |
| `Switch` | `LayerControlPanel` (map layer toggles) | Medium |
| `Popover` | `SectionDetailPopover`, `BlockDetailPopover` | Medium |
| `Sheet` | `EventDetailDrawer` (side drawer pattern) | Medium |
| `Skeleton` | Loading states during API fetches | Medium |

### shadcn/ui Primitives to REMOVE (Unused — per CLEANUP_REPORT.md §2a)

accordion, alert-dialog, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, collapsible, command, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, radio-group, resizable, slider, sonner, toggle, toggle-group

---

## 5. State Management Architecture

The application has three distinct categories of state. No external state library (Redux, Zustand, Jotai) is required for the documented scope — React Context + useReducer is sufficient.

### 5.1 Authentication / Persona State

**Scope:** Global — all authenticated pages  
**Provider:** `context/persona-context.tsx`  
**Contents:**

```
PersonaContextState {
  persona: Persona | null          // { id, name, role, division, badge, divisionId }
  isAuthenticated: boolean
  login(credentials) → Promise     // Sets persona, triggers redirect to /dashboard
  logout() → void
}
```

**Consumed by:** Header (persona display), all RBAC hooks, Sidebar (no change needed — no persona-locked nav items), ActionPreviewCard (Approve button enable logic), DistinctApproverGuard.

### 5.2 SSE Live Feed State

**Scope:** Global — all authenticated pages  
**Provider:** `context/sse-context.tsx`  
**Contents:**

```
SSEContextState {
  isConnected: boolean             // false triggers StaleStateOverlay + disables all action buttons
  lastHeartbeatAt: Date | null
  liveBlocks: LiveBlock[]          // Parsed SSE payload: active block zones for map
  liveTrainPositions: TrainPos[]   // RTIS positions for Corridor Map
  subscribe() → void
  disconnect() → void
}
```

**Key rule:** When `isConnected === false`, the `StaleStateOverlay` renders non-dismissibly over the entire content area. All `<Button>` components that perform mutations (Approve, Authorize, Emergency Trigger, Trigger Solver) check `isConnected` and are `disabled` when false.

### 5.3 Solver Run State

**Scope:** Planner pages only  
**Provider:** `context/solver-context.tsx`  
**Contents:**

```
SolverContextState {
  status: 'IDLE' | 'RUNNING' | 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN'
  bestBound: number | null
  latencyMs: number | null
  lastRunAt: Date | null
  triggerSolve(weekId: string) → Promise
}
```

**Consumed by:** `SolverStatusBanner` (always visible on planner pages), Trigger Solver button (loading state).

### 5.4 Page-Level Local State

Each page manages its own local UI state with `useState` / `useReducer`. No cross-page state sharing is needed beyond the three global contexts above.

| Page | Local State |
|---|---|
| `/dashboard` | Selected escalated demand (for detail hover) |
| `/corridor-map` | Selected section ID, active map layers (5 toggles), section popover open/closed |
| `/string-chart` | Selected section, selected date, tooltip position + content |
| `/planner/26-week` | Filter values (division, section, dept, status), popover open + block ID |
| `/planner/weekly` | Selected week offset, selected demand ID, roster panel open |
| `/approvals` | Selected plan ID, approval step active, sign modal open, rejection reason text |
| `/disruptions` | Selected incident ID, confirm modal open, acknowledgment checkbox state, provisional plan data |
| `/audit-ledger` | Filter values, selected event ID, drawer open, verification status |

---

## 6. TypeScript Type Architecture

All canonical types live in `lib/types.ts`. No inline type definitions in components.

### Core Domain Types

```typescript
// 12-state FSM — AppFlow.md §3
type BlockPlanStatus =
  | 'DRAFT'
  | 'SENTINEL_PASSED'
  | 'APPROVED_SR_DOM'
  | 'ESCALATED_OVERDUE'
  | 'AUTHORIZED_DRM'
  | 'TRANSMITTED_COA'
  | 'PROVISIONAL'
  | 'SUPERSEDED'
  | 'SUPERSEDED_EMERGENCY'
  | 'ACTIVE_GRANTED'
  | 'COMPLETED_FITNESS'
  | 'ARCHIVED_SEALED'
  | 'FAILED_ESCALATE'
  | 'CANCELLED'

// Incident types — Schema.md §2
type IncidentType = 'TRACK_FRACTURE' | 'OHE_BREAKDOWN' | 'SIGNAL_FAILURE' | 'OTHER'

// Solver output — TechSpec §2.5
type SolverStatus = 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN'

// Train path source — Schema.md §2
type TrainPathSource = 'WTT' | 'COA_LIVE' | 'FOIS_FORECAST'

// Department ordering: Civil → TRD → S&T (enforced in all lists)
type Department = 'CIVIL' | 'TRD' | 'SNT'

// Persona — PRD §3 (extended with divisionId)
type PersonaRole = 'SR_DOM' | 'DRM' | 'CHIEF_CONTROLLER' | 'SR_DEN' | 'SSE'
interface Persona {
  id: string
  name: string
  role: PersonaRole
  division: string
  divisionId: string
  badge: string
}

// Sentinel check — Design.md §3 (10 enumerated checks)
type SentinelRuleId =
  | 'G&SR-1' | 'G&SR-2' | 'G&SR-3' | 'G&SR-4' | 'G&SR-5'
  | 'MILP-C1' | 'MILP-C2' | 'MILP-C3' | 'MILP-C4' | 'MILP-C5'

interface SentinelCheckResult {
  ruleId: SentinelRuleId
  name: string
  passed: boolean
  detail: string
}

// Block plan (simplified for UI layer)
interface BlockPlan {
  id: string
  sectionId: string
  startTime: string         // ISO 8601
  endTime: string
  department: Department
  status: BlockPlanStatus
  contentHash: string       // SAFE-002
  sentinelHash: string      // SAFE-002
  decidedBy: string | null  // FR-027
  authorizedBy: string | null
  sentinelChecks: SentinelCheckResult[]
  urgencyScore: number       // ML estimate
  isModelEstimate: true      // Always — labeled accordingly
}

// Audit ledger event — FR-022
interface LedgerEvent {
  seq: number
  eventId: string
  eventType: string
  actor: string
  timestamp: string
  blockId: string
  hash: string
  prevHash: string
  verified: boolean
}

// Incident — Schema.md §2
interface Incident {
  id: string
  sectionId: string
  type: IncidentType
  severity: 'P0' | 'P1'
  reportedAt: string
  coalescedWith: string | null
  responseState: 'OPEN' | 'PROVISIONAL_ISSUED' | 'ACKNOWLEDGED' | 'RESOLVED'
  trainsHeld: string[]
  plansSuperseded: string[]
}
```

---

## 7. API Integration Architecture

### 7.1 API Client Structure

All API calls are centralized in `lib/api.ts`. No raw `fetch` calls in components or pages.

```
lib/api.ts exports:
  // Auth
  auth.login(credentials)                       → Promise<Persona>
  auth.logout()                                 → Promise<void>

  // Block Plans
  plans.list(weekId?: string)                   → Promise<BlockPlan[]>
  plans.get(planId: string)                     → Promise<BlockPlan>
  plans.approve(planId, signature)              → Promise<BlockPlan>
  plans.authorize(planId, signature)            → Promise<BlockPlan>
  plans.reject(planId, reason)                  → Promise<BlockPlan>
  plans.modify(planId, params)                  → Promise<BlockPlan>  // Creates new revision

  // Demands
  demands.list(weekId?: string)                 → Promise<Demand[]>
  demands.getEscalated()                        → Promise<Demand[]>

  // Solver
  solver.trigger(weekId: string)                → Promise<SolverRun>
  solver.status(runId: string)                  → Promise<SolverStatus>

  // Emergency
  emergency.triggerBreakdown(params)            → Promise<ProvisionalPlan>
  emergency.acknowledgeProvisional(planId)      → Promise<BlockPlan>

  // Ledger
  ledger.list(filters)                          → Promise<LedgerEvent[]>
  ledger.verify()                               → Promise<VerificationResult>

  // Live data (SSE — handled separately via use-sse.ts hook)
  // GET /api/v1/stream/live-blocks → EventSource
```

### 7.2 SSE Connection Strategy

The SSE feed (`/api/v1/stream/live-blocks`) is managed by `hooks/use-sse.ts` and provided globally via `SSEContext`.

**Connection lifecycle:**
1. `SSEContext` opens `EventSource` on mount after authentication
2. Heartbeat timeout (implementation decision — not specified in docs): 30s recommended
3. On disconnect/timeout: `isConnected = false` → `StaleStateOverlay` renders + all mutation buttons disabled
4. Auto-reconnect with exponential backoff (3 attempts, then manual reconnect prompt)
5. On reconnect: `isConnected = true` → overlay removes, buttons re-enable

**Development:** `lib/mock-sse.ts` emits synthetic events on a timer for use without a running backend.

### 7.3 RBAC Permission Map

`hooks/use-rbac.ts` exposes `canPerform(action)` which checks `persona.role` against this table:

| Action | SR_DOM | DRM | CHIEF_CONTROLLER | SR_DEN | SSE |
|---|---|---|---|---|---|
| `TRIGGER_SOLVER` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `APPROVE_PLAN` (Sr. DOM step) | ✅ | ❌ | ❌ | ❌ | ❌ |
| `AUTHORIZE_PLAN` (DRM step) | ❌ | ✅ | ❌ | ❌ | ❌ |
| `TRIGGER_EMERGENCY` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `ACKNOWLEDGE_PROVISIONAL` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `VIEW_CORRIDOR_MAP` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `VIEW_LEDGER` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `VERIFY_CHAIN` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 8. Visualization Architecture

### 8.1 GIS Corridor Map — MapLibre GL JS

**Component:** `components/visualizations/gis-corridor-map.tsx`  
**Library:** MapLibre GL JS (must be added: `npm install maplibre-gl`)  
**Pattern:** Wrapper component using `useEffect` + `useRef` to initialize map. Map instance stored in `ref`, not state.

**Layer stack (bottom → top):**
1. Base raster/vector tiles (background)
2. Track centerlines (GeoJSON LineString)
3. OHE feeding-section boundaries (GeoJSON Polygon, toggleable)
4. Block hazard corridors (GeoJSON LineString/Polygon, colored by dept + status)
5. Station markers (GeoJSON Point)
6. Live RTIS train positions (GeoJSON Point, animated)

**Data flow:**
- Static geometry (tracks, stations, OHE): loaded once from `/api/v1/map/corridor-geometry`
- Live train positions: updated from `SSEContext.liveTrainPositions` via `map.getSource().setData()`
- Active block zones: updated from `SSEContext.liveBlocks` via `map.getSource().setData()`

**Interaction events:**
- `map.on('click', 'track-layer', ...)` → opens `SectionDetailPopover`
- `map.on('click', 'block-layer', ...)` → navigates to `/approvals?planId=...`
- Layer toggles call `map.setLayoutProperty(layerId, 'visibility', 'visible' | 'none')`

### 8.2 Time-Distance String Chart — HTML5 Canvas

**Component:** `components/visualizations/time-distance-string-chart.tsx`  
**Technology:** HTML5 `<canvas>` with a `useRef` for the canvas element. No external charting library.

**Rendering model:**
- `useEffect` redraws the full canvas on data change or viewport resize (via `ResizeObserver`)
- Coordinate system: X = distance (0–250 km), Y = time (00:00–24:00)
- Scale transforms: `kmToPixel(km)` and `timeToPixel(isoTime)` — derived from canvas dimensions

**Layers drawn in order:**
1. Grid lines (km grid + hour grid)
2. Maintenance block rectangles (semi-transparent, filled)
3. Shadow bundle overlays (diagonal stripe pattern via canvas `createPattern`)
4. Train path lines (slope = speed)
5. Tooltip (HTML overlay div, positioned via `getBoundingClientRect`)

**Interaction:**
- `mousemove` → hit-test nearest train line or block rectangle → update tooltip state
- `wheel` + `mousedown/mousemove` → dual-axis pan/zoom via canvas transform matrix
- `click` on block → navigate to plan detail in `/approvals`

**SIMULATED DATA Watermark:** Absolute-positioned `<div>` overlaid on the `<canvas>` element, rendered in JSX (not drawn on canvas), ensuring it cannot be painted over.

### 8.3 26-Week Gantt Calendar — Custom React

**Component:** `components/visualizations/twenty-six-week-gantt.tsx`  
**Technology:** Custom React with CSS `overflow-x: scroll` + `position: sticky` for the section label column.

**Layout model:**
- Outer container: `display: grid; grid-template-columns: 200px 1fr`
- Left column (sticky): section labels
- Right column (scrollable): week columns × block bars
- Week columns: 26 fixed-width columns (e.g., 120px each = 3120px total scrollable width)
- Block bars: absolutely positioned within their week column, vertically centered, width = duration fraction

**Data:** 26-week allocation data fetched from `/api/v1/plans/26-week-calendar`

**Current week marker:** `position: absolute` vertical line calculated from `(currentWeekIndex / 26) * totalWidth`

**Click → popover:** Block bar `onClick` sets `selectedBlockId` state → `BlockDetailPopover` renders anchored to the bar's bounding rect.

### 8.4 7-Day Block Schedule Grid — Custom React

**Component:** `components/visualizations/block-schedule-grid.tsx`  
**Technology:** CSS Grid — rows = track sections, columns = 7 days × time slots.

**Layout model:**
- Grid: `grid-template-columns: [section-label 160px] repeat(7, 1fr)`
- Grid rows: one per track section in the weekly plan
- Block slots: `grid-column` + `grid-row` placement with time-proportional widths via CSS custom properties
- Shadow bundles: stacked absolutely within the block cell, showing department stripes

**Interaction:**
- Click a populated slot → opens slot detail
- Edit mode (Sr. DOM only): click empty slot → creates new assignment → triggers revision warning banner
