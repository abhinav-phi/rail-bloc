export type Persona = {
  id: string;
  role: string;
  name: string;
  division: string;
  badge: string;
};

export type Department = 'Civil' | 'TRD' | 'S&T' | 'Operating';

export type Priority = 'P0' | 'P1' | 'Routine';

export type BlockStatus =
  | 'Draft'
  | 'Sentinel Passed'
  | 'Sr. DOM Decided'
  | 'DRM Authorized'
  | 'Transmitted to COA';

export type TrainType = 'passenger' | 'freight' | 'maintenance';

export type TrainPath = {
  id: string;
  label: string;
  type: TrainType;
  direction: 'UP' | 'DN';
  startMin: number;
  endMin: number;
  track: number;
  departments?: Department[];
  priority?: Priority;
  shadow?: boolean;
};

export type MaintenanceDemand = {
  id: string;
  source: 'TMS' | 'TDMS' | 'SMMS';
  asset: string;
  description: string;
  department: Department;
  priority: Priority;
  requestedSlot: string;
  durationHrs: number;
  status: 'Pending' | 'Allocated' | 'Deferred';
};

export type SentinelCheck = {
  id: number;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export type AuditEvent = {
  id: string;
  hash: string;
  prevHash: string;
  timestamp: string;
  actor: string;
  action: string;
  blockId: string;
  verified: boolean;
};

export type KpiMetric = {
  id: string;
  label: string;
  value: number;
  unit: string;
  target: number;
  delta: number;
  deltaLabel: string;
  tone: 'primary' | 'success' | 'warning' | 'accent';
};

export const PERSONAS: Persona[] = [
  {
    id: 'sr-dom',
    role: 'Sr. DOM',
    name: 'R. K. Sharma',
    division: 'DLI Division',
    badge: 'Sr.DOM/DLI',
  },
  {
    id: 'drm',
    role: 'DRM',
    name: 'Sunita Verma',
    division: 'DLI Division',
    badge: 'DRM/DLI',
  },
  {
    id: 'chief-controller',
    role: 'Chief Controller',
    name: 'A. P. Singh',
    division: 'DLI Division',
    badge: 'CHC/DLI',
  },
  {
    id: 'sse-engineer',
    role: 'SSE Engineer',
    name: 'Meena Nair',
    division: 'DLI Division',
    badge: 'SSE/S&T',
  },
];

export const KPIS: KpiMetric[] = [
  {
    id: 'asset-availability',
    label: 'Asset Availability',
    value: 94.2,
    unit: '%',
    target: 100,
    delta: +2.1,
    deltaLabel: 'vs last week',
    tone: 'primary',
  },
  {
    id: 'bundling-efficiency',
    label: 'Multi-Dept Bundling Efficiency',
    value: 78.5,
    unit: '%',
    target: 100,
    delta: +5.4,
    deltaLabel: 'shadow block ratio',
    tone: 'accent',
  },
  {
    id: 'punctuality',
    label: 'Passenger Punctuality Impact',
    value: 184,
    unit: 'min',
    target: 240,
    delta: +12,
    deltaLabel: 'delay avoided',
    tone: 'success',
  },
  {
    id: 'sentinel-gate',
    label: 'Active Safety Gate',
    value: 100,
    unit: '%',
    target: 100,
    delta: 0,
    deltaLabel: 'Sentinel verified',
    tone: 'warning',
  },
];

const MIN = 60;
const H = 60 * MIN;

export const TRAIN_PATHS: TrainPath[] = [
  // Passenger WTT paths
  {
    id: 'p-12952',
    label: '12952 NDLS-BCT Rajdhani',
    type: 'passenger',
    direction: 'DN',
    startMin: 0,
    endMin: 2 * H + 15 * MIN,
    track: 1,
  },
  {
    id: 'p-12302',
    label: '12302 NDLS-HWH Rajdhani',
    type: 'passenger',
    direction: 'UP',
    startMin: 30 * MIN,
    endMin: 3 * H,
    track: 2,
  },
  {
    id: 'p-12009',
    label: '12009 Shatabdi Express',
    type: 'passenger',
    direction: 'UP',
    startMin: 1 * H + 45 * MIN,
    endMin: 2 * H + 30 * MIN,
    track: 1,
  },
  {
    id: 'p-12626',
    label: '12626 Kerala Express',
    type: 'passenger',
    direction: 'DN',
    startMin: 2 * H + 45 * MIN,
    endMin: 4 * H + 10 * MIN,
    track: 2,
  },
  {
    id: 'p-22691',
    label: '22691 Rajdhani Express',
    type: 'passenger',
    direction: 'UP',
    startMin: 3 * H + 20 * MIN,
    endMin: 5 * H,
    track: 1,
  },
  // Freight forecasts
  {
    id: 'f-BOXN-4421',
    label: 'BOXN Freight 4421',
    type: 'freight',
    direction: 'DN',
    startMin: 1 * H,
    endMin: 1 * H + 50 * MIN,
    track: 3,
  },
  {
    id: 'f-BCNA-3380',
    label: 'BCNA Freight 3380',
    type: 'freight',
    direction: 'UP',
    startMin: 2 * H + 10 * MIN,
    endMin: 3 * H + 5 * MIN,
    track: 3,
  },
  {
    id: 'f-BOXN-5512',
    label: 'BOXN Freight 5512',
    type: 'freight',
    direction: 'DN',
    startMin: 4 * H + 20 * MIN,
    endMin: 5 * H + 15 * MIN,
    track: 3,
  },
  // Maintenance shadow blocks (co-allocated)
  {
    id: 'm-blk-01',
    label: 'OHE TRD + S&T Shadow Block',
    type: 'maintenance',
    direction: 'UP',
    startMin: 0,
    endMin: 55 * MIN,
    track: 3,
    departments: ['TRD', 'S&T'],
    priority: 'Routine',
    shadow: true,
  },
  {
    id: 'm-blk-02',
    label: 'Civil + TRD Track Ballast',
    type: 'maintenance',
    direction: 'DN',
    startMin: 1 * H + 55 * MIN,
    endMin: 2 * H + 40 * MIN,
    track: 3,
    departments: ['Civil', 'TRD'],
    priority: 'P1',
    shadow: true,
  },
  {
    id: 'm-blk-03',
    label: 'S&T Signal Recalibration',
    type: 'maintenance',
    direction: 'UP',
    startMin: 3 * H + 10 * MIN,
    endMin: 3 * H + 50 * MIN,
    track: 3,
    departments: ['S&T'],
    priority: 'Routine',
    shadow: true,
  },
  {
    id: 'm-blk-04',
    label: 'Civil + TRD + S&T Tri-Dept Block',
    type: 'maintenance',
    direction: 'DN',
    startMin: 4 * H + 30 * MIN,
    endMin: 5 * H + 30 * MIN,
    track: 3,
    departments: ['Civil', 'TRD', 'S&T'],
    priority: 'P1',
    shadow: true,
  },
];

export const MAINTENANCE_DEMANDS: MaintenanceDemand[] = [
  {
    id: 'MD-2241',
    source: 'TMS',
    asset: 'TKM-214/B (DN Line)',
    description: 'Rail grinding & ballast tamping — 1.2 km section',
    department: 'Civil',
    priority: 'P1',
    requestedSlot: 'Tue 02:00–04:00',
    durationHrs: 2,
    status: 'Pending',
  },
  {
    id: 'MD-2242',
    source: 'TDMS',
    asset: 'OHE Mast 38–44 (GZB–SRE)',
    description: 'Catenary tension adjustment & insulator replacement',
    department: 'TRD',
    priority: 'Routine',
    requestedSlot: 'Wed 01:30–03:30',
    durationHrs: 2,
    status: 'Pending',
  },
  {
    id: 'MD-2243',
    source: 'SMMS',
    asset: 'Signal Relay R-17 (DLI Jn)',
    description: 'Point machine recalibration & track circuit test',
    department: 'S&T',
    priority: 'Routine',
    requestedSlot: 'Thu 03:00–04:00',
    durationHrs: 1,
    status: 'Pending',
  },
  {
    id: 'MD-2244',
    source: 'TMS',
    asset: 'Bridge ROB-09 (TKM 198)',
    description: 'Track surface fracture inspection — urgent',
    department: 'Civil',
    priority: 'P0',
    requestedSlot: 'Today 23:30–00:30',
    durationHrs: 1,
    status: 'Pending',
  },
  {
    id: 'MD-2245',
    source: 'TDMS',
    asset: 'SSP-2 Substation (NDLS)',
    description: 'Transformer oil sampling & breaker servicing',
    department: 'TRD',
    priority: 'Routine',
    requestedSlot: 'Fri 02:00–03:30',
    durationHrs: 1.5,
    status: 'Allocated',
  },
  {
    id: 'MD-2246',
    source: 'SMMS',
    asset: 'IBH Signal Panel (DLI)',
    description: 'Route relay interlocking verification',
    department: 'S&T',
    priority: 'P1',
    requestedSlot: 'Sat 01:00–02:30',
    durationHrs: 1.5,
    status: 'Pending',
  },
];

export const APPROVAL_STAGES: BlockStatus[] = [
  'Draft',
  'Sentinel Passed',
  'Sr. DOM Decided',
  'DRM Authorized',
  'Transmitted to COA',
];

export const SENTINEL_CHECKS: SentinelCheck[] = [
  { id: 1, label: 'Block window conflict-free (WTT)', status: 'pass', detail: '0 passenger path conflicts' },
  { id: 2, label: 'Track machine availability', status: 'pass', detail: '3/3 machines assigned' },
  { id: 3, label: 'Possession handover margin ≥ 15 min', status: 'pass', detail: '18 min margin' },
  { id: 4, label: 'Detour route feasibility', status: 'pass', detail: 'Single-line working viable' },
  { id: 5, label: 'OHE isolation confirmed (TRD)', status: 'pass', detail: 'Section dead' },
  { id: 6, label: 'Signal isolation & clamping (S&T)', status: 'pass', detail: 'All points clamped' },
  { id: 7, label: 'Engineering speed restriction issued', status: 'pass', detail: '15 km/h advisory' },
  { id: 8, label: 'Crew roster impact < threshold', status: 'warn', detail: '2 crews re-timed' },
  { id: 9, label: 'Punctuality deviation ≤ 10 min', status: 'pass', detail: '7.4 min avg' },
  { id: 10, label: 'Cryptographic signature attached', status: 'pass', detail: 'SHA-256 chained' },
];

export const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'evt-001',
    hash: '000a7f3c92b4e8d1…f021',
    prevHash: '0000000000000000',
    timestamp: '2026-08-25 09:42:11',
    actor: 'CP-SAT Solver',
    action: 'Block plan generated (optimal)',
    blockId: 'BLK-2026-W34-01',
    verified: true,
  },
  {
    id: 'evt-002',
    hash: '000b8e4d03c5f9e2…a103',
    prevHash: '000a7f3c92b4e8d1…f021',
    timestamp: '2026-08-25 09:42:14',
    actor: 'Sentinel Safety Engine',
    action: '10-point safety check passed',
    blockId: 'BLK-2026-W34-01',
    verified: true,
  },
  {
    id: 'evt-003',
    hash: '000c9f5e14d60af3…b214',
    prevHash: '000b8e4d03c5f9e2…a103',
    timestamp: '2026-08-25 09:43:02',
    actor: 'R. K. Sharma (Sr. DOM)',
    action: 'Decision recorded — Approve',
    blockId: 'BLK-2026-W34-01',
    verified: true,
  },
  {
    id: 'evt-004',
    hash: '000d0a6f25e71b04…c325',
    prevHash: '000c9f5e14d60af3…b214',
    timestamp: '2026-08-25 09:44:38',
    actor: 'Sunita Verma (DRM)',
    action: 'Authorization granted',
    blockId: 'BLK-2026-W34-01',
    verified: true,
  },
  {
    id: 'evt-005',
    hash: '000e1b7036f82c15…d436',
    prevHash: '000d0a6f25e71b04…c325',
    timestamp: '2026-08-25 09:45:55',
    actor: 'COA Transmission Service',
    action: 'Transmitted to COA — acknowledged',
    blockId: 'BLK-2026-W34-01',
    verified: true,
  },
];

export const ROLLING_WEEKS = Array.from({ length: 26 }, (_, i) => {
  const week = `W${(34 + i - 26)}`.replace('W0', 'W');
  return {
    id: i,
    label: i === 25 ? 'W34 (Current)' : week,
    current: i === 25,
    load: Math.round(40 + Math.sin(i / 2) * 25 + Math.random() * 20),
  };
});

export function formatClock(min: number): string {
  const base = 22 * 60;
  const total = (base + min) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const TIMELINE_START_HOUR = 22;
export const TIMELINE_HOURS = 6;
