import React from 'react';
import Link from 'next/link';
import { CalendarRange } from 'lucide-react';

export default function Planner26WeekPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          26-Week Strategic Calendar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Long-term corridor planning view (STRATEGIC_26W horizon) — sits above
          the rolling Monthly and Weekly tactical plans.
        </p>
      </header>

      <div className="atlas-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange size={16} className="text-[#935073]" />
          <h2 className="atlas-card-title">Horizon stack</h2>
        </div>
        <ol className="grid gap-2 text-sm">
          {[
            ['STRATEGIC_26W', '26-week strategic calendar — corridor-level capacity planning (this view)'],
            ['MONTHLY', 'Rolling 4-week plan — monthly beat cron, same formulation'],
            ['WEEKLY', 'Tactical week — committed blocks, headway-expanded train paths'],
            ['REALTIME', 'P0 emergency re-plans (≤45 s, PROVISIONAL until acknowledged)'],
          ].map(([tag, desc]) => (
            <li key={tag} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="atlas-badge border-border font-mono text-muted-foreground">{tag}</span>
              <span className="text-foreground">{desc}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Committed plans by horizon:{' '}
          <Link href="/planner/weekly" className="font-medium text-[#935073] underline dark:text-[#d58ba9]">
            open the multi-horizon Block Planning console
          </Link>{' '}
          (Weekly / Monthly / 26-Week tabs) — the strategic Gantt renders from the
          same plan rows.
        </p>
      </div>
    </div>
  );
}
