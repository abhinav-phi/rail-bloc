import React from 'react';
import { Department } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { HardHat, Zap, RadioTower } from 'lucide-react';

const DEPT_CONFIG = {
  CIVIL: { label: 'Civil', icon: HardHat, className: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20' },
  TRD: { label: 'TRD', icon: Zap, className: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20' },
  SNT: { label: 'S&T', icon: RadioTower, className: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20' },
};

export function DepartmentTag({ dept }: { dept: Department }) {
  const config = DEPT_CONFIG[dept];
  const Icon = config.icon;
  
  return (
    <Badge variant="outline" className={`gap-1 pr-2 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
