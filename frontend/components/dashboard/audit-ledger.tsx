'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText,
  X,
  Copy,
  Check,
  ShieldCheck,
  Link2,
  Fingerprint,
  Clock,
  UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AUDIT_EVENTS } from '@/lib/data';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuditLedger({ open, onOpenChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (hash: string) => {
    navigator.clipboard?.writeText(hash);
    setCopied(hash);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15">
                  <ScrollText className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Cryptographic Audit Ledger
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Immutable SHA-256 hash-chained event timeline
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

            {/* Chain integrity banner */}
            <div className="flex items-center gap-2 border-b border-border bg-success/5 px-5 py-3">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span className="text-xs font-medium text-foreground">
                Chain integrity verified
              </span>
              <span className="ml-auto font-mono text-[11px] text-success">
                5/5 blocks valid
              </span>
            </div>

            {/* Event timeline */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              <div className="relative space-y-4">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                {AUDIT_EVENTS.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="relative pl-10"
                  >
                    {/* Node */}
                    <div
                      className={cn(
                        'absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2',
                        event.verified
                          ? 'border-success bg-success/15'
                          : 'border-destructive bg-destructive/15'
                      )}
                    >
                      <Fingerprint
                        className={cn(
                          'h-3.5 w-3.5',
                          event.verified ? 'text-success' : 'text-destructive'
                        )}
                      />
                    </div>

                    {/* Event card */}
                    <div className="rounded-lg border border-border bg-card/50 p-3 transition-colors hover:border-primary/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-foreground">
                            {event.action}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <UserCircle2 className="h-3 w-3" />
                              {event.actor}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {event.timestamp}
                            </span>
                          </div>
                        </div>
                        {event.verified && (
                          <Badge className="shrink-0 border-success/40 bg-success/10 px-1.5 py-0 text-[9px] text-success">
                            <ShieldCheck className="mr-0.5 h-2.5 w-2.5" />
                            Verified
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            Hash
                          </span>
                          <code className="font-mono text-[10px] text-accent">
                            {event.hash}
                          </code>
                          <button
                            onClick={() => handleCopy(event.hash)}
                            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {copied === event.hash ? (
                              <Check className="h-3 w-3 text-success" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        {event.prevHash !== '0000000000000000' && (
                          <div className="flex items-center gap-1.5">
                            <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            <span className="text-[10px] text-muted-foreground/60">
                              Prev
                            </span>
                            <code className="font-mono text-[10px] text-muted-foreground/70">
                              {event.prevHash}
                            </code>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          Block:
                        </span>
                        <code className="font-mono text-[10px] text-primary">
                          {event.blockId}
                        </code>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => onOpenChange(false)}
              >
                Close Ledger
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
