'use client';
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wrench, CheckCircle2, Truck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const MOCK_MACHINES = [
  {
    id: 'BCM-1',
    type: 'Ballast Cleaning',
    status: 'AVAILABLE',
    loc: 'DLI',
    util: 40,
  },
  {
    id: 'TRT-2',
    type: 'Track Relaying',
    status: 'ASSIGNED',
    loc: 'PNP',
    util: 85,
  },
  {
    id: 'TW-4',
    type: 'Tower Wagon',
    status: 'AVAILABLE',
    loc: 'UMB',
    util: 20,
  },
  {
    id: 'UNIMAT-1',
    type: 'Tamping',
    status: 'MAINTENANCE',
    loc: 'LDH',
    util: 0,
  },
];

export function MachineRosterPanel() {
  return (
    <div className="flex flex-col h-full border-l bg-muted/10">
      <div className="p-4 border-b bg-muted/20">
        <h3 className="font-semibold text-sm">Machine Roster</h3>
        <p className="text-xs text-muted-foreground mt-1">Asset availability</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 grid gap-3">
          {MOCK_MACHINES.map((machine) => (
            <div
              key={machine.id}
              className="p-3 border rounded-md bg-card shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold">
                  {machine.id}
                </span>
                {machine.status === 'AVAILABLE' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
                {machine.status === 'ASSIGNED' && (
                  <Truck className="h-3.5 w-3.5 text-blue-500" />
                )}
                {machine.status === 'MAINTENANCE' && (
                  <Wrench className="h-3.5 w-3.5 text-rose-500" />
                )}
              </div>
              <div className="text-sm font-medium mb-1 truncate">
                {machine.type}
              </div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                <span>Loc: {machine.loc}</span>
                <span>{machine.util}% Util</span>
              </div>
              <Progress value={machine.util} className="h-1.5" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
