import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Train, ShieldAlert, GitMerge } from 'lucide-react';

export function BlastRadiusPanel() {
  return (
    <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto bg-background">
      <div>
        <h2 className="text-2xl font-bold font-mono text-destructive mb-1">INC-992: OHE Breakdown</h2>
        <p className="text-muted-foreground">Reported at 10:45 AM • Delhi - Panipat Section (Km 45)</p>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2"><Train className="h-4 w-4"/> Impacted Trains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">14</div>
            <p className="text-xs text-muted-foreground">Expected delay: 45-120 mins</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2"><ShieldAlert className="h-4 w-4"/> Block Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">3</div>
            <p className="text-xs text-muted-foreground">Requires immediate rescheduling</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><GitMerge className="h-4 w-4"/> Coalescing Resolution (AI Provisional Plan)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted/50 rounded text-sm border">
            <strong>Action 1:</strong> Divert Express Trains (12011, 12013) via Rohtak branch line.
          </div>
          <div className="p-3 bg-muted/50 rounded text-sm border">
            <strong>Action 2:</strong> Cancel Freight Blocks BLK-402, BLK-403 for today.
          </div>
          <div className="p-3 bg-muted/50 rounded text-sm border">
            <strong>Action 3:</strong> Deploy Tower Wagon TW-4 from SNP base immediately.
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline">Modify Plan</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Acknowledge & Execute</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
