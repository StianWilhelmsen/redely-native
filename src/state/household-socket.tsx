/**
 * The live channel for the current household. One STOMP connection; every message is
 * just "something changed" with ids, so this file turns each one into SWR revalidations
 * of exactly the cache keys it touched (see `keys` in @/api). Screens therefore never
 * need to think about realtime: they read SWR, and SWR is kept fresh from here.
 *
 * Screens that want to *react* to something (a toast when a note is added by someone
 * else) can listen with `useHouseholdEvent`.
 *
 * Transport notes carried over from the old app: auth rides on the CONNECT frame, and
 * frames are sent binary because React Native truncates text frames at the NULL octet
 * that terminates every STOMP frame.
 */

import { Client } from '@stomp/stompjs';
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { useSWRConfig } from 'swr';

import type { HouseholdEvent, HouseholdEventType, Uuid } from '@/api';
import { getValidIdToken } from '@/lib/auth-store';
import { env } from '@/lib/env';
import { useMeState } from '@/state/household';

type Listener = (event: HouseholdEvent) => void;
const SocketContext = createContext<{ on: (type: HouseholdEventType, l: Listener) => () => void } | null>(null);

/** Which SWR key prefixes each event type makes stale. `entity` keys get the id appended. */
const INVALIDATES: Record<HouseholdEventType, { lists?: string[]; entity?: string[]; me?: boolean }> = {
  HOUSEHOLD_UPDATED: { lists: ['household'], me: true },
  HOUSEHOLD_DELETED: { me: true },
  REMOVED_FROM_HOUSEHOLD: { me: true },
  MEMBERS_CHANGED: { lists: ['household'], me: true },
  NOTE_CHANGED: { lists: ['notes', 'areas'], entity: ['note'] },
  NOTE_DELETED: { lists: ['notes', 'areas'], entity: ['note'] },
  NOTE_COMMENTS_CHANGED: { lists: ['notes'], entity: ['note', 'note-comments'] },
  EVENT_CHANGED: { lists: ['events'], entity: ['event'] },
  EVENT_DELETED: { lists: ['events'], entity: ['event'] },
  EVENT_COMMENTS_CHANGED: { lists: ['events'], entity: ['event', 'event-comments'] },
  AREA_CHANGED: { lists: ['areas'] },
  AREA_DELETED: { lists: ['areas', 'notes'] },
  LIST_CHANGED: { lists: ['lists'], entity: ['list'] },
  LIST_DELETED: { lists: ['lists'], entity: ['list'] },
  LIST_ITEMS_CHANGED: { lists: ['lists'], entity: ['list'] },
  ACTIVITY_ADDED: { lists: ['activity'] },
  SUBSCRIPTION_UPDATED: { lists: ['subscription', 'household'], me: true },
};

export function HouseholdSocketProvider({ children }: { children: ReactNode }) {
  const { current } = useMeState();
  const hid = current?.householdId ?? null;
  const { mutate } = useSWRConfig();
  const listeners = useRef(new Map<HouseholdEventType, Set<Listener>>());

  const handle = useCallback(
    (event: HouseholdEvent, forHid: Uuid) => {
      const rule = INVALIDATES[event.type];
      if (rule) {
        mutate((key) => {
          if (!Array.isArray(key)) return false;
          const [prefix, keyHid, entity] = key as string[];
          if (rule.me && prefix === 'me') return true;
          if (keyHid !== forHid) return false;
          if (rule.lists?.includes(prefix)) return true;
          return !!rule.entity?.includes(prefix) && entity === event.entityId;
        });
      }
      listeners.current.get(event.type)?.forEach((l) => l(event));
    },
    [mutate]
  );

  useEffect(() => {
    if (!hid) return;
    const client = new Client({
      brokerURL: `${env.apiUrl.replace(/^http/, 'ws')}/ws-chat`,
      forceBinaryWSFrames: true,
      reconnectDelay: 3000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      beforeConnect: async (c) => {
        // Fresh token on every (re)connect; without one, connect header-less so the server
        // rejects and stompjs schedules a retry instead of dying silently.
        try {
          c.connectHeaders = { Authorization: `Bearer ${await getValidIdToken()}` };
        } catch {
          c.connectHeaders = {};
        }
      },
      onConnect: () => {
        const onFrame = (body: string) => {
          try {
            handle(JSON.parse(body) as HouseholdEvent, hid);
          } catch {
            // A malformed frame is dropped, never allowed to break the socket loop.
          }
        };
        client.subscribe(`/topic/households/${hid}`, (m) => onFrame(m.body));
        client.subscribe('/user/queue/events', (m) => onFrame(m.body));
        // Anything that happened while we were away: refetch what's on screen.
        mutate((key) => Array.isArray(key) && (key[0] === 'me' || key[1] === hid));
      },
      onStompError: (frame) => console.warn('[socket] STOMP error:', frame.headers.message),
      onWebSocketError: (e) => console.warn('[socket] transport error:', (e as { message?: string })?.message ?? e),
    });
    try {
      client.activate();
    } catch (err) {
      console.warn('[socket] activate failed:', err);
    }
    return () => {
      client.deactivate();
    };
  }, [hid, handle, mutate]);

  const on = useCallback((type: HouseholdEventType, l: Listener) => {
    if (!listeners.current.has(type)) listeners.current.set(type, new Set());
    listeners.current.get(type)!.add(l);
    return () => listeners.current.get(type)?.delete(l);
  }, []);

  return <SocketContext.Provider value={{ on }}>{children}</SocketContext.Provider>;
}

/** Run `handler` whenever an event of this type arrives for the current household. */
export function useHouseholdEvent(type: HouseholdEventType, handler: Listener) {
  const ctx = useContext(SocketContext);
  const onEvent = useEffectEvent(handler);
  useEffect(() => ctx?.on(type, (e) => onEvent(e)), [ctx, type]);
}
