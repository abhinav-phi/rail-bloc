'use client';
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DepartmentTag } from '@/components/shared/department-tag';
import { Department } from '@/lib/types';
import { ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOCK_QUEUE = [
  { id: 'BLK-402', dept: 'CIVIL' as Department, section: 'DLI-PNP', status: 'SENTINEL_PASSED', urgency: 'HIGH' },
  { id: 'BLK-415', dept: 'TRD' as Department, section: 'UMB-LDH', status: 'ESCALATED_OVERDUE', urgency: 'CRITICAL' },
  { id: 'BLK-502', dept: 'SNT' as Department, section: 'JUC-ASR', status: 'SENTINEL_PASSED', urgency: 'NORMAL' },
];

export function PlanApprovalQueue({ activeId, onSelect }: { activeId?: string, onSelect: (id: string) => void }) {
  return (
    <div className="w-[350px] shrink-0 border rounded bg-card flex flex-col h-full shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-muted/10">
        <h3 className="font-semibold">Pending Approvals</h3>
        <p className="text-xs text-muted-foreground mt-1">3 blocks require your authorization</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {MOCK_QUEUE.map((plan) => (
            <div 
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className={cn(
                "p-4 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col gap-2",
                activeId === plan.id ? "bg-accent/50 border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm">{plan.id}</span>
                <DepartmentTag dept={plan.dept} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{plan.section}</span>
                {plan.urgency === 'CRITICAL' && (
                  <span className="flex items-center text-rose-500 font-medium"><ShieldAlert className="h-3 w-3 mr-1"/> Critical</span>
                )}
                {plan.urgency === 'HIGH' && (
                  <span className="flex items-center text-amber-500 font-medium"><Clock className="h-3 w-3 mr-1"/> High</span>
                )}
                {plan.urgency === 'NORMAL' && (
                  <span className="flex items-center text-emerald-500 font-medium"><ShieldCheck className="h-3 w-3 mr-1"/> Normal</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
