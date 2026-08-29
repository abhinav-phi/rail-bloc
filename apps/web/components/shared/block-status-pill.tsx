import React from 'react';
import { BlockPlanStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Send,
  Lock,
  XCircle,
  Archive,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  BlockPlanStatus,
  { label: string; icon: any; className: string }
> = {
  DRAFT: {
    label: 'Draft',
    icon: Clock,
    className:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200',
  },
  SENTINEL_PASSED: {
    label: 'Sentinel Passed',
    icon: ShieldCheck,
    className:
      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200',
  },
  APPROVED_SR_DOM: {
    label: 'Approved (Sr. DOM)',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200',
  },
  ESCALATED_OVERDUE: {
    label: 'Escalated',
    icon: AlertTriangle,
    className: 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200',
  },
  AUTHORIZED_DRM: {
    label: 'Authorized (DRM)',
    icon: Lock,
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200',
  },
  TRANSMITTED_COA: {
    label: 'Transmitted to COA',
    icon: Send,
    className:
      'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200',
  },
  PROVISIONAL: {
    label: 'Provisional',
    icon: AlertTriangle,
    className:
      'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200',
  },
  SUPERSEDED: {
    label: 'Superseded',
    icon: XCircle,
    className:
      'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200',
  },
  SUPERSEDED_EMERGENCY: {
    label: 'Superseded (Emergency)',
    icon: AlertTriangle,
    className: 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200',
  },
  ACTIVE_GRANTED: {
    label: 'Active',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200',
  },
  COMPLETED_FITNESS: {
    label: 'Completed',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200',
  },
  ARCHIVED_SEALED: {
    label: 'Archived',
    icon: Archive,
    className:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200',
  },
  FAILED_ESCALATE: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    className:
      'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200',
  },
};

export function BlockStatusPill({ status }: { status: BlockPlanStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 px-2.5 py-0.5 ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}
