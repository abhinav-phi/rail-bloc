'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/api';
import { PersonaProvider } from '@/context/persona-context';
import { SSEProvider } from '@/context/sse-context';
import { SolverProvider } from '@/context/solver-context';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { StaleStateOverlay } from '@/components/shell/stale-state-overlay';
import { AtlasWatermark } from '@/components/shell/atlas-watermark';
import { Spinner } from '@/components/shared/loading';

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // token survives reload via the sessionStorage mirror (lib/api.ts)
    if (!getToken()) router.replace('/login');
    else setChecked(true);
  }, [router]);

  // Token check is a single synchronous read in useEffect — this spinner only
  // covers the hydration frame, but a blank flash reads as "broken".
  if (!checked)
    return (
      <div
        className="flex h-screen items-center justify-center bg-background text-brass"
        role="status"
        aria-label="Checking session"
      >
        <Spinner size={24} />
      </div>
    );
  return <>{children}</>;
}

function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Header onMenu={() => setNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <main className="relative flex-1 overflow-y-auto">
          <StaleStateOverlay />
          {children}
          <AtlasWatermark detail="seed 42 · demo scope" />
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersonaProvider>
      <AuthGate>
        <SSEProvider>
          <SolverProvider>
            <ConsoleShell>{children}</ConsoleShell>
          </SolverProvider>
        </SSEProvider>
      </AuthGate>
    </PersonaProvider>
  );
}
