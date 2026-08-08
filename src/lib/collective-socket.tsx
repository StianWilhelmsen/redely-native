/**
 * One shared STOMP-over-WebSocket connection per signed-in session, mounted once at the
 * app root. Chat messages and typing status are the first consumers, but the channel is
 * generic on purpose (`CollectiveEvent.type` + `payload`) so other live features (someone
 * completed a task, someone added a shopping item) can subscribe to the same connection
 * later instead of each opening its own socket.
 *
 * Auth happens on the STOMP CONNECT frame, not the WebSocket handshake - React Native's
 * WebSocket can't attach a custom header to the handshake request itself, but stompjs lets
 * us set one on the CONNECT frame once the socket is open (see `beforeConnect` below).
 */
import { Client } from '@stomp/stompjs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useMe } from '@/hooks/use-me';
import { getValidIdToken } from '@/lib/auth-store';
import { env } from '@/lib/env';

type EventHandler = (payload: unknown) => void;

type CollectiveSocketContextValue = {
  connected: boolean;
  /** Publishes to an /app-prefixed STOMP destination, e.g. "/typing". */
  publish: (destination: string, body: unknown) => void;
  subscribe: (eventType: string, handler: EventHandler) => () => void;
};

const CollectiveSocketContext = createContext<CollectiveSocketContextValue | null>(null);

function socketUrl(): string {
  return `${env.apiUrl.replace(/^http/, 'ws')}/ws-chat`;
}

export function CollectiveSocketProvider({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const collectiveId = me?.collective?.id ?? null;

  const clientRef = useRef<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  const dispatch = useCallback((eventType: string, payload: unknown) => {
    listenersRef.current.get(eventType)?.forEach((handler) => handler(payload));
  }, []);

  useEffect(() => {
    if (!collectiveId) return;

    const client = new Client({
      webSocketFactory: () => new WebSocket(socketUrl()),
      reconnectDelay: 3000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      beforeConnect: async (activeClient) => {
        // Re-fetched on every (re)connect, not just once, so a socket that reconnects
        // hours later (app resumed from background) authenticates with a fresh token
        // instead of one that expired while the connection was down.
        const token = await getValidIdToken();
        activeClient.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        setConnected(true);
        const handleFrame = (body: string) => {
          try {
            const event = JSON.parse(body) as { type?: string; payload?: unknown };
            if (event.type) dispatch(event.type, event.payload);
          } catch {
            // Malformed frame - drop it rather than crash the socket loop.
          }
        };
        client.subscribe(`/topic/collective/${collectiveId}`, (message) => handleFrame(message.body));
        client.subscribe('/user/queue/events', (message) => handleFrame(message.body));
      },
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    });

    clientRef.current = client;
    client.activate();

    return () => {
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [collectiveId, dispatch]);

  const publish = useCallback((destination: string, body: unknown) => {
    clientRef.current?.publish({ destination: `/app${destination}`, body: JSON.stringify(body) });
  }, []);

  const subscribe = useCallback((eventType: string, handler: EventHandler) => {
    if (!listenersRef.current.has(eventType)) listenersRef.current.set(eventType, new Set());
    listenersRef.current.get(eventType)!.add(handler);
    return () => listenersRef.current.get(eventType)?.delete(handler);
  }, []);

  const value = useMemo(
    () => ({ connected, publish, subscribe }),
    [connected, publish, subscribe]
  );

  return <CollectiveSocketContext.Provider value={value}>{children}</CollectiveSocketContext.Provider>;
}

/** Whether the live channel is currently connected - useful for a subtle "offline" hint,
 *  never required for correctness (REST stays the source of truth). */
export function useCollectiveSocketConnected(): boolean {
  return useContext(CollectiveSocketContext)?.connected ?? false;
}

export function usePublishToSocket() {
  const ctx = useContext(CollectiveSocketContext);
  return ctx?.publish ?? (() => {});
}

/** Subscribes to one event type for as long as the calling component is mounted. `handler`
 *  doesn't need to be memoized - only `eventType` changing re-subscribes. */
export function useCollectiveEvent<T>(eventType: string, handler: (payload: T) => void) {
  const ctx = useContext(CollectiveSocketContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(eventType, (payload) => handlerRef.current(payload as T));
  }, [ctx, eventType]);
}
