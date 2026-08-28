'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePersona } from '@/context/persona-context';

export function Header() {
  const [time, setTime] = useState('');
  const { persona } = usePersona();

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b px-6 bg-background">
      <div className="font-bold text-lg">RAIL-BLOC</div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
        <span>Solver: OPTIMAL</span>
        <span>|</span>
        <span>Sentinel: PASS</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="font-mono text-sm">{time}</div>
        <Button variant="outline" asChild size="sm">
          <Link href="/audit-ledger">Ledger</Link>
        </Button>
        <Button variant="destructive" size="sm">
          Emergency
        </Button>
        <div className="text-sm font-medium">
          {persona ? `${persona.name} (${persona.role})` : 'Guest'}
        </div>
      </div>
    </header>
  );
}
