import React from 'react';
import { SimulatedDataWatermark } from '@/components/shell/simulated-data-watermark';
import { HashChainVerificationBanner } from '@/components/audit-ledger/hash-chain-verification-banner';
import { LedgerEventTable } from '@/components/audit-ledger/ledger-event-table';

export default function AuditLedgerPage() {
  return (
    <div className="p-6 h-full flex flex-col relative max-w-[1600px] mx-auto overflow-hidden">
      <SimulatedDataWatermark position="center" />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Audit Ledger</h1>
        <p className="text-muted-foreground mt-1">Immutable, cryptographically verifiable record of all system actions.</p>
      </div>

      <div className="flex flex-col gap-6 flex-1 overflow-y-auto pb-6">
        <HashChainVerificationBanner />
        <LedgerEventTable />
      </div>
    </div>
  );
}
