# Document 4: Design.md — UI/UX Design System Specification
## [REVISION 1.1 — POST-AUDIT HARDENED]

> **Revision note:** Closes UX-001, DOC-001 (card-level manifestation), and reinforces WCAG 1.4.1 compliance. The single highest-priority change in this document is removing the fabricated "14/14 Rules Verified" claim from the human-in-the-loop approval surface — this number does not correspond to anything in Rules.md or TechSpec.md and misleads the exact person who is the last technical safety barrier before a plan reaches COA.

## 1. Design Philosophy: "Rail Operational Command"

The interface is designed for mission-critical railway control environments. It employs a high-density Dark Slate theme (#0B111E), monospaced tabular numeric figures for operational times, high-contrast state indicators conforming to WCAG AA accessibility standards, and distinct departmental accent colors. **Severity and state are never conveyed by color alone** (WCAG 1.4.1) — every status token pairs color with an icon and a text label.

## 2. Color System & Design Tokens

| Token Name | Hex Value | Semantic Usage |
|---|---|---|
| bg-primary | #0B111E | Main dashboard and console background. |
| bg-surface | #151E2E | Card containers, modals, table headers. |
| border-subtle | #2D3748 | Card borders, table dividers, grid lines. |
| text-primary | #F8FAFC | Main headings, train identifiers, critical text. |
| text-secondary | #94A3B8 | Metadata labels, timestamps, secondary parameters. |
| accent-civil | #F59E0B | Civil Track Engineering (TMS) demands and layers. |
| accent-trd | #0EA5E9 | Electrical Traction TRD (TDMS) demands and power cuts. |
| accent-sig | #10B981 | Signal & Telecom (SMMS) disconnections and gears. |
| status-active | #059669 | Line open / Normal train running / Safe state. Always paired with a ✓ / open-line icon + "ACTIVE" text. |
| status-blocked | #DC2626 | Active traffic block / Track isolated / Line closed. Always paired with a ⛔ icon + "BLOCKED" text. |
| status-caution | #D97706 | Temporary Speed Restriction (TSR) / Warning alert. Always paired with a ⚠ icon + "CAUTION" text. |
| status-stale (NEW) | #6B7280 | Data known to be out of date (SSE disconnected). Always paired with a stale-clock icon + "STALE DATA" text. |
| status-provisional (NEW) | #8B5CF6 | Emergency `PROVISIONAL` plan pending Controller acknowledgment (AppFlow.md Scenario A). |

## 3. Specialized Railway Domain UI Components

### Interactive Time-Distance String Chart (Train Graph)

- **Canvas Architecture:** Rendered using HTML5 Canvas with dual pan and zoom axes.
- **Horizontal Axis (X):** Railway distance in kilometers ($0 \text{ km}$ to $250 \text{ km}$) with station, junction, and block post ticks.
- **Vertical Axis (Y):** Continuous time spanning a 24-hour window ($00:00$ to $23:59$).
- **Train Paths:** Sloped vector lines representing train trajectories. Line color indicates train classification (e.g., Purple for Vande Bharat/Rajdhani, Blue for Mail/Express, Amber for Freight).
- **Block Rectangles:** Semi-transparent colored rectangular overlays spanning the blocked kilometer length and duration. Multi-department shadow blocks display striped diagonal patterns combining Civil (Amber), TRD (Blue), and Signal (Green) accent colors.
- **Rendering performance target:** smooth pan/zoom on the demo scenario dataset. **The "60 FPS at 10,000+ active vector entities" figure is a target, not a validated claim (PERF-003) — it must be measured via FPS profiling on the actual demo scenario before being stated as achieved.**

### GIS Corridor Spatial Map

- **Engine:** MapLibre GL JS vector rendering with custom rail vector tiles.
- **Layers:** Track centerline geometries, railway station markers, active block hazard corridors, real-time train positions from RTIS, and OHE feeding-section boundaries (SAFE-004).
- **Interaction:** Hovering over a track section displays the section's kilometer post, deterministic track-health indices (GMT, weekly defect count) and the nearest scheduled maintenance window for that section (status + time range).
- **Synthetic-data labeling (Rules.md §5):** every layer sourced from synthetic seed data carries a persistent, non-dismissible **"SIMULATED DATA"** watermark — this is a hard requirement, not a subtle footnote, per the project's own demonstration-honesty rules.

### Stale-State Overlay (NEW — UX-001 fix)

If the SSE live-block stream (`/api/v1/stream/live-blocks`) disconnects or its heartbeat lapses, the corridor map and string chart display a **persistent, non-dismissible "STALE DATA — actions disabled" overlay**. All action buttons (Approve, Authorize, Emergency Trigger) are disabled while stale. This prevents a Controller from acting on a corridor that only *looks* clear because the live feed silently died.

### Standardized Action Preview Card (REWRITTEN — UX-001 / DOC-001 fix)

A trust-building modal presented to the Sr. DOM prior to approving any AI-generated block schedule. **The original "14/14 Rules Verified" figure did not correspond to anything documented anywhere else in the project (Rules.md names 5 G&SR rules; TechSpec.md §2 defines 5 MILP constraints — 10 total, not 14) and has been replaced with the actual enumerated check list, each tied to a rule ID a judge or auditor can trace.**

- **WHAT:** Section Name (e.g., GZB-ALJN Down Main Line), Start Time, End Time, Duration (e.g., 01:30 - 05:00, 210 mins).
- **WHY:** Ingested Defect Severity (e.g., TMS IMR Defect #842, Cumulative GMT: 48.2), with a **freshness badge** showing `source_ingested_at` staleness (TEL-001).
- **SHADOW CLUSTER:** Co-allocated works (e.g., Track Tamping + OHE Cantilever Adjustment + Point Machine Overhaul).
- **IMPACT ANALYSIS:** Predicted passenger delay, freight detention, machine utilization — **each figure explicitly labeled "model estimate (B1-relative, simulated data)"**, never presented as a fact.
- **SAFETY VERIFICATION (enumerated, not a bare count):**
  1. ✓/✗ G&SR-1 Absolute Block Exclusion
  2. ✓/✗ G&SR-2 Interlocking Precedence Acknowledgment
  3. ✓/✗ G&SR-3 Fail-Closed State Consistency
  4. ✓/✗ G&SR-4 Power Isolation Boundary Containment
  5. ✓/✗ G&SR-5 Headway Margin (≥15 min)
  6. ✓/✗ MILP-C1 Section Exclusion (NoOverlap)
  7. ✓/✗ MILP-C2 Maintenance Enclosure
  8. ✓/✗ MILP-C3 Shadow Bundling Window Containment
  9. ✓/✗ MILP-C4 Non-Fragmented Duration
  10. ✓/✗ MILP-C5 Machine Spatial Conservation

  Each row links to its ledger evidence entry. The card's headline reads "SAFETY VERIFICATION: 10/10 CHECKS PASSED" only when literally true of the enumerated list above — the number is computed, never hardcoded as a display string.
- **STATE BADGE:** A distinct, unambiguous badge for the plan's current lifecycle state (`SENTINEL_PASSED` / `APPROVED_SR_DOM` / `AUTHORIZED_DRM` / `PROVISIONAL`, etc. — AppFlow.md §3) so the approver never confuses "solver-verified" with "already approved."
- **REVISION INTEGRITY:** If the card's locally-held `content_hash` does not match the server's current hash for the plan (i.e., the plan was edited since the card was opened), the Approve button is disabled and a **"Plan changed — reload to review latest revision"** banner is shown instead of allowing a stale approval.
- **ACTIONS:** [ Approve & Digitally Sign ] — enabled only for the authenticated actor whose role matches the plan's current required approver, and only when the plan is `SENTINEL_PASSED` (or `APPROVED_SR_DOM` for the DRM step) with a hash match. | [ Modify Parameters ] — any use of this action immediately creates a new plan revision and clears `sentinel_verified`, visibly resetting the state badge. | [ Reject Plan ].
- **DRM-step label distinction (APP-001):** when the authenticated actor's role is DRM and the plan is at `APPROVED_SR_DOM`, the primary action label reads **[ Authorize & Seal ]** — distinct from Sr. DOM's [ Approve & Digitally Sign ] — visually reinforcing that a different person performs a different action. The server continues to route by role (DRM → AUTHORIZE). **Implemented in the current build; end-to-end browser verification tracked under TASK-061.**

### Emergency Confirmation Modal (NEW — API-001 fix)

Before `/api/v1/emergency/breakdown` fires, the Controller sees a confirmation modal showing the **blast radius** of the action: trains currently held, plans that will be superseded, and the affected section list. This prevents a single accidental click (or a compromised/duplicate request) from revoking a corridor's plans without the Controller seeing the consequence first.

### Demo Scope Notes (honesty acknowledgments)

- **Single-division UI:** the tactical weekly planner currently targets division DLI only (no multi-division dropdown). The API and schema are division-aware and need no changes to support more; a division selector is a post-hackathon enhancement.
- **STALE overlay timing spec:** server sends an SSE heartbeat comment every 10 seconds; the client resets a ~15-second watchdog on any received message. If no message arrives within the window OR EventSource `onerror` fires (including connect-time failures such as HTTP 500 when Redis is down), the overlay MUST appear immediately. It clears only on the first message after successful reconnection. **Note: this server-client combo is specified but not yet tested end-to-end** (see `Tracker.md §4.2` TASK-054).
- **StringChart tooltip:** implemented — KM post, health indices and nearest block shown on hover (see Interaction note above).
- **DRM button label:** [ Authorize & Seal ] distinction implemented — the primary action label switches by viewer role at the APPROVED_SR_DOM step.
