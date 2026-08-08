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
import useSWR, { useSWRConfig } from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { localDateKey, relativeDayLabel } from '@/lib/date-utils';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCollectiveEvent, usePublishToSocket } from '@/lib/collective-socket';
import type { ChatMessage, Member, TypingEvent } from '@/types/api';

// The live WebSocket connection is the primary delivery path now - this interval is just
// a safety net for whatever it misses (a dropped connection, a message from before this
// screen mounted its subscription).
const POLL_INTERVAL_MS = 20_000;
// Re-announce "still typing" at most this often while someone keeps typing, and the
// receiving side treats silence past this long as "stopped".
const TYPING_ANNOUNCE_MS = 2000;
const TYPING_EXPIRE_MS = 4000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

type PickedImage = { uri: string; name: string; type: string };

export type ChatTarget =
  | { type: 'GROUP'; title: string }
  | { type: 'DIRECT'; peer: Pick<Member, 'id' | 'name' | 'pictureUrl'> };

/**
 * Wraps a message row in its own private fade/slide-in, played once on mount.
 * Each row gets its own Animated.Value (never shared across rows) so re-renders
 * elsewhere in the list can't retarget an in-flight animation onto the wrong
 * message - which is what caused the previous "last message vanishes" bug when a
 * single shared value got reassigned to whichever row was newest.
 */
function AnimatedMessageRow({ animate, children }: { animate: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? 8 : 0)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    // Intentionally runs once on mount only - this row's animation is a one-time
    // entrance, not something that should replay on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/** Three dots pulsing in sequence inside a bubble - "someone is typing", styled to match
 *  an incoming message bubble. `name` labels it in the group chat (several people could be
 *  typing); a direct conversation only ever has one other person, so it's omitted there. */
function TypingIndicator({ name }: { name?: string }) {
  const theme = useTheme();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - index) * 150),
        ])
      )
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.typingRow}>
      {name && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.typingName}>
          {name} skriver …
        </ThemedText>
      )}
      <View style={[styles.typingBubble, { backgroundColor: theme.backgroundElement }]}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[styles.typingDot, { backgroundColor: theme.textSecondary, opacity: dot }]}
          />
        ))}
      </View>
    </View>
  );
}

export function ConversationView({
  target,
  onBack,
}: {
  target: ChatTarget;
  onBack: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { mutate: globalMutate } = useSWRConfig();
  const peerId = target.type === 'DIRECT' ? target.peer.id : undefined;
  const conversationKey = peerId == null ? 'group' : `direct-${peerId}`;

  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  // Only poll at conversation speed while you're actually looking at the conversation.
  // The tab bar keeps a much slower badge poll running elsewhere (see use-unread.ts).
  const chatPollInterval = isFocused ? POLL_INTERVAL_MS : 0;
  const {
    data: messages,
    error,
    mutate,
  } = useSWR(
    me?.collective ? `chat-messages-${conversationKey}` : null,
    () => api.chatMessages(peerId),
    {
    refreshInterval: chatPollInterval,
    }
  );
  const { data: members } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: readStates } = useSWR(
    me?.collective ? `chat-read-states-${conversationKey}` : null,
    () => api.chatReadStates(peerId),
    { refreshInterval: chatPollInterval }
  );

  const publish = usePublishToSocket();
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  // Live delivery: append a message the instant it arrives instead of waiting for the
  // next poll tick. `recipientId` is what lets a shared-chat view and a DM with the same
  // person tell each other's messages apart when both land on this one socket connection.
  useCollectiveEvent<ChatMessage>('CHAT_MESSAGE', (message) => {
    const belongsHere =
      peerId == null
        ? message.recipientId == null
        : (message.recipientId === peerId && message.senderId === me?.id) ||
          (message.recipientId === me?.id && message.senderId === peerId);
    if (!belongsHere) return;

    mutate(
      (current) => {
        if (!current) return current;
        if (current.some((m) => m.id === message.id)) return current; // already have it (our own send)
        return [...current, message];
      },
      { revalidate: false }
    );
  });

  useCollectiveEvent<TypingEvent>('TYPING', (event) => {
    if (event.userId === me?.id) return;
    const belongsHere = peerId == null ? event.peerId == null : event.peerId === me?.id && event.userId === peerId;
    if (!belongsHere) return;

    setTypingUser(event.name);
    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    typingClearRef.current = setTimeout(() => setTypingUser(null), TYPING_EXPIRE_MS);
  });

  useEffect(() => {
    return () => {
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
    };
  }, []);

  const [text, setText] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const notifyPlayer = useAudioPlayer(require('@/assets/notifysfx.mp3'));

  // History loaded by scrolling up, kept separate from the SWR-owned newest page so
  // polling can keep replacing that page without wiping what we've paged in.
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedStart, setReachedStart] = useState(false);

  const allMessages = useMemo(
    () => (messages ? [...olderMessages, ...messages] : olderMessages),
    [olderMessages, messages]
  );

  // Set just before prepending a page, so the auto-scroll-to-bottom handler knows this
  // particular content-size change came from loading history rather than a new message.
  const isPaginatingRef = useRef(false);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || reachedStart) return;
    const oldest = allMessages[0];
    if (!oldest) return;

    setLoadingOlder(true);
    try {
      const page = await api.chatMessages(peerId, oldest.id);
      if (page.length === 0) {
        setReachedStart(true);
      } else {
        isPaginatingRef.current = true;
        setOlderMessages((prev) => [...page, ...prev]);
      }
    } catch {
      // Leave the flag unset so scrolling up again retries.
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, reachedStart, allMessages, peerId]);

  // Same trigger, but pushes the read cursor to the backend so housemates can see
  // your read receipt move - purely additive to the local unread-badge marker above.
  useEffect(() => {
    if (!isFocused || !messages || messages.length === 0) return;
    api.markChatRead(messages[messages.length - 1].id, peerId)
      .then(() => globalMutate('chat-conversations'))
      .catch(() => {});
  }, [isFocused, messages?.length, messages, peerId, globalMutate]);

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

  // Marks the id-watermark of "already loaded when the screen opened" the first time
  // messages arrive, so only genuinely new messages (sent or received afterwards) pop
  // in - not the whole history on first open. Set once and never touched again.
  const initialMaxIdRef = useRef<number | null>(null);
  if (initialMaxIdRef.current === null && messages) {
    initialMaxIdRef.current = messages.length > 0 ? messages[messages.length - 1].id : 0;
  }

  // Resolves each housemate's read cursor to an avatar shown under the newest
  // message they've actually seen - Messenger-style "seen by" receipts. Only
  // resolves against messages currently loaded (last 50), and never for yourself.
  const readReceiptsByMessageId = useMemo(() => {
    const map = new Map<number, Member[]>();
    if (allMessages.length === 0 || !readStates || !members) return map;
    const loadedIds = new Set(allMessages.map((m) => m.id));
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
  }, [allMessages, readStates, members, me?.id]);

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

  const applyPickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
    const type = asset.mimeType ?? (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);
    setImage({ uri: asset.uri, name: asset.fileName ?? `chat.${ext}`, type });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til kameraet for å ta et bilde.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    applyPickedAsset(result.assets[0]);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til bilder for å sende et bilde.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    applyPickedAsset(result.assets[0]);
  };

  // Camera first: in a shared-flat chat the photo is usually of something happening right
  // now ("look at the kitchen"), so making that the default saves a trip via the album.
  const handlePickImage = () => {
    Alert.alert('Legg ved bilde', undefined, [
      { text: 'Ta bilde', onPress: takePhoto },
      { text: 'Velg fra album', onPress: pickFromLibrary },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  };

  const handleChangeText = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingSentRef.current > TYPING_ANNOUNCE_MS) {
      lastTypingSentRef.current = now;
      publish('/typing', { peerId: peerId ?? null });
    }
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
          const sent = await api.sendChatMessage(content, peerId, pendingImage ?? undefined);
          return [...(current ?? []), sent];
        },
        { revalidate: false }
      );
      globalMutate('chat-conversations');
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tilbake til samtaler"
          onPress={onBack}
          hitSlop={Spacing.two}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        {target.type === 'DIRECT' ? (
          <AvatarBadge
            userId={target.peer.id}
            name={target.peer.name}
            pictureUrl={target.peer.pictureUrl}
            size={38}
          />
        ) : (
          <CollectiveAvatar pictureUrl={me?.collective?.pictureUrl} size={38} />
        )}
        <View style={styles.headerText}>
          <ThemedText type="heading" numberOfLines={1}>
            {target.type === 'DIRECT' ? target.peer.name : target.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {target.type === 'DIRECT'
              ? 'Privat samtale'
              : `${me?.collective?.name ?? 'Kollektivet'} · ${members?.length ?? 0} medlem${members?.length === 1 ? '' : 'mer'}`}
          </ThemedText>
        </View>
      </View>

      {error ? (
        <ErrorState message="Klarte ikke å hente meldinger." onRetry={() => mutate()} />
      ) : !messages ? (
        <View style={styles.loading}>
          <RefreshSpinner active />
        </View>
      ) : allMessages.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyEmoji}>💬</ThemedText>
          <ThemedText type="heading">Ingen meldinger ennå</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {target.type === 'DIRECT'
              ? `Send den første meldingen til ${target.peer.name.split(' ')[0]}.`
              : 'Send den første meldingen til kollektivet.'}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={allMessages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          // Keeps the message you're looking at anchored when a page is prepended above,
          // instead of the content jumping under your thumb.
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          onScroll={(e) => {
            if (e.nativeEvent.contentOffset.y < 80) loadOlder();
          }}
          scrollEventThrottle={16}
          ListHeaderComponent={
            loadingOlder ? (
              <View style={styles.loadingOlder}>
                <RefreshSpinner active />
              </View>
            ) : null
          }
          onContentSizeChange={() => {
            // Growing upwards (history) must not yank the view to the bottom - only a new
            // message at the end should.
            if (isPaginatingRef.current) {
              isPaginatingRef.current = false;
              return;
            }
            listRef.current?.scrollToEnd({ animated: false });
          }}
          renderItem={({ item, index }) => {
            const mine = item.senderId === me?.id;
            const prev = allMessages[index - 1];
            const next = allMessages[index + 1];
            const dayKey = localDateKey(new Date(item.createdAt));
            const showDateSeparator = !prev || localDateKey(new Date(prev.createdAt)) !== dayKey;
            // A new day restarts the grouping, so the sender is re-labelled under it.
            const showSender =
              !mine && (showDateSeparator || !prev || prev.senderId !== item.senderId);
            // Messenger only timestamps the last message of a run from one person,
            // instead of repeating the clock under every single bubble.
            const showTime =
              !next ||
              next.senderId !== item.senderId ||
              localDateKey(new Date(next.createdAt)) !== dayKey;
            const readers = readReceiptsByMessageId.get(item.id);
            const isNew = initialMaxIdRef.current !== null && item.id > initialMaxIdRef.current;
            return (
              <AnimatedMessageRow animate={isNew}>
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.dateSeparatorText}>
                      {relativeDayLabel(item.createdAt)}
                    </ThemedText>
                  </View>
                )}
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
                    {showTime && (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.timeText}>
                        {formatTime(item.createdAt)}
                      </ThemedText>
                    )}
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
              </AnimatedMessageRow>
            );
          }}
        />
      )}

      {typingUser && <TypingIndicator name={target.type === 'GROUP' ? typingUser : undefined} />}

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
          onChangeText={handleChangeText}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  backButton: {
    width: 28,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
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
  loadingOlder: {
    alignItems: 'center',
    paddingBottom: Spacing.three,
  },
  dateSeparator: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  dateSeparatorText: {
    fontSize: 11,
    textTransform: 'capitalize',
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
  typingRow: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: 2,
  },
  typingName: {
    fontSize: 11,
    marginLeft: Spacing.two,
  },
  typingBubble: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radii.card,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
