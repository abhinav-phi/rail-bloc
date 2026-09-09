'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLive } from '@/lib/live';
import { usePersona } from '@/context/persona-context';
import {
  X,
  LayoutDashboard,
  CalendarClock,
  CheckCircle2,
  ScrollText,
  Map as MapIcon,
  Spline,
  CalendarRange,
  Siren,
  type LucideIcon,
} from 'lucide-react';

const navItems: {
  href: string;
  num: '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08';
  label: string;
  icon: LucideIcon;
}[] = [
  { href: '/dashboard', num: '01', label: 'Operations', icon: LayoutDashboard },
  {
    href: '/planner/weekly',
    num: '02',
    label: 'Weekly planner',
    icon: CalendarClock,
  },
  { href: '/approvals', num: '03', label: 'Approvals', icon: CheckCircle2 },
  { href: '/audit-ledger', num: '04', label: 'Audit ledger', icon: ScrollText },
  { href: '/corridor-map', num: '05', label: 'Corridor map', icon: MapIcon },
  { href: '/string-chart', num: '06', label: 'String chart', icon: Spline },
  {
    href: '/planner/26-week',
    num: '07',
    label: '26-week horizon',
    icon: CalendarRange,
  },
  { href: '/disruptions', num: '08', label: 'Disruptions', icon: Siren },
];

/** CONNECTING / LIVE / STALE pill — real SSE heartbeat (wiring unchanged). */
function StreamPill() {
  const { status, stale, connected, lastEvent } = useLive();
  const label = stale
    ? 'STALE'
    : status === 'connecting'
      ? 'CONNECTING…'
      : connected
        ? 'LIVE'
        : 'STALE';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-sm border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.14em]',
        stale
          ? 'border-[color:var(--atlas-danger-ring)] bg-[color:var(--atlas-danger-bg)] text-[color:var(--atlas-danger)]'
          : status === 'connecting'
            ? 'atlas-pill-connecting'
            : 'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]',
      )}
      title={
        stale
          ? 'Live stream not available — actions disabled'
          : status === 'connecting'
            ? 'Handing live feed… (one-time ticket handshake)'
            : 'Live SSE stream healthy (one-time ticket)'
      }
    >
      <span
        aria-hidden="true"
        className={cn(
          'atlas-pill-dot inline-block h-1.5 w-1.5 rounded-full',
          stale
            ? 'animate-pulse bg-[color:var(--atlas-danger)]'
            : status === 'connecting'
              ? 'bg-[color:var(--atlas-warning)]'
              : 'bg-[color:var(--atlas-success)]',
        )}
      />
      {label}
      <span className="font-normal opacity-70">
        {connected && lastEvent ? '· live' : ''}
      </span>
    </div>
  );
}

/** Console sidebar — Emergent numbered-rail concept, brass instrument skin.
 * Real wiring unchanged: same hrefs, same persona/live hooks. */
export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { persona, logout } = usePersona();
  // Desktop = sidebar always in-flow (relative); mobile = fixed drawer.
  // JS-driven (matchMedia) instead of lg: utilities — deterministic, no
  // transform-cascade surprises in the built sheet.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const visible = open || isDesktop;

  return (
    <>
      {open && !isDesktop ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/50"
          onClick={onClose}
        />
      ) : null}
      <aside
        className="z-40 flex h-full w-60 shrink-0 flex-col border-r border-border bg-card transition-transform duration-200 ease-out"
        style={{
          position: isDesktop ? 'relative' : 'fixed',
          inset: isDesktop ? 'auto' : '0 auto 0 0',
          transform: visible ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Brand block */}
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-[0.14em] text-foreground">
              RAIL-BLOC
            </span>
            <span className="font-mono text-[9px] tracking-[0.22em] text-muted-foreground">
              CONTROL / 01
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
            NETWORK / {persona?.division ?? 'DLI'} DIVISION
          </p>
        </div>

        <nav className="grid content-start gap-0.5 px-2.5 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'atlas-nav-item group',
                  isActive && 'atlas-nav-item-active',
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.num} ${item.label}`}
              >
                {React.createElement(item.icon, {
                  size: 16,
                  'aria-hidden': true,
                  className: cn(
                    'shrink-0',
                    isActive
                      ? 'text-brass'
                      : 'text-muted-foreground group-hover:text-foreground',
                  ),
                })}
                <span className="text-[13px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Stream + operator footer */}
        <div className="mt-auto grid gap-3 border-t border-border px-3 py-4">
          <StreamPill />
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-muted-foreground">
              OPERATOR
            </span>
            <span className="font-semibold text-foreground">
              {persona ? persona.name : 'Guest'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-muted-foreground">
              DIVISION
            </span>
            <span className="font-mono text-foreground">
              {persona?.division ?? '—'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="atlas-btn-secondary atlas-btn w-full text-xs"
          >
            EXIT
          </button>
        </div>
      </aside>
    </>
  );
}
