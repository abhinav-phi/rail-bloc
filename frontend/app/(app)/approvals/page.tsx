'use client';
import React, { useState } from 'react';
import { PlanApprovalQueue } from '@/components/approvals/plan-approval-queue';
import { ActionPreviewCard } from '@/components/approvals/action-preview-card';
import { SimulatedDataWatermark } from '@/components/shell/simulated-data-watermark';

export default function ApprovalsPage() {
  const [activePlanId, setActivePlanId] = useState<string | undefined>('BLK-402');

  return (
    <div className="p-6 h-full flex flex-col relative max-w-[1600px] mx-auto">
      <SimulatedDataWatermark position="center" />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Approval Workflow</h1>
        <p className="text-muted-foreground mt-1">Review and authorize block plans cryptographically.</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden pb-6">
        <PlanApprovalQueue activeId={activePlanId} onSelect={setActivePlanId} />
        <ActionPreviewCard planId={activePlanId} />
      </div>
    </div>
  );
}
