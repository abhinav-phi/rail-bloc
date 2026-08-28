import React from 'react';
import { BlockPlanStatus } from '@/lib/types';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface ApprovalChainProgressProps {
  currentStatus: BlockPlanStatus;
}

const CHAIN_STAGES = [
  { id: 'DRAFT', label: 'Draft Created' },
  { id: 'SENTINEL_PASSED', label: 'Sentinel Passed' },
  { id: 'APPROVED_SR_DOM', label: 'Sr. DOM Approved' },
  { id: 'AUTHORIZED_DRM', label: 'DRM Authorized' },
  { id: 'TRANSMITTED_COA', label: 'Transmitted (COA)' },
];

export function ApprovalChainProgress({ currentStatus }: ApprovalChainProgressProps) {
  // Simple mock logic to determine active stage
  const activeIdx = CHAIN_STAGES.findIndex(s => s.id === currentStatus);
  const resolvedIdx = activeIdx >= 0 ? activeIdx : 2; // Default to index 2 for mock

  return (
    <div className="relative pt-6 pb-2">
      <div className="absolute top-9 left-4 right-4 h-0.5 bg-muted" />
      <div className="absolute top-9 left-4 h-0.5 bg-primary transition-all" style={{ width: `${(resolvedIdx / (CHAIN_STAGES.length - 1)) * 100}%` }} />
      
      <div className="relative flex justify-between">
        {CHAIN_STAGES.map((stage, idx) => {
          const isCompleted = idx <= resolvedIdx;
          const isCurrent = idx === resolvedIdx;
          
          return (
            <div key={stage.id} className="flex flex-col items-center gap-2 z-10 w-24">
              <div className={`rounded-full bg-background p-1 ${isCompleted ? 'text-primary' : 'text-muted-foreground'}`}>
                {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : isCurrent ? <Clock className="h-6 w-6 text-amber-500" /> : <Circle className="h-6 w-6" />}
              </div>
              <span className={`text-xs text-center font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
