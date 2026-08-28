import React from 'react';
import { Info } from 'lucide-react';

export function ModelEstimateLabel() {
  return (
    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-2">
      <Info className="h-3 w-3" />
      <span>model estimate (B1-relative, simulated data)</span>
    </div>
  );
}
