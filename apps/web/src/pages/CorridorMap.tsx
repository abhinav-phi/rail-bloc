import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "../api";
import { useLive } from "../live";
import { Card } from "../components/common";

interface GeoFeed {
  sections: GeoJSON.FeatureCollection;
  blocks: GeoJSON.FeatureCollection;
  ohe: GeoJSON.FeatureCollection;
}

interface TimetableRow {
  train_number: string;
  train_type: string;
  priority_rank: number;
  entry: string;
  exit: string;
  start_km: number;
  end_km: number;
  section_code: string;
}

/** FR-021 — MapLibre corridor map with track centerlines, block hazard corridors,
 *  OHE feeding boundaries and RTIS-mock train markers. Synthetic layers carry the
 *  persistent SIMULATED DATA watermark (rendered globally in App). */
export const CorridorMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const { lastEvent, stale } = useLive();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": "#0B111E" } }],
      },
      center: [78.8, 27.7],
      zoom: 6.2,
    });
    map.addControl(new maplibregl.NavigationControl());
    mapRef.current = map;

    api.get<GeoFeed>("/api/v1/plans/geo").then((geo) => {
      if (!mapRef.current) return;
      const m = mapRef.current;
      m.on("load", () => loadLayers(m, geo));
      if (m.isStyleLoaded()) loadLayers(m, geo);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Live SSE events nudge the map to refresh block states.
  useEffect(() => {
    if (!lastEvent) return;
    api.get<GeoFeed>("/api/v1/plans/geo").then((geo) => {
      const m = mapRef.current;
      if (m && m.getSource("blocks")) {
        (m.getSource("blocks") as maplibregl.GeoJSONSource).setData(geo.blocks);
        (m.getSource("sections") as maplibregl.GeoJSONSource).setData(geo.sections);
      }
    }).catch(() => undefined);
  }, [lastEvent]);

  useEffect(() => {
    // RTIS mock: derive live train markers from the timetable by interpolating now().
    let markers: maplibregl.Marker[] = [];
    const tick = async () => {
      try {
        const rows = await api.get<TimetableRow[]>("/api/v1/plans/timetable");
        markers.forEach((mk) => mk.remove());
        markers = [];
        const now = Date.now();
        for (const r of rows) {
          const entry = new Date(r.entry).getTime();
          const exit = new Date(r.exit).getTime();
          if (entry > now || exit < now) continue;
          const f = (now - entry) / Math.max(exit - entry, 1);
          const km = r.start_km + (r.end_km - r.start_km) * f;
          const pos = kmToLatLng(km);
          const el = document.createElement("div");
          el.textContent = "🚆";
          el.className = "text-lg";
          markers.push(new maplibregl.Marker({ element: el }).setLngLat(pos).addTo(mapRef.current!));
        }
      } catch {
        /* stale — overlay already communicates this */
      }
    };
    tick();
    const t = setInterval(tick, 10000);
    return () => {
      clearInterval(t);
      markers.forEach((mk) => mk.remove());
    };
  }, [stale]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-text-primary">GIS Corridor Map</h2>
      <div
        ref={containerRef}
        data-testid="map"
        className="h-[70vh] w-full rounded-lg border border-border-subtle"
        onMouseOver={() => setHoverInfo("Hover a section for health indices")}
      />
      <Card title="Layer legend">
        <ul className="grid grid-cols-2 gap-1 text-xs text-text-secondary md:grid-cols-4">
          <li><span className="mr-1 inline-block h-2 w-4 bg-accent-trd" /> Track centerline</li>
          <li><span className="mr-1 inline-block h-2 w-4 bg-status-blocked" /> ⛔ Active block hazard</li>
          <li><span className="mr-1 inline-block h-2 w-4 border border-dashed border-accent-trd" /> OHE feeding boundary (G&SR-4)</li>
          <li>🚆 RTIS-mock train position</li>
        </ul>
        {hoverInfo && <p className="mt-2 font-mono text-xs text-text-secondary">{hoverInfo}</p>}
      </Card>
    </div>
  );
};

function kmToLatLng(km: number): [number, number] {
  // Interpolation along the seeded NDLS→CNB anchor chain.
  const anchors: [number, number, number][] = [
    [0, 77.2215, 28.6425], [24.5, 77.431, 28.669], [68.2, 78.078, 27.897],
    [118, 78.471, 27.601], [205, 79.021, 26.777], [250, 80.354, 26.449],
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [k0, x0, y0] = anchors[i];
    const [k1, x1, y1] = anchors[i + 1];
    if (km >= k0 && km <= k1) {
      const f = (km - k0) / (k1 - k0);
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    }
  }
  return anchors[anchors.length - 1].slice(1) as unknown as [number, number];
}

function loadLayers(m: maplibregl.Map, geo: GeoFeed) {
  if (!m.getSource("sections")) {
    m.addSource("sections", { type: "geojson", data: geo.sections });
    m.addSource("blocks", { type: "geojson", data: geo.blocks });
    m.addSource("ohe", { type: "geojson", data: geo.ohe });
    m.addLayer({
      id: "ohe-lines", type: "line", source: "ohe",
      paint: { "line-color": "#0EA5E9", "line-dasharray": [2, 2], "line-width": 1.5 },
    });
    m.addLayer({
      id: "section-lines", type: "line", source: "sections",
      paint: {
        "line-color": ["case", ["get", "blocked"], "#DC2626", "#0EA5E9"],
        "line-width": ["case", ["get", "blocked"], 5, 2.5],
      },
    });
    m.addLayer({
      id: "block-fills", type: "fill", source: "blocks",
      paint: { "fill-color": "#DC2626", "fill-opacity": 0.18 },
    });
    m.on("click", "section-lines", (e) => {
      const f = e.features?.[0];
      if (f) {
        const p = f.properties as { code: string; division: string; start_km: number; end_km: number };
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<b>${p.code}</b> (${p.division})<br/>KM ${p.start_km}–${p.end_km}<br/>` +
            `<i>SIMULATED health indices: GMT ${(48.2 % (p.end_km + 12)).toFixed(1)} · defects ${Math.round(p.start_km) % 7}</i>`
          )
          .addTo(m);
      }
    });
  } else {
    (m.getSource("sections") as maplibregl.GeoJSONSource).setData(geo.sections);
    (m.getSource("blocks") as maplibregl.GeoJSONSource).setData(geo.blocks);
    (m.getSource("ohe") as maplibregl.GeoJSONSource).setData(geo.ohe);
  }
}
