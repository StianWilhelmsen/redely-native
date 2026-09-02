import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, TextInput, View } from 'react-native';
import useSWR from 'swr';

import {
  ConversationView,
  type ChatTarget,
} from '@/components/chat/conversation-view';
import { AvatarBadge } from '@/components/avatar-badge';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCollectiveEvent } from '@/lib/collective-socket';
import type { ChatConversation, ChatMessage, PresenceEvent } from '@/types/api';

function formatConversationTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

function preview(conversation: ChatConversation, myId?: number) {
  const message = conversation.lastMessage;
  if (!message) {
    return conversation.type === 'GROUP' ? 'Ingen meldinger ennå' : 'Start en samtale';
  }
  const content = message.content?.trim() || (message.imageUrl ? '📷 Bilde' : 'Melding');
  const prefix = message.senderId === myId ? 'Du: ' : conversation.type === 'GROUP'
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
  const [search, setSearch] = useState('');

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
  const allDirect = conversations?.filter((conversation) => conversation.type === 'DIRECT') ?? [];
  const query = search.trim().toLowerCase();
  const direct = query ? allDirect.filter((c) => c.title.toLowerCase().includes(query)) : allDirect;

  return (
    <ScreenScroll
      eyebrow={me?.collective?.name ?? 'Kollektivet'}
      title="Meldinger"
      refreshing={isLoading}
      onRefresh={mutate}
      headerExtra={
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Søk i samtaler"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
      }>
      {error && !conversations ? (
        <ErrorState message="Klarte ikke å hente samtalene." onRetry={() => mutate()} />
      ) : !conversations ? (
        <RefreshSpinner active />
      ) : (
        <>
          {group && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Felleschat${group.unreadCount ? `, ${group.unreadCount} uleste` : ''}`}
              onPress={() => setTarget({ type: 'GROUP', title: group.title })}
              style={({ pressed }) => [
                styles.groupCard,
                { backgroundColor: `${theme.brand}14`, borderColor: `${theme.brand}35` },
                pressed && styles.pressed,
              ]}>
              <CollectiveAvatar pictureUrl={me?.collective?.pictureUrl} size={48} />
              <View style={styles.conversationText}>
                <View style={styles.groupTitleRow}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {group.title}
                  </ThemedText>
                  <View style={[styles.allePill, { backgroundColor: `${theme.brand}22` }]}>
                    <ThemedText type="small" themeColor="brand" style={styles.allePillText}>
                      ALLE
                    </ThemedText>
                  </View>
                </View>
                <ThemedText
                  type={group.unreadCount > 0 ? 'smallBold' : 'small'}
                  themeColor={group.unreadCount > 0 ? 'text' : 'textSecondary'}
                  numberOfLines={1}>
                  {preview(group, me?.id)}
                </ThemedText>
              </View>
              <ConversationMeta conversation={group} />
            </Pressable>
          )}

          <Section title="Direktemeldinger">
            {direct.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {query
                  ? 'Ingen treff.'
                  : 'Inviter noen til kollektivet for å starte en privat samtale.'}
              </ThemedText>
            ) : (
              <View style={[styles.directCard, { backgroundColor: theme.backgroundElement }]}>
                {direct.map((conversation, index) => (
                  <View key={conversation.peerId}>
                    {index > 0 && <Separator />}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${conversation.title}${conversation.unreadCount ? `, ${conversation.unreadCount} uleste` : ''}${
                        onlineIds?.includes(conversation.peerId!) ? ', pålogget' : ''
                      }`}
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
                      style={({ pressed }) => [styles.directRow, pressed && styles.pressed]}>
                      <View style={styles.avatarWithDot}>
                        <AvatarBadge
                          userId={conversation.peerId!}
                          name={conversation.title}
                          pictureUrl={conversation.pictureUrl}
                          size={48}
                        />
                        {onlineIds?.includes(conversation.peerId!) && (
                          <View
                            style={[
                              styles.onlineDot,
                              { backgroundColor: theme.success, borderColor: theme.backgroundElement },
                            ]}
                          />
                        )}
                      </View>
                      <ConversationText conversation={conversation} myId={me?.id} />
                      <ConversationMeta conversation={conversation} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </Section>
        </>
      )}
    </ScreenScroll>
  );
}

function ConversationText({
  conversation,
  myId,
}: {
  conversation: ChatConversation;
  myId?: number;
}) {
  return (
    <View style={styles.conversationText}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {conversation.title}
      </ThemedText>
      <ThemedText
        type={conversation.unreadCount > 0 ? 'smallBold' : 'small'}
        themeColor={conversation.unreadCount > 0 ? 'text' : 'textSecondary'}
        numberOfLines={1}>
        {preview(conversation, myId)}
      </ThemedText>
    </View>
  );
}

function ConversationMeta({ conversation }: { conversation: ChatConversation }) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
      {conversation.lastMessage && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
          {formatConversationTime(conversation.lastMessage.createdAt)}
        </ThemedText>
      )}
      {conversation.unreadCount > 0 && (
        <View style={[styles.unreadBadge, { backgroundColor: theme.brand }]}>
          <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  allePill: {
    borderRadius: Radii.chip,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
  },
  allePillText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  avatarWithDot: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  directCard: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
  },
  directRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  conversationText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  meta: {
    minWidth: 34,
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  time: {
    fontSize: 11,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
