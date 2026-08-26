'use client';
import React from 'react';
import { useSolver } from '@/context/solver-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';

export function SolverStatusBanner() {
  const { status, triggerSolve } = useSolver();
  
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground font-medium">Solver:</span>
        {status === 'IDLE' && <Badge variant="outline" className="bg-slate-100 text-slate-600"><Clock className="w-3 h-3 mr-1"/> Idle</Badge>}
        {status === 'RUNNING' && <Badge variant="outline" className="bg-blue-100 text-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin"/> Running</Badge>}
        {status === 'OPTIMAL' && <Badge variant="outline" className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1"/> Optimal (Bound: 0.0%)</Badge>}
        {status === 'INFEASIBLE' && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1"/> Infeasible</Badge>}
      </div>
      <Button size="sm" onClick={() => triggerSolve('week-42')} disabled={status === 'RUNNING'} className="h-8">
        <Play className="h-4 w-4 mr-1" />
        Run MILP Solver
      </Button>
    </div>
  );
}
