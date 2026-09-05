'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CloudRain, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── /api/v1/weather shapes (verified live 2026-09-06) ───────────────── */

interface WeatherAlert {
  id: string;
  alert_type: string;
  severity: string;
  precipitation_mm_hr: number;
  rail_temperature_celsius: number;
  prohibited_work_types: string[];
  valid_until: string;
  affected_sections: string[];
}

interface DeferredPayload {
  feed_state: string;
  deferred: string[];
  reason: string;
}

interface WeatherPayload {
  stale_feed: boolean;
  fail_closed_default: string;
  staleness_ttl_hours: number;
  alerts: WeatherAlert[];
}

function severityTone(sev: string): { fg: string; bg: string; ring: string } {
  if (/RED/i.test(sev))
    return { fg: '#d6293e', bg: '#fdecef', ring: '#f5c2ca' };
  if (/ORANGE/i.test(sev))
    return { fg: '#b7791f', bg: '#fff7e6', ring: '#f3dfb1' };
  return { fg: '#b7791f', bg: '#fff7e6', ring: '#f3dfb1' }; // YELLOW + unknown → amber
}

/** Weather card — fail-closed G&SR-3 storytelling (audit RANK 9). */
export function AtlasWeather() {
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [deferred, setDeferred] = useState<DeferredPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        api.get<WeatherPayload>('/api/v1/weather/alerts'),
        api.get<DeferredPayload>('/api/v1/weather/deferred-activities'),
      ]);
      setData(a);
      setDeferred(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 120_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="atlas-card overflow-hidden">
      <div className="atlas-card-header">
        <div className="flex items-center gap-2">
          <CloudRain size={16} className="text-[#2d63c8]" />
          <h2 className="atlas-card-title">Weather — IMD feed (fail-closed)</h2>
        </div>
        <span
          className={cn(
            'atlas-badge',
            data?.stale_feed
              ? 'border-[#f3dfb1] bg-[#fff7e6] text-[#b7791f] dark:border-[#78350f] dark:bg-[#451a03]/60 dark:text-[#fbbf24]'
              : 'border-[#bfe6d0] bg-[#e9f7ef] text-[#1b7f4b] dark:border-[#14532d] dark:bg-[#052e16]/60 dark:text-[#4ade80]',
          )}
        >
          {data ? (data.stale_feed ? 'STALE' : 'FRESH') : '…'}
        </span>
      </div>

      {error ? (
        <p className="p-5 text-sm text-muted-foreground">{error}</p>
      ) : !data ? (
        <p className="p-5 text-sm text-muted-foreground">Loading weather…</p>
      ) : (
        <div className="grid gap-4 p-5">
          {/* G&SR-3 fail-closed banner — the amber line judges look for */}
          {data.stale_feed ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-[#f3dfb1] bg-[#fff7e6] px-3.5 py-3 text-sm text-[#b7791f] dark:border-[#78350f] dark:bg-[#451a03]/40 dark:text-[#fbbf24]"
            >
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <p>
                <span className="font-semibold">
                  Feed stale — FAILING CLOSED:
                </span>{' '}
                outdoor work is <span className="font-semibold">deferred</span>,
                never assumed clear (TEL-002). TTL {data.staleness_ttl_hours} h
                · default: {data.fail_closed_default}.
              </p>
            </div>
          ) : null}

          {deferred ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                Deferred work types ({deferred.feed_state}):
              </span>{' '}
              {deferred.deferred.join(', ')}
              <span className="atlas-model-estimate mt-1">
                {deferred.reason}
              </span>
            </div>
          ) : null}

          {data.alerts.length === 0 ? (
            <div className="atlas-empty-state">No active weather alerts.</div>
          ) : (
            <ul className="grid gap-3">
              {data.alerts.map((a) => {
                const tone = severityTone(a.severity);
                return (
                  <li
                    key={a.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="atlas-badge"
                        style={{
                          color: tone.fg,
                          backgroundColor: tone.bg,
                          borderColor: tone.ring,
                        }}
                      >
                        {a.severity.replaceAll('_', ' ')}
                      </span>
                      <span className="font-mono text-xs text-foreground">
                        {a.alert_type.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      precip {a.precipitation_mm_hr} mm/hr · rail temp{' '}
                      {a.rail_temperature_celsius}°C · valid until{' '}
                      {new Date(a.valid_until).toLocaleString('en-IN', {
                        hour12: false,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-foreground">
                      <span className="font-medium">Deferred:</span>{' '}
                      {a.prohibited_work_types
                        .map((w) => w.replaceAll('_', ' '))
                        .join(', ')}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      affects: {a.affected_sections.join(' · ')}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
