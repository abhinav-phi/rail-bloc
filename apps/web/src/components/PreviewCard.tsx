import React from "react";
import { ActionButton, StatusBadge } from "./common";

export interface SentinelCheck {
  id: string;
  passed: boolean;
  pending: boolean;
  detail: string;
}

export interface PlanDetail {
  id: string;
  section_code: string;
  start_time: string;
  end_time: string;
  approval_status: string;
  revision_no: number;
  content_hash: string;
  sentinel_verified: boolean;
  decided_by?: string | null;
  authorized_by?: string | null;
}

interface Props {
  plan: PlanDetail;
  demands: { id: string; external_ref_id?: string; activity_code: string; urgency_score: number; source_ingested_at?: string; features?: Record<string, unknown> }[];
  shadowCount: number;
  checks: SentinelCheck[] | null;
  serverHash: string;
  cardHashRef: React.MutableRefObject<string>;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
  message: string | null;
}

const fmt = (iso: string) => new Date(iso).toISOString().slice(5, 16).replace("T", " ");
const durationMins = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / 60000);

/** Design.md §3 — Standardized Action Preview Card (UX-001/DOC-001 rewrite).
 *  The headline count is COMPUTED from the enumerated list — never a hardcoded "N/N". */
export const PreviewCard: React.FC<Props> = ({
  plan, demands, shadowCount, checks, serverHash, cardHashRef,
  onApprove, onReject, busy, message,
}) => {
  const stale = cardHashRef.current !== serverHash && cardHashRef.current !== "";
  const passed = checks?.filter((c) => c.passed).length ?? 0;
  const total = checks?.length ?? 10;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 className="font-bold text-text-primary">Action Preview</h3>
        <StatusBadge status={plan.approval_status} />
      </div>

      {stale && (
        <div data-testid="hash-mismatch-banner" className="m-3 rounded border border-status-caution bg-status-caution/15 px-3 py-2 text-xs font-semibold text-status-caution">
          ⚠ Plan changed — reload to review latest revision. Approve disabled while the locally-held hash is stale.
        </div>
      )}
      {message && (
        <div className={`m-3 rounded px-3 py-2 text-xs ${message.startsWith("✓") ? "bg-status-active/15 text-status-active" : "bg-status-blocked/15 text-status-blocked"}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
        {/* WHAT */}
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-accent-trd">WHAT</h4>
          <p className="text-sm text-text-primary">{plan.section_code}</p>
          <p className="font-mono text-xs text-text-secondary">
            {fmt(plan.start_time)} – {fmt(plan.end_time)} · {durationMins(plan.start_time, plan.end_time)} mins
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-secondary">rev{plan.revision_no} · hash {plan.content_hash.slice(0, 24)}…</p>
        </section>

        {/* WHY */}
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-accent-civil">WHY</h4>
          {demands.slice(0, 3).map((d) => (
            <div key={d.id} className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-text-primary">{d.activity_code}</span>
              <span className="font-mono text-text-secondary">Π≈{d.urgency_score.toFixed(3)}</span>
            </div>
          ))}
          {demands[0]?.source_ingested_at && (
            <FreshnessBadge iso={demands[0].source_ingested_at} />
          )}
        </section>

        {/* SHADOW CLUSTER */}
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-accent-sig">SHADOW CLUSTER</h4>
          <p className="text-xs text-text-primary">
            {shadowCount > 0
              ? `${shadowCount} co-allocated works bundled (ENG+TRD/S&T synchronized disconnection)`
              : "single-department block"}
          </p>
        </section>

        {/* IMPACT */}
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-status-caution">IMPACT ANALYSIS</h4>
          <p className="text-xs text-text-secondary">
            Predicted delay &amp; utilization figures are shown on the planner row and dashboard —{" "}
            <em>each figure is a model estimate (B1-relative, simulated data)</em>, never a fact.
          </p>
        </section>
      </div>

      {/* SAFETY VERIFICATION — enumerated, computed count */}
      <div className="border-t border-border-subtle px-4 py-3">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
          SAFETY VERIFICATION: {checks ? `${passed}/${total} CHECKS PASSED` : "loading…"}
        </h4>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          {(checks ?? []).map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-2 font-mono text-[11px]">
              <span className={c.passed ? "text-status-active" : c.pending ? "text-status-caution" : "text-status-blocked"}>
                {c.passed ? "✓" : c.pending ? "⚠" : "✗"} {i + 1}. {c.id}
              </span>
              <span className="truncate text-text-secondary" title={c.detail}>{c.detail || (c.pending ? "PENDING ACKS" : "")}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* REVISION INTEGRITY + ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3">
        <div className="font-mono text-[10px] text-text-secondary">
          REVISION INTEGRITY: local {cardHashRef.current.slice(0, 12) || "—"} · server {serverHash.slice(0, 12)}
          <br />
          {plan.decided_by && <span>decided_by: <b className="text-text-primary">{plan.decided_by}</b> </span>}
          {plan.authorized_by && <span>· authorized_by: <b className="text-text-primary">{plan.authorized_by}</b></span>}
        </div>
        <div className="flex gap-2">
          <ActionButton data-testid="approve" onClick={onApprove} disabled={stale || busy}>
            ✔ Approve &amp; Digitally Sign
          </ActionButton>
          <ActionButton onClick={onReject} disabled={busy} className="bg-status-blocked/20 text-status-blocked hover:bg-status-blocked/30">
            ✗ Reject Plan
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

function FreshnessBadge({ iso }: { iso: string }) {
  const ageH = (Date.now() - new Date(iso).getTime()) / 3600000;
  const fresh = ageH <= 12;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] ${fresh ? "bg-status-active/15 text-status-active" : "bg-status-stale/25 text-status-stale"}`}>
      🕓 TEL-001 freshness: ingested {new Date(iso).toISOString().slice(5, 16).replace("T", " ")}Z ({ageH.toFixed(1)}h ago){fresh ? "" : " — STALE"}
    </span>
  );
}
