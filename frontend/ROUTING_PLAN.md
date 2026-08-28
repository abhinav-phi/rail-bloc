# ROUTING_PLAN.md — RAIL-BLOC Routing Plan
## Source: DESIGN_PROMPT.md §2, AppFlow.md §1–2
## Router: Next.js 13 App Router (file-system based)

---

## 1. Route Registry

| Route | File | Type | Auth? | Layout | FR Coverage |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | Redirect | No | None | — |
| `/login` | `app/(auth)/login/page.tsx` | Page | No | Auth-only | FR-025 |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Page | Yes | App Shell | FR-011, FR-012, FR-016 |
| `/corridor-map` | `app/(app)/corridor-map/page.tsx` | Page | Yes | App Shell | FR-021 |
| `/string-chart` | `app/(app)/string-chart/page.tsx` | Page | Yes | App Shell | FR-004, FR-005, FR-020 |
| `/planner/26-week` | `app/(app)/planner/26-week/page.tsx` | Page | Yes | App Shell + Planner | FR-012 |
| `/planner/weekly` | `app/(app)/planner/weekly/page.tsx` | Page | Yes | App Shell + Planner | FR-001–003, FR-007–009, FR-013 |
| `/approvals` | `app/(app)/approvals/page.tsx` | Page | Yes | App Shell | FR-010, FR-014, FR-015, FR-026–029 |
| `/disruptions` | `app/(app)/disruptions/page.tsx` | Page | Yes | App Shell | FR-017, FR-018, FR-019, FR-028 |
| `/audit-ledger` | `app/(app)/audit-ledger/page.tsx` | Page | Yes | App Shell | FR-022, FR-023 |

---

## 2. Route Group Structure

### Why Route Groups?

Next.js 13 App Router supports **Route Groups** (folder names wrapped in parentheses). They do NOT appear in the URL but allow different layouts for different groups of routes.

```
app/
├── page.tsx                    ← "/" — no group, bare redirect
├── (auth)/                     ← Group: unauthenticated pages (no shell)
│   └── login/
│       └── page.tsx
└── (app)/                      ← Group: authenticated pages (full shell)
    ├── layout.tsx              ← App Shell layout
    ├── dashboard/
    ├── corridor-map/
    ├── string-chart/
    ├── planner/
    │   ├── layout.tsx          ← Planner sub-layout
    │   ├── 26-week/
    │   └── weekly/
    ├── approvals/
    ├── disruptions/
    └── audit-ledger/
```

---

## 3. Layout Hierarchy

### Level 1: Root Layout — `app/layout.tsx`

```tsx
// Applies to ALL routes
// Responsibilities:
//   - Font imports (Inter + JetBrains Mono via next/font/google)
//   - HTML lang="en" + dir="ltr"
//   - <body> with antialiasing + color-scheme: dark
//   - No providers here (too early for context)

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${interFont.variable} ${monoFont.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

### Level 2A: Auth Layout — `app/(auth)/layout.tsx`

```tsx
// Applies to: /login
// Responsibilities:
//   - Bare centered layout
//   - No sidebar, no header, no persona context
//   - Redirect to /dashboard if already authenticated

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {children}
    </div>
  )
}
```

### Level 2B: App Shell Layout — `app/(app)/layout.tsx`

```tsx
// Applies to: all 8 functional routes
// Responsibilities:
//   - PersonaProvider (auth context)
//   - SSEProvider (live feed context)
//   - SolverProvider (solver run context)
//   - Header (fixed 64px)
//   - Sidebar (248px / 76px collapsed)
//   - StaleStateOverlay (conditional)
//   - <main> scrollable content area

export default function AppLayout({ children }) {
  return (
    <PersonaProvider>
      <SSEProvider>
        <SolverProvider>
          <div className="flex h-screen flex-col overflow-hidden">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto relative">
                <StaleStateOverlay />
                {children}
              </main>
            </div>
          </div>
        </SolverProvider>
      </SSEProvider>
    </PersonaProvider>
  )
}
```

### Level 3: Planner Sub-Layout — `app/(app)/planner/layout.tsx`

```tsx
// Applies to: /planner/26-week + /planner/weekly
// Responsibilities:
//   - Sticky top bar with WeekNavigator + SolverStatusBanner
//   - Passes selected week state down to children via URL search params

export default function PlannerLayout({ children }) {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b px-6 py-2">
        <WeekNavigator />
        <SolverStatusBanner />
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
```

---

## 4. Route-by-Route Detail

### `/` — Root Redirect

```
File: app/page.tsx
Purpose: Immediately redirect to /login
Implementation: Next.js redirect() in server component
Logic: If session exists → redirect('/dashboard'), else → redirect('/login')
No UI rendered.
```

---

### `/login`

```
File: app/(auth)/login/page.tsx
Auth Required: No
Layout: Auth-only (bare centered page)

URL Parameters: none
Query Parameters:
  - ?redirect=/approvals  ← where to send user after login (preserved through auth)

Page State:
  - step: 'credentials' | 'division-select' | 'role-confirm'
  - error: string | null
  - isSubmitting: boolean

Navigation Out:
  - Success → /dashboard (or ?redirect target)
  - No outbound nav links (no sidebar)

Guard: If persona context already set → redirect('/dashboard')
```

---

### `/dashboard`

```
File: app/(app)/dashboard/page.tsx
Auth Required: Yes (all personas)
Layout: App Shell

URL Parameters: none
Query Parameters:
  - ?filter=escalated  ← optionally pre-scrolls to DemandEscalationList

Data Fetched:
  - GET /api/v1/kpis                     → KPI values
  - GET /api/v1/demands?status=ESCALATED_OVERDUE → escalated demand list
  - GET /api/v1/plans/counts             → block count by state
  - GET /api/v1/machines/utilization     → machine assignment counts

Navigation Out (links):
  - DemandEscalationRow CTA    → /approvals?planId={demand.planId}
  - QuickNavCard "Planner"     → /planner/weekly
  - QuickNavCard "26-Week"     → /planner/26-week
  - QuickNavCard "Approvals"   → /approvals
  - QuickNavCard "Corridor Map"→ /corridor-map
  - QuickNavCard "String Chart"→ /string-chart
  - Header Ledger button       → /audit-ledger

Active Sidebar Item: "dashboard"
```

---

### `/corridor-map`

```
File: app/(app)/corridor-map/page.tsx
Auth Required: Yes (all personas)
Layout: App Shell (map fills all remaining space after header + sidebar)

URL Parameters: none
Query Parameters:
  - ?section={sectionId}     ← optionally pre-focuses map on a section
  - ?block={planId}          ← optionally highlights a specific block zone

Data Fetched:
  - GET /api/v1/map/corridor-geometry    → GeoJSON (track, stations, OHE)
  - SSEContext.liveBlocks                → active block zones (live)
  - SSEContext.liveTrainPositions        → RTIS train markers (live)

Navigation Out (links):
  - Block zone click         → /approvals?planId={planId}
  - Header Emergency button  → opens EmergencyConfirmModal

Active Sidebar Item: "corridor-map"
```

---

### `/string-chart`

```
File: app/(app)/string-chart/page.tsx
Auth Required: Yes (all personas)
Layout: App Shell (chart fills remaining content area)

URL Parameters: none
Query Parameters:
  - ?section={sectionId}     ← pre-selects section filter
  - ?date={YYYY-MM-DD}       ← pre-selects date filter
  - ?block={planId}          ← optionally highlights a block

Data Fetched:
  - GET /api/v1/train-paths?section={id}&date={date}  → WTT + RTIS paths
  - GET /api/v1/block-plans?section={id}&date={date}  → maintenance blocks for overlay

Navigation Out (links):
  - Block rectangle click    → /approvals?planId={planId}
  - Section filter change    → updates ?section query param (shallow routing)
  - Date filter change       → updates ?date query param (shallow routing)

Active Sidebar Item: "string-chart"
```

---

### `/planner/26-week`

```
File: app/(app)/planner/26-week/page.tsx
Auth Required: Yes (all personas — read; SR_DOM + DRM for navigation to weekly)
Layout: App Shell + Planner sub-layout

URL Parameters: none
Query Parameters:
  - ?section={sectionId}     ← filter initial view to a section
  - ?dept={dept}             ← filter initial view to a department
  - ?startWeek={isoWeekNum}  ← scroll to a specific week (default: current)

Data Fetched:
  - GET /api/v1/plans/26-week-calendar   → 26-week allocation data

Navigation Out (links):
  - Block bar click popover → "View Week" → /planner/weekly?week={weekNum}
  - Week column header      → /planner/weekly?week={weekNum}

Active Sidebar Item: "planner-26-week"
```

---

### `/planner/weekly`

```
File: app/(app)/planner/weekly/page.tsx
Auth Required: Yes (SR_DOM, SR_DEN for edits; others read-only)
Layout: App Shell + Planner sub-layout

URL Parameters: none
Query Parameters:
  - ?week={isoWeekNum}       ← week to display (default: next Thursday trigger week)
  - ?demand={demandId}       ← pre-selects/highlights a demand in queue

Data Fetched:
  - GET /api/v1/demands?week={week}              → demand queue
  - GET /api/v1/block-plans?week={week}          → current plan slots
  - GET /api/v1/machines/roster?week={week}      → machine assignments

Navigation Out (links):
  - "Submit for Approval"    → /approvals?planId={currentPlanId}
  - WeekNavigator prev/next  → updates ?week query param (shallow routing)

Mutation Triggers:
  - "Trigger Solver"         → POST /api/v1/solver/trigger → updates SolverContext
  - Block slot edit          → POST /api/v1/plans/modify → creates new revision
                               → shows RevisionWarningBanner
Active Sidebar Item: "planner-weekly"
```

---

### `/approvals`

```
File: app/(app)/approvals/page.tsx
Auth Required: Yes (SR_DOM for Approve step; DRM for Authorize step)
Layout: App Shell (split panel: 360px list + fill detail)

URL Parameters: none
Query Parameters:
  - ?planId={planId}         ← pre-selects plan in queue + opens ActionPreviewCard
  - ?step=authorize          ← pre-filters queue to DRM authorization step

Data Fetched:
  - GET /api/v1/plans?status=SENTINEL_PASSED  → plans awaiting Sr. DOM decision
  - GET /api/v1/plans?status=APPROVED_SR_DOM  → plans awaiting DRM authorization
  - GET /api/v1/plans/{planId}                → selected plan full detail + sentinel checks

Navigation Out (links):
  - "Modify Parameters"      → POST creates revision → updates planId in query param
  - ApprovalChainProgress    → (no nav, display only)

Mutation Triggers:
  - "Approve & Sign"         → POST /api/v1/plans/{planId}/approve
                               Body: { signature, contentHash }
                               Guard: hash match + correct role + correct state + isConnected
  - "Authorize"              → POST /api/v1/plans/{planId}/authorize
                               Guard: decidedBy ≠ currentPersona.id + isConnected
  - "Reject"                 → POST /api/v1/plans/{planId}/reject
                               Body: { reason }

Active Sidebar Item: "approvals"
```

---

### `/disruptions`

```
File: app/(app)/disruptions/page.tsx
Auth Required: Yes (CHIEF_CONTROLLER for emergency actions; others read-only)
Layout: App Shell (split panel: 360px incidents + fill detail)

URL Parameters: none
Query Parameters:
  - ?incident={incidentId}   ← pre-selects incident

Data Fetched:
  - GET /api/v1/incidents?status=OPEN    → active incidents list
  - GET /api/v1/incidents/{id}           → selected incident detail
  - GET /api/v1/incidents/{id}/blast-radius → blast radius preview data (for modal)

Navigation Out (links):
  - ProvisionalPlanDisplay   → (no nav, in-page display)
  - ControllerAckGate success→ triggers refresh of incident detail

Mutation Triggers (multi-step):
  Step 1: EmergencyTriggerButton.onClick
          → opens EmergencyConfirmModal
  Step 2: User reviews BlastRadiusPanel, selects IncidentType, checks AcknowledgmentCheckbox
          → "Fire Emergency Override" enabled
  Step 3: Fire button
          → POST /api/v1/emergency/breakdown
             Body: { incidentId, sectionId, type, confirmationFlag: true, affectedSections }
          → returns ProvisionalPlan → rendered in right panel
  Step 4: ControllerAcknowledgmentGate
          → POST /api/v1/emergency/acknowledge
             Body: { planId }
          → plan transitions from PROVISIONAL → full re-planning state

Active Sidebar Item: "disruptions"
```

---

### `/audit-ledger`

```
File: app/(app)/audit-ledger/page.tsx
Auth Required: Yes (all personas)
Layout: App Shell (table-dominant)

URL Parameters: none
Query Parameters:
  - ?eventType={type}        ← pre-filter
  - ?actor={actorId}         ← pre-filter
  - ?from={YYYY-MM-DD}       ← pre-filter
  - ?to={YYYY-MM-DD}         ← pre-filter
  - ?blockId={blockId}       ← pre-filter
  - ?event={eventId}         ← pre-selects + opens EventDetailDrawer

Data Fetched:
  - GET /api/v1/ledger?{filters}&page={n}&pageSize=50  → paginated events
  - GET /api/v1/ledger/verify                           → chain verification status (cached)

Navigation Out (links):
  - EventDetailDrawer linked planId → /approvals?planId={planId}

Mutation Triggers:
  - "Verify Chain" button → GET /api/v1/ledger/verify (with loading state)
                          → updates HashChainVerificationBanner

Active Sidebar Item: "audit-ledger"
```

---

## 5. Navigation Flow Diagrams

### Primary Operational Flow

```
/login
  ↓ auth.login() success
/dashboard
  ↓ DemandEscalationRow CTA
/approvals?planId=...
  ↓ Approve & Sign
/dashboard (refreshed — block count updated)
  ↓ QuickNav "Planner"
/planner/weekly
  ↓ "Submit for Approval"
/approvals
  ↓ DRM Authorize
/dashboard (TRANSMITTED_COA state visible)
```

### Emergency Re-planning Flow

```
/dashboard OR /corridor-map
  (incident detected in SSE liveBlocks)
  ↓ user clicks Emergency header button OR navigates
/disruptions?incident={id}
  ↓ EmergencyTriggerButton → modal open
  [EmergencyConfirmModal — overlay]
  ↓ blast-radius reviewed + checkbox + confirm
  → POST /api/v1/emergency/breakdown
  ↓ ProvisionalPlanDisplay rendered
  ↓ ControllerAcknowledgmentGate → POST /api/v1/emergency/acknowledge
/corridor-map (updated live state via SSE)
```

### Audit Flow

```
ANY page → Header "Ledger" button
/audit-ledger
  ↓ Filter events
  ↓ Row click → EventDetailDrawer
  → LinkedPlanID click → /approvals?planId=...
  OR
  ↓ "Verify Chain" → HashChainVerificationBanner updated
```

### Deep-Link Entry Points

The following routes support deep-linking via query parameters (e.g., from email notifications, COA references, external tools):

| Deep Link | Opens |
|---|---|
| `/approvals?planId=BLK-2026-W34-01` | ActionPreviewCard for that plan |
| `/disruptions?incident=INC-2026-001` | IncidentDetailView for that incident |
| `/audit-ledger?blockId=BLK-2026-W34-01` | Filtered ledger view for that block |
| `/string-chart?section=DLI-ALD&date=2026-08-25` | Pre-filtered chart view |
| `/planner/weekly?week=34` | Week 34 planning view |
| `/planner/26-week?startWeek=30` | Gantt scrolled to week 30 |
| `/corridor-map?block=BLK-2026-W34-01` | Map with block zone highlighted |

---

## 6. Sidebar Navigation Mapping

The `Sidebar` component maps nav item `id` values to `href` paths. Current sidebar uses in-page state switching — this must be replaced with Next.js `Link` components and `usePathname()` for active detection.

| Nav Item Label | `href` | Icon | Auth Required | Active When |
|---|---|---|---|---|
| Operations Overview | `/dashboard` | `LayoutDashboard` | All personas | `pathname === '/dashboard'` |
| 26-Week Calendar | `/planner/26-week` | `CalendarRange` | All personas | `pathname.startsWith('/planner/26-week')` |
| Block Planning | `/planner/weekly` | `CalendarClock` | All personas | `pathname.startsWith('/planner/weekly')` |
| Corridor Map | `/corridor-map` | `Map` | All personas | `pathname === '/corridor-map'` |
| String Chart | `/string-chart` | `GitBranch` | All personas | `pathname === '/string-chart'` |
| Approval Workflow | `/approvals` | `ShieldCheck` | All personas | `pathname === '/approvals'` |
| Disruptions | `/disruptions` | `AlertTriangle` | All personas | `pathname === '/disruptions'` |
| Audit Ledger | `/audit-ledger` | `ScrollText` | All personas | `pathname === '/audit-ledger'` |

**Changes from current sidebar.tsx:**
- Remove `onNavigate` prop (state-based)
- Replace `button` elements with `<Link href={item.href}>` from `next/link`
- Replace `active === item.id` with `usePathname().startsWith(item.href)` for active detection
- Add `/corridor-map` nav item (currently missing)
- Add `/planner/26-week` nav item (currently missing)
- Rename "Emergency Override" → "Disruptions" (links to page, not modal)
- Remove the id-based approach entirely

---

## 7. URL Search Param Conventions

All query parameters follow these conventions:

| Convention | Rule |
|---|---|
| Entity selection | `?{entityType}Id={id}` — e.g., `?planId=...`, `?incidentId=...` |
| Filter values | `?{fieldName}={value}` — e.g., `?section=DLI-ALD`, `?dept=CIVIL` |
| Pagination | `?page={n}` — 1-indexed |
| Date range | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Week selection | `?week={isoWeekNumber}` — ISO 8601 week number (e.g., `?week=34`) |
| Shallow routing | Filter/selection changes use `router.push(url, { scroll: false })` to avoid full re-render |

---

## 8. Authentication Guard Pattern

All `(app)` group routes are protected by a server-side authentication check in `app/(app)/layout.tsx`:

```
Pseudocode:
1. Read session from cookie / JWT
2. If no valid session → redirect('/login?redirect=' + currentPath)
3. If valid session → render layout with PersonaProvider seeded from session
4. PersonaContext.persona is never null inside (app) group
```

Client-side, `usePersona()` hook provides the resolved persona. Components that perform RBAC checks call `useRbac().canPerform(action)` which reads from `usePersona()`.

---

## 9. API Route Handlers (Next.js Route Handlers)

For development / mock mode, Next.js API route handlers in `app/api/` serve mock data. In production these are replaced by the FastAPI backend.

```
app/api/
├── auth/
│   ├── login/route.ts              ← POST → mock login, returns persona + sets session cookie
│   └── logout/route.ts             ← POST → clears session cookie
├── kpis/route.ts                   ← GET → mock KPI values
├── demands/route.ts                ← GET → mock demand list with filters
├── plans/
│   ├── route.ts                    ← GET → plan list with filters
│   ├── [planId]/
│   │   ├── route.ts                ← GET → single plan detail
│   │   ├── approve/route.ts        ← POST → mock approve
│   │   ├── authorize/route.ts      ← POST → mock authorize
│   │   ├── reject/route.ts         ← POST → mock reject
│   │   └── modify/route.ts         ← POST → mock modify (creates revision)
│   ├── 26-week-calendar/route.ts   ← GET → 26-week allocation mock
│   └── counts/route.ts             ← GET → block counts by state
├── machines/
│   ├── utilization/route.ts        ← GET → machine utilization counts
│   └── roster/route.ts             ← GET → machine roster for a week
├── solver/
│   ├── trigger/route.ts            ← POST → mock solver trigger (returns runId)
│   └── [runId]/status/route.ts     ← GET → mock solver status
├── emergency/
│   ├── breakdown/route.ts          ← POST → mock emergency trigger
│   └── acknowledge/route.ts        ← POST → mock acknowledge provisional
├── incidents/route.ts              ← GET → mock incidents
├── ledger/
│   ├── route.ts                    ← GET → paginated mock ledger events
│   └── verify/route.ts             ← GET → mock chain verification
├── map/
│   └── corridor-geometry/route.ts  ← GET → mock GeoJSON for map
├── train-paths/route.ts            ← GET → mock train paths for string chart
└── stream/
    └── live-blocks/route.ts        ← GET → mock SSE stream (EventStream)
```
