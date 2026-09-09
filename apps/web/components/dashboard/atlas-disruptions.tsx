'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePersona } from '@/context/persona-context';
import { AtlasWeather } from '@/components/dashboard/atlas-weather';
import { AlertTriangle, CheckCircle2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/shared/loading';

/* ── API shapes (verified against live backend 2026-09-05) ──────────── */

interface BlastRadius {
  // Emergency service returns the affected corridor preview; shape may vary by
  // backend version — we render defensively from whatever arrives.
  affected?: unknown[];
  [k: string]: unknown;
}

interface Incident {
  id: string;
  section_id: string;
  incident_type: string;
  reported_by: string;
  estimated_duration_mins: number;
  coalesced_into_incident_id: string | null;
  controller_acknowledged: boolean;
  created_at?: string;
}

interface SectionRow {
  section_code: string;
  division: string;
  start_km: number;
  end_km: number;
}

const BREAKDOWN_TYPES = [
  'TRACK_FRACTURE',
  'OHE_BREAKDOWN',
  'SIGNAL_FAILURE',
  'OTHER',
] as const;

/** Human labels for the API codes — the payload always carries the code. */
const BREAKDOWN_LABELS: Record<string, string> = {
  TRACK_FRACTURE: 'Track crack',
  OHE_BREAKDOWN: 'Power line fault',
  SIGNAL_FAILURE: 'Signal failure',
  OTHER: 'Other',
};

/** Seed-fixed corridor sections (data/generators/corridor_gen.py, seed 42).
 * The live DB is seeded from this exact set, so a client-side list is honest;
 * value stays the section CODE (the drill API accepts it), never a UUID. */
const CORRIDOR_SECTIONS = [
  'NDLS-GZB-UP',
  'NDLS-GZB-DN',
  'GZB-ALJN-UP',
  'GZB-ALJN-DN',
  'GZB-ALJN-3L',
  'ALJN-TDL-UP',
  'ALJN-TDL-DN',
  'TDL-ETW-UP',
  'TDL-ETW-DN',
  'TDL-ETW-3L',
  'ETW-CNB-UP',
  'ETW-CNB-DN',
];

/** Short corridor label for copy — 'GZB-ALJN-UP' → 'GZB–ALJN'. */
function shortCorridor(code: string): string {
  const parts = code.replace(/-(UP|DN|3L)$/, '').split('-');
  return parts.join('–');
}

/** Drill form stores the section code; some older payloads may carry a UUID.
 * For display we map back to the corridor label when possible. */
function codeOf(sectionId: string): string {
  if (CORRIDOR_SECTIONS.includes(sectionId)) return sectionId;
  return sectionId.slice(0, 8) || '—';
}

/** Defensive human summary from whatever blast fields arrive. Never crashes on
 * a shape change — worst case 'N items affected'. */
function blastSummary(blast: BlastRadius, corridor: string): string {
  try {
    const affected = Array.isArray(blast.affected) ? blast.affected : [];
    if (affected.length === 0 && !blast.affected) {
      // unknown shape: count any array-looking member
      const arrays = Object.values(blast).filter((v) => Array.isArray(v));
      if (arrays.length) {
        const n = (arrays as unknown[][]).reduce(
          (acc: number, a) => acc + a.length,
          0,
        );
        return `${n} items affected on corridor ${corridor}.`;
      }
    }
    const held = affected.filter(
      (x) =>
        typeof x === 'object' && x !== null && 'train_number' in (x as object),
    ).length;
    const paused = affected.length - held;
    const corridorPart = `corridor ${corridor}`;
    if (held || paused) {
      return `${held || 0} trains held · ${paused || 0} plans paused · ${corridorPart}.`;
    }
    return `${affected.length} items affected on ${corridorPart}.`;
  } catch {
    return 'Impact check complete — review the technical preview below.';
  }
}

export function AtlasDisruptions() {
  const { persona } = usePersona();
  const [sections, setSections] = useState<SectionRow[] | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [ackBusy, setAckBusy] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string>('');
  const [type, setType] =
    useState<(typeof BREAKDOWN_TYPES)[number]>('TRACK_FRACTURE');
  const [duration, setDuration] = useState(90);
  const [blast, setBlast] = useState<BlastRadius | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isController =
    persona?.role === 'CHIEF_CONTROLLER' || persona?.role === 'ADMIN';

  const ackIncident = useCallback(async (incidentId: string) => {
    setAckBusy(incidentId);
    setError(null);
    try {
      await api.post(
        `/api/v1/emergency/incidents/${incidentId}/acknowledge`,
        {},
      );
      setIncidents(
        (prev) =>
          prev?.map((i) =>
            i.id === incidentId ? { ...i, controller_acknowledged: true } : i,
          ) ?? prev,
      );
      setResult(
        'Approved. The diversion plan is now authoritative and can be transmitted.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAckBusy(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const rows = await api.get<SectionRow[]>(
        '/api/v1/plans/geo?division=DLI',
      );
      // geo returns corridor geometry; fall back to a static section list if shape differs
      const secs = Array.isArray(rows) ? [] : [];
      void secs;
    } catch {
      /* geo may be auditor-scoped — the drill works from any section id */
    }
    try {
      const inc = await api.get<Incident[]>('/api/v1/emergency/incidents');
      setIncidents(inc);
    } catch {
      setIncidents([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewBlast = async () => {
    setError(null);
    setBlast(null);
    setAcknowledged(false);
    try {
      const r = await api.get<BlastRadius>(
        `/api/v1/emergency/blast-radius?section_id=${encodeURIComponent(sectionId)}&estimated_duration_mins=${duration}`,
      );
      setBlast(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const fire = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{
        incident_id?: string;
        coalesced_into?: string;
      }>('/api/v1/emergency/breakdown', {
        section_id: sectionId,
        breakdown_type: type,
        estimated_duration_mins: duration,
        confirmation: acknowledged,
        idempotency_key: `drill-${sectionId}-${Date.now()}`,
      });
      setResult(
        `Drill started. Waiting for Controller approval below. (incident ${r.incident_id?.slice(0, 8) ?? 'queued'})`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="atlas-section-label mb-2">08 / DISRUPTIONS</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Emergency drill
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Check impact → confirm → Controller approves. Takes under a minute.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            P0 drill: blast-radius preview → explicit confirmation → PROVISIONAL
            plan with Sentinel&apos;s synchronous structural re-check (≤45 s,
            SAFE-003) → Controller acknowledgment gate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Radio
            size={14}
            aria-hidden="true"
            className={cn(
              isController
                ? 'text-[color:var(--atlas-success)]'
                : 'text-[color:var(--atlas-warning)]',
            )}
          />
          <span
            className={cn(
              'atlas-badge',
              isController
                ? 'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]'
                : 'border-[color:var(--atlas-warning-ring)] bg-[color:var(--atlas-warning-bg)] text-[color:var(--atlas-warning)]',
            )}
          >
            {isController
              ? 'You are Controller — drill unlocked'
              : 'Switch to Controller to fire'}
          </span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Drill form */}
        <div className="atlas-card p-5">
          <h2 className="atlas-card-title mb-4">Report a breakdown</h2>

          <label
            className="mb-1 block text-xs font-medium text-foreground"
            htmlFor="sec"
          >
            Section
          </label>
          <select
            id="sec"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">Pick a section</option>
            {CORRIDOR_SECTIONS.map((code) => (
              <option key={code} value={code}>
                {shortCorridor(code)}
                {CORRIDOR_SECTIONS.indexOf(code) === 0 ? '' : ''}
              </option>
            ))}
          </select>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-xs font-medium text-foreground"
                htmlFor="type"
              >
                What broke
              </label>
              <select
                id="type"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                {BREAKDOWN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BREAKDOWN_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-foreground"
                htmlFor="dur"
              >
                Needed time (minutes)
              </label>
              <input
                id="dur"
                type="number"
                min={1}
                max={1440}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!sectionId}
              onClick={() => void previewBlast()}
              className="atlas-btn-secondary atlas-btn text-sm"
            >
              1 · Check impact
            </button>
            <button
              type="button"
              data-action="true"
              disabled={!acknowledged || busy || !sectionId}
              onClick={() => void fire()}
              className="atlas-btn-danger atlas-btn text-sm"
              title="Gated on the blast-radius acknowledgment (API-001)"
            >
              {busy ? 'Firing…' : '2 · Start drill'}
            </button>
          </div>

          {/* Blast-radius preview + acknowledgment gate (API-001) */}
          {blast ? (
            <div className="mt-4 rounded-lg border border-[color:var(--atlas-warning-ring)] bg-[color:var(--atlas-warning-bg)] p-3 text-xs">
              <p className="mb-1 font-semibold text-[color:var(--atlas-warning)]">
                Impact check (synchronous, read-only)
              </p>
              <p className="text-sm font-medium text-foreground">
                {blastSummary(blast, shortCorridor(codeOf(sectionId)))}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  Technical preview
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                  {JSON.stringify(blast, null, 1)}
                </pre>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Firing supersedes affected plans and generates a PROVISIONAL
                  diversion plan — never treated as authoritative until the
                  Controller acknowledges.
                </p>
              </details>
              <label className="mt-2 flex items-start gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I checked the impact above. Starting pauses the affected
                  plans.
                </span>
              </label>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-[color:var(--atlas-danger-ring)] bg-[color:var(--atlas-danger-bg)] px-3 py-2 text-xs text-[color:var(--atlas-danger)]/40"
            >
              {error}
            </div>
          ) : null}

          {result ? (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-lg border border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] px-3 py-2 text-xs text-[color:var(--atlas-success)]/40"
            >
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              {result}
            </div>
          ) : null}
        </div>

        {/* Incidents */}
        <div className="atlas-card overflow-hidden">
          <div className="atlas-card-header">
            <h2 className="atlas-card-title">Incidents</h2>
            <span className="atlas-badge border-border text-muted-foreground">
              {incidents === null ? (
                <Skeleton className="h-3 w-14" />
              ) : (
                `${incidents.length} total`
              )}
            </span>
          </div>
          {incidents === null ? (
            <div className="grid gap-3 p-5">
              <Skeleton rows={1} className="h-5" />
              <Skeleton rows={1} className="h-5" />
              <Skeleton rows={1} className="h-5" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="atlas-empty-state m-5">
              <AlertTriangle size={18} />
              No incidents — the corridor is clean.
            </div>
          ) : (
            <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
              {incidents.slice(0, 20).map((i) => (
                <li key={i.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {BREAKDOWN_LABELS[i.incident_type] ?? i.incident_type}
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {i.incident_type}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'atlas-badge',
                        i.controller_acknowledged
                          ? 'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]/60'
                          : 'border-[color:var(--atlas-warning-ring)] bg-[color:var(--atlas-warning-bg)] text-[color:var(--atlas-warning)]/60',
                      )}
                    >
                      {i.controller_acknowledged
                        ? 'approved'
                        : 'Waiting for approval'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    section {i.section_id.slice(0, 8)}… ·{' '}
                    {i.estimated_duration_mins} min · reported by{' '}
                    {i.reported_by}
                    {i.coalesced_into_incident_id ? (
                      <span
                        title={`grouped into ${i.coalesced_into_incident_id}`}
                      >
                        {' '}
                        · Grouped with another report
                      </span>
                    ) : null}
                  </p>
                  {!i.controller_acknowledged ? (
                    <button
                      type="button"
                      data-action="true"
                      disabled={!isController || ackBusy === i.id}
                      onClick={() => void ackIncident(i.id)}
                      title={
                        isController
                          ? 'Record Controller acknowledgment — PROVISIONAL becomes authoritative'
                          : 'CONTROLLER role required (demo: A. P. Singh)'
                      }
                      className="atlas-btn-primary atlas-btn mt-2 text-xs"
                    >
                      {ackBusy === i.id
                        ? 'Approving…'
                        : 'Approve as Controller'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Weather — G&SR-3 fail-closed storytelling (audit RANK 9), compact for scan speed */}
      <div className="mt-5">
        <AtlasWeather compact />
      </div>
    </div>
  );
}
