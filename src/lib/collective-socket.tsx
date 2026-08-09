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
      // brokerURL rather than a custom webSocketFactory: a hand-rolled factory has to
      // build the socket itself, and doing so drops the STOMP subprotocols that stompjs
      // would otherwise advertise ("v12.stomp, v11.stomp, v10.stomp") on the handshake.
      // Nothing here needed a custom socket - auth rides on the CONNECT frame, not the
      // handshake - so this just puts us back on the library's default path.
      brokerURL: socketUrl(),
      // A STOMP frame is terminated by a NULL octet, which makes it the one kind of
      // WebSocket *text* payload that carries an embedded \0. React Native's bridge
      // truncates the string there, so the server received a frame that never terminated:
      // the socket stayed open, StompDecoder waited forever, and the broker logged
      // CONNECT(0) while the client had happily logged ">>> CONNECT". Sending binary
      // frames instead routes through base64 (sendBinary), where \0 is just data.
      forceBinaryWSFrames: true,
      reconnectDelay: 3000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      beforeConnect: async (activeClient) => {
        // Re-fetched on every (re)connect, not just once, so a socket that reconnects
        // hours later (app resumed from background) authenticates with a fresh token
        // instead of one that expired while the connection was down.
        try {
          const token = await getValidIdToken();
          activeClient.connectHeaders = { Authorization: `Bearer ${token}` };
        } catch {
          // No token right now (session refresh lost the network, signed out mid-flight).
          // Connecting header-less lets the server reject the CONNECT frame and close the
          // socket, which is what schedules stompjs's retry. Letting this reject instead
          // would abort activation before a socket ever exists, so nothing would ever
          // trigger a reconnect and the live channel would stay dead for the session.
          activeClient.connectHeaders = {};
        }
      },
      onConnect: () => {
        // `debug` only prints raw frames, and there was no other signal that a CONNECT
        // round-trip actually completed - "did it connect?" required reading tea leaves
        // out of frame dumps. This is the one line that says so plainly. Success chatter,
        // so dev-only; the failure paths below stay on in release, where they're the only
        // way to tell a dead live channel from a quiet one.
        if (__DEV__) console.log('[socket] CONNECTED - live channel is up');
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
      // Without these three the live channel fails completely silently: a rejected CONNECT
      // arrives as a STOMP ERROR frame that stompjs otherwise just swallows, so "typing
      // never shows up" is indistinguishable from "the server never sent it".
      onStompError: (frame) => {
        console.warn('[socket] STOMP error:', frame.headers.message, frame.body);
      },
      onWebSocketError: (event) => {
        console.warn('[socket] transport error:', (event as { message?: string })?.message ?? event);
      },
      debug: __DEV__ ? (msg) => console.log('[socket]', msg) : undefined,
    });

    clientRef.current = client;
    // activate() kicks off an async _connect(); anything that throws synchronously in
    // there (or in the WebSocket factory) would otherwise surface only as an unhandled
    // rejection - invisible in a release build, and it leaves the client with no socket
    // and no scheduled retry, which is exactly the state that used to crash sends.
    try {
      client.activate();
    } catch (err) {
      console.warn('[socket] activate failed:', err);
    }

    return () => {
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [collectiveId, dispatch]);

  // Everything published here is best-effort decoration (typing, presence) - never
  // something the UI depends on. stompjs throws synchronously when the socket is between
  // connections, and callers run this straight out of a TextInput's onChangeText, where a
  // throw escapes the root error boundary and takes the whole app down. So a publish while
  // disconnected has to be a silent no-op, not an exception.
  const publish = useCallback((destination: string, body: unknown) => {
    const client = clientRef.current;
    if (!client?.connected) return;
    try {
      client.publish({ destination: `/app${destination}`, body: JSON.stringify(body) });
    } catch {
      // Raced with a disconnect between the check and the send - dropping one typing
      // ping costs nothing.
    }
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
