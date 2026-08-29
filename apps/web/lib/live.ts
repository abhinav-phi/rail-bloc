/** SSE live-feed hook — reconnects using a short-lived one-time ticket instead of
 * exposing the JWT in the URL. */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from './api';

export interface LiveEvent {
  event: string;
  [k: string]: unknown;
}

export interface LiveState {
  stale: boolean;
  connected: boolean;
  lastEvent: LiveEvent | null;
  events: LiveEvent[];
}

/** SSE client with reconnect re-auth using a ticket instead of a raw JWT and a
 * heartbeat-lapse detector that drives the persistent STALE DATA overlay. */
export function useLive(): LiveState {
  const [state, setState] = useState<LiveState>({
    stale: true,
    connected: false,
    lastEvent: null,
    events: [],
  });
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(async () => {
    esRef.current?.close();
    const token = getToken();
    if (!token) return;

    try {
      const ticketResp = await fetch('/api/v1/stream/issue-ticket', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!ticketResp.ok) throw new Error('could not mint stream ticket');
      const { ticket } = (await ticketResp.json()) as { ticket?: string };
      if (!ticket) throw new Error('missing stream ticket');

      const es = new EventSource(
        `/api/v1/stream/live-blocks?ticket=${encodeURIComponent(ticket)}`,
      );
      esRef.current = es;
      es.onopen = () =>
        setState((s) => ({ ...s, stale: false, connected: true }));
      es.onmessage = (m) => {
        try {
          const parsed = JSON.parse(m.data) as LiveEvent;
          setState((s) => ({
            ...s,
            stale: false,
            connected: true,
            lastEvent: parsed,
            events: [parsed, ...s.events].slice(0, 50),
          }));
        } catch {
          /* ignore malformed frames */
        }
      };
      es.onerror = () => {
        es.close();
        setState((s) => ({ ...s, stale: true, connected: false }));
        setTimeout(() => { void connect(); }, 3000);
      };
    } catch {
      setState((s) => ({ ...s, stale: true, connected: false }));
    }
  }, []);

  useEffect(() => {
    void connect();
    const watchdog = setInterval(() => {
      setState((s) => (s.connected ? s : { ...s, stale: true }));
    }, 15000);
    return () => {
      clearInterval(watchdog);
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
