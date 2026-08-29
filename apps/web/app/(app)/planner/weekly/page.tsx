import React from 'react';
import { DemandQueuePanel } from '@/components/planner/demand-queue-panel';
import { MachineRosterPanel } from '@/components/planner/machine-roster-panel';
import { BlockScheduleGrid } from '@/components/visualizations/block-schedule-grid';
import { SimulatedDataWatermark } from '@/components/shell/simulated-data-watermark';

export default function PlannerWeeklyPage() {
  return (
    <div className="flex h-full w-full overflow-hidden relative">
      <SimulatedDataWatermark position="center" />
      
      {/* Left panel: 20% width min 250px max 350px */}
      <div className="w-[280px] shrink-0">
        <DemandQueuePanel />
      </div>

      {/* Center panel: flex-1 */}
      <div className="flex-1 min-w-0">
        <BlockScheduleGrid />
      </div>

      {/* Right panel: 20% width min 250px max 350px */}
      <div className="w-[280px] shrink-0">
        <MachineRosterPanel />
      </div>
    </div>
  );
}
