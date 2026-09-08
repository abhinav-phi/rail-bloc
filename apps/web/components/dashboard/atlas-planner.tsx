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
    'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]/60',
  APPROVED_SR_DOM:
    'border-[color:var(--atlas-info-ring)] bg-[color:var(--atlas-info-bg)] text-[color:var(--atlas-info)]/60',
  AUTHORIZED_DRM:
    'border-[color:var(--atlas-purple-bg)] bg-[color:var(--atlas-purple-bg)] text-[color:var(--atlas-purple)]/60',
  TRANSMITTED_COA:
    'border-[color:var(--atlas-brand-ring)] bg-[color:var(--atlas-brand-soft)] text-[color:var(--atlas-brand)]/60',
  ACTIVE_GRANTED:
    'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]/60',
  DRAFT: 'border-border bg-muted text-muted-foreground',
  PROVISIONAL:
    'border-[color:var(--atlas-warning-ring)] bg-[color:var(--atlas-warning-bg)] text-[color:var(--atlas-warning)]/60',
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
          className="mt-3 rounded-lg border border-[color:var(--atlas-danger-ring)] bg-[color:var(--atlas-danger-bg)] px-3 py-2 text-xs text-[color:var(--atlas-danger)]/40"
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
  const [baseline, setBaseline] = useState<number | null>(null);
  const committed =
    queuedTask !== null &&
    baseline !== null &&
    plans !== null &&
    plans.length > baseline;
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
          <p className="atlas-section-label mb-2">02 / BLOCK PLANNING</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Work queue
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
          setBaseline((plans ?? []).length);
          setPlans(null);
        }}
      />

      {queuedTask ? (
        <div className="atlas-card mb-4 p-4" aria-live="polite">
          <p className="atlas-section-label mb-3">
            SOLVE IN PROGRESS · {queuedTask.slice(0, 8)}…
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              'NEXUS · ingesting demands',
              'OPTIMA · solving network',
              'SENTINEL · validating',
            ].map((stage, i) => (
              <div
                key={stage}
                className={cn(
                  'flex items-center gap-2 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]',
                  i === 0
                    ? 'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]'
                    : 'border-border text-muted-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    i === 0
                      ? 'animate-pulse bg-[color:var(--atlas-success)]'
                      : 'bg-muted-foreground/40',
                  )}
                />
                {stage}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Plan rows appear here when the worker commits them.
          </p>
        </div>
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
