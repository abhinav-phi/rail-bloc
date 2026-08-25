import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Card, StatusBadge } from "../components/common";

interface TT {
  train_number: string;
  train_type: string;
  priority_rank: number;
  entry: string;
  exit: string;
  start_km: number;
  end_km: number;
  section_code: string;
}
interface BlockBand {
  id: string;
  code: string;
  status: string;
  shadow: boolean;
  start: string;
  end: string;
}

const TRAIN_COLORS: Record<string, string> = {
  VANDE_RAJDHANI: "#8B5CF6",
  MAIL_EXP: "#3B82F6",
  PASSENGER: "#64748B",
  FREIGHT: "#F59E0B",
};

/** FR-020 — HTML5 Canvas time-distance chart: X = km (0–250), Y = 24 h.
 *  Dual-axis pan/zoom; train slopes; block bands with diagonal stripes for
 *  multi-department shadow blocks. FPS is a target until profiled (PERF-003). */
export const StringChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ km0: 0, km1: 250, hour0: 0, hour1: 24 });
  const drag = useRef<{ x: number; y: number; v: typeof view.current } | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [bands, setBands] = useState<BlockBand[]>([]);

  useEffect(() => {
    interface WeeklyApiPlan {
      id: string; section_code: string; approval_status: string;
      is_shadow_block: boolean; start_time: string; end_time: string;
    }
    api.get<WeeklyApiPlan[]>("/api/v1/plans/weekly").then((plans) =>
      setBands(
        plans.map((p) => ({
          id: p.id,
          code: p.section_code,
          status: p.approval_status,
          shadow: p.is_shadow_block,
          start: p.start_time,
          end: p.end_time,
        }))
      )
    ).catch(() => undefined);
  }, [dayOffset]);

  useEffect(() => {
    let rows: TT[] = [];
    api.get<TT[]>("/api/v1/plans/timetable").then((r) => { rows = r; draw(); }).catch(() => undefined);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const xOf = (km: number, w: number) => ((km - view.current.km0) / (view.current.km1 - view.current.km0)) * w;
    const yOf = (h: number, height: number) => height - ((h - view.current.hour0) / (view.current.hour1 - view.current.hour0)) * height;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0B111E";
      ctx.fillRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = "#2D3748";
      ctx.fillStyle = "#94A3B8";
      ctx.font = "10px monospace";
      for (let km = 0; km <= 250; km += 25) {
        if (km < view.current.km0 || km > view.current.km1) continue;
        const x = xOf(km, w);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillText(`${km}km`, x + 2, h - 4);
      }
      for (let hh = Math.ceil(view.current.hour0); hh <= view.current.hour1; hh += 2) {
        const y = yOf(hh, h);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.fillText(`${String(hh).padStart(2, "0")}:00`, 2, y - 2);
      }

      // block bands (semi-transparent; striped when shadow)
      const dayBase = new Date();
      dayBase.setUTCHours(0, 0, 0, 0);
      dayBase.setUTCDate(dayBase.getUTCDate() + dayOffset);
      for (const b of bands) {
        const s = new Date(b.start), e = new Date(b.end);
        const hs = (s.getTime() - dayBase.getTime()) / 3600000;
        const he = (e.getTime() - dayBase.getTime()) / 3600000;
        if (he < view.current.hour0 || hs > view.current.hour1) continue;
        // section_code → km span via anchors lookup by prefix match on the seeded chain
        const span = kmSpanForSection(b.code);
        const x0 = xOf(span[0], w), x1 = xOf(span[1], w);
        const y0 = yOf(hs, h), y1 = yOf(Math.max(he, hs + 0.02), h);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = b.status === "ACTIVE_GRANTED" ? "#DC2626" : b.status === "PROVISIONAL" ? "#8B5CF6" : "#D97706";
        ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
        if (b.shadow) {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = "#10B981";
          ctx.lineWidth = 1;
          for (let xx = x0 - (y0 - y1); xx < x1; xx += 8) {
            ctx.beginPath(); ctx.moveTo(xx, y1); ctx.lineTo(xx + (y0 - y1), y0); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = b.status === "PROVISIONAL" ? "#8B5CF6" : "#DC2626";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0, y1, x1 - x0, y0 - y1);
        ctx.fillStyle = "#F8FAFC"; ctx.font = "9px monospace";
        ctx.fillText(b.code.slice(0, 12), x0 + 2, y1 + 10);
      }

      // train trajectories
      dayBase.setUTCHours(0, 0, 0, 0);
      for (const r of rows) {
        const entryH = hoursFromDayBase(r.entry, dayBase);
        const exitH = hoursFromDayBase(r.exit, dayBase);
        if (exitH < view.current.hour0 || entryH > view.current.hour1) continue;
        ctx.strokeStyle = TRAIN_COLORS[r.train_type] ?? "#94A3B8";
        ctx.lineWidth = r.priority_rank <= 3 ? 2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(xOf(r.start_km, w), yOf(entryH, h));
        ctx.lineTo(xOf(r.end_km, w), yOf(exitH, h));
        ctx.stroke();
        if (r.priority_rank === 1) {
          ctx.fillStyle = TRAIN_COLORS[r.train_type];
          ctx.fillText(r.train_number, xOf(r.start_km, w) + 3, yOf(entryH, h) - 3);
        }
      }
    }

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const fx = (ev.clientX - rect.left) / rect.width;
      const fy = (ev.clientY - rect.top) / rect.height;
      const v = view.current;
      if (ev.ctrlKey || ev.shiftKey) {
        const scale = ev.deltaY > 0 ? 1.15 : 0.87;
        const mid = v.hour0 + fy * (v.hour1 - v.hour0);
        v.hour0 = clamp(mid - (mid - v.hour0) * scale, 0, 24);
        v.hour1 = clamp(mid + (v.hour1 - mid) * scale, 0, 24);
      } else {
        const scale = ev.deltaY > 0 ? 1.15 : 0.87;
        const mid = v.km0 + fx * (v.km1 - v.km0);
        v.km0 = clamp(mid - (mid - v.km0) * scale, 0, 250);
        v.km1 = clamp(mid + (v.km1 - mid) * scale, 0, 250);
      }
      draw();
    };
    const onDown = (ev: MouseEvent) => {
      drag.current = { x: ev.clientX, y: ev.clientY, v: { ...view.current } };
    };
    const onMove = (ev: MouseEvent) => {
      if (!drag.current) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((ev.clientX - drag.current.x) / rect.width) * (drag.current.v.km1 - drag.current.v.km0);
      const dy = ((ev.clientY - drag.current.y) / rect.height) * (drag.current.v.hour1 - drag.current.v.hour0);
      view.current.km0 = clamp(drag.current.v.km0 - dx, 0, 250);
      view.current.km1 = clamp(drag.current.v.km1 - dx, 0, 250);
      view.current.hour0 = clamp(drag.current.v.hour0 + dy, 0, 24);
      view.current.hour1 = clamp(drag.current.v.hour1 + dy, 0, 24);
      draw();
    };
    const onUp = () => { drag.current = null; };
    const onHover = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const km = view.current.km0 + ((ev.clientX - rect.left) / rect.width) * (view.current.km1 - view.current.km0);
      setTooltip(`KM ${km.toFixed(1)} — hover tooltips active`);
    };

    canvas.addEventListener("wheel", onWheel);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("mousemove", onHover);
    window.addEventListener("resize", draw);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mousemove", onHover);
      window.removeEventListener("resize", draw);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands, dayOffset]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">Time-Distance String Chart</h2>
        <div className="flex gap-2">
          <button className="rounded border border-border-subtle px-2 py-1 text-xs text-text-secondary" onClick={() => setDayOffset(dayOffset - 1)}>◀ prev day</button>
          <button className="rounded border border-border-subtle px-2 py-1 text-xs text-text-secondary" onClick={() => setDayOffset(0)}>today</button>
          <button className="rounded border border-border-subtle px-2 py-1 text-xs text-text-secondary" onClick={() => setDayOffset(dayOffset + 1)}>next day ▶</button>
        </div>
      </div>
      <canvas ref={canvasRef} data-testid="string-chart" className="h-[65vh] w-full rounded-lg border border-border-subtle" />
      <Card title="Legend">
        <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
          <span><span className="mr-1 inline-block h-1 w-4 bg-[#8B5CF6]" /> Vande/Rajdhani (rank ≤ 2)</span>
          <span><span className="mr-1 inline-block h-1 w-4 bg-[#3B82F6]" /> Mail/Express</span>
          <span><span className="mr-1 inline-block h-1 w-4 bg-[#F59E0B]" /> Freight</span>
          <span><span className="mr-1 inline-block h-2 w-4 bg-status-caution/30 border border-status-blocked" /> Block band</span>
          <span><span className="mr-1 inline-block h-2 w-4 bg-status-caution/30 striped" /> Shadow bundle (striped)</span>
          <span>scroll = zoom · drag = pan · ctrl+scroll = time zoom</span>
          {tooltip && <span className="font-mono">{tooltip}</span>}
        </div>
      </Card>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function hoursFromDayBase(iso: string, dayBase: Date): number {
  return (new Date(iso).getTime() - dayBase.getTime()) / 3600000;
}

function kmSpanForSection(code: string): [number, number] {
  const spans: Record<string, [number, number]> = {
    "NDLS-GZB-UP": [0, 24.5], "NDLS-GZB-DN": [0, 24.5],
    "GZB-ALJN-UP": [24.5, 68.2], "GZB-ALJN-DN": [24.5, 68.2], "GZB-ALJN-3L": [24.5, 68.2],
    "ALJN-TDL-UP": [68.2, 118], "ALJN-TDL-DN": [68.2, 118],
    "TDL-ETW-UP": [118, 205], "TDL-ETW-DN": [118, 205], "TDL-ETW-3L": [118, 205],
    "ETW-CNB-UP": [205, 250], "ETW-CNB-DN": [205, 250],
  };
  return spans[code] ?? [0, 250];
}
