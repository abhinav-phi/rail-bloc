import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, StatusBadge, ActionButton } from "../components/common";

interface Summary {
  plan_counts: Record<string, number>;
  demand_counts: Record<string, number>;
  escalated_overdue: { external_ref_id: string; activity_code: string; urgency_score: number; section_code: string }[];
  machine_utilization: { machine: string; jobs: number; work_minutes: number }[];
  model_estimates: { predicted_pax_delay_minutes: number; predicted_frt_delay_minutes: number; note: string };
}

export const Dashboard: React.FC = () => {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    api.get<Summary>("/api/v1/plans/summary").then(setS).catch(() => undefined);
    const t = setInterval(() => api.get<Summary>("/api/v1/plans/summary").then(setS).catch(() => undefined), 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-text-primary">Divisional Overview</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card title="Active blocks">
          <p className="font-mono text-3xl font-bold text-status-blocked">
            {(s?.plan_counts["ACTIVE_GRANTED"] ?? 0) + (s?.plan_counts["TRANSMITTED_COA"] ?? 0)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">⛔ TRANSMITTED_COA + ACTIVE_GRANTED</p>
        </Card>
        <Card title="Predicted pax delay">
          <p className="font-mono text-3xl font-bold text-accent-civil">
            {Math.round(s?.model_estimates.predicted_pax_delay_minutes ?? 0)}
            <span className="text-sm"> min</span>
          </p>
          <p className="mt-1 text-xs text-text-secondary">{s?.model_estimates.note}</p>
        </Card>
        <Card title="Predicted freight detention">
          <p className="font-mono text-3xl font-bold text-accent-trd">
            {Math.round(s?.model_estimates.predicted_frt_delay_minutes ?? 0)}
            <span className="text-sm"> min</span>
          </p>
          <p className="mt-1 text-xs text-text-secondary">{s?.model_estimates.note}</p>
        </Card>
        <Card title="Escalated overdue">
          <p className={`font-mono text-3xl font-bold ${(s?.escalated_overdue.length ?? 0) > 0 ? "text-status-blocked" : "text-status-active"}`}>
            ✗ {s?.escalated_overdue.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-text-secondary">FSM-002 cap exhausted — human review required</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Overdue / Escalated demands (FSM-002)">
          {s && s.escalated_overdue.length > 0 ? (
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-text-secondary">
                <tr><th className="py-1">Ref</th><th>Activity</th><th>Section</th><th>Urgency</th></tr>
              </thead>
              <tbody className="text-status-caution">
                {s.escalated_overdue.map((d) => (
                  <tr key={d.external_ref_id} className="border-t border-border-subtle">
                    <td className="py-1">{d.external_ref_id}</td><td>{d.activity_code}</td>
                    <td>{d.section_code}</td><td>⚠ {d.urgency_score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-text-secondary">✓ none — no demand silently pending (AppFlow §3)</p>
          )}
        </Card>

        <Card title="Machine fleet utilization (VRP rosters)">
          {s && s.machine_utilization.length > 0 ? (
            <ul className="space-y-1 font-mono text-xs">
              {s.machine_utilization.map((m) => (
                <li key={m.machine} className="flex justify-between border-b border-border-subtle py-1">
                  <span>{m.machine}</span>
                  <span className="text-text-secondary">{m.jobs} jobs · {Math.round(m.work_minutes)} travel/work min recorded</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-secondary">No rosters yet — trigger a weekly solve.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Link to="/planner/weekly"><ActionButton>Open Weekly Planner</ActionButton></Link>
          </div>
        </Card>
      </div>

      <Card title="Plan lifecycle distribution">
        <div className="flex flex-wrap gap-2">
          {Object.entries(s?.plan_counts ?? {}).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 rounded border border-border-subtle px-2 py-1">
              <StatusBadge status={k} />
              <span className="font-mono text-sm font-bold text-text-primary">{v}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
