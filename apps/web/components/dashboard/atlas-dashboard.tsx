'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLive } from '@/lib/live';
import { usePersona } from '@/context/persona-context';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── /api/v1/plans/summary response shape (unchanged) ────────────────── */
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

/* ── /api/v1/plans?limit=500 row (same shape approvals uses) ─────────── */
interface PlanRow {
  id: string;
  section_code: string;
  division: string;
  plan_horizon: string;
  start_time: string;
  end_time: string;
  approval_status: string;
  revision_no: number;
  is_shadow_block: boolean;
  content_hash: string;
  loss_pax_minutes: number;
  loss_frt_minutes: number;
  primary_demand_id: string;
}

const DEMAND_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  NORMALIZED: 'Normalized',
  SCHEDULED_DRAFT: 'Scheduled (Draft)',
  SENTINEL_PASSED: 'In a verified plan',
  APPROVED_SR_DOM: 'Approved',
  AUTHORIZED_DRM: 'Authorized',
  ESCALATED_OVERDUE: 'Escalated (overdue)',
};

const DEPT_BY_SECTION: Record<string, 'CIVIL' | 'TRD' | 'SNT'> = {
  CIVIL: 'CIVIL',
  TRD: 'TRD',
  SNT: 'SNT',
};
const DEPT_COLORS: Record<string, string> = {
  CIVIL: 'bg-[#F59E0B]/70',
  TRD: 'bg-[#0EA5E9]/70',
  SNT: 'bg-[#10B981]/70',
};
function deptOf(section: string): 'CIVIL' | 'TRD' | 'SNT' {
  if (section.includes('TRD') || section.includes('OHE')) return 'TRD';
  if (section.includes('SNT') || section.includes('SIG')) return 'SNT';
  return 'CIVIL';
}
void DEPT_BY_SECTION;

const IST_TZ = 'Asia/Kolkata';
const istDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: IST_TZ }); // YYYY-MM-DD
const istTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST_TZ,
  });

function fmtMinutes(m: number | undefined): string {
  if (m === undefined || m === null || Number.isNaN(m)) return '—';
  if (m === 0) return '0 min';
  return m >= 60
    ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`
    : `${Math.round(m)} min`;
}

/** Count-up once on mount — no looping counters (AI-demo tell). */
function CountUp({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{value.toLocaleString('en-IN')}</>;
}

/** Emergent eyebrow label — mono, uppercase, wide tracking. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="atlas-section-label mb-3">{children}</p>;
}

/** Division capacity map — 7-day × section grid of real block windows. */
function WeekGrid({ plans }: { plans: PlanRow[] }) {
  const days = useMemo(() => {
    const list: { key: string; label: string; date: Date }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      list.push({
        key: istDay(d.toISOString()),
        label: d
          .toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            timeZone: 'Asia/Kolkata',
          })
          .toUpperCase(),
        date: d,
      });
    }
    return list;
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, PlanRow[]>();
    for (const p of plans) {
      const day = istDay(p.start_time);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(p);
    }
    return map;
  }, [plans]);

  const sections = useMemo(() => {
    const set = new Set<string>();
    for (const p of plans) set.add(p.section_code);
    return Array.from(set).sort().slice(0, 6);
  }, [plans]);

  return (
    <div className="atlas-card p-5">
      <Eyebrow>BLOCK WINDOW / NEXT 7 DAYS</Eyebrow>
      {plans.length === 0 || sections.length === 0 ? (
        <div className="atlas-empty-state">
          No planned blocks in the next 7 days — request a solve from Block
          Planning.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-left">
            <thead>
              <tr>
                <th className="w-24 pb-1 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
                  Section
                </th>
                {days.map((d) => (
                  <th
                    key={d.key}
                    className="pb-1 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <tr key={sec}>
                  <td className="pr-2 font-mono text-[11px] text-foreground">
                    {sec}
                  </td>
                  {days.map((d) => {
                    const blocks = (byDay.get(d.key) ?? []).filter(
                      (p) => p.section_code === sec,
                    );
                    const first = blocks[0];
                    const dept = first ? deptOf(sec) : null;
                    return (
                      <td key={d.key}>
                        {blocks.length > 0 ? (
                          <div
                            className={cn(
                              'rounded-[2px] px-2 py-1.5 font-mono text-[10px] tabular-nums text-[#0B111E]',
                              DEPT_COLORS[dept ?? 'CIVIL'],
                            )}
                            title={`${blocks.length} block(s): ${blocks
                              .map(
                                (b) =>
                                  `${istTime(b.start_time)}–${istTime(b.end_time)} IST`,
                              )
                              .join(', ')}`}
                          >
                            {istTime(first.start_time)}–
                            {istTime(first.end_time)}
                            {blocks.length > 1 ? (
                              <span className="ml-1 font-bold">
                                +{blocks.length - 1}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-[2px] border border-border/50 px-2 py-1.5" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-[1px] bg-[#F59E0B]/70" />
              CIVIL
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-[1px] bg-[#0EA5E9]/70" />
              TRD
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-[1px] bg-[#10B981]/70" />
              SNT
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Operations Overview — Emergent layout concept, brass skin, real data.
 * Every figure comes from /plans/summary + /plans (live); nothing invented. */
export function AtlasDashboard() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
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
      try {
        const p = await api.get<PlanRow[]>('/api/v1/plans?limit=500');
        setPlans(p ?? []);
      } catch {
        /* summary is the critical feed; grid degrades to empty state */
      }
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  const planCounts = data?.plan_counts ?? {};
  const demandCounts = data?.demand_counts ?? {};
  const totalPlans = Object.values(planCounts).reduce((s, n) => s + n, 0);
  const activeBlocks =
    (planCounts['TRANSMITTED_COA'] ?? 0) + (planCounts['ACTIVE_GRANTED'] ?? 0);
  const pendingApprovals =
    (planCounts['SENTINEL_PASSED'] ?? 0) + (planCounts['APPROVED_SR_DOM'] ?? 0);
  const escalated = data?.escalated_overdue ?? [];
  // Honest metric: share of plans that reached a post-SENTINEL state.
  // DRAFT + PROVISIONAL are pre-verification; SUPERSEDED rows passed once
  // but were replaced — excluded so the ratio reflects the live set.
  const POST_SENTINEL = [
    'SENTINEL_PASSED',
    'APPROVED_SR_DOM',
    'AUTHORIZED_DRM',
    'TRANSMITTED_COA',
    'ACTIVE_GRANTED',
    'COMPLETED_FITNESS',
    'ARCHIVED_SEALED',
  ];
  const certifiedShare =
    totalPlans > 0
      ? `${Math.round((POST_SENTINEL.reduce((s2, k) => s2 + (planCounts[k] ?? 0), 0) / totalPlans) * 100)}%`
      : '—';
  const fleet = data?.machine_utilization ?? [];
  const totalWorkMinutes = fleet.reduce((s, m) => s + m.work_minutes, 0);
  const upcoming7 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 7);
    return plans.filter((p) => {
      const t = new Date(p.start_time);
      return t >= new Date() && t <= cutoff;
    });
  }, [plans]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      {/* Page header — eyebrow idiom */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>01 / OPERATIONS OVERVIEW</Eyebrow>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Control room
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
                connected
                  ? 'bg-[color:var(--atlas-success)]'
                  : 'animate-pulse bg-[color:var(--atlas-danger)]',
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
          className="atlas-alert-danger mb-5 flex items-start gap-2 px-3.5 py-3 text-sm"
        >
          <span aria-hidden="true" className="font-bold">
            ✗
          </span>
          <div className="flex-1">
            <p className="font-semibold">Dashboard refresh failed</p>
            <p className="text-xs">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="atlas-btn-secondary atlas-btn text-xs"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* KPI row — Emergent 4-stat concept, real figures */}
      <section
        aria-label="Key performance indicators"
        className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: 'ACTIVE BLOCK PLANS',
            value: loading ? '…' : <CountUp target={activeBlocks} />,
            note: 'TRANSMITTED_COA + ACTIVE_GRANTED',
            pulse: activeBlocks > 0,
          },
          {
            label: 'SENTINEL-CERTIFIED SHARE',
            value: loading ? '…' : certifiedShare,
            note: `${totalPlans} plans on ledger`,
            pulse: false,
          },
          {
            label: 'PENDING APPROVALS',
            value: loading ? '…' : <CountUp target={pendingApprovals} />,
            note: 'SENTINEL_PASSED + APPROVED_SR_DOM',
            pulse: pendingApprovals > 0,
          },
          {
            label: 'FLEET WORKLOAD',
            value: loading ? '…' : fmtMinutes(totalWorkMinutes),
            note: `${fleet.length} machines rostered`,
            pulse: false,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="atlas-card atlas-card-raised flex flex-col gap-1 p-4"
          >
            <p className="atlas-section-label">{kpi.label}</p>
            <p className="atlas-kpi-value text-foreground" aria-live="polite">
              {kpi.value}
              {kpi.pulse ? (
                <span
                  aria-hidden="true"
                  className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--atlas-success)] align-middle"
                />
              ) : null}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              {kpi.note}
            </p>
          </div>
        ))}
      </section>

      {/* Demand vs plan ribbon — real counts as ticker badges */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Eyebrow>DEMAND VS PLAN</Eyebrow>
        <div className="flex flex-wrap gap-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 7-day capacity map */}
        <WeekGrid plans={upcoming7} />

        {/* Right rail: pipeline health (lifecycle distribution) */}
        <div className="grid gap-4">
          <div className="atlas-card p-5">
            <Eyebrow>PIPELINE HEALTH</Eyebrow>
            <div className="grid gap-2">
              {Object.entries(planCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 truncate text-xs text-muted-foreground">
                      {status.replaceAll('_', ' ')}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brass"
                        style={{
                          width: `${(count / Math.max(1, totalPlans)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-xs tabular-nums text-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              {totalPlans === 0 ? (
                <div className="atlas-empty-state">
                  No plans yet — trigger a solve from Block Planning.
                </div>
              ) : null}
            </div>
          </div>

          {/* Machine fleet — compact table */}
          <div className="atlas-card p-5">
            <Eyebrow>DECISION TRACE / FLEET</Eyebrow>
            {fleet.length === 0 ? (
              <div className="atlas-empty-state">
                No machine rosters yet — trigger a solve from Block Planning.
              </div>
            ) : (
              <table className="atlas-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th className="text-right">Jobs</th>
                    <th className="text-right">Work</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((m) => (
                    <tr key={m.machine}>
                      <td className="font-mono text-xs">{m.machine}</td>
                      <td className="text-right tabular-nums">{m.jobs}</td>
                      <td className="text-right font-mono text-xs tabular-nums">
                        {fmtMinutes(m.work_minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Live incident feed — escalated demands (real FSM-002 rows) */}
      <div className="atlas-card mt-4 border-[color:var(--atlas-danger-ring)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>LIVE INCIDENT FEED / ESCALATED OVERDUE</Eyebrow>
          <span
            className="atlas-badge"
            style={{
              borderColor: 'var(--atlas-danger-ring)',
              color: 'var(--atlas-danger)',
            }}
          >
            {escalated.length} OPEN
          </span>
        </div>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--atlas-danger)]" />
          These demands failed automatic resolution and require human
          intervention (FSM-002).
        </p>
        {escalated.length === 0 ? (
          <div className="atlas-empty-state">
            Nothing escalated — the solver and Sentinel are keeping up.
          </div>
        ) : (
          <table className="atlas-table">
            <thead>
              <tr>
                <th>Demand</th>
                <th>Activity</th>
                <th>Section</th>
                <th className="text-right">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {escalated.slice(0, 10).map((d) => (
                <tr key={d.external_ref_id}>
                  <td className="font-mono text-xs">{d.external_ref_id}</td>
                  <td>{d.activity_code.replaceAll('_', ' ')}</td>
                  <td className="font-mono text-xs">{d.section_code}</td>
                  <td className="text-right font-mono tabular-nums text-[color:var(--atlas-danger)]">
                    {d.urgency_score.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
