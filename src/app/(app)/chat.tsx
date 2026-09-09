import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ConversationView, type ChatTarget } from '@/components/chat/conversation-view';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { rowEntrance } from '@/lib/animations';
import { useCollectiveEvent } from '@/lib/collective-socket';
import type { ChatConversation, ChatMessage, PresenceEvent } from '@/types/api';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long ago, at the coarsest useful resolution: a time for today, a word for
 * yesterday, a weekday for this week, and a date once it stops being "recent".
 */
function formatConversationTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysAgo = Math.floor((startOfToday - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / DAY_MS);

  if (daysAgo <= 0) return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  if (daysAgo === 1) return 'i går';
  if (daysAgo < 7) return date.toLocaleDateString('nb-NO', { weekday: 'short' });
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

function preview(conversation: ChatConversation, myId?: number): string {
  const message = conversation.lastMessage;
  if (!message) {
    return conversation.type === 'GROUP' ? 'Ingen meldinger ennå' : 'Ingen meldinger ennå';
  }
  const content = message.content?.trim() || (message.imageUrl ? '📷 Bilde' : 'Melding');
  const prefix =
    message.senderId === myId
      ? 'Du: '
      : conversation.type === 'GROUP'
        ? `${message.senderName.split(' ')[0]}: `
        : '';
  return `${prefix}${content}`;
}

export default function ChatScreen() {
  const theme = useTheme();
  const { data: me } = useMe();
  const [target, setTarget] = useState<ChatTarget | null>(null);
  const {
    data: conversations,
    error,
    mutate,
    isLoading,
  } = useSWR(me?.collective ? 'chat-conversations' : null, api.chatConversations, {
    // The live socket refreshes this the instant a message arrives (see below) - this
    // interval is just the fallback for whatever it misses.
    refreshInterval: 20_000,
  });
  const { data: onlineIds, mutate: mutateOnline } = useSWR(
    me?.collective ? 'online-members' : null,
    api.onlineMembers,
    { refreshInterval: 30_000 }
  );

  useFocusEffect(
    useCallback(() => {
      mutate();
    }, [mutate])
  );

  // Any message anywhere (group or any DM) changes a preview/unread count somewhere in
  // this list, so a full refetch is simpler and just as cheap as patching it in place.
  useCollectiveEvent<ChatMessage>('CHAT_MESSAGE', () => {
    mutate();
  });

  useCollectiveEvent<PresenceEvent>('PRESENCE', (event) => {
    mutateOnline(
      (current) => {
        const set = new Set(current ?? []);
        if (event.online) set.add(event.userId);
        else set.delete(event.userId);
        return Array.from(set);
      },
      { revalidate: false }
    );
  });

  useEffect(() => {
    if (!target) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setTarget(null);
      mutate();
      return true;
    });
    return () => subscription.remove();
  }, [target, mutate]);

  if (target) {
    return (
      <ConversationView
        key={target.type === 'GROUP' ? 'group' : target.peer.id}
        target={target}
        onBack={() => {
          setTarget(null);
          mutate();
        }}
      />
    );
  }

  const group = conversations?.find((conversation) => conversation.type === 'GROUP');
  const direct = conversations?.filter((conversation) => conversation.type === 'DIRECT') ?? [];

  return (
    <ScreenScroll
      eyebrow={me?.collective?.name ?? 'Kollektivet'}
      title="Chat"
      refreshing={isLoading}
      onRefresh={mutate}>
      {error && !conversations ? (
        <ErrorState message="Klarte ikke å hente samtalene." onRetry={() => mutate()} />
      ) : !conversations ? (
        <RefreshSpinner active />
      ) : (
        <>
          {/* The shared chat is its own band between two hairlines rather than the first
              item of a list: it is the one conversation everybody is always in. */}
          {group && (
            <View style={styles.groupBand}>
              <View style={[styles.hairline, { backgroundColor: theme.border }]} />
              <ConversationRow
                title="Alle i kollektivet"
                preview={preview(group, me?.id)}
                unreadCount={group.unreadCount}
                time={group.lastMessage ? formatConversationTime(group.lastMessage.createdAt) : null}
                avatar={<CollectiveAvatar pictureUrl={me?.collective?.pictureUrl} size={44} />}
                onPress={() => setTarget({ type: 'GROUP', title: group.title })}
              />
              <View style={[styles.hairline, { backgroundColor: theme.border }]} />
            </View>
          )}

          <Section title="Direkte" variant="eyebrow">
            {direct.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Inviter noen til kollektivet for å starte en privat samtale.
              </ThemedText>
            ) : (
              <View>
                {direct.map((conversation, index) => (
                  <ConversationRow
                    key={conversation.peerId}
                    index={index}
                    title={conversation.title}
                    preview={preview(conversation, me?.id)}
                    unreadCount={conversation.unreadCount}
                    time={
                      conversation.lastMessage
                        ? formatConversationTime(conversation.lastMessage.createdAt)
                        : null
                    }
                    online={
                      conversation.peerId != null && !!onlineIds?.includes(conversation.peerId)
                    }
                    avatar={
                      <AvatarBadge
                        userId={conversation.peerId!}
                        name={conversation.title}
                        pictureUrl={conversation.pictureUrl}
                        shape="circle"
                        size={44}
                      />
                    }
                    onPress={() => {
                      if (conversation.peerId == null) return;
                      setTarget({
                        type: 'DIRECT',
                        peer: {
                          id: conversation.peerId,
                          name: conversation.title,
                          pictureUrl: conversation.pictureUrl,
                        },
                      });
                    }}
                  />
                ))}
              </View>
            )}
          </Section>
        </>
      )}
    </ScreenScroll>
  );
}

function ConversationRow({
  title,
  preview,
  unreadCount,
  time,
  avatar,
  online,
  index = 0,
  onPress,
}: {
  title: string;
  preview: string;
  unreadCount: number;
  time: string | null;
  avatar: React.ReactNode;
  online?: boolean;
  index?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const hasUnread = unreadCount > 0;

  return (
    <Animated.View entering={rowEntrance(index)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}${hasUnread ? `, ${unreadCount} uleste` : ''}${online ? ', pålogget' : ''}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.avatarWrap}>
          {avatar}
          {online && (
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: theme.success, borderColor: theme.background },
              ]}
            />
          )}
        </View>

        <View style={styles.text}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText
            type={hasUnread ? 'smallBold' : 'small'}
            themeColor={hasUnread ? 'text' : 'textSecondary'}
            numberOfLines={1}>
            {preview}
          </ThemedText>
        </View>

        <View style={styles.meta}>
          {time && (
            // Unread turns the timestamp brand-coloured: the badge says how many, the time
            // says how long it has been sitting there.
            <ThemedText type="small" themeColor={hasUnread ? 'brand' : 'textSecondary'}>
              {time}
            </ThemedText>
          )}
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: theme.brand }]}>
              <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onBrand }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </ThemedText>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  groupBand: {
    gap: 0,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  avatarWrap: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  meta: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
  },
  empty: {
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
