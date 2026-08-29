import React from 'react';
import { WeekNavigator } from '@/components/planner/week-navigator';
import { SolverStatusBanner } from '@/components/shared/solver-status-banner';

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <WeekNavigator />
        <SolverStatusBanner />
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
