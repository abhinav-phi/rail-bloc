'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrainTrack,
  ChevronDown,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  UserCircle2,
  AlertTriangle,
  ScrollText,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PERSONAS, type Persona } from '@/lib/data';
import { cn } from '@/lib/utils';

type HeaderProps = {
  persona: Persona;
  onPersonaChange: (p: Persona) => void;
  onOpenLedger: () => void;
  onOpenEmergency: () => void;
};

export function Header({
  persona,
  onPersonaChange,
  onOpenLedger,
  onOpenEmergency,
}: HeaderProps) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString('en-IN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST',
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/70 px-4 backdrop-blur-xl lg:px-6">
      {/* Left: branding + simulated badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 lg:hidden">
            <TrainTrack className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider text-foreground">
                RAIL-BLOC
              </span>
              <Badge
                variant="outline"
                className="hidden border-warning/40 bg-warning/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-warning sm:inline-flex"
              >
                Simulated Data
              </Badge>
            </div>
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
              AI Block Planning System
            </span>
          </div>
        </div>
      </div>

      {/* Center: live system status */}
      <div className="hidden items-center gap-2 md:flex">
        <StatusPill
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="CP-SAT Latency"
          value="28.4s"
          tone="primary"
          sub="< 35s target"
        />
        <div className="h-8 w-px bg-border" />
        <StatusPill
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="Sentinel Safety"
          value="100% Passed"
          tone="success"
          sub="10/10 checks"
        />
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-end leading-tight">
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {clock}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            25 Aug 2026
          </span>
        </div>
      </div>

      {/* Right: actions + persona */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenLedger}
          className="hidden gap-2 border-border bg-card/50 text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          <ScrollText className="h-4 w-4" />
          Ledger
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenEmergency}
          className="gap-2 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline">P0 Override</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-muted/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground">
                <UserCircle2 className="h-4.5 w-4.5" />
              </div>
              <div className="hidden flex-col items-start leading-tight sm:flex">
                <span className="text-xs font-semibold text-foreground">
                  {persona.role}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {persona.division}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Switch Persona
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PERSONAS.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => onPersonaChange(p)}
                className={cn(
                  'flex items-center gap-3 py-2',
                  p.id === persona.id && 'bg-primary/10',
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-accent/70 text-xs font-bold text-primary-foreground">
                  {p.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="flex flex-1 flex-col leading-tight">
                  <span className="text-sm font-medium text-foreground">
                    {p.role}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.name} · {p.badge}
                  </span>
                </div>
                {p.id === persona.id && (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function StatusPill({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: 'primary' | 'success';
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 rounded-lg border border-border bg-card/40 px-3 py-1.5"
      >
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md',
            tone === 'primary' && 'bg-primary/15 text-primary',
            tone === 'success' && 'bg-success/15 text-success',
          )}
        >
          {icon}
        </span>
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                tone === 'success' && 'bg-success pulse-ring',
              )}
            />
          </div>
          <span className="font-mono text-xs font-semibold text-foreground">
            {value}
          </span>
        </div>
        <span className="hidden text-[10px] text-muted-foreground xl:inline">
          {sub}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
