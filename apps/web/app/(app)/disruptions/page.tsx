import React from 'react';
import { SimulatedDataWatermark } from '@/components/shell/simulated-data-watermark';
import { ActiveIncidentsList } from '@/components/disruptions/active-incidents-list';
import { BlastRadiusPanel } from '@/components/disruptions/blast-radius-panel';

export default function DisruptionsPage() {
  return (
    <div className="flex h-full w-full overflow-hidden relative">
      <SimulatedDataWatermark position="center" />
      <ActiveIncidentsList />
      <BlastRadiusPanel />
    </div>
  );
}
