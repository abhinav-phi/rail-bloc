'use client';

import React, { createContext, useContext, useState } from 'react';
import { SolverStatus } from '@/lib/types';

interface SolverContextState {
  status: SolverStatus;
  bestBound: number | null;
  latencyMs: number | null;
  lastRunAt: Date | null;
  triggerSolve: (weekId: string) => Promise<void>;
}

const SolverContext = createContext<SolverContextState | undefined>(undefined);

export function SolverProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SolverStatus>('IDLE');

  const triggerSolve = async (weekId: string) => {
    setStatus('RUNNING');
    // Mock solve
    setTimeout(() => {
      setStatus('OPTIMAL');
    }, 2000);
  };

  return (
    <SolverContext.Provider
      value={{
        status,
        bestBound: null,
        latencyMs: null,
        lastRunAt: null,
        triggerSolve,
      }}
    >
      {children}
    </SolverContext.Provider>
  );
}

export function useSolver() {
  const context = useContext(SolverContext);
  if (context === undefined) {
    throw new Error('useSolver must be used within a SolverProvider');
  }
  return context;
}
