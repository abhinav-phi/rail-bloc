'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/* ── /api/v1/plans/geo shapes (verified live 2026-09-06) ─────────────── */

interface GeoFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

interface GeoBundle {
  sections: GeoFeature[];
  blocks: GeoFeature[];
  ohe: GeoFeature[];
}

type LayerKey = 'sections' | 'blocks' | 'ohe';

const LAYER_META: { key: LayerKey; label: string; color: string }[] = [
  { key: 'sections', label: 'Sections (blocked = red)', color: '#3b82f6' },
  { key: 'blocks', label: 'Maintenance blocks', color: '#ef4444' },
  { key: 'ohe', label: 'OHE feeding boundaries', color: '#22d3ee' },
];

/** Corridor Map — REAL data from /api/v1/plans/geo via MapLibre GeoJSON
 *  sources. Replaces the old demo-tiles-only view (audit P1 #2). */
export function AtlasCorridorMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [bundle, setBundle] = useState<GeoBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    sections: true,
    blocks: true,
    ohe: true,
  });
  const [popupInfo, setPopupInfo] = useState<string | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const load = useCallback(async () => {
    try {
      const d = await api.get<GeoBundle>('/api/v1/plans/geo');
      setBundle(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Map lifecycle: init once, then (re)load sources whenever bundle changes.
  useEffect(() => {
    if (!containerRef.current || !bundle) return;
    let cancelled = false;
    let map: Record<string, unknown> | null = null;

    (async () => {
      const maplibregl = await import('maplibre-gl');

      if (cancelled || !containerRef.current) return;
      if (!mapRef.current) {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: 'https://demotiles.maplibre.org/style.json',
          center: [77.9, 28.75],
          zoom: 8.2,
        }) as unknown as Record<string, unknown>;
        mapRef.current = map;
        const nav = new maplibregl.NavigationControl();
        (map as { addControl: (c: unknown) => void }).addControl(nav);
      } else {
        map = mapRef.current as Record<string, unknown>;
      }

      const on = map as {
        on: (ev: string, cb: (e: unknown) => void) => void;
        getSource: (
          id: string,
        ) => { setData?: (d: unknown) => void } | undefined;
        addSource: (id: string, cfg: unknown) => void;
        addLayer: (cfg: unknown) => void;
        getLayer: (id: string) => unknown;
      };

      const apply = () => {
        if (cancelled) return;
        for (const key of ['sections', 'blocks', 'ohe'] as const) {
          const data: unknown = {
            type: 'FeatureCollection',
            features: bundle[key],
          };
          if (on.getSource(key)) {
            on.getSource(key)?.setData?.(data);
          } else {
            on.addSource(key, { type: 'geojson', data });
          }
          if (!on.getLayer(`${key}-line`)) {
            if (key === 'sections') {
              on.addLayer({
                id: 'sections-line',
                type: 'line',
                source: 'sections',
                paint: {
                  'line-color': [
                    'case',
                    ['get', 'blocked'],
                    '#ef4444',
                    '#3b82f6',
                  ],
                  'line-width': ['case', ['get', 'blocked'], 6, 3.5],
                },
              });
            } else if (key === 'blocks') {
              on.addLayer({
                id: 'blocks-line',
                type: 'line',
                source: 'blocks',
                paint: {
                  'line-color': '#ef4444',
                  'line-width': 8,
                  'line-offset': 3,
                },
              });
            } else {
              on.addLayer({
                id: 'ohe-line',
                type: 'line',
                source: 'ohe',
                paint: {
                  'line-color': '#22d3ee',
                  'line-width': 2,
                  'line-dasharray': [2, 2],
                },
              });
            }
          }
          // visibility per toggle
          const m = map as unknown as {
            setLayoutProperty: (
              layer: string,
              prop: string,
              val: unknown,
            ) => void;
          };
          if (on.getLayer(`${key}-line`)) {
            m.setLayoutProperty(
              `${key}-line`,
              'visibility',
              visibleRef.current[key] ? 'visible' : 'none',
            );
          }
        }

        // Section click → popup
        (
          map as unknown as {
            on: (ev: string, layer: string, cb: (e: unknown) => void) => void;
          }
        ).on('click', 'sections-line', (e: unknown) => {
          const fe = e as {
            features?: { properties: Record<string, unknown> }[];
          };
          const p = fe.features?.[0]?.properties;
          if (!p) return;
          setPopupInfo(
            `Section ${p.code as string} · ${p.division as string}\n` +
              `km ${(p.start_km as number).toFixed(1)}–${(p.end_km as number).toFixed(1)} · ${p.line_type as string}\n` +
              `blocked: ${p.blocked ? 'YES' : 'no'}`,
          );
        });
      };

      (map as unknown as { on: (ev: string, cb: () => void) => void }).on(
        'load',
        apply,
      );
      apply();
    })();

    return () => {
      cancelled = true;
    };
  }, [bundle]);

  const toggle = (key: LayerKey) => {
    setVisible((v) => {
      const next = { ...v, [key]: !v[key] };
      const m = mapRef.current as unknown as {
        setLayoutProperty?: (layer: string, prop: string, val: unknown) => void;
      } | null;
      if (m?.setLayoutProperty) {
        m.setLayoutProperty(
          `${key}-line`,
          'visibility',
          next[key] ? 'visible' : 'none',
        );
      }
      return next;
    });
  };

  const counts = bundle
    ? {
        sections: bundle.sections.length,
        blocked: bundle.sections.filter((f) => f.properties.blocked).length,
        blocks: bundle.blocks.length,
        ohe: bundle.ohe.length,
      }
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar — layer toggles + live counts */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2.5">
        {LAYER_META.map((l) => (
          <label
            key={l.key}
            className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground"
          >
            <input
              type="checkbox"
              checked={visible[l.key]}
              onChange={() => toggle(l.key)}
              className="accent-[#935073]"
            />
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-4 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </label>
        ))}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {counts
            ? `${counts.sections} sections · ${counts.blocked} blocked · ${counts.blocks} block overlays · ${counts.ohe} OHE boundaries`
            : 'loading…'}
        </span>
      </div>

      <div className="relative flex-1">
        {error ? (
          <div
            role="alert"
            className="atlas-alert-danger absolute left-4 top-4 z-10 px-3 py-2 text-xs"
          >
            {error}
          </div>
        ) : null}
        {popupInfo ? (
          <div className="atlas-card absolute bottom-4 left-4 z-10 max-w-sm whitespace-pre-line p-3 font-mono text-xs text-foreground">
            {popupInfo}
            <button
              type="button"
              onClick={() => setPopupInfo(null)}
              className="ml-2 text-muted-foreground underline"
            >
              close
            </button>
          </div>
        ) : null}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
