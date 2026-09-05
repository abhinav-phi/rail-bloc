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

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // token survives reload via the sessionStorage mirror (lib/api.ts)
    if (!getToken()) router.replace('/login');
    else setChecked(true);
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersonaProvider>
      <AuthGate>
        <SSEProvider>
          <SolverProvider>
            <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto relative">
                  <StaleStateOverlay />
                  {children}
                  <AtlasWatermark detail="seed 42 · demo scope" />
                </main>
              </div>
            </div>
          </SolverProvider>
        </SSEProvider>
      </AuthGate>
    </PersonaProvider>
  );
}
