import React from 'react';
import { SentinelCheckResult } from '@/lib/types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface SentinelCheckListProps {
  checks: SentinelCheckResult[];
}

export function SentinelCheckList({ checks }: SentinelCheckListProps) {
  return (
    <div className="border rounded-md divide-y bg-card">
      <div className="p-3 bg-muted/30 font-semibold text-sm">
        Sentinel Safety Checks (10-point Verification)
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {checks.map((check) => (
          <div
            key={check.ruleId}
            className="p-3 flex items-start gap-3 hover:bg-muted/10 transition-colors"
          >
            {check.passed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  {check.ruleId}
                </span>
                <span className="font-medium text-sm truncate">
                  {check.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {check.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
