'use client';
import React, { useEffect, useRef } from 'react';

export function GisCorridorMap() {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    let map: any;

    (async () => {
      const maplibregl = await import('maplibre-gl');
      // CSS is loaded via the maplibre-gl package automatically

      map = new maplibregl.Map({
        container: mapContainer.current!,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [77.1025, 28.7041], // Delhi approx
        zoom: 6,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
    })();

    return () => {
      if (map) map.remove();
    };
  }, []);

  return <div ref={mapContainer} className="w-full h-full" />;
}
