import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';

export function LayerControlPanel() {
  return (
    <Card className="absolute top-4 left-4 w-64 z-10 shadow-md bg-background/95 backdrop-blur">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Map Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked
            className="rounded border-input"
          />
          <span>Active Blocks (Heatmap)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked
            className="rounded border-input"
          />
          <span>Section Boundaries</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="rounded border-input" />
          <span>Live Train Positions</span>
        </label>
      </CardContent>
    </Card>
  );
}
