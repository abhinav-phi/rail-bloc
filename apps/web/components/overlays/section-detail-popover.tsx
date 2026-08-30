import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export function SectionDetailPopover({
  sectionId = 'DLI-PNP',
}: {
  sectionId?: string;
}) {
  return (
    <Card className="w-72 shadow-xl border-primary/20">
      <CardHeader className="py-3 px-4 border-b bg-muted/30">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          {sectionId}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Active Blocks:</span>
          <span className="font-bold font-mono text-rose-500">3</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pending Approvals:</span>
          <span className="font-bold font-mono">5</span>
        </div>
        <div className="flex justify-between border-t pt-2 mt-1">
          <span className="text-muted-foreground">Trains in Section:</span>
          <span className="font-bold font-mono text-emerald-500">12</span>
        </div>
      </CardContent>
    </Card>
  );
}
