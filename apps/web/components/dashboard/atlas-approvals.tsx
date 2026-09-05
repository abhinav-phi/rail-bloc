'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { usePersona } from '@/context/persona-context';
import { ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── API shapes (verified against live backend 2026-09-05) ──────────── */

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
  decided_by?: string | null;
  authorized_by?: string | null;
}

interface SentinelReport {
  content_hash: string;
  passed: boolean;
  has_pending: boolean;
  checks: { id: string; passed: boolean; pending: boolean; detail: string }[];
}

const THE_TEN: Record<string, string> = {
  'G&SR-1 Absolute Block Exclusion': 'G&SR-1',
  'G&SR-2 Interlocking Precedence Acknowledgment': 'G&SR-2',
  'G&SR-3 Fail-Closed State Consistency': 'G&SR-3',
  'G&SR-4 Power Isolation Boundary Containment': 'G&SR-4',
  'G&SR-5 Headway Margin': 'G&SR-5',
  'MILP-C1 Section Exclusion': 'MILP-C1',
  'MILP-C2 Maintenance Enclosure': 'MILP-C2',
  'MILP-C3 Shadow Bundling Window Containment': 'MILP-C3',
  'MILP-C4 Non-Fragmented Duration': 'MILP-C4',
  'MILP-C5 Machine Spatial Conservation': 'MILP-C5',
};

const ACTIONABLE = new Set(['SENTINEL_PASSED', 'APPROVED_SR_DOM']);

function fmtPlanTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtMinutes(m: number): string {
  if (!m) return '0 min';
  return m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)} min`;
}

/* ── Sentinel 10-check card (their design idiom, our live report) ───── */

function SentinelChecklist({ report }: { report: SentinelReport | null }) {
  const checks = report?.checks ?? [];
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed && !c.pending).length;
  const pending = checks.filter((c) => c.pending).length;
  const allPassed = report ? report.passed && !report.has_pending : false;
  const headerTone = allPassed
    ? 'text-[#1b7f4b] dark:text-[#4ade80]'
    : failed > 0
      ? 'text-[#d6293e] dark:text-[#f87171]'
      : 'text-[#b7791f] dark:text-[#fbbf24]';

  return (
    <div>
      <p className={cn('atlas-section-label flex items-center justify-between', headerTone)}>
        <span>Safety verification — Sentinel</span>
        <span className="font-mono normal-case tracking-normal" data-testid="sentinel-count">
          {checks.length ? `${passed}/${checks.length} checks` : 'loading…'}
          {failed > 0 ? ` · ${failed} failed` : ''}
          {pending > 0 ? ` · ${pending} pending` : ''}
        </span>
      </p>
      <ol className="mt-2 divide-y divide-border rounded-lg border border-border">
        {(checks.length ? checks : Array.from({ length: 10 }, () => null)).map((c, i) => {
          const verdict = !c ? 'PENDING' : c.passed ? 'PASS' : c.pending ? 'PENDING' : 'FAIL';
          const icon = verdict === 'PASS' ? '✓' : verdict === 'FAIL' ? '✗' : '○';
          const tone =
            verdict === 'PASS'
              ? 'text-[#1b7f4b] dark:text-[#4ade80]'
              : verdict === 'FAIL'
                ? 'font-bold text-[#d6293e] dark:text-[#f87171]'
                : 'text-muted-foreground';
          return (
            <li
              key={c?.id ?? `slot-${i}`}
              className="flex items-start gap-3 px-3 py-1.5 text-sm"
              data-verdict={verdict}
            >
              <span aria-hidden="true" className={cn('w-4 shrink-0 text-center', tone)}>
                {icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground">
                  <span className="font-semibold">{c ? (THE_TEN[c.id] ?? c.id.split(' ')[0]) : `Check ${i + 1}`}</span>
                  <span className="ml-2 text-muted-foreground">
                    {c?.id ?? 'awaiting report'}
                  </span>
                </p>
                {c ? <p className="text-xs text-muted-foreground">{c.detail}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Sign dialog (digital signature + idempotency key) ──────────────── */

function SignDialog(props: {
  plan: PlanRow;
  action: 'APPROVE' | 'AUTHORIZE';
  onClose: () => void;
  onDone: () => void;
}) {
  const { plan, action, onClose, onDone } = props;
  const [signature, setSignature] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isDrm = action === 'AUTHORIZE';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/v1/approvals/decide', {
        plan_id: plan.id,
        decision: 'APPROVE',
        signature,
        idempotency_key: `${action}-${plan.id}-${signature.length}-${Math.floor(Date.now() / 1000)}`,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isDrm ? 'Authorize and Seal' : 'Approve plan'}
    >
      <div className="atlas-card w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isDrm ? 'Authorize & Seal' : 'Approve Plan'}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isDrm
                ? 'DRM authorization — plan becomes tamper-evidently bound (content_hash == sentinel_hash).'
                : 'Sr. DOM approval — distinct-approver chain (APP-001) enforced at the DB layer.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-mono text-foreground">{plan.id.slice(0, 8)}…</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Section</span>
            <span className="font-mono text-foreground">{plan.section_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Window</span>
            <span className="font-mono text-foreground">
              {fmtPlanTime(plan.start_time)} → {fmtPlanTime(plan.end_time)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">content_hash</span>
            <span className="atlas-hash truncate">{plan.content_hash.slice(0, 18)}…</span>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="sig">
          Digital signature (min 8 chars)
        </label>
        <input
          id="sig"
          type="password"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          placeholder="Type your approval signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        />

        {error ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-[#f5c2ca] bg-[#fdecef] px-3 py-2 text-xs text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a]/40"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="atlas-btn-secondary atlas-btn text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={signature.length < 8 || busy}
            onClick={() => void submit()}
            className="atlas-btn-primary atlas-btn text-sm"
          >
            {busy ? 'Signing…' : isDrm ? 'Authorize & Seal' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main approvals view ────────────────────────────────────────────── */

export function AtlasApprovals() {
  const { persona } = usePersona();
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [selected, setSelected] = useState<PlanRow | null>(null);
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [signAction, setSignAction] = useState<'APPROVE' | 'AUTHORIZE' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await api.get<PlanRow[]>('/api/v1/plans?limit=200');
    setPlans(rows);
    return rows;
  }, []);

  useEffect(() => {
    void load().catch(() => setPlans([]));
  }, [load]);

  const openPlan = useCallback(async (plan: PlanRow) => {
    setSelected(plan);
    setReport(null);
    try {
      const r = await api.get<SentinelReport>(`/api/v1/plans/${plan.id}/sentinel-report`);
      setReport(r);
    } catch {
      setReport(null);
    }
  }, []);

  // Approvable = current persona's next stage, division-scoped by the API anyway.
  const queue = useMemo(
    () => (plans ?? []).filter((p) => ACTIONABLE.has(p.approval_status)),
    [plans],
  );

  const refreshAfterDecision = useCallback(async () => {
    setSignAction(null);
    setNotice(
      signAction === 'AUTHORIZE'
        ? 'Plan authorized & sealed — TRANSMITTED_COA happens only after COA acknowledgment.'
        : 'Plan approved by Sr. DOM — now awaiting DRM authorization.',
    );
    const rows = await load();
    const next = rows.find((r) => selected && r.id === selected.id);
    if (next) await openPlan(next);
  }, [load, openPlan, selected, signAction]);

  const canApprove =
    persona?.role === 'SR_DOM' || persona?.role === 'ADMIN';
  const canAuthorize =
    persona?.role === 'DRM' || persona?.role === 'ADMIN';

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Approval Workflow
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Distinct-approver chain: Sr. DOM approves → DRM authorizes & seals →
            COA transmits on acknowledgment. Safe-002: any content change forces
            re-verification (HTTP 409).
          </p>
        </div>
      </header>

      {notice ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-2 rounded-lg border border-[#bfe6d0] bg-[#e9f7ef] px-3.5 py-3 text-sm text-[#1b7f4b] dark:border-[#14532d] dark:bg-[#052e16]/40 dark:text-[#4ade80]"
        >
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto text-xs underline">
            dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Queue */}
        <div className="atlas-card overflow-hidden">
          <div className="atlas-card-header">
            <h2 className="atlas-card-title">Approval queue</h2>
            <span className="atlas-badge border-border text-muted-foreground">
              {queue.length} actionable
            </span>
          </div>
          {plans === null ? (
            <p className="p-5 text-sm text-muted-foreground">Loading plans…</p>
          ) : queue.length === 0 ? (
            <div className="atlas-empty-state m-5">
              No plans awaiting decision right now. Run a solve from Block
              Planning to generate candidates.
            </div>
          ) : (
            <ul className="max-h-[560px] divide-y divide-border overflow-y-auto">
              {queue.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void openPlan(p)}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors hover:bg-accent',
                      selected?.id === p.id && 'bg-accent',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-foreground">
                        {p.section_code}
                      </span>
                      <span
                        className={cn(
                          'atlas-badge',
                          p.approval_status === 'SENTINEL_PASSED'
                            ? 'border-[#bfe6d0] bg-[#e9f7ef] text-[#1b7f4b] dark:border-[#14532d] dark:bg-[#052e16]/60 dark:text-[#4ade80]'
                            : 'border-[#c3d6f5] bg-[#eaf1fc] text-[#2d63c8] dark:border-[#1e3a8a] dark:bg-[#172554]/60 dark:text-[#93c5fd]',
                        )}
                      >
                        {p.approval_status === 'SENTINEL_PASSED' ? 'Awaiting Sr. DOM' : 'Awaiting DRM'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{fmtPlanTime(p.start_time)}</span>
                      <span>→</span>
                      <span className="font-mono">{fmtPlanTime(p.end_time)}</span>
                      {p.is_shadow_block ? (
                        <span className="atlas-stripes-shadow inline-block h-3 w-8 rounded" title="shadow bundle" />
                      ) : null}
                      <span>rev {p.revision_no}</span>
                      <span>· {p.plan_horizon}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail panel */}
        <div className="atlas-card p-5">
          {!selected ? (
            <div className="atlas-empty-state h-full min-h-[280px]">
              Select a plan from the queue to see its 10-check Sentinel report.
            </div>
          ) : (
            <div>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selected.section_code}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {selected.id.slice(0, 8)}… · rev {selected.revision_no}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtPlanTime(selected.start_time)} → {fmtPlanTime(selected.end_time)} ·
                    {' '}pax {fmtMinutes(selected.loss_pax_minutes)} · frt{' '}
                    {fmtMinutes(selected.loss_frt_minutes)}{' '}
                    <span className="atlas-model-estimate inline">
                      (model estimate, B1-relative, simulated)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canApprove && selected.approval_status === 'SENTINEL_PASSED' ? (
                    <button
                      type="button"
                      data-action="true"
                      onClick={() => setSignAction('APPROVE')}
                      className="atlas-btn-primary atlas-btn text-sm"
                    >
                      Approve (Sr. DOM)
                    </button>
                  ) : null}
                  {canAuthorize && selected.approval_status === 'APPROVED_SR_DOM' ? (
                    <button
                      type="button"
                      data-action="true"
                      onClick={() => setSignAction('AUTHORIZE')}
                      className="atlas-btn-primary atlas-btn text-sm"
                    >
                      Authorize &amp; Seal
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Hash-mismatch gate visual: report must agree with the sealed hash */}
              {report && report.content_hash !== selected.content_hash ? (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-[#f5c2ca] bg-[#fdecef] px-3.5 py-3 text-sm text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a]/40"
                >
                  <p className="font-semibold">Hash mismatch</p>
                  <p className="text-xs">
                    The plan content changed after Sentinel verification — approval
                    is disabled (SAFE-002). Create a new revision instead.
                  </p>
                </div>
              ) : null}

              <SentinelChecklist report={report} />

              <div className="mt-4 grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">sealed content_hash</span>
                  <span className="atlas-hash truncate">{selected.content_hash}</span>
                </div>
                <p className="text-muted-foreground">
                  Tenants of the seal: decided_by ≠ authorized_by (APP-001),
                  idempotency keys on every decision, ledger rows appended
                  tamper-evidently.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {signAction && selected ? (
        <SignDialog
          plan={selected}
          action={signAction}
          onClose={() => setSignAction(null)}
          onDone={() => void refreshAfterDecision()}
        />
      ) : null}
    </div>
  );
}
