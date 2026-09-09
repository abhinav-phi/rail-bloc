import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { parseJwt, setToken } from '@/lib/api';
import { PersonaProvider } from '@/context/persona-context';
import { ApprovalActionRow } from '@/components/approvals/approval-action-row';
import { Spinner, Skeleton } from '@/components/shared/loading';
import { Sidebar } from '@/components/shell/sidebar';
import { useLive } from '@/lib/live';
import { SSEProvider } from '@/context/sse-context';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
    expect(
      screen.getByRole('button', { name: /approve & sign/i }),
    ).toBeDisabled();
  });

  it('shows sidebar navigation entries for standard operations pages', () => {
    render(
      <PersonaProvider>
        <SSEProvider>
          <Sidebar open={false} onClose={() => {}} />
        </SSEProvider>
      </PersonaProvider>,
    );

    // Rev-2.0 sidebar uses the Emergent console labels (numbered rail)
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Audit ledger')).toBeInTheDocument();
  });

  it('marks live feed stale on reconnect failure', async () => {
    const originalEventSource = globalThis.EventSource;
    // Structural type so the zero-arg handler invocations below typecheck —
    // the DOM EventSource interface declares onopen/onerror with an event arg.
    let instance: {
      close: () => void;
      onopen: (() => void) | null;
      onerror: (() => void) | null;
    } | null = null;

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
    setToken(makeToken('SR_DOM', 'DLI'));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ticket: 'test-ticket' }),
    } as Response);

    function HookHarness() {
      const state = useLive();
      return <div>{state.stale ? 'STALE' : 'LIVE'}</div>;
    }

    render(<HookHarness />);

    await waitFor(() => expect(instance).not.toBeNull());
    await act(async () => {
      instance?.onopen?.();
    });
    await waitFor(() => expect(screen.getByText('LIVE')).toBeInTheDocument());

    await act(async () => {
      instance?.onerror?.();
    });
    await waitFor(() => expect(screen.getByText('STALE')).toBeInTheDocument());

    fetchMock.mockRestore();
    globalThis.EventSource = originalEventSource;
  });
});

describe('shared loading primitives', () => {
  it('Spinner renders a decorative svg (aria-hidden) and Skeleton renders rows', () => {
    render(
      <div>
        <Spinner size={16} />
        <Skeleton rows={3} />
      </div>,
    );
    expect(document.querySelector('svg.atlas-spinner')).toBeTruthy();
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBe(3);
  });

  it('ApprovalActionRow shows busy label and blocks double-submit while busy', () => {
    const onApprove = vi.fn();
    render(
      <ApprovalActionRow
        isHashValid={true}
        canApprove={true}
        busy={true}
        onApprove={onApprove}
      />,
    );
    const btn = screen.getByRole('button', { name: /approving…/i });
    expect(btn).toBeDisabled();
  });

  it('ApprovalActionRow without a wired handler keeps buttons inert (mock usage)', () => {
    render(<ApprovalActionRow isHashValid={true} canApprove={true} />);
    expect(
      screen.getByRole('button', { name: /approve & sign/i }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /reject plan/i })).toBeDisabled();
  });
});
