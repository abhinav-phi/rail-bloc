import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ActionButton, Card, StatusBadge } from "../components/common";

interface Incident {
  id: string | null;
  section_id: string;
  section_code: string;
  division: string;
  incident_type: string;
  reported_by: string;
  estimated_duration_mins: number | null;
  coalesced_into_incident_id: string | null;
  controller_acknowledged: boolean;
  controller_ack_actor: string | null;
  created_at: string;
  provisional_plan_id: string | null;
}

interface BlastRadius {
  section_id: string;
  trains_held: { train_number: string; train_type: string; scheduled_entry: string }[];
  plans_superseded: { id: string; approval_status: string; revision_no: number }[];
  affected_sections: string[];
}

/** /disruptions — P0 incident console with the blast-radius confirmation modal
 *  (API-001), incident coalescing view and Controller-acknowledgment gate (SAFE-003). */
export const Disruptions: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [type, setType] = useState("TRACK_FRACTURE");
  const [duration, setDuration] = useState(120);
  const [blast, setBlast] = useState<BlastRadius | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.get<Incident[]>("/api/v1/emergency/incidents").then(setIncidents).catch(() => undefined);
  }, []);

  useEffect(reload, [reload]);
  useEffect(() => {
    if (sectionId) return;
    api.get<{ sections: { properties: { id: string; code: string } }[] }>("/api/v1/plans/geo")
      .then((g) => {
        const s = g.sections[0]?.properties;
        if (s) setSectionId(s.id);
      })
      .catch(() => undefined);
  }, [sectionId]);

  const previewBlast = async () => {
    try {
      setBlast(await api.get<BlastRadius>(
        `/api/v1/emergency/blast-radius?section_id=${encodeURIComponent(sectionId)}&estimated_duration_mins=${duration}`));
      setConfirmed(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "blast radius failed");
    }
  };

  const fire = async () => {
    setMsg(null);
    try {
      const out = await api.post<{
        incident_id: string; coalesced_into: string | null; plan_id: string | null;
        plans_superseded: string[]; measured: { wall_seconds_incl_sentinel: number };
      }>("/api/v1/emergency/breakdown", {
        section_id: sectionId,
        breakdown_type: type,
        estimated_duration_mins: duration,
        confirmation: confirmed,
        idempotency_key: `emg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });
      setMsg(
        `✓ PROVISIONAL plan ${out.plan_id?.slice(0, 8) ?? "—"} created in ${out.measured.wall_seconds_incl_sentinel.toFixed(1)}s ` +
        `(NFR-002 budget incl. synchronous structural re-check). Coalesced: ${out.coalesced_into ?? "no"}. ` +
        `Superseded: ${out.plans_superseded.length} plan(s). Awaiting Controller acknowledgment.`
      );
      setBlast(null);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "emergency failed");
    }
  };

  const ack = async (incidentId: string | null) => {
    if (!incidentId) return;
    try {
      await api.post(`/api/v1/emergency/incidents/${incidentId}/acknowledge`);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "ack failed");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2 space-y-3">
        <h2 className="text-lg font-bold text-text-primary">Disruption Console (P0)</h2>
        {msg && <div className="rounded border border-status-provisional/50 bg-status-provisional/10 px-3 py-2 text-xs text-status-provisional">{msg}</div>}

        <Card title="Log P0 incident">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs text-text-secondary">
              Section ID
              <input value={sectionId} onChange={(e) => setSectionId(e.target.value)}
                className="mt-1 w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 font-mono text-xs" />
            </label>
            <label className="text-xs text-text-secondary">
              Type
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 font-mono text-xs">
                {["TRACK_FRACTURE", "OHE_BREAKDOWN", "SIGNAL_FAILURE", "OTHER"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-secondary">
              Est. duration (min)
              <input type="number" min={15} max={1440} value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 font-mono text-xs" />
            </label>
            <div className="flex items-end">
              <ActionButton onClick={previewBlast}>⚡ Preview blast radius</ActionButton>
            </div>
          </div>
        </Card>

        {blast && (
          <Card title="Emergency Confirmation Modal — blast radius">
            <ul className="mb-2 list-disc pl-5 text-xs text-text-primary">
              <li>Trains currently held: <b>{blast.trains_held.length}</b></li>
              <li>Plans that will be superseded: <b>{blast.plans_superseded.length}</b></li>
              <li>Affected sections (incl. adjacent via feeding map): <b>{blast.affected_sections.length}</b></li>
            </ul>
            <label className="flex items-center gap-2 text-xs text-text-primary">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I acknowledge the blast radius above (API-001 modal). Advisory revocations will be issued by the
              Emergency Service; the re-plan is PROVISIONAL until I acknowledge it.
            </label>
            <div className="mt-3">
              <ActionButton onClick={fire} disabled={!confirmed} className="bg-status-blocked/25 text-status-blocked hover:bg-status-blocked/40">
                🚨 Fire emergency breakdown
              </ActionButton>
            </div>
          </Card>
        )}

        <Card title="Incidents & PROVISIONAL gate">
          <ul className="divide-y divide-border-subtle">
            {incidents.map((i) => (
              <li key={i.id ?? i.created_at} className="py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-text-primary">{i.section_code} · {i.incident_type}</span>
                  <span className="text-text-secondary">
                    {new Date(i.created_at).toISOString().slice(5, 16).replace("T", " ")}Z · est {i.estimated_duration_mins ?? "?"}m
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {i.coalesced_into_incident_id && (
                    <span className="rounded bg-status-caution/15 px-2 py-0.5 font-mono text-[10px] text-status-caution">
                      ⧉ coalesced into {i.coalesced_into_incident_id.slice(0, 8)}
                    </span>
                  )}
                  {i.controller_acknowledged ? (
                    <span className="rounded bg-status-active/15 px-2 py-0.5 font-mono text-[10px] text-status-active">
                      ✓ Controller acknowledged ({i.controller_ack_actor})
                    </span>
                  ) : (
                    <>
                      <StatusBadge status="PROVISIONAL" />
                      <ActionButton onClick={() => ack(i.id)}>Acknowledge as Controller</ActionButton>
                    </>
                  )}
                  {i.provisional_plan_id && (
                    <span className="font-mono text-[10px] text-text-secondary">plan {i.provisional_plan_id.slice(0, 8)}…</span>
                  )}
                </div>
              </li>
            ))}
            {incidents.length === 0 && <li className="py-6 text-center text-xs text-text-secondary">No incidents logged.</li>}
          </ul>
        </Card>
      </div>

      <div className="space-y-3 pt-6">
        <Card title="ADR-006 semantics">
          <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-text-secondary">
            <li>The Emergency Service (never Sentinel) issues advisory revocations via the outbox pattern.</li>
            <li>Optima runs a corridor-scoped re-plan within the 45 s budget.</li>
            <li>Sentinel's structural checks run synchronously — sub-second, never skipped (R6.4).</li>
            <li>The resulting plan is PROVISIONAL until the Chief Controller acknowledges it.</li>
            <li>Displaced routine blocks re-enter DRAFT through the full approval chain.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
};
