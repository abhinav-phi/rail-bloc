import React from 'react';

export function SimulatedDataWatermark({ position = 'bottom-right' }: { position?: 'bottom-right' | 'center' }) {
  return (
    <div className={`pointer-events-none absolute z-40 text-muted-foreground/30 font-bold uppercase ${position === 'center' ? 'inset-0 flex items-center justify-center text-6xl rotate-[-45deg]' : 'bottom-4 right-4 text-xl'}`}>
      SIMULATED DATA
    </div>
  );
}
