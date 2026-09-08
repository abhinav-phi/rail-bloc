'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLive } from '@/lib/live';
import { usePersona } from '@/context/persona-context';
import { X } from 'lucide-react';

const navItems = [
  { href: '/dashboard', num: '01', label: 'Operations' },
  { href: '/planner/weekly', num: '02', label: 'Weekly planner' },
  { href: '/approvals', num: '03', label: 'Approvals' },
  { href: '/audit-ledger', num: '04', label: 'Audit ledger' },
  { href: '/corridor-map', num: '05', label: 'Corridor map' },
  { href: '/string-chart', num: '06', label: 'String chart' },
  { href: '/planner/26-week', num: '07', label: '26-week horizon' },
  { href: '/disruptions', num: '08', label: 'Disruptions' },
];

/** LIVE / CONNECTING / STALE pill — real SSE heartbeat (wiring unchanged). */
function StreamPill() {
  const { connected, stale, lastEvent } = useLive();
  const label = connected ? 'LIVE' : stale ? 'STALE' : 'CONNECTING';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-sm border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.14em]',
        stale
          ? 'border-[color:var(--atlas-danger-ring)] bg-[color:var(--atlas-danger-bg)] text-[color:var(--atlas-danger)]'
          : 'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]',
      )}
      title={
        stale
          ? 'Live stream not available — actions disabled'
          : 'Live SSE stream healthy (one-time ticket)'
      }
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          stale
            ? 'animate-pulse bg-[color:var(--atlas-danger)]'
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
                  'atlas-nav-item',
                  isActive && 'atlas-nav-item-active',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {item.num}
                </span>
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
