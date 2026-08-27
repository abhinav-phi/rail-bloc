import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ActionButton, Card, StatusBadge } from "../components/common";
import { PreviewCard, PlanDetail, SentinelCheck } from "../components/PreviewCard";

interface PlanRow extends PlanDetail {
  division: string;
}

interface DetailResponse {
  plan: PlanDetail & { sentinel_hash: string | null; section_code: string };
  shadow_ids: string[];
  demands: { id: string; external_ref_id: string; activity_code: string; urgency_score: number; source_ingested_at: string; features: Record<string, unknown> }[];
  ack: { sm_actor?: string; sm_acked_at?: string; controller_actor?: string; controller_acked_at?: string } | null;
}

/** /approvals — Sr. DOM & DRM sign-off console with the enumerated 10-check
 *  Action Preview Card, hash-mismatch banner and distinct-approver display. */
export const Approvals: React.FC = () => {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [checks, setChecks] = useState<SentinelCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cardHashRef = useRef<string>("");
  const viewerRole: string | null = (() => {
    // Same base64url decode approach as App.tsx; needed for role-aware action label.
    const tok = localStorage.getItem("railbloc_token");
    if (!tok) return null;
    try {
      const b64 = (tok.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
      return (JSON.parse(decodeURIComponent(escape(window.atob(b64)))) as { role?: string }).role ?? null;
    } catch {
      return null;
    }
  })();

  const loadPlans = useCallback(() => {
    api.get<PlanRow[]>("/api/v1/plans?horizon=WEEKLY&limit=300")
      .then((rows) => {
        const actionable = rows.filter((p) => ["SENTINEL_PASSED", "APPROVED_SR_DOM"].includes(p.approval_status));
        setPlans(actionable);
        if (!selectedId && actionable.length > 0) setSelectedId(actionable[0].id);
      })
      .catch(() => undefined);
  }, [selectedId]);

  useEffect(loadPlans, [loadPlans]);

  useEffect(() => {
    if (!selectedId) return;
    setMessage(null);
    api.get<DetailResponse>(`/api/v1/plans/${selectedId}`)
      .then((d) => {
        setDetail(d);
        // Freeze the locally-held hash at card-open time (REVISION INTEGRITY check).
        cardHashRef.current = d.plan.content_hash;
      })
      .catch(() => undefined);
    api.get<{ checks: SentinelCheck[]; content_hash: string; passed: boolean }>(`/api/v1/plans/${selectedId}/sentinel-report`)
      .then((r) => setChecks(r.checks))
      .catch(() => setChecks(null));
  }, [selectedId]);

  const decide = async (decision: "APPROVE" | "REJECT") => {
    if (!detail || !selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      const out = await api.post<{ status: string; transaction_hash?: string; replayed?: boolean }>(
        "/api/v1/approvals/decide",
        {
          plan_id: selectedId,
          decision,
          signature: `sig-${detail.plan.content_hash.slice(0, 16)}-${Date.now()}`,
          idempotency_key: `decide-${selectedId}-${decision}-${Date.now()}`,
        }
      );
      setMessage(`✓ ${out.status}${out.replayed ? " (idempotent replay — no second effect)" : ` · ledger ${out.transaction_hash?.slice(0, 16)}…`}`);
      loadPlans();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "decision failed");
    } finally {
      setBusy(false);
    }
  };

  const signalAck = async (as_role: "STATION_MASTER" | "CONTROLLER") => {
    if (!selectedId) return;
    try {
      await api.post(`/api/v1/plans/${selectedId}/acknowledge-signal`, { as_role });
      const d = await api.get<DetailResponse>(`/api/v1/plans/${selectedId}`);
      setDetail(d);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "ack failed");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-text-primary">Approvals Queue</h2>
        <Card>
          <ul className="divide-y divide-border-subtle">
            {plans.map((p) => (
              <li key={p.id}
                  className={`cursor-pointer py-2 hover:bg-bg-primary ${selectedId === p.id ? "bg-bg-primary" : ""}`}
                  onClick={() => setSelectedId(p.id)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-text-primary">{p.section_code} rev{p.revision_no}</span>
                  <StatusBadge status={p.approval_status} />
                </div>
                <span className="font-mono text-[10px] text-text-secondary">
                  {new Date(p.start_time).toISOString().slice(5, 16).replace("T", " ")}
                </span>
              </li>
            ))}
            {plans.length === 0 && (
              <li className="py-6 text-center text-xs text-text-secondary">
                No plans awaiting decision. Run a solve first.
              </li>
            )}
          </ul>
        </Card>
      </div>

      <div className="xl:col-span-2 space-y-3">
        {!detail ? (
          <Card><p className="text-xs text-text-secondary">Select a plan to review.</p></Card>
        ) : (
          <>
            {detail.demands.some((d) => d.activity_code !== "" ) &&
              detail.plan.approval_status === "DRAFT" && (
                <Card title="G&SR-2 pending acknowledgments">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={detail.ack?.sm_acked_at ? "text-status-active" : "text-status-caution"}>
                      {detail.ack?.sm_acked_at ? "✓ SM acknowledged" : "⚠ SM acknowledgment required"}
                    </span>
                    <span className={detail.ack?.controller_acked_at ? "text-status-active" : "text-status-caution"}>
                      {detail.ack?.controller_acked_at ? "✓ Controller acknowledged" : "⚠ Controller acknowledgment required"}
                    </span>
                    <ActionButton onClick={() => signalAck("STATION_MASTER")}>Acknowledge as Station Master</ActionButton>
                    <ActionButton onClick={() => signalAck("CONTROLLER")}>Acknowledge as Controller</ActionButton>
                  </div>
                </Card>
              )}
            <PreviewCard
              plan={detail.plan}
              viewerRole={viewerRole}
              demands={detail.demands}
              shadowCount={detail.shadow_ids.length}
              checks={checks}
              serverHash={detail.plan.content_hash}
              cardHashRef={cardHashRef}
              onApprove={() => decide("APPROVE")}
              onReject={() => decide("REJECT")}
              busy={busy}
              message={message}
            />
            <p className="px-1 text-[10px] leading-relaxed text-text-secondary">
              The DRM authorization step appears automatically once this plan is APPROVED_SR_DOM:
              the server rejects self-authorization with HTTP 403 when decided_by = authorized_by (APP-001),
              and rejects any decision whose recomputed content_hash ≠ sentinel_hash with HTTP 409 (SAFE-002/R6.2).
            </p>
          </>
        )}
      </div>
    </div>
  );
};
