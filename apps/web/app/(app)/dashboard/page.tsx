import React from 'react';
import { KpiRibbon } from '@/components/dashboard/kpi-ribbon';
import { DemandEscalationList } from '@/components/dashboard/demand-escalation-list';
import { BlockCountSummary } from '@/components/dashboard/block-count-summary';
import { MachineUtilizationSummary } from '@/components/dashboard/machine-utilization-summary';
import { QuickNavCards } from '@/components/dashboard/quick-nav-cards';
import { SimulatedDataWatermark } from '@/components/shell/simulated-data-watermark';

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto relative min-h-full pb-20">
      <SimulatedDataWatermark position="center" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Operations Overview
        </h1>
        <p className="text-muted-foreground mt-1">
          Live divisional status and escalated demands.
        </p>
      </div>

      <KpiRibbon />

      <DemandEscalationList />

      <div className="grid gap-6 md:grid-cols-2">
        <BlockCountSummary />
        <MachineUtilizationSummary />
      </div>

      <QuickNavCards />
    </div>
  );
}
