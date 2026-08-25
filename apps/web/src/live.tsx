import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getToken } from "./api";

export interface LiveEvent {
  event: string;
  [k: string]: unknown;
}

interface LiveState {
  stale: boolean;
  connected: boolean;
  lastEvent: LiveEvent | null;
  events: LiveEvent[];
}

const LiveContext = createContext<LiveState>({ stale: true, connected: false, lastEvent: null, events: [] });

/** SSE client with reconnect re-auth (fresh token per EventSource) and a
 * heartbeat-lapse detector that drives the persistent STALE DATA overlay. */
export const LiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LiveState>({ stale: true, connected: false, lastEvent: null, events: [] });
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    esRef.current?.close();
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`/api/v1/stream/live-blocks?token=${encodeURIComponent(token)}`);
    esRef.current = es;
    es.onopen = () => setState((s) => ({ ...s, stale: false, connected: true }));
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

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
};

export function useLive() {
  return useContext(LiveContext);
}
