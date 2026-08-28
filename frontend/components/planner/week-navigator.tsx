import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export function WeekNavigator() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 px-4 py-1.5 border rounded-md bg-card">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm">W42: Oct 16 - Oct 22, 2026</span>
      </div>
      <Button variant="outline" size="icon" className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
