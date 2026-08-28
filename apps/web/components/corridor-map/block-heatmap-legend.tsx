import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function BlockHeatmapLegend() {
  return (
    <Card className="absolute bottom-6 right-4 z-10 shadow-md">
      <CardContent className="p-3 text-xs flex items-center gap-3">
        <span className="font-semibold text-muted-foreground">Block Density:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-emerald-500/20 border border-emerald-500" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-500/50 border border-amber-500" />
          <span>Med</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-rose-500/80 border border-rose-500" />
          <span>High</span>
        </div>
      </CardContent>
    </Card>
  );
}
