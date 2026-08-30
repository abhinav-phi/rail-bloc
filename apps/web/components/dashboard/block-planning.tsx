'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  CalendarRange,
  Cpu,
  CheckCircle2,
  Loader2,
  Clock,
  AlertOctagon,
  CircleDot,
  Building2,
  Zap,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MAINTENANCE_DEMANDS,
  ROLLING_WEEKS,
  type Priority,
  type MaintenanceDemand,
} from '@/lib/data';
import { cn } from '@/lib/utils';

const SOURCE_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  TMS: Building2,
  TDMS: Zap,
  SMMS: CircleDot,
};

const PRIORITY_STYLES: Record<
  Priority,
  { badge: string; dot: string; label: string }
> = {
  P0: {
    badge: 'border-destructive/40 bg-destructive/15 text-destructive',
    dot: 'bg-destructive',
    label: 'P0 Emergency',
  },
  P1: {
    badge: 'border-warning/40 bg-warning/15 text-warning',
    dot: 'bg-warning',
    label: 'P1 Urgent',
  },
  Routine: {
    badge: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
    dot: 'bg-muted-foreground',
    label: 'Routine',
  },
};

const SOLVE_STEPS = [
  'Loading maintenance demands (TMS, TDMS, SMMS)',
  'Building constraint model (CP-SAT)',
  'Optimizing shadow block co-allocation',
  'Running Sentinel safety verification',
  'Finalizing optimal plan',
];

export function BlockPlanning() {
  const [horizon, setHorizon] = useState<'tactical' | 'rolling'>('tactical');
  const [solving, setSolving] = useState(false);
  const [solveStep, setSolveStep] = useState(0);
  const [solved, setSolved] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSolve = async () => {
    setSolving(true);
    setSolved(false);
    setDrawerOpen(true);
    for (let i = 0; i < SOLVE_STEPS.length; i++) {
      setSolveStep(i);
      await new Promise((r) => setTimeout(r, 850));
    }
    setSolving(false);
    setSolved(true);
  };

  return (
    <Card className="border-border bg-card/60">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Multi-Horizon Block Planning
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pending demands from TMS, TDMS, and SMMS with urgency prioritization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
            <HorizonToggle
              active={horizon === 'tactical'}
              onClick={() => setHorizon('tactical')}
              icon={CalendarDays}
              label="7-Day Tactical"
            />
            <HorizonToggle
              active={horizon === 'rolling'}
              onClick={() => setHorizon('rolling')}
              icon={CalendarRange}
              label="26-Week Rolling"
            />
          </div>
          <Button
            onClick={handleSolve}
            disabled={solving}
            className="gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
          >
            {solving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Cpu className="h-4 w-4" />
            )}
            Solve with CP-SAT
          </Button>
        </div>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {horizon === 'tactical' ? (
            <motion.div
              key="tactical"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TacticalWeek />
            </motion.div>
          ) : (
            <motion.div
              key="rolling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RollingCalendar />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Solve completion drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => !solving && setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border p-5">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">
                    CP-SAT Solver
                  </h4>
                </div>
                {!solving && (
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                {solving ? (
                  <div className="space-y-4">
                    {SOLVE_STEPS.map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {i < solveStep ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : i === solveStep ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted" />
                        )}
                        <span
                          className={cn(
                            'text-sm',
                            i <= solveStep
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {step}
                        </span>
                      </div>
                    ))}
                    <div className="mt-6">
                      <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
                        <span>Optimizing</span>
                        <span className="font-mono">
                          {Math.round(
                            ((solveStep + 1) / SOLVE_STEPS.length) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                          animate={{
                            width: `${((solveStep + 1) / SOLVE_STEPS.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Optimal plan generated
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Solver completed in 28.4s · 6 demands allocated
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Results
                      </p>
                      {[
                        { label: 'Shadow blocks created', value: '4' },
                        {
                          label: 'Departments bundled',
                          value: '3 (Civil + TRD + S&T)',
                        },
                        { label: 'Passenger delay avoided', value: '184 min' },
                        {
                          label: 'Sentinel safety checks',
                          value: '10/10 passed',
                        },
                        { label: 'Solver status', value: 'OPTIMAL' },
                      ].map((r) => (
                        <div
                          key={r.label}
                          className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                        >
                          <span className="text-xs text-muted-foreground">
                            {r.label}
                          </span>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {r.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="w-full gap-2 bg-gradient-to-r from-primary to-accent"
                      onClick={() => setDrawerOpen(false)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Review Plan
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Card>
  );
}

function HorizonToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function TacticalWeek() {
  return (
    <div className="space-y-2">
      {MAINTENANCE_DEMANDS.map((demand, i) => (
        <DemandRow key={demand.id} demand={demand} index={i} />
      ))}
    </div>
  );
}

function DemandRow({
  demand,
  index,
}: {
  demand: MaintenanceDemand;
  index: number;
}) {
  const Icon = SOURCE_ICON[demand.source] ?? CircleDot;
  const prio = PRIORITY_STYLES[demand.priority];
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3 transition-all hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-foreground">
            {demand.id}
          </span>
          <Badge
            variant="outline"
            className={cn('px-1.5 py-0 text-[9px]', prio.badge)}
          >
            <span className={cn('mr-1 h-1.5 w-1.5 rounded-full', prio.dot)} />
            {prio.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {demand.source}
          </span>
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {demand.asset} · {demand.description}
        </span>
      </div>
      <div className="hidden items-center gap-4 sm:flex">
        <div className="flex flex-col items-end leading-tight">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {demand.requestedSlot}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {demand.durationHrs}h duration
          </span>
        </div>
        <span
          className={cn(
            'rounded-md px-2 py-1 text-[10px] font-semibold',
            demand.status === 'Allocated'
              ? 'bg-success/15 text-success'
              : 'bg-muted/50 text-muted-foreground',
          )}
        >
          {demand.status}
        </span>
      </div>
    </motion.div>
  );
}

function RollingCalendar() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          26-week rolling horizon · block load forecast
        </p>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-primary" /> Current
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-muted-foreground/40" />{' '}
            Planned
          </span>
        </div>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      >
        {ROLLING_WEEKS.map((w, i) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              'group relative flex aspect-square flex-col items-center justify-center rounded-md border text-center transition-all hover:z-10 hover:scale-110',
              w.current
                ? 'border-primary/50 bg-primary/15'
                : 'border-border bg-card/40 hover:border-primary/30',
            )}
            title={`${w.label} · ${w.load}% load`}
          >
            <span
              className="absolute bottom-1 left-1 right-1 h-0.5 rounded-full"
              style={{
                width: `${w.load}%`,
                backgroundColor: w.current
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--muted-foreground) / 0.5)',
              }}
            />
            <span
              className={cn(
                'font-mono text-[8px] font-semibold',
                w.current ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {w.label.replace(' (Current)', '').replace('W', '')}
            </span>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Weeks planned', value: '26' },
          { label: 'Avg block load', value: '62%' },
          { label: 'Peak weeks', value: 'W36, W41' },
          { label: 'Horizon end', value: 'W08 2027' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
