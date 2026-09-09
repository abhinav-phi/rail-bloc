'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/shared/loading';
import { RefreshCw, Crosshair } from 'lucide-react';

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

type LayerKey = 'sections' | 'blocks' | 'ohe';

const LAYER_META: { key: LayerKey; label: string; color: string }[] = [
  { key: 'sections', label: 'Sections (blocked = red)', color: '#4A5C72' },
  { key: 'blocks', label: 'Maintenance blocks', color: '#F06B72' },
  { key: 'ohe', label: 'OHE feeding boundaries', color: '#C17F3E' },
];

/* Corridor stations — fixed facts from data/generators/corridor_gen.py
   STATIONS (seed 42): name, km, lng, lat. Client-side constants, offline-safe. */
const STATIONS: { code: string; km: number; lng: number; lat: number }[] = [
  { code: 'NDLS', km: 0.0, lng: 77.2215, lat: 28.6425 },
  { code: 'GZB', km: 24.5, lng: 77.431, lat: 28.669 },
  { code: 'ALJN', km: 68.2, lng: 78.078, lat: 27.897 },
  { code: 'TDL', km: 118.0, lng: 78.471, lat: 27.601 },
  { code: 'ETW', km: 205.0, lng: 79.021, lat: 26.777 },
  { code: 'CNB', km: 250.0, lng: 80.354, lat: 26.449 },
];

/** km → lng/lat by linear interpolation along the station chain. */
function kmToLngLat(km: number): [number, number] {
  const s = STATIONS;
  if (km <= s[0].km) return [s[0].lng, s[0].lat];
  for (let i = 1; i < s.length; i++) {
    if (km <= s[i].km) {
      const a = s[i - 1];
      const b = s[i];
      const t = (km - a.km) / (b.km - a.km);
      return [a.lng + t * (b.lng - a.lng), a.lat + t * (b.lat - a.lat)];
    }
  }
  return [s[s.length - 1].lng, s[s.length - 1].lat];
}

function priorityColor(rank: number): string {
  if (rank <= 2) return '#8b5cf6'; // P1-2 violet
  if (rank <= 4) return '#f59e0b'; // P3-4 amber
  return '#14b8a6'; // P5+ teal
}

/** Corridor Map — REAL data from /api/v1/plans/geo via MapLibre GeoJSON
 *  sources. Void base stays offline; optional Carto tiles are a toggle. */
export function AtlasCorridorMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const mapReadyRef = useRef(false);
  // state twin of mapReadyRef — marker effects re-run when the map finishes loading
  const [mapReady, setMapReady] = useState(false);
  const clickBoundRef = useRef(false);
  const replayT0Ref = useRef(Date.now());
  const markersRef = useRef<{ marker: unknown }[]>([]);
  const [bundle, setBundle] = useState<GeoBundle | null>(null);
  const [trains, setTrains] = useState<TrainPath[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    sections: true,
    blocks: true,
    ohe: true,
  });
  const [basemap, setBasemap] = useState(false);
  const [basemapError, setBasemapError] = useState(false);
  const [popup, setPopup] = useState<{
    title: string;
    lines: string[];
  } | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;

  const load = useCallback(async () => {
    try {
      const d = await api.get<GeoBundle>('/api/v1/plans/geo');
      setBundle(d);
      setError(null);
      try {
        setTrains(await api.get<TrainPath[]>('/api/v1/plans/timetable'));
      } catch {
        setTrains(null); // timetable is decoration — never blocks the map
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  // ── Map init (once, []) — void style + glyphs for line labels + controls ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css' as string);
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          // Glyphs power the section-code line labels only. They are font
          // PBFs, not basemap tiles — the void base stays offline-first; if
          // the glyph endpoint is unreachable the labels silently vanish and
          // every data layer keeps rendering.
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          sources: {},
          layers: [
            {
              id: 'bg',
              type: 'background',
              paint: { 'background-color': '#0B111E' },
            },
          ],
        },
        center: [78.5, 27.6],
        zoom: 5.4,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl(), 'top-left');
      map.addControl(
        new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
        'bottom-left',
      );
      map.on('error', (e: unknown) => {
        const msg =
          (e as { error?: { message?: string } })?.error?.message ?? '';
        if (/tile|basemap|Failed to fetch/i.test(msg)) setBasemapError(true);
      });
      map.on('load', () => {
        mapReadyRef.current = true;
        setMapReady(true);
        // fitBounds on the corridor extent (stations bound the 12 sections)
        const lons = STATIONS.map((s) => s.lng);
        const lats = STATIONS.map((s) => s.lat);
        map.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { padding: 48, duration: 0 },
        );
        // Basemap (optional): carto dark_matter raster, toggle-gated. Added on
        // load so the void style never flickers.
        map.addSource('basemap-tiles', {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors © CARTO',
        });
        map.addLayer({
          id: 'basemap-layer',
          type: 'raster',
          source: 'basemap-tiles',
          layout: { visibility: 'none' },
        });
        // retry /geo if it resolved before load (race guard)
        if (bundle) void applyBundle(bundle);
      });

      function applyBundle(data: GeoBundle) {
        const on = map as unknown as {
          getSource: (
            id: string,
          ) => { setData?: (d: unknown) => void } | undefined;
          addSource: (id: string, cfg: unknown) => void;
          addLayer: (cfg: unknown) => void;
          getLayer: (id: string) => unknown;
          queryRenderedFeatures?: unknown;
        };
        const setLayout = map as unknown as {
          setLayoutProperty: (l: string, p: string, v: unknown) => void;
        };

        const fc = (features: GeoFeature[]) => ({
          type: 'FeatureCollection',
          features,
        });

        // Sources (add-once, then setData)
        for (const key of ['sections', 'blocks', 'ohe'] as const) {
          const payload: unknown = fc((data as GeoBundle)[key] ?? []);
          if (on.getSource(key)) on.getSource(key)?.setData?.(payload);
          else on.addSource(key, { type: 'geojson', data: payload });
        }

        // Layers — paint order: sections → blocks casing → blocks → OHE dash
        if (!on.getLayer('sections-line')) {
          on.addLayer({
            id: 'sections-line',
            type: 'line',
            source: 'sections',
            paint: {
              'line-color': ['case', ['get', 'blocked'], '#F06B72', '#4A5C72'],
              'line-width': ['case', ['get', 'blocked'], 6, 3.5],
            },
          });
        }
        if (!on.getLayer('blocks-casing')) {
          on.addLayer({
            id: 'blocks-casing',
            type: 'line',
            source: 'blocks',
            paint: {
              'line-color': '#1A2233',
              'line-width': 11,
              'line-offset': 3,
            },
          });
        }
        if (!on.getLayer('blocks-line')) {
          on.addLayer({
            id: 'blocks-line',
            type: 'line',
            source: 'blocks',
            paint: {
              'line-color': '#F06B72',
              'line-width': 8,
              'line-offset': 3,
            },
          });
        }
        if (!on.getLayer('ohe-line')) {
          on.addLayer({
            id: 'ohe-line',
            type: 'line',
            source: 'ohe',
            paint: {
              'line-color': '#C17F3E',
              'line-width': 2,
              'line-dasharray': [2, 2],
            },
          });
        }
        if (!on.getLayer('ohe-ends')) {
          // OHE isolator end markers — brass dots at both ends of each boundary
          const ends: GeoFeature[] = [];
          for (const f of (data as GeoBundle).ohe ?? []) {
            const coords =
              (f.geometry.coordinates as unknown as [number, number][]) ?? [];
            const first = coords[0];
            const last = coords[coords.length - 1];
            for (const c of [first, last]) {
              if (!c) continue;
              ends.push({
                type: 'Feature',
                properties: { code: f.properties.code },
                geometry: { type: 'Point', coordinates: c },
              });
            }
          }
          on.addSource('ohe-ends', { type: 'geojson', data: fc(ends) });
          on.addLayer({
            id: 'ohe-ends',
            type: 'circle',
            source: 'ohe-ends',
            paint: {
              'circle-color': '#C17F3E',
              'circle-radius': 3.5,
              'circle-stroke-color': '#0B111E',
              'circle-stroke-width': 1,
            },
          });
        }
        if (!on.getLayer('sections-label')) {
          on.addLayer({
            id: 'sections-label',
            type: 'symbol',
            source: 'sections',
            layout: {
              'symbol-placement': 'line',
              'text-field': ['get', 'code'],
              'text-font': ['Open Sans Regular'],
              'text-size': 11,
              'text-offset': [0, -1.1],
            },
            paint: {
              'text-color': '#CBD5E1',
              'text-halo-color': '#0B111E',
              'text-halo-width': 1.5,
            },
            minzoom: 8,
          });
        }

        // Visibility per toggle
        for (const key of ['sections', 'blocks', 'ohe'] as const) {
          if (on.getLayer(`${key}-line`)) {
            setLayout.setLayoutProperty(
              `${key}-line`,
              'visibility',
              visibleRef.current[key] ? 'visible' : 'none',
            );
          }
        }
        setLayout.setLayoutProperty(
          'blocks-casing',
          'visibility',
          visibleRef.current.blocks ? 'visible' : 'none',
        );
        if (on.getLayer('ohe-ends')) {
          setLayout.setLayoutProperty(
            'ohe-ends',
            'visibility',
            visibleRef.current.ohe ? 'visible' : 'none',
          );
        }
        setLayout.setLayoutProperty(
          'basemap-layer',
          'visibility',
          basemapRef.current ? 'visible' : 'none',
        );

        // Click handlers — bound ONCE (guarded), never re-registered per refresh
        if (!clickBoundRef.current) {
          clickBoundRef.current = true;
          const clickLayer = (
            layer: string,
            cb: (props: Record<string, unknown>) => void,
          ) => {
            map.on('click', layer, (e: unknown) => {
              const fe = e as {
                features?: { properties: Record<string, unknown> }[];
              };
              const p = fe.features?.[0]?.properties;
              if (p) cb(p);
            });
          };
          clickLayer('sections-line', (p) => {
            setPopup({
              title: `Section ${p.code as string} · ${p.division as string}`,
              lines: [
                `km ${(p.start_km as number).toFixed(1)}–${(p.end_km as number).toFixed(1)} · ${p.line_type as string}`,
                `blocked: ${p.blocked ? 'YES' : 'no'}`,
              ],
            });
          });
          clickLayer('blocks-line', (p) => {
            setPopup({
              title: `Block · ${p.code as string}`,
              lines: [
                `status: ${p.status as string}${p.shadow ? ' · SHADOW BUNDLE' : ''}`,
                `${String(p.start as string).slice(11, 16)}–${String(p.end as string).slice(11, 16)} (UTC)`,
              ],
            });
          });
          clickLayer('ohe-line', (p) => {
            setPopup({
              title: `OHE feeding boundary · ${p.code as string}`,
              lines: ['isolator boundary — ⚡ feed switch point'],
            });
          });
          clickLayer('ohe-ends', (p) => {
            setPopup({
              title: `OHE isolator · ${p.code as string}`,
              lines: ['ES feed-switch endpoint'],
            });
          });
        }

        // fitBounds to the actual section extent on first data arrival
        const lons: number[] = [];
        const lats: number[] = [];
        const collect = (coords: unknown) => {
          // LineString coords: [[lng,lat], ...]; MultiLineString nests one more level.
          const c0 = (coords as unknown[])[0] as unknown;
          const pairs: [number, number][] = (
            Array.isArray((c0 as unknown[] | undefined)?.[0])
              ? (coords as unknown as [number, number][][]).flat(1)
              : (coords as unknown as [number, number][])
          ) as [number, number][];
          for (const c of pairs) {
            lons.push(c[0]);
            lats.push(c[1]);
          }
        };
        for (const f of (data as GeoBundle).sections ?? []) {
          collect(f.geometry.coordinates as unknown);
        }
        if (lons.length) {
          map.fitBounds(
            [
              [Math.min(...lons), Math.min(...lats)],
              [Math.max(...lons), Math.max(...lats)],
            ],
            { padding: 48, duration: 0 },
          );
        }
      }

      if (bundle) applyBundle(bundle);
      map.on('load', () => {
        if (bundle) applyBundle(bundle);
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Station + train markers (HTML — JetBrains Mono, offline-safe) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapReady || !bundle) return;
      const maplibregl = await import('maplibre-gl');
      if (cancelled) return;
      const map = mapRef.current as {
        removeLayer?: (id: string) => void;
        addLayer: (cfg: unknown) => void;
        getSource: (
          id: string,
        ) => { setData?: (d: unknown) => void } | undefined;
        addSource: (id: string, cfg: unknown) => void;
        getLayer: (id: string) => unknown;
      } | null;
      if (!map) return;

      // wipe previous markers (markers live in the DOM, not the style)
      for (const m of markersRef.current) {
        (m.marker as { remove?: () => void })?.remove?.();
      }
      markersRef.current = [];

      // section_code → [start_km, end_km] + blocked
      const secKm = new Map<
        string,
        { a: number; b: number; blocked: boolean }
      >();
      for (const f of bundle.sections) {
        secKm.set(f.properties.code as string, {
          a: f.properties.start_km as number,
          b: f.properties.end_km as number,
          blocked: Boolean(f.properties.blocked),
        });
      }
      const blocksByCode = new Map<string, number>();
      for (const f of bundle.blocks) {
        const code = f.properties.code as string;
        blocksByCode.set(code, (blocksByCode.get(code) ?? 0) + 1);
      }

      // Stations: white dot + brass ring when a bracketing section is blocked
      for (const s of STATIONS) {
        const bracketing = Array.from(secKm.entries()).filter(
          ([, v]) => v.a <= s.km && s.km <= v.b,
        );
        const blocked = bracketing.some(([, v]) => v.blocked);
        const activeBlocks = bracketing.reduce(
          (acc, [code]) => acc + (blocksByCode.get(code) ?? 0),
          0,
        );
        const el = document.createElement('div');
        el.className = 'atlas-station';
        el.innerHTML = `<span class="atlas-station-dot${blocked ? ' atlas-station-blocked' : ''}"></span><span class="atlas-station-label">${s.code}</span>`;
        el.addEventListener('click', () => {
          setPopup({
            title: `Station ${s.code}`,
            lines: [
              `km ${s.km.toFixed(1)}`,
              `blocked: ${blocked ? 'YES' : 'no'}`,
              `active blocks nearby: ${activeBlocks}`,
            ],
          });
        });
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .addTo(map as unknown as import('maplibre-gl').Map);
        markersRef.current.push({ marker });
      }

      // Train dots — interpolated along km chain, priority colors, pulse when
      // the section is blocked (ACTIVE/TRANSMITTED), hover label only.
      if (trains && trains.length) {
        // "Now" is rarely inside the seeded timetable (synthetic feed dates).
        // Honest replay: anchor to the LATEST timetable day and show that
        // day's paths against the matching wall-clock time — no invented
        // positions outside each path's window.
        const lastEntry = Math.max(
          ...trains.map((t) => new Date(t.entry).getTime()),
        );
        const anchorDay = new Date(lastEntry);
        anchorDay.setUTCHours(0, 0, 0, 0);
        const dayStart = anchorDay.getTime();
        // Replay clock: the anchored timetable day plays back in 6 real minutes
        // (240× speed) so the dots are alive at any wall-clock time. Positions
        // stay strictly inside each path's scheduled window — nothing invented.
        const REPLAY_MS_PER_DAY = 360000;
        const replayT0 = replayT0Ref.current;
        const clockNow =
          dayStart +
          ((Date.now() - replayT0) % REPLAY_MS_PER_DAY) *
            (86400000 / REPLAY_MS_PER_DAY);
        const dayPaths = trains.filter((t) => {
          const e = new Date(t.entry).getTime();
          return e >= dayStart && e < dayStart + 86400000;
        });
        for (const t of dayPaths) {
          const entry = new Date(t.entry).getTime();
          const exit = new Date(t.exit).getTime();
          if (clockNow < entry || clockNow > exit) continue; // not running this minute
          const sec = secKm.get(t.section_code);
          if (!sec) continue;
          const span = sec.b - sec.a || 1;
          const km = sec.a + ((clockNow - entry) / (exit - entry)) * span;
          const [lng, lat] = kmToLngLat(km);
          const el = document.createElement('div');
          const blocked = sec.blocked;
          el.className = `atlas-train-dot${blocked ? ' atlas-train-pulse' : ''}`;
          el.style.background = priorityColor(t.priority_rank);
          el.title = `${t.train_number} ${t.train_type} · P${t.priority_rank} · ${t.section_code}`;
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map as unknown as import('maplibre-gl').Map);
          markersRef.current.push({ marker });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundle, trains, mapReady]);

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

  const recenter = () => {
    const m = mapRef.current as {
      fitBounds?: (b: unknown, o: unknown) => void;
    } | null;
    const lons = STATIONS.map((s) => s.lng);
    const lats = STATIONS.map((s) => s.lat);
    m?.fitBounds?.(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 48, duration: 400 },
    );
  };

  const toggleBasemap = () => {
    setBasemap((v) => {
      const next = !v;
      setBasemapError(false);
      const m = mapRef.current as unknown as {
        setLayoutProperty?: (layer: string, prop: string, val: unknown) => void;
      } | null;
      if (m?.setLayoutProperty) {
        m.setLayoutProperty(
          'basemap-layer',
          'visibility',
          next ? 'visible' : 'none',
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

  const liveBlocks = (bundle?.blocks ?? [])
    .slice()
    .sort((a, b) =>
      String(a.properties.start) < String(b.properties.start) ? 1 : -1,
    )
    .slice(0, 3);

  const flyToCode = (code: string) => {
    const sec = bundle?.sections.find((f) => f.properties.code === code);
    if (!sec) return;
    const km =
      ((sec.properties.start_km as number) +
        (sec.properties.end_km as number)) /
      2;
    const [lng, lat] = kmToLngLat(km);
    const m = mapRef.current as {
      flyTo?: (o: unknown) => void;
    } | null;
    m?.flyTo?.({ center: [lng, lat], zoom: 9.5, duration: 600 });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar — layer toggles + basemap + live counts */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2.5">
        <p className="atlas-section-label mr-2">05 / CORRIDOR MAP</p>
        {LAYER_META.map((l) => (
          <label
            key={l.key}
            className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground"
          >
            <input
              type="checkbox"
              checked={visible[l.key]}
              onChange={() => toggle(l.key)}
              className="accent-brass"
            />
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-4 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
          <input
            type="checkbox"
            checked={basemap}
            onChange={toggleBasemap}
            className="accent-brass"
          />
          basemap tiles
        </label>
        <button
          type="button"
          onClick={recenter}
          className="atlas-btn-secondary atlas-btn inline-flex items-center gap-1.5 text-xs"
          title="Recenter corridor"
        >
          <Crosshair size={12} /> Recenter
        </button>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {counts ? (
            `${counts.sections} sections · ${counts.blocked} blocked · ${counts.blocks} block overlays · ${counts.ohe} OHE`
          ) : (
            <Skeleton className="h-3 w-64" />
          )}
        </span>
      </div>

      <div className="relative flex-1">
        {error ? (
          <div className="absolute left-4 top-4 z-10">
            <div
              role="alert"
              className="atlas-alert-danger mb-2 px-3 py-2 text-xs"
            >
              {error}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="atlas-btn-secondary atlas-btn inline-flex items-center gap-1.5 text-xs"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : null}
        {basemapError && basemap ? (
          <span className="atlas-badge absolute left-1/2 top-3 z-10 border-border text-muted-foreground">
            offline basemap
          </span>
        ) : null}

        {/* Legend */}
        <div className="atlas-card absolute bottom-4 right-4 z-10 max-w-[220px] p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          <p className="atlas-section-label mb-1.5 text-[9px]">LEGEND</p>
          <p>— track centreline</p>
          <p>
            <span style={{ color: '#F06B72' }}>■</span> blocked live ·{' '}
            <span className="text-[color:var(--atlas-warning)]">■</span>{' '}
            PROVISIONAL
          </p>
          <p>
            <span style={{ color: '#8b5cf6' }}>■</span> authorised-queued ·{' '}
            <span style={{ color: '#C17F3E' }}>┄</span> OHE dashed
          </p>
          <p>
            trains: <span style={{ color: '#8b5cf6' }}>●</span> P1-2{' '}
            <span style={{ color: '#f59e0b' }}>●</span> P3-4{' '}
            <span style={{ color: '#14b8a6' }}>●</span> P5+
          </p>
        </div>

        {/* Live blocks — top 3, click flies to section */}
        <div className="atlas-card absolute right-4 top-4 z-10 w-64 p-3">
          <p className="atlas-section-label mb-1.5 text-[9px]">LIVE BLOCKS</p>
          {liveBlocks.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground">
              no active blocks on the corridor
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {liveBlocks.map((b) => (
                <li key={b.properties.id as string}>
                  <button
                    type="button"
                    onClick={() => flyToCode(b.properties.code as string)}
                    className="w-full text-left font-mono text-[10px] text-foreground hover:text-brass"
                  >
                    {b.properties.code as string}{' '}
                    {String(b.properties.start).slice(11, 16)}–
                    {String(b.properties.end).slice(11, 16)}{' '}
                    <span className="text-muted-foreground">
                      {b.properties.status as string}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {popup ? (
          <div className="atlas-card absolute bottom-4 left-4 z-20 max-w-sm p-3 font-mono text-xs text-foreground">
            <p className="font-semibold text-brass">{popup.title}</p>
            {popup.lines.map((l) => (
              <p key={l} className="text-muted-foreground">
                {l}
              </p>
            ))}
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="ml-0 mt-1 text-muted-foreground underline"
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
