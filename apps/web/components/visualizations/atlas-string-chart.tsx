'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '@/lib/api';

/* ── /api/v1/plans/timetable shape (verified live 2026-09-06) ───────── */

interface TrainPath {
  train_number: string;
  train_type: string;
  priority_rank: number;
  source: string;
  entry: string;
  exit: string;
  start_km: number;
  end_km: number;
  section_code: string;
}

interface PlanRow {
  id: string;
  section_code: string;
  plan_horizon: string;
  start_time: string;
  end_time: string;
  approval_status: string;
  is_shadow_block: boolean;
  revision_no: number;
}

const TYPE_COLOR: Record<string, string> = {
  PREMIUM: '#8b5cf6', // Vande Bharat / Rajdhani
  EXPRESS: '#3b82f6', // Mail / Express
  PASSENGER: '#f59e0b', // Passenger
  FREIGHT: '#f59e0b',
};

function colorFor(train: TrainPath): string {
  if (train.source === 'FOIS_FORECAST') return 'rgba(245, 158, 11, 0.55)';
  return TYPE_COLOR[train.train_type] ?? '#3b82f6';
}

/** String Chart — REAL timetable paths (/plans/timetable, 276 paths) +
 *  real plan blocks (/plans) with shadow-stripes. Replaces the demo canvas. */
export function AtlasStringChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [trains, setTrains] = useState<TrainPath[] | null>(null);
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [section, setSection] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const pathsRef = useRef<
    { x1: number; y1: number; x2: number; y2: number; label: string }[]
  >([]);

  const load = useCallback(async () => {
    try {
      const [tt, pl] = await Promise.all([
        api.get<TrainPath[]>('/api/v1/plans/timetable'),
        api.get<PlanRow[]>('/api/v1/plans?limit=500'),
      ]);
      setTrains(tt);
      setPlans(pl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    if (!trains) return [];
    return Array.from(new Set(trains.map((t) => t.section_code))).sort();
  }, [trains]);

  const activeSection = section || sections[0] || '';

  const sectionTrains = useMemo(
    () => (trains ?? []).filter((t) => t.section_code === activeSection),
    [trains, activeSection],
  );
  const sectionPlans = useMemo(
    () => (plans ?? []).filter((p) => p.section_code === activeSection),
    [plans, activeSection],
  );

  /** Compute the 24h window: earliest entry → latest exit in this section. */
  const window24 = useMemo(() => {
    if (sectionTrains.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    let minKm = Infinity;
    let maxKm = -Infinity;
    for (const t of sectionTrains) {
      const e = new Date(t.entry).getTime();
      const x = new Date(t.exit).getTime();
      if (e < min) min = e;
      if (x > max) max = x;
      minKm = Math.min(minKm, t.start_km);
      maxKm = Math.max(maxKm, t.end_km);
    }
    for (const p of sectionPlans) {
      const s = new Date(p.start_time).getTime();
      const en = new Date(p.end_time).getTime();
      min = Math.min(min, s);
      max = Math.max(max, en);
    }
    return { min, max, minKm, maxKm };
  }, [sectionTrains, sectionPlans]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !window24 || sectionTrains.length === 0) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? 1000;
    const height = parent?.clientHeight ?? 600;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { min, max, minKm, maxKm } = window24;
    const span = Math.max(1, max - min);
    const kmSpan = Math.max(1, maxKm - minKm);
    const padL = 44;
    const padB = 26;
    const plotW = width - padL - 10;
    const plotH = height - 14 - padB;
    const x = (t: number) => padL + ((t - min) / span) * plotW;
    const y = (km: number) => 14 + (1 - (km - minKm) / kmSpan) * plotH;

    // Background
    ctx.fillStyle =
      getComputedStyle(canvas).colorScheme === 'dark' ? '#181020' : '#faf7f2';
    ctx.fillRect(0, 0, width, height);

    // Grid: hours on X, km on Y
    ctx.strokeStyle = 'rgba(120, 110, 125, 0.25)';
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, monospace';
    const hours = new Date(min);
    hours.setMinutes(0, 0, 0);
    for (let t = hours.getTime(); t <= max; t += 3_600_000) {
      const xx = x(t);
      ctx.beginPath();
      ctx.moveTo(xx, 14);
      ctx.lineTo(xx, 14 + plotH);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120, 110, 125, 0.9)';
      const hh = new Date(t).getHours();
      ctx.fillText(`${String(hh).padStart(2, '0')}:00`, xx - 12, height - 8);
    }
    for (let km = minKm; km <= maxKm; km += kmSpan > 60 ? 20 : 5) {
      const yy = y(km);
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(width - 10, yy);
      ctx.stroke();
      ctx.fillText(`${Math.round(km)}km`, 6, yy + 3);
    }

    // Plan blocks (behind train lines) — striped when shadow bundle
    pathsRef.current = [];
    for (const p of sectionPlans) {
      const sx = x(new Date(p.start_time).getTime());
      const ex = x(new Date(p.end_time).getTime());
      const yTop = y(maxKm);
      const yBot = y(minKm);
      ctx.fillStyle = p.is_shadow_block
        ? 'rgba(140, 63, 131, 0.25)'
        : 'rgba(21, 16, 39, 0.14)';
      ctx.fillRect(sx, yTop, Math.max(2, ex - sx), yBot - yTop);
      if (p.is_shadow_block) {
        // diagonal stripes overlay
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx, yTop, Math.max(2, ex - sx), yBot - yTop);
        ctx.clip();
        ctx.strokeStyle = 'rgba(140, 63, 131, 0.5)';
        ctx.lineWidth = 1;
        for (let s = sx - (yBot - yTop); s < ex; s += 7) {
          ctx.beginPath();
          ctx.moveTo(s, yBot);
          ctx.lineTo(s + (yBot - yTop), yTop);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(140, 63, 131, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, yTop, Math.max(2, ex - sx), yBot - yTop);
    }

    // Real train strings: entry(km start, time) → exit(km end, time)
    for (const t of sectionTrains) {
      const x1 = x(new Date(t.entry).getTime());
      const y1 = y(t.start_km);
      const x2 = x(new Date(t.exit).getTime());
      const y2 = y(t.end_km);
      pathsRef.current.push({
        x1,
        y1,
        x2,
        y2,
        label: `${t.train_number} · ${t.train_type} · ${t.source}`,
      });
      ctx.strokeStyle = colorFor(t);
      ctx.lineWidth = t.priority_rank <= 2 ? 2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, [sectionTrains, sectionPlans, window24]);

  const onHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: { d: number; label: string; x: number; y: number } | null = null;
    for (const p of pathsRef.current) {
      // point-to-segment distance
      const dx = p.x2 - p.x1;
      const dy = p.y2 - p.y1;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((mx - p.x1) * dx + (my - p.y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = p.x1 + t * dx;
      const py = p.y1 + t * dy;
      const d = Math.hypot(mx - px, my - py);
      if (!best || d < best.d) best = { d, label: p.label, x: px, y: py };
    }
    setHover(
      best && best.d < 8 ? { x: best.x, y: best.y, label: best.label } : null,
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2.5">
        <label className="flex items-center gap-2 text-xs text-foreground">
          Section
          <select
            className="rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs"
            value={activeSection}
            onChange={(e) => setSection(e.target.value)}
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <span className="font-mono text-[11px] text-muted-foreground">
          {sectionTrains.length} real train paths · {sectionPlans.length} plan
          blocks · legend: <span style={{ color: '#8b5cf6' }}>■</span> premium{' '}
          <span style={{ color: '#3b82f6' }}>■</span> express{' '}
          <span style={{ color: '#f59e0b' }}>■</span> pass/freight{' '}
          <span className="atlas-stripes-shadow inline-block h-3 w-6 rounded border border-border" />{' '}
          shadow bundle
        </span>
      </div>

      {error ? (
        <div role="alert" className="atlas-alert-danger m-4 px-3 py-2 text-xs">
          {error}
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ colorScheme: 'dark' }}
          onMouseMove={onHover}
          onMouseLeave={() => setHover(null)}
        />
        {hover ? (
          <div
            className="atlas-card pointer-events-none absolute z-10 px-2 py-1 font-mono text-[11px] text-foreground"
            style={{ left: hover.x + 12, top: hover.y + 8 }}
          >
            {hover.label}
          </div>
        ) : null}
      </div>
    </div>
  );
}
