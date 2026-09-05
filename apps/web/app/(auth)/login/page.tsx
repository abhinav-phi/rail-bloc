'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePersona } from '@/context/persona-context';
import { Button } from '@/components/ui/button';
import { Train, Shield } from 'lucide-react';

const DEMO_PERSONAS = [
  {
    id: 'sr-dom',
    name: 'R. K. Sharma',
    role: 'Sr. DOM',
    division: 'DLI Division',
    badge: 'Sr.DOM/DLI',
    username: 'srdom_dli',
  },
  {
    id: 'drm',
    name: 'Sunita Verma',
    role: 'DRM',
    division: 'DLI Division',
    badge: 'DRM/DLI',
    username: 'drm_dli',
  },
  {
    id: 'chief-controller',
    name: 'A. P. Singh',
    role: 'Chief Controller',
    division: 'DLI Division',
    badge: 'CHC/DLI',
    username: 'controller_dli',
  },
  {
    id: 'sse-engineer',
    name: 'Meena Nair',
    role: 'SSE Engineer',
    division: 'DLI Division',
    badge: 'SSE/S&T',
    username: 'engineer_dli',
  },
  {
    id: 'station-master',
    name: 'H. Khan',
    role: 'Station Master',
    division: 'DLI Division',
    badge: 'SM/DLI',
    username: 'sm_dli',
  },
  {
    id: 'auditor',
    name: 'V. Krishnan',
    role: 'Vigilance Auditor',
    division: 'DLI Division',
    badge: 'AUD/DLI',
    username: 'auditor',
  },
  {
    id: 'admin',
    name: 'System Administrator',
    role: 'ADMIN',
    division: 'DLI Division',
    badge: 'SYS/DLI',
    username: 'admin',
  },
];

/** Demo-console password for the seeded persona users (SEED_PASSWORD in .env).
 * Frontend demo convenience only — the API stays rate-limited and fail-closed. */
const DEMO_PASSWORD = 'railbloc';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = usePersona();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (persona: (typeof DEMO_PERSONAS)[0]) => {
    setIsLoading(true);
    setError(null);
    try {
      // Real API login — mints a JWT so SSE stream tickets and every
      // authorized call work. NO fake logged-in state: if the backend is
      // unreachable we show an error instead of pretending (Rules §5).
      await login({ username: persona.username, password: DEMO_PASSWORD });
      router.push('/dashboard');
    } catch {
      setError(
        'Backend unreachable — is the Docker stack running? (docker compose up --build)',
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 border rounded-lg bg-card text-card-foreground shadow-lg">
      <div className="flex items-center justify-center gap-3 mb-2">
        <Train className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">RAIL-BLOC</h1>
      </div>
      <p className="text-muted-foreground text-center mb-8 text-sm">
        AI-Powered Block Planning System — Select a persona to begin.
      </p>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[#f5c2ca] bg-[#fdecef] px-3 py-2 text-xs text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a]/40 dark:text-[#f87171]"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {DEMO_PERSONAS.map((persona) => (
          <Button
            key={persona.id}
            variant="outline"
            className="w-full h-auto py-3 px-4 justify-start gap-3 hover:bg-accent/50 transition-colors"
            onClick={() => handleLogin(persona)}
            disabled={isLoading}
          >
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-semibold">{persona.name}</div>
              <div className="text-xs text-muted-foreground">
                {persona.role} • {persona.division}
              </div>
            </div>
            <span className="ml-auto font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {persona.badge}
            </span>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Demo mode — all data is simulated (B1-relative).
      </p>
    </div>
  );
}
