'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  CalendarRange, 
  CalendarClock, 
  Map as MapIcon, 
  GitBranch, 
  ShieldCheck, 
  AlertTriangle, 
  ScrollText 
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[248px] flex-col border-r bg-background">
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
