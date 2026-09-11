import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToken, parseJwt, setToken } from '@/lib/api';
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

/** Sidebar under a persona whose JWT carries `role` — the session restore in
 * PersonaProvider runs in an effect, so callers await an assertion instead of
 * querying synchronously. */
function renderSidebarAs(role: string) {
  setToken(makeToken(role, 'DLI'));
  render(
    <PersonaProvider>
      <SSEProvider>
        <Sidebar open={false} onClose={() => {}} />
      </SSEProvider>
    </PersonaProvider>,
  );
}

const ALL_NAV_LABELS = [
  'Operations',
  'Weekly planner',
  'Approvals',
  'Audit ledger',
  'Corridor map',
  'String chart',
  '26-week horizon',
  'Disruptions',
];

async function expectNavLabels({
  shown,
  hidden,
}: {
  shown: string[];
  hidden: string[];
}) {
  for (const label of shown) {
    await screen.findByText(label);
  }
  for (const label of hidden) {
    expect(screen.queryByText(label)).toBeNull();
  }
  // Full-set lock: the nav contains exactly the shown labels.
  const rendered = ALL_NAV_LABELS.filter((l) => screen.queryByText(l));
  expect(rendered.sort()).toEqual([...shown].sort());
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

  // Role-gated nav (lib/rbac.ts mirrors backend require_roles): every test
  // starts from a clean token so the persona restore can't leak across specs.
  afterEach(() => clearToken());

  it('shows the full 8-page console to ADMIN', async () => {
    renderSidebarAs('ADMIN');
    await expectNavLabels({ shown: ALL_NAV_LABELS, hidden: [] });
  });

  it('hides Audit ledger from SR_DOM (planner seat, auditor owns the ledger)', async () => {
    renderSidebarAs('SR_DOM');
    await expectNavLabels({
      shown: ALL_NAV_LABELS.filter((l) => l !== 'Audit ledger'),
      hidden: ['Audit ledger'],
    });
  });

  it('gives STATION_MASTER only field pages — no planner, no disruptions, no ledger', async () => {
    renderSidebarAs('STATION_MASTER');
    await expectNavLabels({
      shown: ['Operations', 'Approvals', 'Corridor map', 'String chart'],
      hidden: [],
    });
  });

  it('AUDITOR console is ledger + overview + map only', async () => {
    renderSidebarAs('AUDITOR');
    await expectNavLabels({
      shown: ['Operations', 'Audit ledger', 'Corridor map'],
      hidden: [],
    });
  });

  it('CONTROLLER sees the emergency desk but not the 26-week horizon', async () => {
    renderSidebarAs('CONTROLLER');
    await expectNavLabels({
      shown: [
        'Operations',
        'Weekly planner',
        'Approvals',
        'Corridor map',
        'String chart',
        'Disruptions',
      ],
      hidden: [],
    });
  });

  it('unknown JWT roles fall to least privilege (dashboard only)', async () => {
    renderSidebarAs('SPACE_CAPTAIN');
    await expectNavLabels({ shown: ['Operations'], hidden: [] });
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
