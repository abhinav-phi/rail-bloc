/** Role → page / role → action visibility map for the Atlas console.
 *
 * This mirrors the backend's `require_roles(...)` gates in `apps/api/routers/*` —
 * it does NOT replace them. The server stays the security boundary; this file
 * only decides what the UI *shows*, so an operator sees the console their role
 * actually has instead of buttons that 403 on click. If a gate changes on
 * either side, change it on both (verified against backend on 2026-09-10).
 */

import type { PersonaRole } from '@/lib/types';

export type PageKey =
  | 'dashboard'
  | 'planner-weekly'
  | 'approvals'
  | 'ledger'
  | 'corridor-map'
  | 'string-chart'
  | 'planner-26w'
  | 'disruptions';

export type ActionKey =
  /** POST /optimize/solve — SR_DOM + ADMIN */
  | 'solve'
  /** POST /approvals/decide as SR_DOM */
  | 'approve_srdom'
  /** POST /approvals/decide as DRM */
  | 'authorize_drm'
  /** POST /plans/{id}/revise — SR_DOM, ENGINEER, ADMIN */
  | 'modify'
  /** POST /plans/{id}/transmit — SR_DOM, CONTROLLER, ADMIN */
  | 'transmit'
  /** POST /plans/{id}/activate — CONTROLLER, ADMIN */
  | 'activate'
  /** POST /plans/{id}/complete-fitness — ENGINEER, SM, CONTROLLER, ADMIN */
  | 'fitness'
  /** POST /plans/{id}/archive — ADMIN, AUDITOR */
  | 'archive'
  /** POST /plans/{id}/cancel — SR_DOM, DRM, ADMIN */
  | 'cancel'
  /** acknowledge-signal recorded in the SM column */
  | 'ack_sm'
  /** acknowledge-signal recorded in the Controller column */
  | 'ack_ctl'
  /** POST /emergency/breakdown — CONTROLLER only on the backend */
  | 'drill'
  /** POST /emergency/incidents/{id}/acknowledge — CONTROLLER only */
  | 'incident_ack'
  /** GET /emergency/blast-radius — CONTROLLER, SR_DOM, DRM, ENGINEER, ADMIN */
  | 'blast_radius'
  /** GET /ledger/verify + /ledger/entries — AUDITOR, ADMIN */
  | 'ledger_verify';

/** Canonical roles after folding legacy frontend aliases. */
export type RbacRole =
  | 'SR_DOM'
  | 'DRM'
  | 'CONTROLLER'
  | 'ENGINEER'
  | 'STATION_MASTER'
  | 'AUDITOR'
  | 'ADMIN'
  | 'UNKNOWN';

/** The backend signs CONTROLLER / ENGINEER; CHIEF_CONTROLLER / SSE / SR_DEN are
 * legacy frontend display aliases (lib/types.ts PersonaRole) that previously
 * broke role checks (e.g. ack_ctl compared against CHIEF_CONTROLLER, which no
 * real JWT ever carried). */
const ROLE_ALIASES: Record<string, RbacRole> = {
  SR_DOM: 'SR_DOM',
  DRM: 'DRM',
  CONTROLLER: 'CONTROLLER',
  CHIEF_CONTROLLER: 'CONTROLLER',
  ENGINEER: 'ENGINEER',
  SSE: 'ENGINEER',
  SR_DEN: 'ENGINEER',
  STATION_MASTER: 'STATION_MASTER',
  AUDITOR: 'AUDITOR',
  ADMIN: 'ADMIN',
};

export function normalizeRole(raw?: PersonaRole | string | null): RbacRole {
  return ROLE_ALIASES[raw ?? ''] ?? 'UNKNOWN';
}

export const ALL_PAGES: PageKey[] = [
  'dashboard',
  'planner-weekly',
  'approvals',
  'ledger',
  'corridor-map',
  'string-chart',
  'planner-26w',
  'disruptions',
];

export const ALL_ACTIONS: ActionKey[] = [
  'solve',
  'approve_srdom',
  'authorize_drm',
  'modify',
  'transmit',
  'activate',
  'fitness',
  'archive',
  'cancel',
  'ack_sm',
  'ack_ctl',
  'drill',
  'incident_ack',
  'blast_radius',
  'ledger_verify',
];

/** Display labels for the deep-link denied card + nav parity. */
export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Operations Overview',
  'planner-weekly': 'Weekly planner',
  approvals: 'Approvals',
  ledger: 'Audit ledger',
  'corridor-map': 'Corridor map',
  'string-chart': 'String chart',
  'planner-26w': '26-week horizon',
  disruptions: 'Disruptions',
};

const ROLE_PAGES: Record<RbacRole, PageKey[]> = {
  // Sr. DOM: owns planning + first signature; ledger is the auditor's tool.
  SR_DOM: [
    'dashboard',
    'planner-weekly',
    'approvals',
    'planner-26w',
    'corridor-map',
    'string-chart',
    'disruptions',
  ],
  // DRM: second signature over Sr. DOM's approved plans; reviews horizons.
  DRM: [
    'dashboard',
    'approvals',
    'planner-26w',
    'corridor-map',
    'string-chart',
    'disruptions',
  ],
  // Controller: operations desk — disruptions, live blocks, activation.
  // No solve trigger, no 26-week planning.
  CONTROLLER: [
    'dashboard',
    'planner-weekly',
    'approvals',
    'corridor-map',
    'string-chart',
    'disruptions',
  ],
  // Engineer (SSE/S&T): maintenance view — revise + certify fitness.
  ENGINEER: [
    'dashboard',
    'approvals',
    'planner-26w',
    'corridor-map',
    'string-chart',
    'disruptions',
  ],
  // Station Master: field desk — acknowledge signals, certify fitness.
  // No planner pages, no emergency desk.
  STATION_MASTER: ['dashboard', 'approvals', 'corridor-map', 'string-chart'],
  // Vigilance Auditor: ledger is their page; corridor map for spot checks.
  AUDITOR: ['dashboard', 'ledger', 'corridor-map'],
  // Demo wildcard — sees everything (signing actions still 403 where the
  // backend gate excludes ADMIN, e.g. /approvals/decide).
  ADMIN: ALL_PAGES,
  // Unrecognized role: least privilege, never Sr.DOM (old fallback).
  UNKNOWN: ['dashboard'],
};

const ROLE_ACTIONS: Record<RbacRole, ActionKey[]> = {
  SR_DOM: [
    'solve',
    'approve_srdom',
    'modify',
    'transmit',
    'cancel',
    'blast_radius',
  ],
  DRM: ['authorize_drm', 'cancel', 'blast_radius'],
  CONTROLLER: [
    'drill',
    'incident_ack',
    'ack_ctl',
    'transmit',
    'activate',
    'fitness',
    'blast_radius',
  ],
  ENGINEER: ['modify', 'fitness', 'blast_radius'],
  STATION_MASTER: ['ack_sm', 'fitness'],
  AUDITOR: ['ledger_verify', 'archive'],
  ADMIN: ALL_ACTIONS,
  UNKNOWN: [],
};

/** Sidebar href → page key. Routes outside the gated console (/, /login) are
 * absent and always allowed by pageForPath. */
export const PAGE_BY_HREF: Record<string, PageKey> = {
  '/dashboard': 'dashboard',
  '/planner/weekly': 'planner-weekly',
  '/approvals': 'approvals',
  '/audit-ledger': 'ledger',
  '/corridor-map': 'corridor-map',
  '/string-chart': 'string-chart',
  '/planner/26-week': 'planner-26w',
  '/disruptions': 'disruptions',
};

/** Console page for an exact route path; null for non-console paths. */
export function pageForPath(pathname?: string | null): PageKey | null {
  return (pathname && PAGE_BY_HREF[pathname]) || null;
}

/** Route for a page key (inverse of PAGE_BY_HREF) — for building links from
 * role-filtered page lists (denied card, tests). */
export function hrefForPage(page: PageKey): string {
  const href = Object.entries(PAGE_BY_HREF).find(([, p]) => p === page)?.[0];
  if (!href) throw new Error(`No route mapped for page ${page}`);
  return href;
}

export function pagesFor(raw?: PersonaRole | string | null): PageKey[] {
  return ROLE_PAGES[normalizeRole(raw)];
}

export function canPage(
  raw: PersonaRole | string | null | undefined,
  page: PageKey,
): boolean {
  return ROLE_PAGES[normalizeRole(raw)].includes(page);
}

export function can(
  raw: PersonaRole | string | null | undefined,
  action: ActionKey,
): boolean {
  return ROLE_ACTIONS[normalizeRole(raw)].includes(action);
}
