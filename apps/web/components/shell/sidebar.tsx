'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLive } from '@/lib/live';
import { usePersona } from '@/context/persona-context';
import {
  LayoutDashboard,
  CalendarRange,
  CalendarClock,
  Map as MapIcon,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  ScrollText,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Operations Overview', icon: LayoutDashboard },
  { href: '/planner/26-week', label: '26-Week Calendar', icon: CalendarRange },
  { href: '/planner/weekly', label: 'Block Planning', icon: CalendarClock },
  { href: '/corridor-map', label: 'Corridor Map', icon: MapIcon },
  { href: '/string-chart', label: 'String Chart', icon: GitBranch },
  { href: '/approvals', label: 'Approval Workflow', icon: ShieldCheck },
  { href: '/disruptions', label: 'Disruptions', icon: AlertTriangle },
  { href: '/audit-ledger', label: 'Audit Ledger', icon: ScrollText },
];

/** LIVE / CONNECTING / STALE pill — team design share, driven by our live SSE hook. */
function StreamPill() {
  const { connected, stale, lastEvent } = useLive();
  const label = connected ? 'LIVE' : stale ? 'STALE' : 'CONNECTING';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-wide',
        stale
          ? 'border-[#f5c2ca] bg-[#fdecef] text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a]/60 dark:text-[#f87171]'
          : 'border-[#bfe6d0] bg-[#e9f7ef] text-[#1b7f4b] dark:border-[#14532d] dark:bg-[#052e16]/60 dark:text-[#4ade80]',
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
          'inline-block h-2 w-2 rounded-full',
          stale ? 'animate-pulse bg-[#d6293e]' : 'bg-[#1b7f4b]',
        )}
      />
      {label}
      <span className="font-normal opacity-70">
        {connected && lastEvent ? '· live' : ''}
      </span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { persona } = usePersona();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card">
      {/* Brand block */}
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full bg-[#935073]"
          />
          <span className="text-sm font-bold tracking-tight text-foreground">
            RAIL-BLOC
          </span>
          <span className="rounded-full border border-[#d9afc1] bg-[#f8eaf0] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#935073] dark:border-[#502d55] dark:bg-[#3a1f33] dark:text-[#d58ba9]">
            Atlas
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Block Planning Console
        </p>
      </div>

      <nav className="grid content-start gap-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'atlas-nav-item',
                isActive && 'atlas-nav-item-active',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Stream + role footer */}
      <div className="mt-auto grid gap-3 border-t px-4 py-4">
        <StreamPill />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Signed in</span>
          <span className="font-semibold text-foreground">
            {persona ? persona.name : 'Guest'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Division</span>
          <span className="font-mono text-foreground">
            {persona?.division ?? '—'}
          </span>
        </div>
      </div>
    </aside>
  );
}
