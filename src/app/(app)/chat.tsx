import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadChat } from '@/hooks/use-unread';
import { api } from '@/lib/api';
import type { ChatMessage, Member } from '@/types/api';

const POLL_INTERVAL_MS = 2500;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

type PickedImage = { uri: string; name: string; type: string };

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const {
    data: messages,
    error,
    mutate,
  } = useSWR(me?.collective ? 'chat-messages' : null, api.chatMessages, {
    refreshInterval: POLL_INTERVAL_MS,
  });
  const { data: members } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: readStates } = useSWR(me?.collective ? 'chat-read-states' : null, api.chatReadStates, {
    refreshInterval: POLL_INTERVAL_MS,
  });

  const [text, setText] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const notifyPlayer = useAudioPlayer(require('@/assets/notifysfx.mp3'));

  const { markRead } = useUnreadChat();
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );
  // Marks read on focus, and again on every new message that arrives while the
  // screen stays open - otherwise the tab dot would linger until you leave and
  // come back even though you're already looking at the new message.
  useEffect(() => {
    if (isFocused) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, messages?.length]);

  // Same trigger, but pushes the read cursor to the backend so housemates can see
  // your read receipt move - purely additive to the local unread-badge marker above.
  useEffect(() => {
    if (!isFocused || !messages || messages.length === 0) return;
    api.markChatRead(messages[messages.length - 1].id).catch(() => {});
  }, [isFocused, messages?.length, messages]);

  // Plays a soft notification sound when a housemate's message arrives while you're
  // already looking at the chat (skipped on first load, and for your own messages).
  const prevLastIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const isFirstLoad = prevLastIdRef.current === null;
    if (!isFirstLoad && last.id !== prevLastIdRef.current && last.senderId !== me?.id) {
      notifyPlayer.seekTo(0);
      notifyPlayer.play();
    }
    prevLastIdRef.current = last.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Subtle pop-in for whichever message just landed at the bottom of the list.
  const newMessageAnim = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (messages && messages.length > prevCountRef.current && prevCountRef.current > 0) {
      newMessageAnim.setValue(0);
      Animated.timing(newMessageAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    prevCountRef.current = messages?.length ?? 0;
  }, [messages?.length, newMessageAnim]);

  // Resolves each housemate's read cursor to an avatar shown under the newest
  // message they've actually seen - Messenger-style "seen by" receipts. Only
  // resolves against messages currently loaded (last 50), and never for yourself.
  const readReceiptsByMessageId = useMemo(() => {
    const map = new Map<number, Member[]>();
    if (!messages || !readStates || !members) return map;
    const loadedIds = new Set(messages.map((m) => m.id));
    for (const state of readStates) {
      if (state.userId === me?.id) continue;
      if (!loadedIds.has(state.lastReadMessageId)) continue;
      const member = members.find((m) => m.id === state.userId);
      if (!member) continue;
      const existing = map.get(state.lastReadMessageId) ?? [];
      existing.push(member);
      map.set(state.lastReadMessageId, existing);
    }
    return map;
  }, [messages, readStates, members, me?.id]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    }
  }, [messages?.length]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til bilder for å sende et bilde.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
    const type = asset.mimeType ?? (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);
    setImage({ uri: asset.uri, name: asset.fileName ?? `chat.${ext}`, type });
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content && !image) return;

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    const pendingImage = image;
    setText('');
    setImage(null);
    try {
      await mutate(
        async (current) => {
          const sent = await api.sendChatMessage(content, pendingImage ?? undefined);
          return [...(current ?? []), sent];
        },
        { revalidate: false }
      );
    } catch (err) {
      Alert.alert('Kunne ikke sende', err instanceof Error ? err.message : 'Prøv igjen.');
      setText(content);
      setImage(pendingImage);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three, borderBottomColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {me?.collective?.name ?? 'Kollektivet'}
        </ThemedText>
        <ThemedText type="display" style={styles.headerTitle}>
          Chat
        </ThemedText>
      </View>

      {error ? (
        <ErrorState message="Klarte ikke å hente meldinger." onRetry={() => mutate()} />
      ) : !messages ? (
        <View style={styles.loading}>
          <RefreshSpinner active />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyEmoji}>💬</ThemedText>
          <ThemedText type="heading">Ingen meldinger ennå</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Send den første meldingen til kollektivet.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const mine = item.senderId === me?.id;
            const prev = messages[index - 1];
            const showSender = !mine && (!prev || prev.senderId !== item.senderId);
            const isLast = index === messages.length - 1;
            const readers = readReceiptsByMessageId.get(item.id);
            return (
              <Animated.View
                style={
                  isLast
                    ? {
                        opacity: newMessageAnim,
                        transform: [
                          {
                            translateY: newMessageAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [8, 0],
                            }),
                          },
                        ],
                      }
                    : undefined
                }>
                <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                  {!mine && (
                    <View style={styles.avatarSlot}>
                      {showSender && (
                        <AvatarBadge
                          userId={item.senderId}
                          name={item.senderName}
                          pictureUrl={item.senderPictureUrl}
                          shape="circle"
                          size={28}
                        />
                      )}
                    </View>
                  )}
                  <View style={styles.bubbleColumn}>
                    {showSender && (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.senderName}>
                        {item.senderName}
                      </ThemedText>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        mine
                          ? { backgroundColor: theme.brand, borderBottomRightRadius: 4 }
                          : { backgroundColor: theme.backgroundElement, borderBottomLeftRadius: 4 },
                      ]}>
                      {item.imageUrl && (
                        <Image source={{ uri: item.imageUrl }} style={styles.bubbleImage} contentFit="cover" />
                      )}
                      {item.content && (
                        <ThemedText
                          type="small"
                          themeColor={mine ? 'onBrand' : 'text'}
                          style={item.imageUrl ? styles.bubbleTextWithImage : undefined}>
                          {item.content}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.timeText}>
                      {formatTime(item.createdAt)}
                    </ThemedText>
                  </View>
                </View>
                {readers && readers.length > 0 && (
                  <View style={[styles.readReceiptRow, mine ? styles.readReceiptRowMine : styles.readReceiptRowTheirs]}>
                    {readers.map((reader, i) => (
                      <View key={reader.id} style={[styles.readReceiptAvatar, i > 0 && styles.readReceiptAvatarStacked]}>
                        <AvatarBadge
                          userId={reader.id}
                          name={reader.name}
                          pictureUrl={reader.pictureUrl}
                          shape="circle"
                          size={14}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </Animated.View>
            );
          }}
        />
      )}

      {image && (
        <View style={[styles.imagePreviewRow, { borderTopColor: theme.border }]}>
          <Image source={{ uri: image.uri }} style={styles.imagePreview} contentFit="cover" />
          <Pressable onPress={() => setImage(null)} hitSlop={Spacing.two}>
            <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}

      <View
        style={[
          styles.inputBar,
          {
            borderTopColor: theme.border,
            paddingBottom: keyboardVisible ? Spacing.two : insets.bottom + Spacing.two,
          },
        ]}>
        <Pressable onPress={handlePickImage} hitSlop={Spacing.two} style={styles.imageButton}>
          <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Skriv en melding…"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <Pressable
          onPress={handleSend}
          disabled={sending || (!text.trim() && !image)}
          style={[
            styles.sendButton,
            { backgroundColor: theme.brand },
            sending || (!text.trim() && !image) ? styles.sendButtonDisabled : null,
          ]}>
          <Ionicons name="arrow-up" size={20} color={theme.onBrand} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.five,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    maxWidth: '85%',
  },
  messageRowMine: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatarSlot: {
    width: 28,
  },
  bubbleColumn: {
    gap: 2,
    flexShrink: 1,
  },
  senderName: {
    marginLeft: Spacing.two,
    fontSize: 11,
  },
  bubble: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  bubbleImage: {
    width: 200,
    height: 200,
    borderRadius: Radii.chip,
  },
  bubbleTextWithImage: {
    marginTop: 2,
  },
  timeText: {
    fontSize: 10,
    marginHorizontal: Spacing.two,
  },
  readReceiptRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  readReceiptRowMine: {
    justifyContent: 'flex-end',
    marginRight: Spacing.two,
  },
  readReceiptRowTheirs: {
    justifyContent: 'flex-start',
    marginLeft: Spacing.two + 28 + Spacing.two, // clears the sender's avatar slot
  },
  readReceiptAvatar: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  readReceiptAvatarStacked: {
    marginLeft: -6,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  imagePreview: {
    width: 44,
    height: 44,
    borderRadius: Radii.chip,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  imageButton: {
    paddingBottom: Spacing.two,
  },
  input: {
    flex: 1,
    borderRadius: Radii.sheet,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
