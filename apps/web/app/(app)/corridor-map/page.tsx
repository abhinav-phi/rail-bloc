import React from 'react';
import { GisCorridorMap } from '@/components/visualizations/gis-corridor-map';
import { LayerControlPanel } from '@/components/corridor-map/layer-control-panel';
import { BlockHeatmapLegend } from '@/components/corridor-map/block-heatmap-legend';
import { SimulatedDataWatermark } from '@/components/shell/simulated-data-watermark';

export default function CorridorMapPage() {
  return (
    <div className="flex h-full flex-col relative overflow-hidden">
      <SimulatedDataWatermark position="center" />
      <div className="p-4 border-b shrink-0 bg-background/95 backdrop-blur z-20">
        <h1 className="text-2xl font-bold">Corridor Map</h1>
        <p className="text-muted-foreground">
          Live GIS situational awareness and block visualization.
        </p>
      </div>
      <div className="flex-1 relative bg-slate-900 overflow-hidden">
        <LayerControlPanel />
        <GisCorridorMap />
        <BlockHeatmapLegend />
      </div>
    </div>
  );
}
