'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function MachineUtilizationSummary() {
  const total = 42;
  const assigned = 34;
  const maintenance = 3;
  const idle = total - assigned - maintenance;

  const assignedPct = (assigned / total) * 100;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Machine Fleet Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Utilization</span>
            <span className="font-medium font-mono">
              {Math.round(assignedPct)}%
            </span>
          </div>
          <Progress value={assignedPct} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center border-t border-border pt-4">
          <div>
            <div className="text-2xl font-bold font-mono">{assigned}</div>
            <div className="text-xs text-muted-foreground uppercase mt-1">
              Assigned
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-500">
              {idle}
            </div>
            <div className="text-xs text-muted-foreground uppercase mt-1">
              Idle
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-rose-500">
              {maintenance}
            </div>
            <div className="text-xs text-muted-foreground uppercase mt-1">
              In Maint
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
