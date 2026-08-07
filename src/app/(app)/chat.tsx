import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import useSWR from 'swr';

import {
  ConversationView,
  type ChatTarget,
} from '@/components/chat/conversation-view';
import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section, Separator } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { ChatConversation } from '@/types/api';

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
    refreshInterval: 10_000,
  });

  useFocusEffect(
    useCallback(() => {
      mutate();
    }, [mutate])
  );

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
      title="Meldinger"
      refreshing={isLoading}
      onRefresh={mutate}>
      {error ? (
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
              <View style={[styles.groupAvatar, { backgroundColor: theme.brand }]}>
                <Ionicons name="people" size={24} color={theme.onBrand} />
              </View>
              <ConversationText conversation={group} myId={me?.id} />
              <ConversationMeta conversation={group} />
            </Pressable>
          )}

          <Section title="Direktemeldinger">
            {direct.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Inviter noen til kollektivet for å starte en privat samtale.
              </ThemedText>
            ) : (
              <View style={[styles.directCard, { backgroundColor: theme.backgroundElement }]}>
                {direct.map((conversation, index) => (
                  <View key={conversation.peerId}>
                    {index > 0 && <Separator />}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${conversation.title}${conversation.unreadCount ? `, ${conversation.unreadCount} uleste` : ''}`}
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
                      <AvatarBadge
                        userId={conversation.peerId!}
                        name={conversation.title}
                        pictureUrl={conversation.pictureUrl}
                        size={48}
                      />
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
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
