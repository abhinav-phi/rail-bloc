import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, ShieldCheck, Map, GitBranch } from 'lucide-react';

const NAV_ITEMS = [
  {
    title: 'Block Planning',
    desc: 'Weekly tactical allocation',
    icon: CalendarClock,
    href: '/planner/weekly',
  },
  {
    title: 'Approvals',
    desc: 'Review & authorize blocks',
    icon: ShieldCheck,
    href: '/approvals',
  },
  {
    title: 'Corridor Map',
    desc: 'GIS situational awareness',
    icon: Map,
    href: '/corridor-map',
  },
  {
    title: 'String Chart',
    desc: 'Time-distance graphing',
    icon: GitBranch,
    href: '/string-chart',
  },
];

export function QuickNavCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link href={item.href} key={item.title}>
            <Card className="hover:bg-accent/50 transition-colors h-full cursor-pointer group">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <Icon className="h-8 w-8 mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.desc}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
