'use client';

import React from 'react';
import { useSSE } from '@/context/sse-context';
import { AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/shared/loading';

/** Honest live-feed states: CONNECTING is not an error — brass shimmer card,
 * non-blocking look (actions stay enabled until a real failure). Only STALE
 * keeps the red actions-disabled card. */
export function StaleStateOverlay() {
  const { status, stale } = useSSE();

  if (status === 'live' || (!stale && status !== 'stale')) return null;

  if (status === 'stale') {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center p-6 bg-destructive/10 text-destructive border border-destructive rounded-lg shadow-lg">
          <AlertTriangle className="h-10 w-10 mb-4" />
          <h2 className="text-lg font-bold">STALE DATA</h2>
          <p>Live feed disconnected. All actions disabled.</p>
        </div>
      </div>
    );
  }

  // status === 'connecting' — reassurance, not a wall
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center">
      <div className="flex items-center gap-3 rounded-sm border border-[color:var(--atlas-warning-ring)] bg-card/95 px-4 py-2.5 shadow-sm">
        <Spinner size={14} />
        <div className="text-sm">
          <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[color:var(--atlas-warning)]">
            Connecting live feed…
          </span>
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
            one-time ticket handshake
          </span>
        </div>
      </div>
    </div>
  );
}
