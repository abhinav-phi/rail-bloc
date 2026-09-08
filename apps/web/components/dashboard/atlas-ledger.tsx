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
      // verify itself is AUDITOR/ADMIN-scoped — show the inspector card, not an error
      const msg = e instanceof Error ? e.message : String(e);
      if (/requires role|AUDITOR|ADMIN/i.test(msg)) {
        setRoleGate(msg);
        setVerify(null);
        setEntries(null);
      } else {
        setError(msg);
      }
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
          <p className="atlas-section-label mb-2">04 / AUDIT LEDGER</p>
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
          className="mb-5 rounded-lg border border-[color:var(--atlas-danger-ring)] bg-[color:var(--atlas-danger-bg)] px-3.5 py-3 text-sm text-[color:var(--atlas-danger)]/40"
        >
          {error}
        </div>
      ) : null}

      {/* Chain verification card — the live tamper-evidence demo */}
      <div
        className={cn(
          'atlas-card mb-6 border p-5',
          ok
            ? 'border-[color:var(--atlas-success-ring)] bg-[color:var(--atlas-success-bg)]/40/20'
            : 'border-[color:var(--atlas-danger-ring)] bg-[color:var(--atlas-danger-bg)]/40/20',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'atlas-icon-chip',
                ok
                  ? 'bg-[color:var(--atlas-success-bg)] text-[color:var(--atlas-success)]'
                  : 'bg-[color:var(--atlas-danger-bg)] text-[color:var(--atlas-danger)]',
              )}
            >
              {ok ? <ShieldCheck size={20} /> : <Link2 size={20} />}
            </span>
            <div>
              <p
                className={cn(
                  'text-lg font-bold',
                  ok
                    ? 'text-[color:var(--atlas-success)]'
                    : 'text-[color:var(--atlas-danger)]',
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
              {/* Chain walkthrough — real seq/hash pairs from the live ledger */}
              {entries && entries.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {entries.slice(0, 6).map((e2, i) => (
                    <React.Fragment key={e2.seq ?? i}>
                      <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-muted-foreground">
                        #{e2.seq}
                      </span>
                      <span className="atlas-hash">
                        {(e2.hash ?? '').slice(0, 8)}
                      </span>
                      {i < 5 ? (
                        <span className="text-[10px] text-brass">→</span>
                      ) : null}
                    </React.Fragment>
                  ))}
                  {entries.length > 6 ? (
                    <span className="font-mono text-[9px] text-muted-foreground">
                      +{entries.length - 6} more
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            tamper-evident, not tamper-proof — Rules.md §3
          </p>
        </div>
      </div>

      {/* Role-scoped: inspector persona required for verify + rows */}
      {roleGate && !verify ? (
        <div className="atlas-card p-5">
          <p className="atlas-section-label mb-2">LEDGER INSPECTOR</p>
          <h2 className="atlas-card-title mb-2">
            Chain inspection requires the AUDITOR or ADMIN persona
          </h2>
          <p className="text-sm text-muted-foreground">
            The API enforces this scope (AUDITOR / ADMIN only) — by design, so
            the inspector of record is always identified. Sign out and sign in
            as{' '}
            <span className="font-mono text-foreground">
              V. Krishnan (Vigilance Auditor)
            </span>{' '}
            or{' '}
            <span className="font-mono text-foreground">
              System Administrator
            </span>{' '}
            to walk the chain, verify integrity, and browse all{' '}
            {verify === null ? '' : ''}events.
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            api scope: requires role in (AUDITOR, ADMIN)
          </p>
        </div>
      ) : null}

      {/* Entries table (AUDITOR/ADMIN) — the inspector card above explains scoping */}
      {entries !== null ? (
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
      ) : null}
    </div>
  );
}
