'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLive } from '@/lib/live';
import { usePersona } from '@/context/persona-context';
import { AlertTriangle, Activity, Clock, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── /api/v1/plans/summary response shape ───────────────────────────── */
interface SummaryData {
  plan_counts: Record<string, number>;
  demand_counts: Record<string, number>;
  escalated_overdue: {
    external_ref_id: string;
    activity_code: string;
    urgency_score: number;
    section_code: string;
  }[];
  machine_utilization: {
    machine: string;
    jobs: number;
    work_minutes: number;
  }[];
  model_estimates: {
    predicted_pax_delay_minutes: number;
    predicted_frt_delay_minutes: number;
    note: string;
  };
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft (awaiting S&T acks)',
  SENTINEL_PASSED: 'Sentinel Passed',
  APPROVED_SR_DOM: 'Approved (Sr. DOM)',
  AUTHORIZED_DRM: 'Authorized (DRM)',
  TRANSMITTED_COA: 'Transmitted to COA',
  ACTIVE_GRANTED: 'Active',
  COMPLETED_FITNESS: 'Completed + Fitness',
  ARCHIVED_SEALED: 'Archived (Sealed)',
  PROVISIONAL: 'Provisional (Emergency)',
  SUPERSEDED: 'Superseded',
  SUPERSEDED_EMERGENCY: 'Superseded (Emergency)',
};

const DEMAND_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  NORMALIZED: 'Normalized',
  SCHEDULED_DRAFT: 'Scheduled (Draft)',
  SENTINEL_PASSED: 'In a verified plan',
  APPROVED_SR_DOM: 'Approved',
  AUTHORIZED_DRM: 'Authorized',
  ESCALATED_OVERDUE: 'Escalated (overdue)',
};

/** Atlas KPI chip — their design language (icon-chip, kpi-value, tones). */
function KpiCard(props: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  footnote?: string;
  tone: 'pink' | 'purple' | 'orange' | 'blue';
  pulse?: boolean;
  estimate?: boolean;
}) {
  const tones: Record<string, { chip: string; value: string }> = {
    pink: { chip: 'bg-[#fff0f7] text-[#e72d79]', value: 'text-[#e72d79]' },
    purple: { chip: 'bg-[#f1eaf8] text-[#6d4a96]', value: 'text-[#6d4a96]' },
    orange: { chip: 'bg-[#fff3ea] text-[#c66b3c]', value: 'text-[#c66b3c]' },
    blue: { chip: 'bg-[#eaf1fc] text-[#2d63c8]', value: 'text-[#2d63c8]' },
  };
  const t = tones[props.tone];
  return (
    <div className="atlas-card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{props.label}</p>
        <span
          aria-hidden="true"
          className={cn(
            'atlas-icon-chip ring-4',
            t.chip,
            props.pulse && 'animate-pulse',
          )}
        >
          {props.icon}
        </span>
      </div>
      <div className="min-h-[3.25rem]">
        <p className={cn('atlas-kpi-value', t.value)} aria-live="polite">
          {props.value}
        </p>
        {props.estimate ? (
          <span className="atlas-model-estimate mt-1.5">
            model estimate (B1-relative, simulated data)
          </span>
        ) : null}
      </div>
      {props.footnote ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {props.footnote}
        </p>
      ) : null}
    </div>
  );
}

function fmtMinutes(m: number | undefined): string {
  if (m === undefined || m === null || Number.isNaN(m)) return '—';
  if (m === 0) return '0 min';
  return m >= 60
    ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`
    : `${Math.round(m)} min`;
}

export function AtlasDashboard() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { connected } = useLive();
  const { persona } = usePersona();

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const d = await api.get<SummaryData>('/api/v1/plans/summary');
      setData(d);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Poll every 30s; SSE events also trigger refresh via 'connected' edge.
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Live SSE event → immediate refresh (debounced by the interval tick anyway)
  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  const planCounts = data?.plan_counts ?? {};
  const demandCounts = data?.demand_counts ?? {};
  const activeBlocks =
    (planCounts['TRANSMITTED_COA'] ?? 0) + (planCounts['ACTIVE_GRANTED'] ?? 0);
  const escalated = data?.escalated_overdue ?? [];
  const machines = data?.machine_utilization ?? [];
  const totalWorkMinutes = machines.reduce((s, m) => s + m.work_minutes, 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      {/* PageHeader — Atlas idiom */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Divisional Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Division{' '}
            <span className="font-semibold text-foreground">
              {persona?.division ?? 'DLI'}
            </span>{' '}
            · corridor NDLS→CNB · seeded synthetic scenario
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5" aria-live="polite">
            <span
              aria-hidden="true"
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                connected ? 'bg-[#1b7f4b]' : 'animate-pulse bg-[#d6293e]',
              )}
            />
            {lastUpdated
              ? `updated ${lastUpdated.toLocaleTimeString('en-IN', { hour12: false })}`
              : 'loading…'}
            {' · '}
            {connected ? 'live via SSE' : 'polling only'}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="atlas-btn-secondary atlas-btn text-xs"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="atlas-btn-danger mb-5 flex items-start gap-2 rounded-lg border border-[#f5c2ca] bg-[#fdecef] px-3.5 py-3 text-sm text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a]/40"
        >
          <span aria-hidden="true" className="font-bold">✗</span>
          <div className="flex-1">
            <p className="font-semibold">Dashboard refresh failed</p>
            <p className="text-xs">{error}</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="atlas-btn-secondary atlas-btn text-xs">
            Retry
          </button>
        </div>
      ) : null}

      {/* KPI row — all real figures from /plans/summary */}
      <section
        aria-label="Key performance indicators"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Active blocks"
          tone="pink"
          icon={<Activity size={18} />}
          value={loading ? '…' : activeBlocks}
          footnote="TRANSMITTED_COA + ACTIVE_GRANTED"
          pulse={activeBlocks > 0}
        />
        <KpiCard
          label="Passenger delay (authorized window)"
          tone="blue"
          icon={<Clock size={18} />}
          value={loading ? '…' : fmtMinutes(data?.model_estimates.predicted_pax_delay_minutes)}
          footnote="authorized+active plans"
          estimate
        />
        <KpiCard
          label="Freight delay (authorized window)"
          tone="purple"
          icon={<Gauge size={18} />}
          value={loading ? '…' : fmtMinutes(data?.model_estimates.predicted_frt_delay_minutes)}
          footnote="fail-closed forecast policy"
          estimate
        />
        <KpiCard
          label="Escalated demands"
          tone="orange"
          icon={<AlertTriangle size={18} />}
          value={loading ? '…' : (demandCounts['ESCALATED_OVERDUE'] ?? 0)}
          footnote="FSM-002: human intervention required"
          pulse={(demandCounts['ESCALATED_OVERDUE'] ?? 0) > 0}
        />
      </section>

      {/* Plan lifecycle distribution + demand state */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="atlas-card p-5">
          <div className="atlas-card-header -mx-5 -mt-5 mb-4 px-5">
            <h3 className="atlas-card-title">Plan lifecycle distribution</h3>
            <span className="atlas-badge border-border text-muted-foreground">
              {Object.values(planCounts).reduce((s, n) => s + n, 0)} plans
            </span>
          </div>
          <div className="grid gap-2">
            {Object.entries(planCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-56 shrink-0 text-xs text-muted-foreground">
                    {PLAN_STATUS_LABELS[status] ?? status}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#935073]"
                      style={{
                        width: `${(count / Math.max(1, Object.values(planCounts).reduce((s, n) => s + n, 0))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs tabular-nums text-foreground">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="atlas-card p-5">
          <div className="atlas-card-header -mx-5 -mt-5 mb-4 px-5">
            <h3 className="atlas-card-title">Machine fleet (VRP rosters)</h3>
            <span className="atlas-badge border-border text-muted-foreground">
              {fmtMinutes(totalWorkMinutes)} total work
            </span>
          </div>
          {machines.length === 0 ? (
            <div className="atlas-empty-state">
              No machine rosters yet — trigger a solve from Block Planning.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="pb-2 font-semibold">Machine</th>
                  <th className="pb-2 text-right font-semibold">Jobs</th>
                  <th className="pb-2 text-right font-semibold">Work</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.machine} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-mono text-xs text-foreground">{m.machine}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{m.jobs}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {fmtMinutes(m.work_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Escalated demands — red-tinted card, their idiom */}
      <div className="atlas-card border-[#f5c2ca] bg-[#fdecef]/40 p-5 dark:border-[#7f1d1d] dark:bg-[#450a0a]/20">
        <div className="atlas-card-header -mx-5 -mt-5 mb-4 px-5 border-[#f5c2ca] dark:border-[#7f1d1d]">
          <div className="flex items-center gap-2 text-[#d6293e] dark:text-[#f87171]">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="atlas-card-title">
              Escalated Demands (Action Required)
            </h3>
          </div>
          <span className="atlas-badge border-[#f5c2ca] bg-[#fdecef] text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a] dark:text-[#f87171]">
            {escalated.length} shown
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          These demands failed automatic resolution and require human
          intervention (FSM-002).
        </p>
        {escalated.length === 0 ? (
          <div className="atlas-empty-state">
            Nothing escalated — the solver and Sentinel are keeping up.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="pb-2 font-semibold">Demand</th>
                <th className="pb-2 font-semibold">Activity</th>
                <th className="pb-2 font-semibold">Section</th>
                <th className="pb-2 text-right font-semibold">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {escalated.slice(0, 10).map((d) => (
                <tr key={d.external_ref_id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 font-mono text-xs text-foreground">
                    {d.external_ref_id}
                  </td>
                  <td className="py-2 text-foreground">
                    {d.activity_code.replaceAll('_', ' ')}
                  </td>
                  <td className="py-2 font-mono text-xs text-foreground">
                    {d.section_code}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-[#d6293e] dark:text-[#f87171]">
                    {d.urgency_score.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Demand-state ribbon footer — real counts */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {Object.entries(demandCounts).map(([status, n]) => (
          <span
            key={status}
            className="atlas-badge border-border text-muted-foreground"
            title={DEMAND_STATUS_LABELS[status] ?? status}
          >
            {DEMAND_STATUS_LABELS[status] ?? status}: {n}
          </span>
        ))}
      </div>
    </div>
  );
}
