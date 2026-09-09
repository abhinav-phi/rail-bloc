import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/shared/loading';

interface ApprovalActionRowProps {
  isHashValid: boolean;
  canApprove: boolean;
  /** Wire these to the real decide/revise handlers of the host view.
   * Omitted handlers leave the buttons inert (mock/showcase usage). */
  busy?: boolean;
  onReject?: () => void;
  onApprove?: () => void;
}

export function ApprovalActionRow({
  isHashValid,
  canApprove,
  busy = false,
  onReject,
  onApprove,
}: ApprovalActionRowProps) {
  return (
    <div className="flex flex-col gap-4 p-4 border-t bg-muted/10 mt-auto">
      {!isHashValid && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>HASH MISMATCH:</strong> Cryptographic integrity check
            failed. Actions disabled.
          </span>
        </div>
      )}

      {!canApprove && isHashValid && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-md text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>DRM ISOLATION:</strong> You cannot authorize a plan you
            originated.
          </span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10"
          disabled={!isHashValid || busy || !onReject}
          onClick={onReject}
        >
          {busy ? (
            <Spinner size={14} className="mr-2" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          {busy ? 'Rejecting…' : 'Reject Plan'}
        </Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={!isHashValid || !canApprove || busy || !onApprove}
          onClick={onApprove}
        >
          {busy ? (
            <Spinner size={14} className="mr-2" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          {busy ? 'Approving…' : 'Approve & Sign'}
        </Button>
      </div>
    </div>
  );
}
