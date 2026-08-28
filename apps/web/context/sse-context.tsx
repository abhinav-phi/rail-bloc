'use client';

import React, { createContext, useContext } from 'react';
import { useLive, LiveState, LiveEvent } from '@/lib/live';

interface SSEContextState {
  isConnected: boolean;
  stale: boolean;
  lastHeartbeatAt: Date | null;
  lastEvent: LiveEvent | null;
  events: LiveEvent[];
  liveBlocks: LiveEvent[];
  liveTrainPositions: LiveEvent[];
}

const SSEContext = createContext<SSEContextState | undefined>(undefined);

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const live = useLive();

  // Categorize events by type for consumers
  const liveBlocks = live.events.filter(
    (e) => e.event === 'block_update' || e.event === 'plan_change'
  );
  const liveTrainPositions = live.events.filter(
    (e) => e.event === 'train_position'
  );

  return (
    <SSEContext.Provider
      value={{
        isConnected: live.connected,
        stale: live.stale,
        lastHeartbeatAt: live.connected ? new Date() : null,
        lastEvent: live.lastEvent,
        events: live.events,
        liveBlocks,
        liveTrainPositions,
      }}
    >
      {children}
    </SSEContext.Provider>
  );
}

export function useSSE() {
  const context = useContext(SSEContext);
  if (context === undefined) {
    throw new Error('useSSE must be used within an SSEProvider');
  }
  return context;
}
