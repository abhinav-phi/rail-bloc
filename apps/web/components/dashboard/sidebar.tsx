'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CalendarClock,
  GitBranch,
  ShieldCheck,
  ScrollText,
  AlertTriangle,
  TrainTrack,
  ChevronLeft,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { id: 'overview', label: 'Operations Overview', icon: LayoutDashboard },
  { id: 'planning', label: 'Block Planning', icon: CalendarClock },
  { id: 'graph', label: 'Time-Distance Graph', icon: GitBranch },
  { id: 'approvals', label: 'Approval Workflow', icon: ShieldCheck },
  { id: 'ledger', label: 'Audit Ledger', icon: ScrollText },
  { id: 'emergency', label: 'Emergency Override', icon: AlertTriangle },
];

type SidebarProps = {
  active: string;
  onNavigate: (id: string) => void;
};

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="relative z-20 hidden shrink-0 border-r border-border bg-card/60 backdrop-blur-xl lg:flex lg:flex-col"
    >
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
          <TrainTrack className="h-5 w-5 text-primary-foreground" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col leading-tight"
            >
              <span className="font-mono text-sm font-bold tracking-wider text-foreground">
                RAIL-BLOC
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Block Planner
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isEmergency = item.id === 'emergency';
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                isEmergency &&
                  !isActive &&
                  'text-destructive/80 hover:text-destructive',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg border border-primary/40 bg-primary/10"
                  transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                />
              )}
              <Icon
                className={cn(
                  'relative z-10 h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110',
                  isEmergency && 'text-destructive',
                )}
              />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="relative z-10 whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <AnimatePresence initial={false}>
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-semibold text-foreground">
                  System Live
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Radio className="h-2.5 w-2.5" /> CP-SAT 28.4s
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:text-foreground"
        aria-label="Toggle sidebar"
      >
        <ChevronLeft
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            collapsed && 'rotate-180',
          )}
        />
      </button>
    </motion.aside>
  );
}
