'use client';

import React from 'react';

/** Rules.md §5 — persistent, non-dismissible SIMULATED DATA watermark.
 * Mounted ONCE in the authenticated app layout; there is intentionally no
 * close control and no prop to hide it. Pointer-events are off so it never
 * obstructs interaction while remaining permanently visible. */
export function AtlasWatermark({ detail }: { detail?: string }) {
  return (
    <div
      role="note"
      aria-label="SIMULATED DATA — all figures are synthetic"
      data-testid="atlas-watermark"
      className="atlas-watermark"
    >
      <span
        aria-hidden="true"
        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
      SIMULATED DATA
      {detail ? (
        <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
          {detail}
        </span>
      ) : null}
    </div>
  );
}
