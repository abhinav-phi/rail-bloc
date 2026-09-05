'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { usePersona } from '@/context/persona-context';
import { Play, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types (live /plans + /optimize contract) ───────────────────────── */

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
}

type Horizon = 'WEEKLY' | 'MONTHLY' | 'STRATEGIC_26W';

const HORIZONS: {
  key: Horizon;
  label: string;
  blurb: string;
  psTag: string;
}[] = [
  {
    key: 'WEEKLY',
    label: 'Weekly',
    blurb: 'Tactical week — headway-expanded train paths, B1 warm start.',
    psTag: 'PS Req 4 · Weekly',
  },
  {
    key: 'MONTHLY',
    label: 'Monthly',
    blurb: 'Rolling 4-week window — same horizon-agnostic formulation.',
    psTag: 'PS Req 4 · Monthly',
  },
  {
    key: 'STRATEGIC_26W',
    label: '26-Week',
    blurb: 'Strategic calendar view (Gantt) — long-term corridor planning.',
    psTag: 'Long-term',
  },
];

const STATUS_TONE: Record<string, string> = {
  SENTINEL_PASSED:
    'border-[#bfe6d0] bg-[#e9f7ef] text-[#1b7f4b] dark:border-[#14532d] dark:bg-[#052e16]/60 dark:text-[#4ade80]',
  APPROVED_SR_DOM:
    'border-[#c3d6f5] bg-[#eaf1fc] text-[#2d63c8] dark:border-[#1e3a8a] dark:bg-[#172554]/60 dark:text-[#93c5fd]',
  AUTHORIZED_DRM:
    'border-[#d9c9ec] bg-[#f1eaf8] text-[#6d4a96] dark:border-[#4c1d95] dark:bg-[#2e1065]/60 dark:text-[#c4b5fd]',
  TRANSMITTED_COA:
    'border-[#d9afc1] bg-[#f8eaf0] text-[#935073] dark:border-[#502d55] dark:bg-[#3a1f33]/60 dark:text-[#d58ba9]',
  ACTIVE_GRANTED:
    'border-[#bfe6d0] bg-[#e9f7ef] text-[#1b7f4b] dark:border-[#14532d] dark:bg-[#052e16]/60 dark:text-[#4ade80]',
  DRAFT: 'border-border bg-muted text-muted-foreground',
  PROVISIONAL:
    'border-[#f3dfb1] bg-[#fff7e6] text-[#b7791f] dark:border-[#78350f] dark:bg-[#451a03]/60 dark:text-[#fbbf24]',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function dur(start: string, end: string): string {
  const m = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  );
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/* ── Solve trigger card ─────────────────────────────────────────────── */

function SolveCard(props: {
  horizon: Horizon;
  division: string;
  onQueued: (taskId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const h = HORIZONS.find((x) => x.key === props.horizon)!;

  const trigger = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ task_id: string }>('/api/v1/optimize/solve', {
        horizon: props.horizon,
        division: props.division,
      });
      props.onQueued(r.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="atlas-card mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="atlas-card-title">{h.label} solve</h2>
            <span className="atlas-badge border-border text-muted-foreground">
              {h.psTag}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{h.blurb}</p>
        </div>
        <button
          type="button"
          data-action="true"
          onClick={() => void trigger()}
          disabled={busy}
          className="atlas-btn-primary atlas-btn text-sm"
        >
          {busy ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {busy ? 'Queueing…' : `Run ${h.label.toLowerCase()} solve`}
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-[#f5c2ca] bg-[#fdecef] px-3 py-2 text-xs text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a]/40 dark:text-[#f87171]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */

export function AtlasPlanner() {
  const { persona } = usePersona();
  const [horizon, setHorizon] = useState<Horizon>('WEEKLY');
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [queuedTask, setQueuedTask] = useState<string | null>(null);
  const division = persona?.division ?? 'DLI';

  const load = useCallback(async () => {
    const rows = await api.get<PlanRow[]>(
      `/api/v1/plans?limit=200&horizon=${encodeURIComponent(horizon)}`,
    );
    setPlans(rows);
  }, [horizon]);

  useEffect(() => {
    void load().catch(() => setPlans([]));
  }, [load]);

  // Poll a bit after queueing so the user sees the run appear
  useEffect(() => {
    if (!queuedTask) return;
    const id = setInterval(() => void load().catch(() => null), 5000);
    const stop = setTimeout(() => clearInterval(id), 120_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [queuedTask, load]);

  const filtered = useMemo(
    () => (plans ?? []).filter((p) => p.plan_horizon === horizon),
    [plans, horizon],
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Block Planning
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-horizon solver (PS Req 4): Weekly · Monthly · 26-Week — one
            horizon-agnostic CP-SAT formulation, B1 warm start, VRP rosters.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Division <span className="font-mono text-foreground">{division}</span>
        </div>
      </header>

      {/* Horizon tabs */}
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Planning horizon"
      >
        {HORIZONS.map((h) => (
          <button
            key={h.key}
            type="button"
            role="tab"
            aria-selected={horizon === h.key}
            onClick={() => setHorizon(h.key)}
            className={cn(
              'atlas-btn-secondary atlas-btn text-sm',
              horizon === h.key && 'atlas-btn-primary',
            )}
          >
            {h.key === 'MONTHLY' ? <Sparkles size={14} /> : null}
            {h.label}
          </button>
        ))}
      </div>

      <SolveCard
        horizon={horizon}
        division={division}
        onQueued={(taskId) => {
          setQueuedTask(taskId);
          setPlans(null);
        }}
      />

      {queuedTask ? (
        <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw size={12} className="animate-spin" />
          Solver run {queuedTask.slice(0, 8)}… queued — plan rows appear here
          when the worker commits them.
        </p>
      ) : null}

      {/* Plans table for the selected horizon */}
      <div className="atlas-card overflow-hidden">
        <div className="atlas-card-header">
          <h2 className="atlas-card-title">
            {HORIZONS.find((x) => x.key === horizon)?.label} plans
          </h2>
          <span className="atlas-badge border-border text-muted-foreground">
            {plans === null ? 'loading…' : `${filtered.length} committed`}
          </span>
        </div>
        {plans === null ? (
          <p className="p-5 text-sm text-muted-foreground">Loading plans…</p>
        ) : filtered.length === 0 ? (
          <div className="atlas-empty-state m-5">
            No {HORIZONS.find((x) => x.key === horizon)?.label.toLowerCase()}{' '}
            plans yet. Trigger the solve above — Sentinel verifies every
            candidate before anything lands here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="atlas-table w-full">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Window</th>
                  <th>Duration</th>
                  <th>Horizon</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="text-right">Hash</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.section_code}</td>
                    <td className="whitespace-nowrap text-xs">
                      {fmt(p.start_time)} → {fmt(p.end_time)}
                    </td>
                    <td className="tabular-nums">
                      {dur(p.start_time, p.end_time)}
                    </td>
                    <td>
                      <span className="atlas-badge border-border text-muted-foreground">
                        {p.plan_horizon}
                      </span>
                    </td>
                    <td>
                      {p.is_shadow_block ? (
                        <span
                          className="atlas-stripes-shadow inline-block h-4 w-10 rounded border border-border"
                          title="shadow bundle"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          single
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={cn(
                          'atlas-badge',
                          STATUS_TONE[p.approval_status] ??
                            'border-border text-muted-foreground',
                        )}
                      >
                        {p.approval_status}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="atlas-hash" title={p.content_hash}>
                        {p.content_hash.slice(0, 10)}…
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
