import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { parseJwt } from '@/lib/api';
import { ApprovalActionRow } from '@/components/approvals/approval-action-row';
import { Sidebar } from '@/components/shell/sidebar';
import { useLive } from '@/lib/live';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

function makeToken(role: string, division: string): string {
  const payload = { username: 'demo-user', role, division };
  const enc = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `header.${enc(payload)}.signature`;
}

describe('frontend core behaviors', () => {
  it('parses JWT claims for role and division', () => {
    const token = makeToken('SR_DOM', 'DLI');
    const parsed = parseJwt(token);

    expect(parsed).not.toBeNull();
    expect(parsed?.role).toBe('SR_DOM');
    expect(parsed?.division).toBe('DLI');
  });

  it('renders hash mismatch banner when signatures fail validation', () => {
    render(<ApprovalActionRow isHashValid={false} canApprove={true} />);

    expect(screen.getByText(/HASH MISMATCH/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve & sign/i })).toBeDisabled();
  });

  it('shows sidebar navigation entries for standard operations pages', () => {
    render(<Sidebar />);

    expect(screen.getByText('Operations Overview')).toBeInTheDocument();
    expect(screen.getByText('Approval Workflow')).toBeInTheDocument();
    expect(screen.getByText('Audit Ledger')).toBeInTheDocument();
  });

  it('marks live feed stale on reconnect failure', async () => {
    const originalEventSource = globalThis.EventSource;
    // Structural type so the zero-arg handler invocations below typecheck —
    // the DOM EventSource interface declares onopen/onerror with an event arg.
    let instance: { close: () => void; onopen: (() => void) | null; onerror: (() => void) | null } | null = null;

    class MockEventSource {
      close = vi.fn();
      onopen: (() => void) | null = null;
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public url: string) {
        instance = this;
      }
    }

    globalThis.EventSource = MockEventSource as any;
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => makeToken('SR_DOM', 'DLI') },
      configurable: true,
    });

    function HookHarness() {
      const state = useLive();
      return <div>{state.stale ? 'STALE' : 'LIVE'}</div>;
    }

    render(<HookHarness />);

    await act(async () => {
      instance?.onopen?.();
    });
    await waitFor(() => expect(screen.getByText('LIVE')).toBeInTheDocument());

    await act(async () => {
      instance?.onerror?.();
    });
    await waitFor(() => expect(screen.getByText('STALE')).toBeInTheDocument());

    globalThis.EventSource = originalEventSource;
  });
});
