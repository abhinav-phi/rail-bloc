'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { getToken } from '@/lib/api';
import {
  PAGE_LABELS,
  canPage,
  hrefForPage,
  pageForPath,
  pagesFor,
  type PageKey,
} from '@/lib/rbac';
import { PersonaProvider, usePersona } from '@/context/persona-context';
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

/** Deep-link guard for role-filtered pages (lib/rbac.ts). The sidebar/⌘K
 * already hide what a role can't open; typing a URL straight lands here —
 * an honest card naming the operator's role, not a silent redirect. */
function RoleGate({ children }: { children: React.ReactNode }) {
  const { persona } = usePersona();
  const pathname = usePathname();
  const page = pageForPath(pathname);
  if (page && !canPage(persona?.role, page)) {
    return <RoleDenied page={page} />;
  }
  return <>{children}</>;
}

function RoleDenied({ page }: { page: PageKey }) {
  const { persona } = usePersona();
  const allowed = pagesFor(persona?.role);
  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-16">
      <div className="atlas-card p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[color:var(--atlas-danger-ring)] bg-[color:var(--atlas-danger-bg)] text-[color:var(--atlas-danger)]">
            <ShieldX size={16} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {PAGE_LABELS[page]} is not part of your console
            </h1>
            <p className="font-mono text-[11px] text-muted-foreground">
              {persona?.role ?? 'UNKNOWN'} · {persona?.division ?? '—'} · server
              enforces this at the API too
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Access in RAIL-BLOC is role-scoped: this page belongs to a different
          operator seat. Your role has these consoles available:
        </p>
        <nav
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Pages available for your role"
        >
          {allowed.map((p) => (
            <Link
              key={p}
              href={hrefForPage(p)}
              className="atlas-btn-secondary atlas-btn text-xs"
            >
              {PAGE_LABELS[p]}
            </Link>
          ))}
        </nav>
        <p className="mt-5 text-xs text-muted-foreground">
          Demo: use the persona switcher (top-right) to open the console another
          role would see.
        </p>
      </div>
    </div>
  );
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
          <RoleGate>{children}</RoleGate>
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
        <PersonaKeyedShell>{children}</PersonaKeyedShell>
      </AuthGate>
    </PersonaProvider>
  );
}

/** Re-keyed by persona.id: a role switch (header dropdown) remounts the whole
 * post-auth shell — SSE mints a fresh ticket (lib/live connects once on
 * mount), role-gated page data refetches, header chip and sidebar footer
 * update together. No logout/login dance in the demo. */
function PersonaKeyedShell({ children }: { children: React.ReactNode }) {
  const { persona } = usePersona();
  return (
    <SSEProvider key={persona?.id}>
      <SolverProvider key={persona?.id}>
        <ConsoleShell key={persona?.id}>{children}</ConsoleShell>
      </SolverProvider>
    </SSEProvider>
  );
}
