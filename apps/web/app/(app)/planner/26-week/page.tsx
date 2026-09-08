'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** 26-week strategic horizon — Emergent heatmap concept on REAL plan rows.
 * Each cell = committed plans for that week, CIVIL/TRD/SNT colour-coded by
 * department inferred from section codes. Counts come from /plans?limit=500
 * (same feed approvals uses); no invented data. */
interface PlanRow {
  id: string;
  section_code: string;
  plan_horizon: string;
  start_time: string;
  end_time: string;
  approval_status: string;
  is_shadow_block: boolean;
}

const WEEKS = 26;

function deptOf(section: string): 'CIVIL' | 'TRD' | 'SNT' {
  if (section.includes('TRD') || section.includes('OHE')) return 'TRD';
  if (section.includes('SNT') || section.includes('SIG')) return 'SNT';
  return 'CIVIL';
}

const DEPT_COLORS: Record<string, string> = {
  CIVIL: 'bg-[#F59E0B]/70',
  TRD: 'bg-[#0EA5E9]/70',
  SNT: 'bg-[#10B981]/70',
};

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

export default function Planner26WeekPage() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await api.get<PlanRow[]>('/api/v1/plans?limit=500');
      setPlans(rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monday = useMemo(() => mondayOf(new Date()), []);

  const weeks = useMemo(() => {
    const grid: {
      start: Date;
      byDept: Record<string, number>;
      total: number;
    }[] = [];
    for (let i = 0; i < WEEKS; i++) {
      grid.push({
        start: new Date(monday.getTime() + i * 7 * 864e5),
        byDept: {},
        total: 0,
      });
    }
    if (plans) {
      for (const p of plans) {
        const t = new Date(p.start_time);
        const idx = Math.floor(
          (mondayOf(t).getTime() - monday.getTime()) / (7 * 864e5),
        );
        if (idx >= 0 && idx < WEEKS) {
          const dept = deptOf(p.section_code);
          grid[idx].byDept[dept] = (grid[idx].byDept[dept] ?? 0) + 1;
          grid[idx].total += 1;
        }
      }
    }
    return grid;
  }, [plans, monday]);

  const monthLabels = useMemo(() => {
    return weeks.map((w) =>
      w.start.toLocaleDateString('en-IN', {
        month: 'short',
        timeZone: 'Asia/Kolkata',
      }),
    );
  }, [weeks]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      <header className="mb-6">
        <p className="atlas-section-label mb-2">07 / 26-WEEK HORIZON</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Possession heatmap
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          26 rolling weeks of committed maintenance windows — corridor-level
          capacity planning above the Monthly and Weekly tactical layers.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="atlas-alert-danger mb-4 px-3.5 py-3 text-sm"
        >
          Plans feed unreachable — {error}
        </div>
      ) : null}

      <div className="atlas-card p-5">
        <p className="atlas-section-label mb-3">POSSESSIONS / 26 WEEKS</p>
        {plans === null ? (
          <p className="p-5 text-sm text-muted-foreground">Loading plans…</p>
        ) : (
          <div className="overflow-x-auto">
            {/* month labels */}
            <div className="mb-1 flex gap-[3px] pl-24">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="w-[22px] font-mono text-[8px] text-muted-foreground"
                >
                  {i === 0 || monthLabels[i] !== monthLabels[i - 1]
                    ? monthLabels[i]
                    : ''}
                </div>
              ))}
            </div>
            {(['CIVIL', 'TRD', 'SNT'] as const).map((dept) => (
              <div key={dept} className="mb-1.5 flex items-center gap-2">
                <span
                  className="w-22 shrink-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground"
                  style={{ width: '5.5rem' }}
                >
                  {dept}
                </span>
                <div className="flex gap-[3px]">
                  {weeks.map((w, i) => {
                    const n = w.byDept[dept] ?? 0;
                    return (
                      <div
                        key={i}
                        title={`Week of ${w.start.toLocaleDateString('en-IN')} — ${n} ${dept} possession(s)`}
                        className={cn(
                          'h-7 w-[22px] rounded-[2px] border',
                          n === 0
                            ? 'border-border/40 bg-transparent'
                            : DEPT_COLORS[dept] + ' border-transparent',
                        )}
                      >
                        {n > 0 ? (
                          <span className="flex h-full w-full items-center justify-center font-mono text-[9px] font-bold tabular-nums text-[#0B111E]">
                            {n}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2 pl-24">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                week 1 = current week · click a bar&apos;s tooltip for dates
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Horizon stack (carried forward) */}
      <div className="atlas-card mt-4 p-5">
        <p className="atlas-section-label mb-3">HORIZON STACK</p>
        <ol className="grid gap-2 text-sm">
          {[
            [
              'STRATEGIC_26W',
              '26-week strategic calendar — corridor-level capacity planning (this view)',
            ],
            [
              'MONTHLY',
              'Rolling 4-week plan — monthly beat cron, same formulation',
            ],
            [
              'WEEKLY',
              'Tactical week — committed blocks, headway-expanded train paths',
            ],
            [
              'REALTIME',
              'P0 emergency re-plans (≤45 s, PROVISIONAL until acknowledged)',
            ],
          ].map(([tag, desc]) => (
            <li
              key={tag}
              className="flex items-start gap-3 rounded-sm border border-border bg-muted/30 px-3 py-2"
            >
              <span className="atlas-badge border-border font-mono text-muted-foreground">
                {tag}
              </span>
              <span className="text-foreground">{desc}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Committed plans by horizon:{' '}
          <Link
            href="/planner/weekly"
            className="font-medium text-brass underline"
          >
            open the multi-horizon Block Planning console
          </Link>{' '}
          (Weekly / Monthly / 26-Week tabs) — the heatmap above renders from the
          same plan rows.
        </p>
      </div>
    </div>
  );
}
