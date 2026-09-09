'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersona } from '@/context/persona-context';
import { useSSE } from '@/context/sse-context';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { Spinner } from '@/components/shared/loading';

/** The 7 seeded demo personas (mirror of the login-page list; password is the
 * shared DEMO_PASSWORD, documented on the login screen). */
const DEMO_PERSONAS = [
  {
    name: 'R. K. Sharma',
    role: 'Sr. DOM',
    username: 'srdom_dli',
    division: 'DLI',
  },
  { name: 'Sunita Verma', role: 'DRM', username: 'drm_dli', division: 'DLI' },
  {
    name: 'A. P. Singh',
    role: 'Controller',
    username: 'controller_dli',
    division: 'DLI',
  },
  {
    name: 'Meena Nair',
    role: 'Engineer',
    username: 'engineer_dli',
    division: 'DLI',
  },
  {
    name: 'H. Khan',
    role: 'Station Master',
    username: 'sm_dli',
    division: 'DLI',
  },
  {
    name: 'V. Krishnan',
    role: 'Auditor',
    username: 'auditor',
    division: 'DLI',
  },
  {
    name: 'System Administrator',
    role: 'ADMIN',
    username: 'admin',
    division: 'DLI',
  },
] as const;

const SEARCHABLE = [
  { href: '/dashboard', label: 'Operations Overview', num: '01' },
  { href: '/planner/weekly', label: 'Block Planning', num: '02' },
  { href: '/approvals', label: 'Approval Workflow', num: '03' },
  { href: '/audit-ledger', label: 'Audit Ledger', num: '04' },
  { href: '/corridor-map', label: 'Corridor Map', num: '05' },
  { href: '/string-chart', label: 'String Chart', num: '06' },
  { href: '/planner/26-week', label: '26-Week Calendar', num: '07' },
  { href: '/disruptions', label: 'Disruptions', num: '08' },
];

/** Top status bar — Emergent control-bar concept, brass skin.
 * Solver/Sentinel chips, ⌘K page-jump (real navigation), IST clock,
 * Ledger + Emergency (the real P0 flow), theme toggle, operator chip. */
export function Header({ onMenu }: { onMenu?: () => void }) {
  const [time, setTime] = useState('');
  const { persona, login } = usePersona();
  const { status, stale, connected } = useSSE();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(false);

  /** Real API login with the shared demo password — never fake persona state
   * (Rules §5). Failure keeps the current session untouched. */
  const switchPersona = async (username: string) => {
    if (switching) return;
    setSwitching(true);
    setSwitchError(false);
    try {
      await login({ username, password: 'railbloc' });
      setSwitchError(false);
    } catch {
      setSwitchError(true); // old persona/session stays intact
    } finally {
      setSwitching(false);
    }
  };
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const streamState = stale
    ? 'STREAM STALE'
    : status === 'connecting'
      ? 'STREAM CONNECTING…'
      : connected
        ? 'STREAM LIVE'
        : 'STREAM OFFLINE';
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Real Cmd/Ctrl+K binding — the label on the box is a promise, so wire it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setQuery('');
        setOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) +
          ' IST',
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const matches = query.trim()
    ? SEARCHABLE.filter((s) =>
        s.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : SEARCHABLE;

  const pageLabel =
    SEARCHABLE.find((s) => pathname === s.href)?.label ?? 'Control room';

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-card px-5">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="rounded-sm border border-border p-1.5 text-muted-foreground hover:border-brass/50 hover:text-brass"
        style={{ display: isDesktop ? 'none' : 'inline-flex' }}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
      <Link
        href="/dashboard"
        className="flex items-baseline gap-2 text-sm font-semibold tracking-[0.14em] text-foreground"
      >
        RAIL-BLOC
      </Link>
      <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground md:inline">
        {pageLabel}
      </span>

      {/* ⌘K page jump — real navigation, no dead box */}
      <div className="relative ml-4 hidden w-56 lg:block">
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) {
              router.push(matches[0].href);
              setQuery('');
              setOpen(false);
            }
          }}
          placeholder="Search anything"
          aria-label="Jump to console page"
          className="h-7 w-full rounded-sm border border-border bg-background/60 px-3 pr-10 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-brass/50 focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-muted-foreground">
          ⌘K
        </kbd>
        {open && query.trim() ? (
          <div className="absolute left-0 top-8 z-30 w-full rounded-sm border border-border bg-card shadow-none">
            {matches.length === 0 ? (
              <p className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                no match
              </p>
            ) : (
              matches.map((s) => (
                <button
                  key={s.href}
                  type="button"
                  onMouseDown={() => {
                    router.push(s.href);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-brass/10"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {s.num}
                  </span>
                  {s.label}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span
          className={cn(
            'atlas-badge',
            stale
              ? 'border-[color:var(--atlas-danger-ring)] text-[color:var(--atlas-danger)]'
              : status === 'connecting'
                ? 'atlas-badge-connecting'
                : connected
                  ? 'border-[color:var(--atlas-success-ring)] text-[color:var(--atlas-success)]'
                  : 'border-border text-muted-foreground',
          )}
          title="Live SSE stream health — the only health signal the frontend can honestly assert"
        >
          {streamState}
        </span>
        <div className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:block">
          {time}
        </div>
        <Link
          href="/audit-ledger"
          className="atlas-btn-secondary atlas-btn text-xs"
        >
          Ledger
        </Link>
        <Link
          href="/disruptions"
          className="atlas-btn-danger atlas-btn text-xs"
        >
          Emergency
        </Link>
        <ThemeToggle />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="flex items-center gap-2 border-l border-border pl-3 outline-none"
            aria-label="Switch demo persona"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-brass/40 bg-brass/10 text-xs font-bold text-brass"
            >
              {switching ? (
                <Spinner size={12} />
              ) : (
                (persona?.name ?? 'G').slice(0, 1)
              )}
            </span>
            <div className="hidden text-left text-xs leading-tight sm:block">
              <div className="font-semibold text-foreground">
                {switching ? 'Switching…' : persona ? persona.name : 'Guest'}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {persona ? persona.role : '—'}
              </div>
            </div>
            <ChevronDown
              size={14}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="bottom"
              align="end"
              sideOffset={6}
              className="z-[90] min-w-[220px] rounded-sm border border-border bg-card py-1 shadow-lg"
            >
              <p className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Switch persona · demo
              </p>
              {DEMO_PERSONAS.map((p) => {
                const current = persona?.id === p.username;
                return (
                  <DropdownMenu.Item
                    key={p.username}
                    disabled={switching || current}
                    onSelect={() => void switchPersona(p.username)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-xs outline-none',
                      'data-[highlighted]:bg-brass/10',
                      current && 'text-brass',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">
                        {p.name}
                      </span>
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {p.role} · {p.division}
                      </span>
                    </span>
                    {current ? (
                      <Check size={14} className="text-brass" />
                    ) : null}
                  </DropdownMenu.Item>
                );
              })}
              {switchError ? (
                <p className="border-t border-border px-3 py-2 text-[11px] text-[color:var(--atlas-danger)]">
                  Backend unreachable — still signed in as{' '}
                  {persona?.name ?? 'Guest'}.
                </p>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
