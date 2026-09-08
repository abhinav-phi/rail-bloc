'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePersona } from '@/context/persona-context';
import { ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { DotField } from '@/components/showcase/dot-field';

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

/** Railway SSO-style instrument login: clean centered card, monospace
 * identity chips, brass accents. Login itself is the real API flow —
 * a JWT is minted, no fake state (Rules §5). */
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <DotField
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div className="grain-overlay" aria-hidden="true" />
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="flex items-baseline justify-center gap-3">
            <span className="text-xl font-semibold tracking-[0.16em]">
              RAIL-BLOC
            </span>
            <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground">
              CONTROL / 01
            </span>
          </div>
          <p className="mt-3 font-mono text-[10px] tracking-[0.26em] text-muted-foreground">
            INDIAN RAILWAYS · BLOCK PLANNING SYSTEM
          </p>
        </div>

        <div className="rounded-sm border border-border bg-card">
          <div className="border-b border-border px-6 py-3">
            <span className="atlas-section-label">IDENTIFY OPERATOR</span>
          </div>

          <div className="px-6 py-6">
            {error ? (
              <div
                role="alert"
                className="atlas-alert-danger mb-4 px-3 py-2 text-xs"
              >
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              {DEMO_PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => handleLogin(persona)}
                  disabled={isLoading}
                  className="group flex w-full items-center gap-3 rounded-sm border border-border bg-background/40 px-4 py-2.5 text-left transition-colors hover:border-brass/50 hover:bg-brass/5 disabled:opacity-45"
                >
                  <ShieldCheck
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brass"
                    aria-hidden="true"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      {persona.name}
                    </span>
                    <span className="block font-mono text-[10px] tracking-wide text-muted-foreground">
                      {persona.role} · {persona.division}
                    </span>
                  </span>
                  <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {persona.badge}
                  </span>
                </button>
              ))}
            </div>

            {isLoading ? (
              <p className="mt-4 text-center font-mono text-[11px] tracking-wide text-brass">
                AUTHENTICATING…
              </p>
            ) : null}
          </div>

          <div className="border-t border-border px-6 py-3">
            <p className="text-center font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
              SIMULATED DATA — DEMO SCOPE
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Access is role-scoped. Sr. DOM and DRM approvals are bound to distinct
          operators — the chain of custody starts here.
        </p>
      </div>
    </div>
  );
}
