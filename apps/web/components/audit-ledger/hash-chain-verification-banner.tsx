import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function HashChainVerificationBanner() {
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-4 rounded-md flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6" />
        <div>
          <h4 className="font-semibold">Cryptographic Ledger Verified</h4>
          <p className="text-sm">
            All 142 records match immutable hash chain signature.
          </p>
        </div>
      </div>
      <div className="font-mono text-xs bg-emerald-500/20 px-3 py-1.5 rounded">
        HEAD: a8f4...9b2c
      </div>
    </div>
  );
}
