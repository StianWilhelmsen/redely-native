import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';
import { chatReadMarker, paymentsReadMarker } from '@/lib/unread-store';

function useMarkerValue(marker: { getValue: () => number; subscribe: (l: () => void) => () => void }) {
  const [, forceRender] = useState(0);
  useEffect(() => marker.subscribe(() => forceRender((n) => n + 1)), [marker]);
  return marker.getValue();
}

/**
 * How often the tab badge re-checks for unread messages. This hook is mounted by the tab
 * bar on *every* screen, so a chat-like interval here would poll the API ~24x/minute for
 * the whole session - burning battery and Render hours to watch a screen you're not on.
 * Push notifications carry the authoritative unread count (see PushNotificationService),
 * so this only needs to be a slow safety net. The chat screen itself polls fast.
 */
const BADGE_POLL_MS = 30_000;

/** Unread chat messages: anything from someone else newer than the last message you saw. */
export function useUnreadChat() {
  const { data: me } = useMe();
  const { data: messages } = useSWR(me?.collective ? 'chat-messages' : null, () => api.chatMessages(), {
    refreshInterval: BADGE_POLL_MS,
  });
  const lastReadId = useMarkerValue(chatReadMarker);

  const markRead = () => {
    if (messages && messages.length > 0) {
      chatReadMarker.markRead(messages[messages.length - 1].id);
    }
  };

  const unreadCount = messages
    ? messages.filter((m) => m.id > lastReadId && m.senderId !== me?.id).length
    : 0;

  return { unreadCount, markRead };
}

/** Unread "someone paid you back": shares of your own expenses marked paid since you last checked Regninger. */
export function useUnreadPayments() {
  const { data: me } = useMe();
  const { data: expenses } = useSWR(me?.collective ? 'expenses' : null, api.expenses, {
    refreshInterval: 15000,
  });
  const lastSeenAt = useMarkerValue(paymentsReadMarker);

  const markRead = () => paymentsReadMarker.markRead(Date.now());

  const unreadCount = expenses
    ? expenses
        .filter((e) => e.paidBy?.id === me?.id)
        .flatMap((e) => e.shares)
        .filter((s) => s.paid && s.paidAt && new Date(s.paidAt).getTime() > lastSeenAt).length
    : 0;

  return { unreadCount, markRead };
}
