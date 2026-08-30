import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const MOCK_EVENTS = [
  {
    id: 'EVT-10492',
    time: '2026-10-18T14:32:01Z',
    actor: 'DRM_DLI',
    action: 'BLOCK_AUTHORIZED',
    entity: 'BLK-402',
    hash: 'e3b0...9f2a',
  },
  {
    id: 'EVT-10491',
    time: '2026-10-18T14:15:22Z',
    actor: 'SYSTEM_SENTINEL',
    action: 'VERIFICATION_PASSED',
    entity: 'BLK-402',
    hash: '8f14...c1d9',
  },
  {
    id: 'EVT-10490',
    time: '2026-10-18T13:45:10Z',
    actor: 'SR_DOM_DLI',
    action: 'DRAFT_SUBMITTED',
    entity: 'BLK-402',
    hash: 'a2c4...e8b1',
  },
  {
    id: 'EVT-10489',
    time: '2026-10-18T10:45:00Z',
    actor: 'SYSTEM_COALESCE',
    action: 'PROVISIONAL_PLAN_GENERATED',
    entity: 'INC-992',
    hash: 'd4f7...b3a2',
  },
];

export function LedgerEventTable() {
  return (
    <div className="border rounded-md bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event ID</TableHead>
            <TableHead>Timestamp (UTC)</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead className="text-right">Block Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MOCK_EVENTS.map((evt) => (
            <TableRow key={evt.id}>
              <TableCell className="font-mono text-xs font-medium">
                {evt.id}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {evt.time}
              </TableCell>
              <TableCell className="font-medium text-xs">{evt.actor}</TableCell>
              <TableCell className="text-xs">
                <span className="bg-muted px-2 py-1 rounded">{evt.action}</span>
              </TableCell>
              <TableCell className="font-mono text-xs">{evt.entity}</TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {evt.hash}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
