'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ShieldCheck, Link2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifyResult {
  chain_ok: boolean;
  total: number;
  verified: number;
  first_broken_seq: number | null;
  verdict: string;
  isolation: string;
}

interface LedgerEntry {
  seq: number;
  event_id: string;
  event_type: string;
  actor_id: string;
  payload: Record<string, unknown>;
  prev_seq: number | null;
  prev_hash: string | null;
  hash: string;
  created_at: string;
}

/** AUDITOR/ADMIN gated by the API itself — non-auditors see the explanation. */
export function AtlasLedger() {
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleGate, setRoleGate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await api.get<VerifyResult>('/api/v1/ledger/verify');
      setVerify(v);
      try {
        const rows = await api.get<LedgerEntry[]>(
          '/api/v1/ledger/entries?limit=50',
        );
        setEntries(rows);
        setRoleGate(null);
      } catch (e) {
        // entries are AUDITOR/ADMIN-scoped; verify is open to every signed-in role
        setEntries(null);
        setRoleGate(e instanceof Error ? e.message : String(e));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ok = verify?.chain_ok === true;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Audit Ledger
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SHA-256 hash-chained, append-only audit trail — advisory-lock
            serialized, INSERT-only role, UPDATE/DELETE guard triggers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="atlas-btn-secondary atlas-btn text-sm"
        >
          <RefreshCw size={14} className={cn(busy && 'animate-spin')} />
          Re-verify chain
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-[#f5c2ca] bg-[#fdecef] px-3.5 py-3 text-sm text-[#d6293e] dark:border-[#7f1d1d] dark:bg-[#450a0a]/40 dark:text-[#f87171]"
        >
          {error}
        </div>
      ) : null}

      {/* Chain verification card — the live tamper-evidence demo */}
      <div
        className={cn(
          'atlas-card mb-6 border p-5',
          ok
            ? 'border-[#bfe6d0] bg-[#e9f7ef]/40 dark:border-[#14532d] dark:bg-[#052e16]/20'
            : 'border-[#f5c2ca] bg-[#fdecef]/40 dark:border-[#7f1d1d] dark:bg-[#450a0a]/20',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'atlas-icon-chip',
                ok
                  ? 'bg-[#e9f7ef] text-[#1b7f4b] dark:bg-[#052e16] dark:text-[#4ade80]'
                  : 'bg-[#fdecef] text-[#d6293e] dark:bg-[#450a0a] dark:text-[#f87171]',
              )}
            >
              {ok ? <ShieldCheck size={20} /> : <Link2 size={20} />}
            </span>
            <div>
              <p
                className={cn(
                  'text-lg font-bold',
                  ok
                    ? 'text-[#1b7f4b] dark:text-[#4ade80]'
                    : 'text-[#d6293e] dark:text-[#f87171]',
                )}
                aria-live="polite"
              >
                {verify
                  ? ok
                    ? 'chain intact — tamper-EVIDENT'
                    : `CHAIN BROKEN at seq ${verify.first_broken_seq}`
                  : 'verifying…'}
              </p>
              <p className="text-xs text-muted-foreground">
                {verify
                  ? `${verify.verified}/${verify.total} verified · isolation: ${verify.isolation}`
                  : 'REPEATABLE READ snapshot verification runs inside PostgreSQL.'}
              </p>
            </div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            tamper-evident, not tamper-proof — Rules.md §3
          </p>
        </div>
      </div>

      {/* Entries table (AUDITOR/ADMIN) or the role-gate explanation */}
      {entries === null ? (
        roleGate ? (
          <div className="atlas-card p-5">
            <h2 className="atlas-card-title mb-2">Ledger rows (restricted)</h2>
            <p className="text-sm text-muted-foreground">
              Event rows are AUDITOR/ADMIN-scoped (API enforced). Sign in as the
              Vigilance Auditor or admin persona to browse the chain; the
              integrity verdict above is available to every signed-in role.
            </p>
          </div>
        ) : null
      ) : (
        <div className="atlas-card overflow-hidden">
          <div className="atlas-card-header">
            <h2 className="atlas-card-title">Recent events (newest first)</h2>
            <span className="atlas-badge border-border text-muted-foreground">
              {entries.length} of {verify?.total ?? '…'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="atlas-table w-full">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Payload</th>
                  <th className="text-right">Hash</th>
                  <th className="text-right">When (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.event_id}>
                    <td className="font-mono text-xs tabular-nums">{e.seq}</td>
                    <td>
                      <span className="atlas-badge border-border text-foreground">
                        {e.event_type}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{e.actor_id}</td>
                    <td
                      className="max-w-[420px] truncate font-mono text-xs text-muted-foreground"
                      title={JSON.stringify(e.payload)}
                    >
                      {JSON.stringify(e.payload)}
                    </td>
                    <td className="text-right">
                      <span
                        className="atlas-hash"
                        title={`prev: ${e.prev_hash ?? 'genesis'}`}
                      >
                        {e.hash.slice(0, 10)}…
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-right font-mono text-xs text-muted-foreground">
                      {e.created_at.slice(11, 19)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
