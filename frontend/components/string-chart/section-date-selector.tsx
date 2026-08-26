import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SectionDateSelector() {
  return (
    <Card className="rounded-none border-x-0 border-t-0 shadow-none bg-muted/20">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Corridor: Delhi - Ambala (DLI-UMB)</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Oct 18, 2026 (00:00 - 24:00)</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Previous Day</Button>
          <Button variant="outline" size="sm">Next Day</Button>
        </div>
      </CardContent>
    </Card>
  );
}
