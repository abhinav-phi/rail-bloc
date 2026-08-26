'use client';

import React, { createContext, useContext, useState } from 'react';

interface SSEContextState {
  isConnected: boolean;
  lastHeartbeatAt: Date | null;
  liveBlocks: any[];
  liveTrainPositions: any[];
}

const SSEContext = createContext<SSEContextState | undefined>(undefined);

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true); // Mock connected
  
  return (
    <SSEContext.Provider
      value={{
        isConnected,
        lastHeartbeatAt: new Date(),
        liveBlocks: [],
        liveTrainPositions: [],
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
