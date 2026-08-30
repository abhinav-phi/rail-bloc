import React from 'react';
import { KpiMetricCard } from '@/components/shared/kpi-metric-card';

const MOCK_KPIS = [
  {
    id: 1,
    title: 'Asset Availability',
    value: '94.2',
    unit: '%',
    target: '90%',
    delta: 2.4,
    isEstimate: false,
  },
  {
    id: 2,
    title: 'Bundling Efficiency',
    value: '2.4',
    unit: 'x',
    target: '2.0x',
    delta: 0.3,
    isEstimate: false,
  },
  {
    id: 3,
    title: 'Pax Punctuality Impact',
    value: '14',
    unit: 'm',
    target: '< 20m',
    delta: -4.2,
    isEstimate: true,
  },
  {
    id: 4,
    title: 'Active Safety Gate',
    value: '99.8',
    unit: '%',
    target: '100%',
    delta: -0.2,
    isEstimate: false,
  },
];

export function KpiRibbon() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {MOCK_KPIS.map((kpi) => (
        <KpiMetricCard
          key={kpi.id}
          title={kpi.title}
          value={kpi.value}
          unit={kpi.unit}
          target={kpi.target}
          delta={kpi.delta}
          isEstimate={kpi.isEstimate}
        />
      ))}
    </div>
  );
}
