/** SSE live-feed hook — reconnects with fresh JWT, drives stale-data detection.
 *  Ported from the legacy apps/web Vite SPA to Next.js. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "./api";

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

/** SSE client with reconnect re-auth (fresh token per EventSource) and a
 * heartbeat-lapse detector that drives the persistent STALE DATA overlay. */
export function useLive(): LiveState {
  const [state, setState] = useState<LiveState>({
    stale: true,
    connected: false,
    lastEvent: null,
    events: [],
  });
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    esRef.current?.close();
    const token = getToken();
    if (!token) return;
    const es = new EventSource(
      `/api/v1/stream/live-blocks?token=${encodeURIComponent(token)}`
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
      // Re-authenticate on every reconnect with the current token.
      es.close();
      setState((s) => ({ ...s, stale: true, connected: false }));
      setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
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
