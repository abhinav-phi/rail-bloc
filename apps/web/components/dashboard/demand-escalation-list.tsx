import React from 'react';
import { DemandEscalationRow } from '@/components/shared/demand-escalation-row';
import { Department } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

const MOCK_ESCALATIONS = [
  {
    id: 'DMD-8492-C',
    department: 'CIVIL' as Department,
    section: 'DLI-ALD',
    reason: 'Failed 3 solver retries',
    timestamp: '14:23:00',
  },
  {
    id: 'DMD-9120-T',
    department: 'TRD' as Department,
    section: 'NDLS-CNB',
    reason: 'Hard conflict with WTT',
    timestamp: '14:45:12',
  },
];

export function DemandEscalationList() {
  if (MOCK_ESCALATIONS.length === 0) return null;

  return (
    <Card className="mb-6 border-destructive/50 shadow-sm">
      <CardHeader className="pb-3 bg-destructive/5 rounded-t-lg border-b border-destructive/10">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <CardTitle>Escalated Demands (Action Required)</CardTitle>
        </div>
        <CardDescription>
          These demands have failed automatic resolution and require human
          intervention (FSM-002).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 grid gap-3">
        {MOCK_ESCALATIONS.map((esc) => (
          <DemandEscalationRow
            key={esc.id}
            id={esc.id}
            department={esc.department}
            section={esc.section}
            reason={esc.reason}
            timestamp={esc.timestamp}
          />
        ))}
      </CardContent>
    </Card>
  );
}
