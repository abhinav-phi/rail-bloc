import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Card, StatusBadge } from "../components/common";

interface PlanRow {
  id: string;
  section_code: string;
  start_time: string;
  end_time: string;
  approval_status: string;
  revision_no: number;
  is_shadow_block: boolean;
}

/** FR-012 — 26-week rolling calendar: rows = sections, columns = weeks. */
export const Planner26Week: React.FC = () => {
  const [plans, setPlans] = useState<PlanRow[]>([]);

  useEffect(() => {
    api.get<PlanRow[]>("/api/v1/plans?horizon=STRATEGIC_26W&limit=500").then(setPlans).catch(() => undefined);
    api.get<PlanRow[]>("/api/v1/plans?horizon=WEEKLY&limit=500").then((w) =>
      setPlans((prev) => [...prev, ...w])
    ).catch(() => undefined);
  }, []);

  const weeks = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 26 }, (_, i) => {
      const s = new Date(now);
      s.setUTCDate(s.getUTCDate() - s.getUTCDay() + i * 7);
      return s;
    });
  }, []);

  const sections = useMemo(
    () => Array.from(new Set(plans.map((p) => p.section_code))).sort(),
    [plans]
  );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-text-primary">26-Week Rolling Calendar</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-bg-surface px-2 py-1 text-left text-text-secondary">Section</th>
                {weeks.map((w) => (
                  <th key={w.toISOString()} className="px-1 py-1 text-text-secondary">
                    W{w.toISOString().slice(5, 10)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <tr key={sec} className="border-t border-border-subtle">
                  <td className="sticky left-0 z-10 bg-bg-surface px-2 py-1 text-text-primary">{sec}</td>
                  {weeks.map((w) => {
                    const weekEnd = new Date(w);
                    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
                    const cell = plans.filter(
                      (p) =>
                        p.section_code === sec &&
                        new Date(p.start_time) < weekEnd &&
                        new Date(p.end_time) >= w
                    );
                    return (
                      <td key={w.toISOString()} className="border-l border-border-subtle/40 px-0.5 py-1 align-top">
                        {cell.slice(0, 2).map((p) => (
                          <div key={p.id} title={`${p.approval_status} rev${p.revision_no}`}>
                            <StatusBadge status={p.approval_status} />
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {sections.length === 0 && (
                <tr><td className="px-2 py-6 text-center text-text-secondary" colSpan={27}>
                  No strategic plans yet — trigger a STRATEGIC_26W solve from the weekly planner.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
