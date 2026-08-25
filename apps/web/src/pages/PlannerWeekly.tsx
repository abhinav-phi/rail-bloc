import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ActionButton, Card, StatusBadge } from "../components/common";

interface PlanRow {
  id: string;
  section_code: string;
  division: string;
  start_time: string;
  end_time: string;
  approval_status: string;
  revision_no: number;
  is_shadow_block: boolean;
  content_hash: string;
  sentinel_verified: boolean;
  loss_pax_minutes: number;
  loss_frt_minutes: number;
}

/** FR-013/FR-031 — tactical weekly console. Any parameter edit calls /revise which
 *  creates a NEW revision at DRAFT and clears sentinel_verified (FR-026/SAFE-002). */
export const PlannerWeekly: React.FC = () => {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selected, setSelected] = useState<PlanRow | null>(null);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [solving, setSolving] = useState(false);

  const reload = useCallback(() => {
    api.get<PlanRow[]>("/api/v1/plans?horizon=WEEKLY&limit=300").then(setPlans).catch(() => undefined);
  }, []);

  useEffect(reload, [reload]);

  useEffect(() => {
    if (!selected) return;
    const fresh = plans.find((p) => p.id === selected.id) ?? null;
    setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const triggerSolve = async () => {
    setMsg(null);
    setSolving(true);
    try {
      const out = await api.post<{ task_id: string }>("/api/v1/optimize/solve", { horizon: "WEEKLY", division: "DLI" });
      setMsg(`Solve queued: ${out.task_id} — poll status in a few seconds.`);
      setTimeout(reload, 8000);
      setTimeout(reload, 20000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "solve failed");
    } finally {
      setSolving(false);
    }
  };

  const revise = async () => {
    if (!selected) return;
    try {
      const body: Record<string, string> = {};
      if (newStart) body.start_time = new Date(newStart).toISOString();
      if (newEnd) body.end_time = new Date(newEnd).toISOString();
      const out = await api.post<{ new_plan_id: string; revision_no: number; note: string }>(
        `/api/v1/plans/${selected.id}/revise`, body
      );
      setMsg(`Revision created: rev ${out.revision_no} (${out.new_plan_id.slice(0, 8)}…) — ${out.note}`);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "revise failed");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Tactical Weekly Planner</h2>
          <ActionButton onClick={triggerSolve} disabled={solving}>
            {solving ? "Queuing…" : "▶ Trigger weekly solve"}
          </ActionButton>
        </div>
        {msg && <div className="rounded border border-accent-trd/40 bg-accent-trd/10 px-3 py-2 text-xs text-accent-trd">{msg}</div>}
        <Card>
          {plans.length === 0 && (
            <p className="text-xs text-text-secondary">
              No WEEKLY plans yet. Trigger a solve, or wait for the WEEKLY_PLAN_CRON cadence.
            </p>
          )}
          <ul className="divide-y divide-border-subtle">
            {plans.map((p) => (
              <li key={p.id} className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 py-2 hover:bg-bg-primary ${selected?.id === p.id ? "bg-bg-primary" : ""}`} onClick={() => setSelected(p)}>
                <div>
                  <span className="font-mono text-sm text-text-primary">{p.section_code}</span>
                  <span className="ml-2 font-mono text-xs text-text-secondary">
                    {fmt(p.start_time)} → {fmt(p.end_time)}
                  </span>
                  {p.is_shadow_block && <span className="ml-2 text-xs text-accent-sig">◆ shadow bundle</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary">
                    est. pax {Math.round(p.loss_pax_minutes)}m · frt {Math.round(p.loss_frt_minutes)}m (model estimate)
                  </span>
                  <span className="font-mono text-[10px] text-text-secondary">rev{p.revision_no}</span>
                  <StatusBadge status={p.approval_status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="pt-6 text-sm font-bold uppercase tracking-wider text-text-secondary">Modify Parameters (creates new revision)</h3>
        {!selected ? (
          <Card><p className="text-xs text-text-secondary">Select a plan row.</p></Card>
        ) : (
          <Card title={`${selected.section_code} · rev${selected.revision_no}`}>
            <StatusBadge status={selected.approval_status} />
            <p className="mt-2 break-all font-mono text-[10px] text-text-secondary">
              hash {selected.content_hash.slice(0, 32)}…
            </p>
            <label className="mt-3 block text-xs text-text-secondary">New start</label>
            <input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)}
              className="mb-2 w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 font-mono text-xs" />
            <label className="block text-xs text-text-secondary">New end</label>
            <input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
              className="mb-3 w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 font-mono text-xs" />
            <ActionButton onClick={revise}>✎ Revise → re-enter Sentinel chain</ActionButton>
            <p className="mt-2 text-[10px] leading-relaxed text-text-secondary">
              FR-026: any mutation after SENTINEL_PASSED creates revision+{1} at DRAFT,
              clears sentinel_verified and restarts the approval chain (SAFE-002).
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

function fmt(iso: string): string {
  return new Date(iso).toISOString().slice(5, 16).replace("T", " ");
}
