import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Clock } from 'lucide-react';

const MOCK_INCIDENTS = [
  { id: 'INC-992', type: 'OHE Breakdown', location: 'DLI-PNP Km 45', time: '10:45 AM', severity: 'CRITICAL' },
  { id: 'INC-993', type: 'Track Fracture', location: 'UMB-LDH Km 112', time: '09:12 AM', severity: 'HIGH' },
];

export function ActiveIncidentsList() {
  return (
    <div className="w-[350px] shrink-0 border-r bg-muted/10 h-full flex flex-col">
      <div className="p-4 border-b bg-muted/20">
        <h3 className="font-semibold text-sm">Active Disruptions</h3>
        <p className="text-xs text-muted-foreground mt-1">2 unresolved incidents</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {MOCK_INCIDENTS.map(inc => (
          <Card key={inc.id} className="cursor-pointer hover:border-destructive transition-colors">
            <CardContent className="p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-xs font-bold text-destructive">{inc.id}</span>
                <span className="text-xs font-medium text-destructive flex items-center"><AlertTriangle className="h-3 w-3 mr-1"/> {inc.severity}</span>
              </div>
              <div className="font-medium text-sm mb-1">{inc.type}</div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{inc.location}</span>
                <span className="flex items-center"><Clock className="h-3 w-3 mr-1"/>{inc.time}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
