import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelEstimateLabel } from './model-estimate-label';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiMetricCardProps {
  title: string;
  value: string;
  unit: string;
  target: string;
  delta: number;
  isEstimate?: boolean;
}

export function KpiMetricCard({ title, value, unit, target, delta, isEstimate }: KpiMetricCardProps) {
  const isPositive = delta > 0;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">
          {value}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
        </div>
        <div className="flex items-center text-xs mt-1">
          <span className={cn("flex items-center mr-2 font-medium", isPositive ? "text-emerald-500" : "text-rose-500")}>
            {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
            {Math.abs(delta)}%
          </span>
          <span className="text-muted-foreground">vs target {target}</span>
        </div>
        {isEstimate && <ModelEstimateLabel />}
      </CardContent>
    </Card>
  );
}
