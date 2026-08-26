import React from 'react';
import { SimulatedDataWatermark } from '@/components/shell/simulated-data-watermark';
import { SectionDateSelector } from '@/components/string-chart/section-date-selector';
import { StringChartLegend } from '@/components/string-chart/string-chart-legend';
import { TimeDistanceStringChart } from '@/components/visualizations/time-distance-string-chart';

export default function StringChartPage() {
  return (
    <div className="flex h-full flex-col relative overflow-hidden">
      <SimulatedDataWatermark position="center" />
      <div className="px-6 py-4 border-b shrink-0 bg-background/95 backdrop-blur z-20">
        <h1 className="text-2xl font-bold">Master String Chart</h1>
        <p className="text-muted-foreground">Time-Distance graph for detailed conflict resolution.</p>
      </div>
      
      <SectionDateSelector />
      <StringChartLegend />
      <TimeDistanceStringChart />
    </div>
  );
}
