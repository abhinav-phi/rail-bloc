import React from 'react';

export function StringChartLegend() {
  return (
    <div className="flex items-center gap-6 text-xs text-muted-foreground px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-2">
        <div className="w-4 h-0.5 bg-blue-500" />
        <span>Express Trains</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-0.5 bg-slate-400" />
        <span>Freight</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-rose-500/20 border border-rose-500" />
        <span>Maintenance Block</span>
      </div>
    </div>
  );
}
