'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePersona } from '@/context/persona-context';

/** Top status bar — Atlas design: solver/sentinel chips, IST clock, Ledger link,
 *  Emergency action. Emergency navigates to the Disruptions drill page (the real
 *  P0 breakdown flow) instead of being a dead button. */
export function Header() {
  const [time, setTime] = useState('');
  const { persona } = usePersona();

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) +
          ' IST',
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="atlas-badge border-[#bfe6d0] bg-[#e9f7ef] text-[#1b7f4b] dark:border-[#14532d] dark:bg-[#052e16]/60 dark:text-[#4ade80]">
          Solver: OPTIMAL
        </span>
        <span className="atlas-badge border-[#c3d6f5] bg-[#eaf1fc] text-[#2d63c8] dark:border-[#1e3a8a] dark:bg-[#172554]/60 dark:text-[#93c5fd]">
          Sentinel: PASS
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="font-mono text-xs text-muted-foreground">{time}</div>
        <Link
          href="/audit-ledger"
          className="atlas-btn-secondary atlas-btn text-xs"
        >
          Ledger
        </Link>
        <Link href="/disruptions" className="atlas-btn-danger atlas-btn text-xs">
          Emergency
        </Link>
        <div className="flex items-center gap-2 border-l pl-3">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f8eaf0] text-xs font-bold text-[#935073] dark:bg-[#3a1f33] dark:text-[#d58ba9]"
          >
            {(persona?.name ?? 'G').slice(0, 1)}
          </span>
          <div className="text-xs leading-tight">
            <div className="font-semibold text-foreground">
              {persona ? persona.name : 'Guest'}
            </div>
            <div className="text-muted-foreground">
              {persona ? persona.role : '—'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
