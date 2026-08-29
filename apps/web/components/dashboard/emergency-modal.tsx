'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Train,
  Users,
  Clock,
  Zap,
  X,
  ShieldAlert,
  Ban,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type EmergencyType = 'rail-fracture' | 'ohe-breakdown';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMERGENCY_TYPES: {
  id: EmergencyType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'rail-fracture',
    label: 'Rail Fracture',
    description: 'Track integrity failure detected',
    icon: Train,
  },
  {
    id: 'ohe-breakdown',
    label: 'OHE Breakdown',
    description: 'Overhead equipment power loss',
    icon: Zap,
  },
];

export function EmergencyModal({ open, onOpenChange }: Props) {
  const [type, setType] = useState<EmergencyType>('rail-fracture');
  const [issued, setIssued] = useState(false);

  const handleIssue = () => {
    setIssued(true);
    setTimeout(() => {
      onOpenChange(false);
      setIssued(false);
    }, 2500);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={() => !issued && onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-destructive/40 bg-card shadow-2xl"
          >
            {!issued ? (
              <>
                <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 p-5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/20">
                      <ShieldAlert className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-destructive">
                        P0 Emergency Override
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Instant advisory revoke — blast-radius preview
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5">
                  {/* Emergency type selector */}
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Emergency Type
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {EMERGENCY_TYPES.map((et) => {
                      const Icon = et.icon;
                      const active = type === et.id;
                      return (
                        <button
                          key={et.id}
                          onClick={() => setType(et.id)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all',
                            active
                              ? 'border-destructive/50 bg-destructive/10'
                              : 'border-border bg-card/40 hover:border-destructive/30',
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-5 w-5',
                              active
                                ? 'text-destructive'
                                : 'text-muted-foreground',
                            )}
                          />
                          <div>
                            <p
                              className={cn(
                                'text-xs font-semibold',
                                active ? 'text-destructive' : 'text-foreground',
                              )}
                            >
                              {et.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {et.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Blast radius preview */}
                  <div className="mt-5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Blast-Radius Impact Preview
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <ImpactCard
                        icon={Train}
                        label="Trains Affected"
                        value="14"
                        sub="8 mail · 6 freight"
                      />
                      <ImpactCard
                        icon={Users}
                        label="Passengers Impacted"
                        value="4,820"
                        sub="across 8 stations"
                      />
                      <ImpactCard
                        icon={Clock}
                        label="Est. Delay"
                        value="42 min"
                        sub="single-line working"
                      />
                      <ImpactCard
                        icon={Radio}
                        label="Section Blocked"
                        value="TKM 196–214"
                        sub="18 km corridor"
                      />
                    </div>
                  </div>

                  {/* Advisory details */}
                  <div className="mt-5 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <p className="text-[11px] text-muted-foreground">
                        Issuing this advisory will immediately revoke all active
                        block possessions in the affected corridor, trigger
                        single-line working protocols, and notify the Chief
                        Controller, SSE on-duty, and adjacent station masters.
                        This action is cryptographically logged.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 gap-2"
                      onClick={handleIssue}
                    >
                      <Ban className="h-4 w-4" />
                      Issue Advisory Revoke
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center p-10 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15"
                >
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </motion.div>
                <h4 className="mt-4 text-base font-semibold text-foreground">
                  Advisory Issued
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Emergency revoke broadcast to all stations in the corridor.
                  Single-line working activated. Sentinel audit event logged.
                </p>
                <Badge className="mt-4 border-success/40 bg-success/10 font-mono text-success">
                  ADV-0xA3F2 · 2026-08-25 09:46
                </Badge>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ImpactCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-destructive" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-1 font-mono text-lg font-bold text-foreground">
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
