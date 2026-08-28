'use client';
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DepartmentTag } from '@/components/shared/department-tag';
import { Department } from '@/lib/types';
import { GripVertical } from 'lucide-react';

const MOCK_DEMANDS = [
  { id: 'DMD-101', dept: 'CIVIL' as Department, desc: 'Track maintenance', hours: 4, section: 'DLI-PNP' },
  { id: 'DMD-102', dept: 'TRD' as Department, desc: 'OHE inspection', hours: 2, section: 'PNP-UMB' },
  { id: 'DMD-103', dept: 'SNT' as Department, desc: 'Signal relay change', hours: 1, section: 'UMB-LDH' },
  { id: 'DMD-104', dept: 'CIVIL' as Department, desc: 'Bridge repair', hours: 6, section: 'LDH-JUC' },
  { id: 'DMD-105', dept: 'TRD' as Department, desc: 'Tower wagon patrol', hours: 3, section: 'JUC-ASR' },
];

export function DemandQueuePanel() {
  return (
    <div className="flex flex-col h-full border-r bg-muted/10">
      <div className="p-4 border-b bg-muted/20">
        <h3 className="font-semibold text-sm">Demand Queue</h3>
        <p className="text-xs text-muted-foreground mt-1">Unassigned requests (5)</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 grid gap-2">
          {MOCK_DEMANDS.map((demand) => (
            <div key={demand.id} className="p-3 border rounded-md bg-card shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground -ml-1 cursor-grab" />
                  <span className="font-mono text-xs font-semibold">{demand.id}</span>
                </div>
                <DepartmentTag dept={demand.dept} />
              </div>
              <div className="text-sm font-medium mb-1 line-clamp-1">{demand.desc}</div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{demand.section}</span>
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{demand.hours}h</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
