import React from 'react';
import { ApprovalChainProgress } from '@/components/visualizations/approval-chain-progress';
import { SentinelCheckList } from '@/components/shared/sentinel-check-list';
import { ApprovalActionRow } from './approval-action-row';
import { SentinelCheckResult } from '@/lib/types';
import { DepartmentTag } from '@/components/shared/department-tag';

const MOCK_CHECKS: SentinelCheckResult[] = [
  {
    ruleId: 'G&SR-1',
    name: 'No conflicting passenger trains',
    passed: true,
    detail: 'WTT cross-referenced.',
  },
  {
    ruleId: 'G&SR-3',
    name: 'Adjacent block safety buffer',
    passed: true,
    detail: '5km separation maintained.',
  },
  {
    ruleId: 'MILP-C2',
    name: 'Resource availability',
    passed: false,
    detail: 'BCM-1 is marked as MAINTENANCE.',
  },
];

export function ActionPreviewCard({ planId }: { planId?: string }) {
  if (!planId) {
    return (
      <div className="flex-1 border rounded bg-card flex items-center justify-center text-muted-foreground h-full shadow-sm">
        Select a block plan from the queue to review
      </div>
    );
  }

  return (
    <div className="flex-1 border rounded bg-card flex flex-col h-full shadow-sm overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold font-mono">{planId}</h2>
          <DepartmentTag dept="CIVIL" />
        </div>
        <div className="text-sm text-muted-foreground">
          Track maintenance • DLI-PNP • Oct 18, 10:00 - 14:00
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
        <div>
          <h3 className="font-semibold mb-4">Approval Chain Status</h3>
          <ApprovalChainProgress currentStatus="SENTINEL_PASSED" />
        </div>

        <div>
          <h3 className="font-semibold mb-4">Sentinel Verifications</h3>
          <SentinelCheckList checks={MOCK_CHECKS} />
        </div>
      </div>

      <ApprovalActionRow isHashValid={true} canApprove={true} />
    </div>
  );
}
