/** SSE live-feed hook — reconnects using a short-lived one-time ticket instead of
 * exposing the JWT in the URL.
 *
 * Status machine (Phase-1 loaders): the handshake takes 1-4 s on the free-tier
 * chain (Vercel → Railway → Aiven/Upstash), so a bare boolean forced the red
 * STALE overlay to flash during every normal cold start. `status` separates the
 * three honest states: connecting (not an error), live, stale (real failure). */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from './api';

export interface LiveEvent {
  event: string;
  [k: string]: unknown;
}

export type LiveStatus = 'connecting' | 'live' | 'stale';

export interface LiveState {
  status: LiveStatus;
  /** true only when status === 'stale' — actions-disabled semantics unchanged. */
  stale: boolean;
  /** true only when status === 'live'. */
  connected: boolean;
  lastEvent: LiveEvent | null;
  events: LiveEvent[];
}

const OPEN_TIMEOUT_MS = 10000;
const RETRY_MS = 3000;
const WATCHDOG_MS = 15000;

export function useLive(): LiveState {
  const [state, setState] = useState<LiveState>({
    status: 'connecting',
    stale: false,
    connected: false,
    lastEvent: null,
    events: [],
  });
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(async () => {
    esRef.current?.close();
    const token = getToken();
    if (!token) return;

    setState((s) =>
      s.status === 'live'
        ? s
        : { ...s, status: 'connecting', stale: false, connected: false },
    );

    // If onopen never fires (hung proxy, dropped conn), connecting must not
    // persist forever — degrade to stale so the overlay tells the truth.
    const openTimeout = setTimeout(() => {
      setState((s) => {
        if (s.status === 'live') return s;
        esRef.current?.close();
        return { ...s, status: 'stale', stale: true, connected: false };
      });
    }, OPEN_TIMEOUT_MS);

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
      es.onopen = () => {
        clearTimeout(openTimeout);
        setState((s) => ({
          ...s,
          status: 'live',
          stale: false,
          connected: true,
        }));
      };
      es.onmessage = (m) => {
        clearTimeout(openTimeout);
        try {
          const parsed = JSON.parse(m.data) as LiveEvent;
          setState((s) => ({
            ...s,
            status: 'live',
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
        clearTimeout(openTimeout);
        es.close();
        setState((s) => ({
          ...s,
          status: 'stale',
          stale: true,
          connected: false,
        }));
        setTimeout(() => {
          void connect();
        }, RETRY_MS);
      };
    } catch {
      clearTimeout(openTimeout);
      setState((s) => ({
        ...s,
        status: 'stale',
        stale: true,
        connected: false,
      }));
      setTimeout(() => {
        void connect();
      }, RETRY_MS);
    }
  }, []);

  useEffect(() => {
    void connect();
    // Heartbeat watchdog: a silently-dead socket (no onerror) must still
    // surface as stale. Opening timeout above covers the pre-open window.
    const watchdog = setInterval(() => {
      setState((s) =>
        s.connected
          ? s
          : { ...s, status: 'stale', stale: true, connected: false },
      );
    }, WATCHDOG_MS);
    return () => {
      clearInterval(watchdog);
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
