import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlockPlanStatus } from '@/lib/types';
import { BlockStatusPill } from '@/components/shared/block-status-pill';

const MOCK_COUNTS: { status: BlockPlanStatus; count: number }[] = [
  { status: 'DRAFT', count: 12 },
  { status: 'SENTINEL_PASSED', count: 8 },
  { status: 'APPROVED_SR_DOM', count: 4 },
  { status: 'AUTHORIZED_DRM', count: 2 },
  { status: 'TRANSMITTED_COA', count: 5 },
  { status: 'ACTIVE_GRANTED', count: 3 },
];

export function BlockCountSummary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Block Lifecycle Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {MOCK_COUNTS.map((item) => (
            <div
              key={item.status}
              className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
            >
              <BlockStatusPill status={item.status} />
              <span className="font-mono font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
