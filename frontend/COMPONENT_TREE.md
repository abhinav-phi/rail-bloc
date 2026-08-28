# COMPONENT_TREE.md — RAIL-BLOC Component Tree
## Source: DESIGN_PROMPT.md §3, §4 + FRONTEND_ARCHITECTURE.md
## Notation: (S) = Server Component · (C) = Client Component · [shadcn] = shadcn/ui primitive

---

## 1. Global Application Shell

```
app/(app)/layout.tsx (S)
├── <PersonaProvider> (C)           ← context/persona-context.tsx
├── <SSEProvider> (C)               ← context/sse-context.tsx
├── <SolverProvider> (C)            ← context/solver-context.tsx
│   ├── <Header> (C)                ← components/shell/header.tsx
│   │   ├── [Logo + Title]          ← Static markup
│   │   ├── <StatusPill>            ← CP-SAT latency pill (inline sub-component)
│   │   ├── <StatusPill>            ← Sentinel verification pill (inline sub-component)
│   │   ├── [LiveClock]             ← useEffect IST clock (inline)
│   │   ├── [Button] ledger         ← [shadcn/Button] → navigate /audit-ledger
│   │   ├── [Button] emergency      ← [shadcn/Button destructive] → open EmergencyConfirmModal
│   │   └── <PersonaSwitcher> (C)
│   │       └── [DropdownMenu]      ← [shadcn/DropdownMenu] with persona list
│   │
│   ├── <Sidebar> (C)               ← components/shell/sidebar.tsx
│   │   ├── [Logo block]
│   │   ├── <NavItem> × 8           ← One per documented route (motion.button)
│   │   ├── [SystemLivePill]        ← SSE connection indicator (inline)
│   │   └── [CollapseToggle]        ← 76px / 248px toggle
│   │
│   ├── <StaleStateOverlay> (C)     ← components/shell/stale-state-overlay.tsx
│   │   └── Conditionally rendered when SSEContext.isConnected === false
│   │       Disables ALL action buttons globally via CSS pointer-events + aria-disabled
│   │
│   └── <main>                      ← Scrollable content area
│       └── {children}              ← Page.tsx rendered here
```

---

## 2. Page: `/login`

```
app/(auth)/login/page.tsx (S → C form)
└── <LoginPage> (C)
    ├── [ApplicationIdentity]       ← RAIL-BLOC name + system description (static)
    ├── <LoginForm> (C)
    │   ├── [Label] Username        ← [shadcn/Label]
    │   ├── [Input] Username        ← [shadcn/Input]
    │   ├── [Label] Password        ← [shadcn/Label]
    │   ├── [Input] Password        ← [shadcn/Input] type="password"
    │   └── [Button] Submit         ← [shadcn/Button] → auth.login()
    ├── <DivisionSelector> (C)      ← Shown after credential validation
    │   └── [Select]                ← [shadcn/Select] — division list
    ├── <RoleDisplayCard>           ← Shows resolved persona before final confirm
    │   ├── Role name
    │   ├── Division
    │   └── Badge ID
    └── <AuthErrorDisplay>          ← [shadcn/Alert] variant="destructive"
```

---

## 3. Page: `/dashboard`

```
app/(app)/dashboard/page.tsx (S + C islands)
├── <KpiRibbon> (C)                 ← components/dashboard/kpi-ribbon.tsx
│   └── <KpiMetricCard> × 4 (C)    ← components/shared/kpi-metric-card.tsx
│       ├── [MetricValue]
│       ├── [MetricUnit]
│       ├── [TargetLabel]
│       ├── [DeltaIndicator]        ← Up/down arrow + value
│       └── <ModelEstimateLabel>    ← components/shared/model-estimate-label.tsx
│
├── <DemandEscalationList> (C)      ← components/dashboard/demand-escalation-list.tsx
│   │                                  [ABOVE FOLD — mandatory per §5.3 rule 1]
│   └── <DemandEscalationRow> × N  ← components/shared/demand-escalation-row.tsx
│       ├── [DemandID]              ← monospaced
│       ├── <DepartmentTag>         ← components/shared/department-tag.tsx
│       ├── [SectionCode]
│       ├── [FailureReason]
│       ├── [Timestamp]             ← monospaced
│       └── [Button] → /approvals  ← [shadcn/Button] size="sm"
│
├── [2-column grid]
│   ├── <BlockCountSummary> (C)     ← components/dashboard/block-count-summary.tsx
│   │   └── <BlockStatusPill> × 4  ← components/shared/block-status-pill.tsx
│   │       └── [icon + text + color token] (WCAG 1.4.1)
│   └── <MachineUtilizationSummary>← components/dashboard/machine-utilization-summary.tsx
│       └── [Progress bar]         ← [shadcn/Progress]
│
├── <QuickNavCards>                 ← components/dashboard/quick-nav-cards.tsx
│   └── [Card] × 4                 ← [shadcn/Card] — Planner, Approvals, Corridor Map, String Chart
│
└── <SimulatedDataWatermark>        ← components/shell/simulated-data-watermark.tsx
```

---

## 4. Page: `/corridor-map`

```
app/(app)/corridor-map/page.tsx (C — full client, no SSR for map)
└── [relative container, fills viewport minus header+sidebar]
    ├── <LayerControlPanel> (C)     ← components/corridor-map/layer-control-panel.tsx
    │   ├── [Switch] Track lines   ← [shadcn/Switch]
    │   ├── [Switch] Stations      ← [shadcn/Switch]
    │   ├── [Switch] Block zones   ← [shadcn/Switch]
    │   ├── [Switch] RTIS trains   ← [shadcn/Switch]
    │   └── [Switch] OHE sections  ← [shadcn/Switch]
    │
    ├── <GISCorridorMap> (C)       ← components/visualizations/gis-corridor-map.tsx
    │   ├── <canvas ref>           ← MapLibre GL JS renders here
    │   ├── <SectionDetailPopover> ← components/overlays/section-detail-popover.tsx
    │   │   └── [Popover]          ← [shadcn/Popover]
    │   │       ├── [SectionCode]
    │   │       ├── [HealthIndices] GMT, defect count
    │   │       ├── [MaintenanceWindows]
    │   │       └── <BlockStatusPill>
    │   └── [LiveTrainMarkers]     ← rendered by MapLibre GL JS layer (not React)
    │
    ├── <BlockHeatmapLegend>       ← components/corridor-map/block-heatmap-legend.tsx
    │   └── [LegendItem] per dept+status
    │
    └── <SimulatedDataWatermark>   ← absolute positioned, z-index above map, non-dismissible
```

---

## 5. Page: `/string-chart`

```
app/(app)/string-chart/page.tsx (C)
├── <SectionDateSelector> (C)      ← components/string-chart/section-date-selector.tsx
│   ├── [Select] Section           ← [shadcn/Select]
│   └── [Select] Date              ← [shadcn/Select]
│
├── [relative canvas container]
│   ├── <TimeDistanceStringChart> (C)← components/visualizations/time-distance-string-chart.tsx
│   │   └── <canvas ref>           ← Custom render: grid, blocks, trains, overlays
│   │
│   ├── <StringChartTooltip> (C)   ← components/string-chart/string-chart-tooltip.tsx
│   │   └── Absolutely positioned div, shown on canvas mousemove
│   │       ├── [TrainNumber/Type]
│   │       ├── [BlockID]
│   │       ├── <DepartmentTag>
│   │       ├── <BlockStatusPill>
│   │       └── [TimeWindow]
│   │
│   └── <SimulatedDataWatermark>   ← absolute, non-dismissible, above canvas
│
└── <StringChartLegend>            ← components/string-chart/string-chart-legend.tsx
    ├── [LegendItem] per train type (shape/pattern encoding)
    ├── [LegendItem] per block dept
    └── [LegendItem] shadow bundle pattern
```

---

## 6. Page: `/planner/26-week`

```
app/(app)/planner/26-week/page.tsx (C)
├── <GanttFilterPanel> (C)         ← components/planner/gantt-filter-panel.tsx
│   ├── [Select] Division          ← [shadcn/Select]
│   ├── [Select] Section           ← [shadcn/Select]
│   ├── [Select] Department        ← [shadcn/Select] — Civil, TRD, S&T (in this order)
│   └── [Select] Block Status      ← [shadcn/Select]
│
├── <TwentySixWeekGanttCalendar> (C)← components/visualizations/twenty-six-week-gantt.tsx
│   ├── [SectionLabels column]     ← sticky left, 200px
│   ├── [WeekHeaders row]          ← 26 columns, week number + date range
│   ├── [CurrentWeekMarker]        ← absolute vertical line
│   ├── [BlockAllocationBar] × N   ← per plan per section per week
│   │   └── onClick → <BlockDetailPopover>
│   └── <WeekLoadHeatmapIndicator> ← components/planner/week-load-heatmap-indicator.tsx
│       └── [Progress]             ← [shadcn/Progress] per week column header
│
└── <BlockDetailPopover>           ← components/overlays/block-detail-popover.tsx
    └── [Popover]                  ← [shadcn/Popover]
        ├── [PlanID]
        ├── [SectionCode]
        ├── [PrimaryDemand]
        ├── [ShadowDemands list]
        ├── <BlockStatusPill>
        └── [Button] → /planner/weekly?week=N
```

---

## 7. Page: `/planner/weekly`

```
app/(app)/planner/weekly/page.tsx (C)
├── [top bar — sticky]
│   ├── <WeekNavigator> (C)        ← components/planner/week-navigator.tsx
│   │   ├── [Button] prev week     ← [shadcn/Button] variant="ghost"
│   │   ├── [WeekLabel]            ← "Week 34 — 18–24 Aug 2026"
│   │   └── [Button] next week
│   └── <SolverStatusBanner> (C)   ← components/shell/solver-status-banner.tsx
│       ├── <StateBadge> solver    ← OPTIMAL / FEASIBLE / INFEASIBLE / UNKNOWN
│       ├── [BestBound]            ← monospaced number
│       └── [LastRunAt]            ← relative timestamp
│
├── <RevisionWarningBanner> (C)    ← components/planner/revision-warning-banner.tsx
│   └── [Alert] "Plan changed..."  ← [shadcn/Alert] — conditional, sticky below top bar
│
├── [3-column layout]
│   ├── <DemandQueuePanel> (C) 320px← components/planner/demand-queue-panel.tsx
│   │   └── [DemandRow] × N
│   │       ├── [DemandID]
│   │       ├── <DepartmentTag>
│   │       ├── [AssetID]
│   │       ├── [UrgencyScore]     ← with <ModelEstimateLabel>
│   │       ├── <FreshnessBadge>   ← components/shared/freshness-badge.tsx
│   │       └── <BlockStatusPill>
│   │
│   ├── <BlockScheduleGrid> (C)    ← components/visualizations/block-schedule-grid.tsx
│   │   ├── [SectionLabel] × N     ← left sticky column
│   │   ├── [DayHeader] × 7        ← Mon–Sun
│   │   └── [BlockSlot] × N        ← per section per day
│   │       ├── [BlockInterval]    ← time-proportional width
│   │       └── <ShadowBundleIndicator>← components/planner/shadow-bundle-indicator.tsx
│   │           └── [DeptStripe] × 3← Civil, TRD, S&T pattern stripes
│   │
│   └── <MachineRosterPanel> (C) 280px← components/planner/machine-roster-panel.tsx
│       └── [Table]                ← [shadcn/Table]
│           └── [MachineRow] × N
│               ├── [MachineID]
│               ├── [AssignedSection]
│               ├── [TravelWindow]
│               └── [DepotOrigin]
│
└── [Action buttons row]
    ├── [Button] Trigger Solver    ← [shadcn/Button] — canPerform('TRIGGER_SOLVER') guard
    ├── [Button] Submit → /approvals← [shadcn/Button]
    └── [Button] View Impact       ← opens impact summary panel
```

---

## 8. Page: `/approvals`

```
app/(app)/approvals/page.tsx (C)
├── [split layout: 360px left + fill right]
│
├── LEFT: <PlanApprovalQueue> (C)  ← components/approvals/plan-approval-queue.tsx
│   └── [PlanQueueRow] × N        ← per awaiting plan
│       ├── [PlanID]              ← monospaced
│       ├── [SectionCode]
│       ├── [TimeWindow]
│       ├── <DepartmentTag>
│       ├── <StateBadge>          ← components/shared/state-badge.tsx (12-state)
│       └── [HashMatchIndicator]  ← ✓ / ⚠ icon (content_hash match)
│
└── RIGHT: <ActionPreviewCard> (C) ← components/overlays/action-preview-card.tsx
    │      (renders in-page panel, not a modal — modal only on mobile)
    │
    ├── [WHAT section]
    │   ├── [SectionName]
    │   ├── [StartTime / EndTime]  ← monospaced
    │   └── [Duration]            ← monospaced
    │
    ├── [WHY section]
    │   ├── [DefectSeverity]
    │   ├── [AssetID]             ← monospaced
    │   └── <FreshnessBadge>      ← source_ingested_at staleness
    │
    ├── <ShadowClusterPanel> (C)  ← components/approvals/shadow-cluster-panel.tsx
    │   └── [ShadowDemandRow] × N
    │       ├── <DepartmentTag>
    │       └── [WorkType]
    │
    ├── <ImpactSummaryPanel> (C)  ← components/approvals/impact-summary-panel.tsx
    │   ├── [PassengerDelay]      ← with <ModelEstimateLabel>
    │   ├── [FreightDetention]    ← with <ModelEstimateLabel>
    │   └── [MachineUtilization]  ← with <ModelEstimateLabel>
    │
    ├── <SentinelCheckList> (C)   ← components/shared/sentinel-check-list.tsx
    │   ├── [Headline] "SAFETY VERIFICATION: N/10 CHECKS PASSED" (computed)
    │   └── <SentinelCheckRow> × 10← components/shared/sentinel-check-row.tsx
    │       ├── [RuleID]          ← G&SR-1…G&SR-5, MILP-C1…MILP-C5
    │       ├── [RuleName]
    │       ├── [PassFailIcon]    ← icon + text (never color alone)
    │       └── [DetailText]
    │
    ├── <StateBadge> (C)          ← components/shared/state-badge.tsx (12-state FSM)
    │
    ├── <RevisionIntegrityBanner> (C)← components/approvals/revision-integrity-banner.tsx
    │   └── [Alert] "Plan changed — reload" ← conditional on hash mismatch
    │       Disables <ApprovalActionRow> Approve button
    │
    ├── <DistinctApproverGuard> (C)← components/approvals/distinct-approver-guard.tsx
    │   └── [disabled message] — shown when persona.id === plan.decidedBy (DRM step)
    │
    ├── <ApprovalChainProgress> (C)← components/visualizations/approval-chain-progress.tsx
    │   └── [StateNode] × 5       ← DRAFT → SENTINEL_PASSED → APPROVED_SR_DOM → AUTHORIZED_DRM → TRANSMITTED_COA
    │
    ├── <ApprovalActionRow> (C)   ← components/approvals/approval-action-row.tsx
    │   ├── [Button] Approve      ← disabled if: stale OR hash-mismatch OR wrong role OR wrong state
    │   ├── [Button] Modify       ← triggers revision creation
    │   └── [Button] Reject       ← opens rejection reason form
    │
    └── <ApprovalDecisionForm> (C) ← components/forms/approval-decision-form.tsx
        └── shown when Approve clicked
            ├── [Input] Signature  ← [shadcn/Input] — mock or PIN
            └── [Button] Confirm
        or when Reject clicked
            └── <RejectionReasonInput>← components/forms/rejection-reason-input.tsx
                └── [Textarea]     ← [shadcn/Textarea] — required
```

---

## 9. Page: `/disruptions`

```
app/(app)/disruptions/page.tsx (C)
├── [split layout: 360px left + fill right]
│
├── LEFT: <ActiveIncidentsList> (C)← components/disruptions/active-incidents-list.tsx
│   └── [IncidentRow] × N
│       ├── [SectionCode]
│       ├── [IncidentType]        ← TRACK_FRACTURE / OHE_BREAKDOWN / SIGNAL_FAILURE / OTHER
│       ├── [Severity]            ← P0 / P1 badge
│       ├── [ReportedAt]          ← monospaced relative time
│       └── <CoalescingStatusIndicator>← components/disruptions/coalescing-status-indicator.tsx
│           └── [badge] "COALESCED WITH ..." — if coalescedWith is set
│
└── RIGHT: <IncidentDetailView> (C)← components/disruptions/incident-detail-view.tsx
    ├── [AffectedSections list]
    ├── [TrainsHeld list]          ← monospaced train numbers
    ├── [PlansSuperseded list]     ← monospaced plan IDs
    ├── [EstimatedRestorationTime]
    │
    ├── <EmergencyTriggerButton> (C)← components/disruptions/emergency-trigger-button.tsx
    │   └── [Button] "Trigger P0 Override"
    │       disabled if: !canPerform('TRIGGER_EMERGENCY') || !isConnected
    │       onClick → opens <EmergencyConfirmModal>
    │
    ├── <ProvisionalPlanDisplay> (C)← components/disruptions/provisional-plan-display.tsx
    │   (rendered only after emergency solver completes)
    │   ├── <StateBadge> PROVISIONAL← components/shared/state-badge.tsx
    │   ├── <SentinelCheckList>   ← 4-check subset for emergency (structural only)
    │   └── <ControllerAcknowledgmentGate>← components/disruptions/controller-acknowledgment-gate.tsx
    │       └── [Button] "Acknowledge as Authoritative"
    │           disabled if: !canPerform('ACKNOWLEDGE_PROVISIONAL') || !isConnected
    │
    └── <SimulatedDataWatermark>
    
    [Portal/Dialog overlay]
    └── <EmergencyConfirmModal> (C)← components/overlays/emergency-confirm-modal.tsx
        └── [Dialog]              ← [shadcn/Dialog]
            ├── <BlastRadiusPanel>← components/disruptions/blast-radius-panel.tsx
            │   ├── [TrainsHeldCount]
            │   ├── [PlansSupersededList]
            │   └── [AffectedSectionsList]
            ├── <CoalescingAlert> ← components/disruptions/coalescing-alert.tsx
            │   └── [Alert] — if adjacent incident exists
            ├── <IncidentTypeSelector>← components/disruptions/incident-type-selector.tsx
            │   └── [Select]      ← [shadcn/Select] 4 options
            ├── <AcknowledgmentCheckbox>← components/forms/acknowledgment-checkbox.tsx
            │   └── [Checkbox]    ← [shadcn/Checkbox]
            │       "I acknowledge the blast radius of this action"
            └── [Button] "Fire Emergency Override"
                disabled until checkbox checked
                onClick → emergency.triggerBreakdown()
```

---

## 10. Page: `/audit-ledger`

```
app/(app)/audit-ledger/page.tsx (C)
├── <HashChainVerificationBanner> (C)← components/audit-ledger/hash-chain-verification-banner.tsx
│   └── [Alert]                    ← "N events verified, unbroken chain" OR "Chain broken at seq X"
│       Uses "tamper-evident" terminology (never "tamper-proof")
│
├── <VerifyChainButton> (C)        ← components/audit-ledger/verify-chain-button.tsx
│   └── [Button] "Verify Chain"    ← [shadcn/Button] with loading spinner
│       onClick → ledger.verify() → updates banner
│
├── <LedgerSearchFilter> (C)       ← components/audit-ledger/ledger-search-filter.tsx
│   ├── [Select] Event Type        ← [shadcn/Select]
│   ├── [Select] Actor             ← [shadcn/Select]
│   ├── [Input] Date From          ← [shadcn/Input] type="date"
│   ├── [Input] Date To            ← [shadcn/Input] type="date"
│   └── [Input] Block ID           ← [shadcn/Input]
│
├── <LedgerEventTable> (C)         ← components/audit-ledger/ledger-event-table.tsx
│   └── [Table]                    ← [shadcn/Table]
│       ├── [TableHeader]
│       │   └── Seq / Event ID / Type / Actor / Timestamp / Block ID / Hash / PrevHash / Status
│       └── [TableRow] × N
│           ├── [SeqNum]           ← monospaced
│           ├── [EventID]          ← monospaced truncated
│           ├── [EventType]
│           ├── [Actor]
│           ├── [Timestamp]        ← monospaced ISO
│           ├── [BlockID]          ← monospaced
│           ├── [HashTruncated]    ← monospaced, first 8 chars + "..."
│           ├── [PrevHashTruncated]← monospaced, first 8 chars + "..."
│           ├── [VerificationBadge]← ✓ chain-ok / ✗ chain-broken (icon + text)
│           └── onClick → opens <EventDetailDrawer>
│
└── <EventDetailDrawer> (C)        ← components/overlays/event-detail-drawer.tsx
    └── [Sheet]                    ← [shadcn/Sheet] side="right"
        ├── [FullHash]             ← monospaced, full 64-char SHA-256
        ├── [FullPrevHash]         ← monospaced, full 64-char SHA-256
        ├── [PayloadJSON]          ← monospaced pre-formatted JSON
        ├── [ActorDetails]
        ├── [Timestamp]            ← ISO 8601 full precision
        └── [LinkedPlanID]         ← link → /approvals?planId=...
```

---

## 11. Shared Components Reference

### Shell Components (`components/shell/`)

| Component | Props | Behavior |
|---|---|---|
| `Header` | `onOpenEmergency: () => void` | Renders persona switcher, status pills, live clock, ledger + emergency CTAs |
| `Sidebar` | `activePath: string` | Collapsible (248px / 76px). `layoutId="sidebar-active"` for animated active indicator |
| `StaleStateOverlay` | — | Reads `SSEContext.isConnected`. Renders non-dismissible overlay when `false`. No props. |
| `SimulatedDataWatermark` | `position?: 'corner' \| 'center'` | Absolute positioned text. Never dismissible. |

### Shared Display Components (`components/shared/`)

| Component | Props | Notes |
|---|---|---|
| `StateBadge` | `status: BlockPlanStatus` | Maps each of 12 states to icon + text + color token |
| `SolverStatusBanner` | — | Reads `SolverContext`. Always visible on planner pages. |
| `KpiMetricCard` | `label, value, unit, target, delta, tone` | `delta` shown with directional arrow |
| `DemandEscalationRow` | `demand: EscalatedDemand` | Links to `/approvals` on CTA click |
| `BlockStatusPill` | `status: BlockPlanStatus` | Inline variant of `StateBadge` |
| `FreshnessBadge` | `ingestedAt: Date, maxStalenessMs: number` | Renders green/amber/red + icon + text |
| `ModelEstimateLabel` | — | Renders "(model estimate — B1-relative, simulated data)" inline |
| `DepartmentTag` | `dept: Department` | Civil / TRD / S&T — icon + text always |
| `SentinelCheckRow` | `check: SentinelCheckResult` | `ruleId` + `name` + pass/fail icon + `detail` |
| `SentinelCheckList` | `checks: SentinelCheckResult[]` | Renders headline "N/10 CHECKS PASSED" (computed) + all rows |

### Overlays Summary (`components/overlays/`)

| Component | Trigger | Implementation |
|---|---|---|
| `ActionPreviewCard` | Plan row click in `/approvals` | In-page right panel on desktop; `Dialog` on mobile |
| `EmergencyConfirmModal` | `EmergencyTriggerButton.onClick` | `Dialog` — cannot be dismissed without checkbox + confirm |
| `EventDetailDrawer` | Table row click in `/audit-ledger` | `Sheet` side="right" |
| `SectionDetailPopover` | Map section hover/click | `Popover` anchored to map canvas coordinate |
| `BlockDetailPopover` | Gantt block bar click | `Popover` anchored to block bar element |

---

## 12. Cross-Cutting Concerns

### WCAG 1.4.1 — Status Token Tripling
Every `StateBadge`, `BlockStatusPill`, `FreshnessBadge`, `DepartmentTag`, `SentinelCheckRow` renders: **color token + icon + text**. No component in this tree conveys status by color alone.

### Stale State Propagation
`StaleStateOverlay` renders at the app shell level. All `<Button>` components that perform mutations accept an `disabled` prop. The pattern is:
```tsx
<Button disabled={!isConnected || !canPerform('APPROVE_PLAN') || hashMismatch}>
  Approve & Sign
</Button>
```
This ensures SSE disconnect, permission, and hash-mismatch are independently tested.

### Department Order Consistency
All lists rendering multiple departments (shadow cluster, block schedule legend, filter dropdowns) enforce Civil → TRD → S&T via the `DEPARTMENT_ORDER` constant in `lib/constants.ts`.

### Monospaced Numerics
All times, IDs, hashes, distances, speeds use JetBrains Mono (or `font-mono` Tailwind class).
