'use client';

import React from 'react';
import { useSSE } from '@/context/sse-context';
import { AlertTriangle } from 'lucide-react';

export function StaleStateOverlay() {
  const { isConnected } = useSSE();

  if (isConnected) return null;

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
