'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Train,
  Truck,
  Wrench,
  Layers,
  Info,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TRAIN_PATHS,
  formatClock,
  TIMELINE_HOURS,
  type TrainPath,
} from '@/lib/data';
import { cn } from '@/lib/utils';

const TRACKS = [
  { id: 1, label: 'Line 1 (UP Main)', direction: 'UP' as const },
  { id: 2, label: 'Line 2 (DN Main)', direction: 'DN' as const },
  { id: 3, label: 'Line 3 (Corridor Block)', direction: 'Mixed' as const },
];

const HOUR_WIDTH = 200;
const LABEL_WIDTH = 180;
const TRACK_HEIGHT = 64;
const TOTAL_WIDTH = TIMELINE_HOURS * HOUR_WIDTH;

const TYPE_STYLES = {
  passenger: {
    bg: 'bg-primary/20',
    border: 'border-primary/50',
    text: 'text-primary',
    icon: Train,
  },
  freight: {
    bg: 'bg-muted/60',
    border: 'border-muted-foreground/40',
    text: 'text-muted-foreground',
    icon: Truck,
  },
  maintenance: {
    bg: 'bg-accent/20',
    border: 'border-accent/50',
    text: 'text-accent',
    icon: Wrench,
  },
} as const;

export function TrainGraph() {
  const [hovered, setHovered] = useState<TrainPath | null>(null);
  const [showShadow, setShowShadow] = useState(true);

  const hours = useMemo(
    () => Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => i),
    []
  );

  return (
    <Card className="overflow-hidden border-border bg-card/60">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Time-Distance Train Graph
            </h3>
            <Badge
              variant="outline"
              className="border-accent/40 bg-accent/10 text-[10px] text-accent"
            >
              WTT + Forecast
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Passenger paths, freight forecasts, and co-allocated shadow blocks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Legend />
          <button
            onClick={() => setShowShadow((s) => !s)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              showShadow
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-sm',
                showShadow ? 'bg-accent' : 'bg-muted-foreground/30'
              )}
            />
            Shadow Blocks
          </button>
        </div>
      </div>

      <div className="relative overflow-x-auto scrollbar-thin">
        <div style={{ minWidth: LABEL_WIDTH + TOTAL_WIDTH }}>
          {/* Hour header */}
          <div className="flex border-b border-border">
            <div
              className="shrink-0 border-r border-border bg-card/40 px-4 py-2"
              style={{ width: LABEL_WIDTH }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Track / Section
              </span>
            </div>
            <div className="relative flex-1" style={{ width: TOTAL_WIDTH }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 flex h-full flex-col justify-center border-l border-border/60 px-2"
                  style={{ left: h * HOUR_WIDTH }}
                >
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                    {formatClock(h * 60)}
                  </span>
                </div>
              ))}
              <div className="py-2" style={{ height: 36 }} />
            </div>
          </div>

          {/* Tracks */}
          {TRACKS.map((track) => {
            const paths = TRAIN_PATHS.filter((p) => p.track === track.id);
            return (
              <div
                key={track.id}
                className="flex border-b border-border/60 last:border-b-0"
              >
                <div
                  className="shrink-0 flex items-center gap-2 border-r border-border bg-card/40 px-4"
                  style={{ width: LABEL_WIDTH, height: TRACK_HEIGHT }}
                >
                  <span
                    className={cn(
                      'flex h-6 w-8 items-center justify-center rounded text-[10px] font-bold',
                      track.direction === 'UP' && 'bg-success/15 text-success',
                      track.direction === 'DN' && 'bg-primary/15 text-primary',
                      track.direction === 'Mixed' && 'bg-accent/15 text-accent'
                    )}
                  >
                    {track.direction}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {track.label}
                  </span>
                </div>

                <div
                  className="relative bg-grid"
                  style={{ width: TOTAL_WIDTH, height: TRACK_HEIGHT }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 h-full border-l border-border/40"
                      style={{ left: h * HOUR_WIDTH }}
                    />
                  ))}

                  {paths.map((p) => {
                    const style = TYPE_STYLES[p.type];
                    const left = (p.startMin / 60) * HOUR_WIDTH;
                    const width = ((p.endMin - p.startMin) / 60) * HOUR_WIDTH;
                    const isShadow = p.shadow && showShadow;
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                        style={{
                          left: left + LABEL_WIDTH,
                          width,
                          top: track.id === 3 ? 8 : 10,
                          height: track.id === 3 ? 48 : 44,
                        }}
                        className="absolute origin-left"
                        onMouseEnter={() => setHovered(p)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <div
                          className={cn(
                            'group relative h-full w-full cursor-pointer rounded-md border px-2 py-1 transition-all hover:z-10 hover:shadow-lg',
                            style.bg,
                            style.border,
                            isShadow &&
                              'ring-1 ring-accent/40 ring-offset-1 ring-offset-background'
                          )}
                        >
                          {isShadow && (
                            <div className="absolute inset-0 rounded-md bg-accent/5 bg-dotted opacity-50" />
                          )}
                          <div className="relative flex h-full items-center gap-1.5 overflow-hidden">
                            <style.icon
                              className={cn('h-3 w-3 shrink-0', style.text)}
                            />
                            <span
                              className={cn(
                                'truncate text-[10px] font-medium',
                                style.text
                              )}
                            >
                              {p.label}
                            </span>
                            {p.departments && (
                              <span className="ml-auto flex gap-0.5">
                                {p.departments.map((d) => (
                                  <span
                                    key={d}
                                    className="h-1.5 w-1.5 rounded-full bg-accent"
                                    title={d}
                                  />
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute bottom-4 right-4 z-20 w-64 rounded-lg border border-border bg-popover/95 p-3 shadow-xl backdrop-blur"
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TYPE_STYLES[hovered.type].icon;
                  return (
                    <Icon
                      className={cn('h-4 w-4', TYPE_STYLES[hovered.type].text)}
                    />
                  );
                })()}
                <span className="text-xs font-semibold text-foreground">
                  {hovered.label}
                </span>
              </div>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Start</span>
                  <span className="text-foreground">{formatClock(hovered.startMin)}</span>
                </div>
                <div className="flex justify-between">
                  <span>End</span>
                  <span className="text-foreground">{formatClock(hovered.endMin)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="text-foreground">
                    {((hovered.endMin - hovered.startMin) / 60).toFixed(1)}h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Direction</span>
                  <span className="text-foreground">{hovered.direction}</span>
                </div>
                {hovered.departments && (
                  <div className="flex justify-between">
                    <span>Departments</span>
                    <span className="text-accent">{hovered.departments.join(' + ')}</span>
                  </div>
                )}
                {hovered.priority && (
                  <div className="flex justify-between">
                    <span>Priority</span>
                    <span
                      className={cn(
                        hovered.priority === 'P0' && 'text-destructive',
                        hovered.priority === 'P1' && 'text-warning',
                        hovered.priority === 'Routine' && 'text-muted-foreground'
                      )}
                    >
                      {hovered.priority}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        Hover any block for details. Shadow blocks show co-allocated Civil + TRD + S&amp;T tasks.
      </div>
    </Card>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 sm:flex">
      {(
        [
          { label: 'Passenger', style: TYPE_STYLES.passenger },
          { label: 'Freight', style: TYPE_STYLES.freight },
          { label: 'Maintenance', style: TYPE_STYLES.maintenance },
        ] as const
      ).map(({ label, style }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm border', style.bg, style.border)} />
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
