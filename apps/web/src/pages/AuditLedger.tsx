import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ActionButton, Card } from "../components/common";

interface Entry {
  seq: number;
  event_type: string;
  actor_id: string;
  payload: Record<string, unknown>;
  prev_seq: number | null;
  prev_hash: string;
  hash: string;
  created_at: string;
}

interface VerifyResult {
  chain_ok: boolean;
  total: number;
  verified: number;
  first_broken_seq: number | null;
  verdict: string;
}

/** /audit-ledger — tamper-EVIDENT (not tamper-proof) hash-chain explorer with
 *  live verification (Rules.md §5). */
export const AuditLedger: React.FC = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const reload = useCallback(() => {
    api.get<Entry[]>(`/api/v1/ledger/entries?limit=200${filter ? `&event_type=${encodeURIComponent(filter)}` : ""}`)
      .then(setEntries)
      .catch(() => undefined);
  }, [filter]);

  useEffect(reload, [reload]);

  const verify = async () => {
    setVerifying(true);
    try {
      setVerifyResult(await api.get<VerifyResult>("/api/v1/ledger/verify"));
    } catch (e) {
      setVerifyResult(null);
      alert(e instanceof Error ? e.message : "verify failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text-primary">
          Audit Ledger <span className="text-xs font-normal text-text-secondary">(tamper-evident, not tamper-proof — Rules.md §3)</span>
        </h2>
        <div className="flex gap-2">
          <input placeholder="filter event_type…" value={filter} onChange={(e) => setFilter(e.target.value)}
            className="rounded border border-border-subtle bg-bg-primary px-2 py-1 font-mono text-xs" />
          <ActionButton onClick={verify} disabled={verifying}>
            {verifying ? "Re-hashing chain…" : "🔐 Verify chain (REPEATABLE READ)"}
          </ActionButton>
        </div>
      </div>

      {verifyResult && (
        <Card>
          <p data-testid="verify-result"
             className={`font-mono text-sm font-bold ${verifyResult.chain_ok ? "text-status-active" : "text-status-blocked"}`}>
            {verifyResult.chain_ok ? "✓" : "✗"} {verifyResult.verdict} — verified {verifyResult.verified}/{verifyResult.total}
            {verifyResult.first_broken_seq !== null && ` · FIRST BROKEN SEQ ${verifyResult.first_broken_seq}`}
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-secondary">
            Method: full re-hash from sequence 1 under REPEATABLE READ snapshot isolation (FR-023).
          </p>
        </Card>
      )}

      <Card>
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="text-text-secondary">
            <tr>
              <th className="py-1">seq</th><th>event</th><th>actor</th><th>prev_seq</th>
              <th>prev_hash→hash</th><th>payload</th><th>at</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.seq} className="border-t border-border-subtle">
                <td className="py-1 text-text-primary">{e.seq}</td>
                <td className="text-accent-trd">{e.event_type}</td>
                <td className="text-text-secondary">{e.actor_id}</td>
                <td className="text-text-secondary">{e.prev_seq ?? "—"}</td>
                <td className="text-text-secondary" title={`${e.prev_hash} → ${e.hash}`}>
                  {e.prev_hash.slice(0, 6)}…→{e.hash.slice(0, 10)}…
                </td>
                <td className="max-w-xs truncate text-text-secondary" title={JSON.stringify(e.payload)}>
                  {JSON.stringify(e.payload).slice(0, 60)}…
                </td>
                <td className="text-text-secondary">{new Date(e.created_at).toISOString().slice(5, 16).replace("T", " ")}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-text-secondary">No entries match.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
