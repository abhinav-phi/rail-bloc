'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  Circle,
  ChevronDown,
  PenLine,
  FileSignature,
  Lock,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { APPROVAL_STAGES, SENTINEL_CHECKS, type Persona } from '@/lib/data';
import { cn } from '@/lib/utils';

type Props = {
  persona: Persona;
};

export function ApprovalWorkflow({ persona }: Props) {
  const [currentStage, setCurrentStage] = useState(4);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [signOpen, setSignOpen] = useState(false);
  const [signed, setSigned] = useState(false);

  const handleSign = () => {
    setSignOpen(false);
    setSigned(true);
    if (currentStage < APPROVAL_STAGES.length - 1) {
      setCurrentStage((s) => s + 1);
    }
  };

  return (
    <Card className="border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold text-foreground">
              Approval Workflow
            </h3>
            <Badge
              variant="outline"
              className="border-success/40 bg-success/10 text-[10px] text-success"
            >
              BLK-2026-W34-01
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Multi-stage approval chain with Sentinel safety verification
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          Stage {currentStage + 1}/{APPROVAL_STAGES.length}
        </span>
      </div>

      <div className="p-5">
        {/* Stage stepper */}
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted">
            <motion.div
              className="h-full bg-gradient-to-r from-success to-primary"
              initial={{ width: 0 }}
              animate={{
                width: `${(currentStage / (APPROVAL_STAGES.length - 1)) * 100}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {APPROVAL_STAGES.map((stage, i) => {
            const done = i < currentStage;
            const active = i === currentStage;
            return (
              <div
                key={stage}
                className="relative z-10 flex flex-1 flex-col items-center gap-1.5"
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                    done && 'border-success bg-success text-success-foreground',
                    active &&
                      'border-primary bg-primary/20 text-primary ring-4 ring-primary/20',
                    !done && !active && 'border-muted bg-card text-muted-foreground'
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-center text-[9px] font-medium leading-tight',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {stage}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action preview */}
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {signed ? 'Approval Completed' : 'Action Required'}
              </span>
            </div>
            {signed ? (
              <Badge className="border-success/40 bg-success/15 text-success">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Signed
              </Badge>
            ) : (
              <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                <PenLine className="mr-1 h-3 w-3" /> Pending
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {signed
              ? `Block plan BLK-2026-W34-01 has been digitally signed by ${persona.name} (${persona.role}). The next stage in the approval chain is now active.`
              : `As ${persona.role}, your digital signature is required to advance this block plan to the next approval stage. This action is cryptographically logged.`}
          </p>
          {!signed && (
            <Button
              onClick={() => setSignOpen(true)}
              className="gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              <PenLine className="h-4 w-4" />
              Sign &amp; Approve as {persona.role}
            </Button>
          )}
        </div>

        {/* Sentinel checklist */}
        <div className="mt-4 rounded-lg border border-border">
          <button
            onClick={() => setChecklistOpen((o) => !o)}
            className="flex w-full items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-foreground">
                Sentinel 10-Point Safety Check
              </span>
              <Badge className="border-success/40 bg-success/15 text-success">
                9 Pass · 1 Warn
              </Badge>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                checklistOpen && 'rotate-180'
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {checklistOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 border-t border-border p-4">
                  {SENTINEL_CHECKS.map((check) => (
                    <div
                      key={check.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30"
                    >
                      {check.status === 'pass' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      ) : check.status === 'warn' ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <div className="flex flex-1 items-center justify-between">
                        <span className="text-xs text-foreground">{check.label}</span>
                        <span
                          className={cn(
                            'font-mono text-[10px]',
                            check.status === 'pass' && 'text-success',
                            check.status === 'warn' && 'text-warning',
                            check.status === 'fail' && 'text-destructive'
                          )}
                        >
                          {check.detail}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Signature modal */}
      <AnimatePresence>
        {signOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setSignOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl"
            >
              <button
                onClick={() => setSignOpen(false)}
                className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                  <FileSignature className="h-7 w-7 text-primary" />
                </div>
                <h4 className="mt-3 text-base font-semibold text-foreground">
                  Digital Signature Confirmation
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  You are authorizing block plan{' '}
                  <span className="font-mono text-foreground">BLK-2026-W34-01</span> on
                  behalf of <span className="text-foreground">{persona.name}</span> ({persona.role}).
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Signing as
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {persona.name} · {persona.badge}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cryptographic token
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-success">
                    SHA-256 · 0x{persona.id.toUpperCase()}F3C92B4E8D1
                  </p>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSignOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2 bg-gradient-to-r from-primary to-accent"
                  onClick={handleSign}
                >
                  <PenLine className="h-4 w-4" />
                  Confirm Signature
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Card>
  );
}
