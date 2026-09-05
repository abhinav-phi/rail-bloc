export type BlockPlanStatus =
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
  | 'CANCELLED';

export type IncidentType =
  | 'TRACK_FRACTURE'
  | 'OHE_BREAKDOWN'
  | 'SIGNAL_FAILURE'
  | 'OTHER';

export type SolverStatus =
  | 'OPTIMAL'
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'UNKNOWN'
  | 'IDLE'
  | 'RUNNING';

export type TrainPathSource = 'WTT' | 'COA_LIVE' | 'FOIS_FORECAST';

export type Department = 'CIVIL' | 'TRD' | 'SNT';

export type PersonaRole =
  | 'SR_DOM'
  | 'DRM'
  | 'ADMIN'
  | 'STATION_MASTER'
  | 'CHIEF_CONTROLLER'
  | 'CONTROLLER'
  | 'AUDITOR'
  | 'SR_DEN'
  | 'ENGINEER'
  | 'SSE';

export interface Persona {
  id: string;
  name: string;
  role: PersonaRole;
  division: string;
  divisionId: string;
  badge: string;
}

export type SentinelRuleId =
  | 'G&SR-1'
  | 'G&SR-2'
  | 'G&SR-3'
  | 'G&SR-4'
  | 'G&SR-5'
  | 'MILP-C1'
  | 'MILP-C2'
  | 'MILP-C3'
  | 'MILP-C4'
  | 'MILP-C5';

export interface SentinelCheckResult {
  ruleId: SentinelRuleId;
  name: string;
  passed: boolean;
  detail: string;
}

export interface BlockPlan {
  id: string;
  sectionId: string;
  startTime: string; // ISO 8601
  endTime: string;
  department: Department;
  status: BlockPlanStatus;
  contentHash: string;
  sentinelHash: string;
  decidedBy: string | null;
  authorizedBy: string | null;
  sentinelChecks: SentinelCheckResult[];
  urgencyScore: number;
  isModelEstimate: true;
}

export interface LedgerEvent {
  seq: number;
  eventId: string;
  eventType: string;
  actor: string;
  timestamp: string;
  blockId: string;
  hash: string;
  prevHash: string;
  verified: boolean;
}

export interface Incident {
  id: string;
  sectionId: string;
  type: IncidentType;
  severity: 'P0' | 'P1';
  reportedAt: string;
  coalescedWith: string | null;
  responseState: 'OPEN' | 'PROVISIONAL_ISSUED' | 'ACKNOWLEDGED' | 'RESOLVED';
  trainsHeld: string[];
  plansSuperseded: string[];
}
