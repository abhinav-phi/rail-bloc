import React from 'react';
import Link from 'next/link';
import { Department } from '@/lib/types';
import { DepartmentTag } from './department-tag';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock } from 'lucide-react';

interface DemandEscalationRowProps {
  id: string;
  department: Department;
  section: string;
  reason: string;
  timestamp: string;
}

export function DemandEscalationRow({ id, department, section, reason, timestamp }: DemandEscalationRowProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-md bg-destructive/5 hover:bg-destructive/10 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="font-mono font-medium">{id}</span>
        </div>
        <DepartmentTag dept={department} />
        <div className="text-sm">
          <span className="font-medium text-muted-foreground">Section:</span> {section}
        </div>
        <div className="text-sm text-destructive">
          <span className="font-medium">Failed:</span> {reason}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center text-sm text-muted-foreground font-mono">
          <Clock className="h-3 w-3 mr-1" />
          {timestamp}
        </div>
        <Button size="sm" variant="destructive" asChild>
          <Link href={`/approvals?planId=${id}`}>Resolve</Link>
        </Button>
      </div>
    </div>
  );
}
