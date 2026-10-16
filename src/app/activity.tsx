import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { api, errorMessage, keys, type ActivityEntry } from '@/api';
import { magnetFor, RoundButton } from '@/components/magneten/door/parts';
import { Magne } from '@/components/magneten/magne';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { activitySentence, groupActivity } from '@/lib/door-activity';
import { addDays, daysBetween, dateOfTimestamp, formatShortDate, formatTime, formatWeekday, osloNow } from '@/lib/door-dates';
import { useHousehold } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

export default function ActivityScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  const { hid, memberById, me } = useHousehold();
  const today = osloNow().date;

  const first = useSWR(keys.activity(hid), () => api.activity.page(hid));
  const [older, setOlder] = useState<ActivityEntry[]>([]);
  const [olderNext, setOlderNext] = useState<number | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // What was new when the screen opened stays highlighted, even after we mark it seen.
  const seenAtOpen = useRef<number | null | undefined>(undefined);
  const [unseenAtOpen, setUnseenAtOpen] = useState(0);
  useEffect(() => {
    if (!first.data || seenAtOpen.current !== undefined) return;
    seenAtOpen.current = first.data.lastSeenId ?? 0;
    setUnseenAtOpen(first.data.unseenCount);
    if (first.data.unseenCount > 0 || (first.data.items[0] && first.data.items[0].id !== first.data.lastSeenId)) {
      api.activity
        .markSeen(hid, first.data.items[0]?.id)
        .then(() => first.mutate())
        .catch(() => {});
    }
  }, [first, hid]);

  const nextBefore = olderNext !== undefined ? olderNext : first.data?.nextBefore ?? null;

  const loadMore = async () => {
    if (loadingMore || nextBefore == null) return;
    setLoadingMore(true);
    try {
      const page = await api.activity.page(hid, nextBefore);
      setOlder((list) => [...list, ...page.items]);
      setOlderNext(page.nextBefore);
    } catch {
      // Keep what we have; scrolling again retries.
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setOlder([]);
    setOlderNext(undefined);
    await first.mutate().catch(() => {});
    setRefreshing(false);
  };

  const groups = groupActivity([...(first.data?.items ?? []), ...older], today);
  const sections = [
    ...(groups.today.length ? [{ key: 'today', title: t('door.activity.today'), data: groups.today }] : []),
    ...(groups.earlier.length ? [{ key: 'earlier', title: t('door.activity.earlier'), data: groups.earlier }] : []),
  ];

  const when = (ts: string) => {
    const date = dateOfTimestamp(ts);
    if (date === today) return formatTime(ts, i18n.language);
    if (date === addDays(today, -1)) return t('door.activity.yesterday');
    if (daysBetween(date, today) < 7) {
      const day = formatWeekday(date, i18n.language);
      return day.charAt(0).toUpperCase() + day.slice(1, 3);
    }
    return formatShortDate(date, i18n.language);
  };

  const open = (e: ActivityEntry) => {
    if (e.noteId) router.push({ pathname: '/note/[id]', params: { id: e.noteId } });
    else if (e.eventId) router.push({ pathname: '/event/[id]', params: { id: e.eventId } });
  };

  const kicker =
    unseenAtOpen === 0
      ? t('door.activity.allSeen')
      : unseenAtOpen === 1
        ? t('door.activity.newOne')
        : t('door.activity.newMany', { count: unseenAtOpen });

  const header = (
    <View style={styles.header}>
      <RoundButton icon="back" label={t('door.note.back')} onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 4 }}>
        {first.data ? <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{kicker}</Text> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.text }]}>
          {t('door.activity.title')}
        </Text>
      </View>
    </View>
  );

  let empty = null;
  if (!first.data) {
    empty = (
      <View style={styles.center}>
        <Magne pose={first.error ? 'lurer' : 'trekker'} size={110} />
        <Text style={[styles.centerTitle, { color: tokens.text }]}>
          {first.error ? errorMessage(first.error) : t('loading')}
        </Text>
        {first.error ? <Button label={t('actions.retry')} variant="outline" onPress={() => first.mutate()} /> : null}
      </View>
    );
  } else if (sections.length === 0) {
    empty = (
      <View style={styles.center}>
        <Magne pose="sover" size={130} />
        <Text style={[styles.centerTitle, { color: tokens.text }]}>{t('door.activity.empty')}</Text>
        <Text style={[styles.centerSub, { color: tokens.textSecondary }]}>{t('door.activity.emptyLine')}</Text>
      </View>
    );
  }

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: tokens.door }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tokens.textSecondary} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={tokens.textSecondary} style={{ padding: 16 }} /> : null}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.section, { color: tokens.textSecondary }]}>{section.title.toUpperCase()}</Text>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item, section }) => {
        const actor = memberById(item.actorMemberId);
        const mag = magnetFor(actor, tokens);
        const isNew =
          seenAtOpen.current != null && item.id > seenAtOpen.current && item.actorMemberId !== me?.id;
        const sentence = activitySentence(item, memberById, t);
        const tappable = !!(item.noteId || item.eventId);
        return (
          <Pressable
            onPress={tappable ? () => open(item) : undefined}
            disabled={!tappable}
            accessibilityRole={tappable ? 'button' : 'text'}
            accessibilityLabel={`${sentence}, ${when(item.createdAt)}`}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: isNew ? tokens.paperYellow : tokens.paper,
                opacity: section.key === 'earlier' && !isNew ? (pressed ? 0.7 : 0.85) : pressed ? 0.85 : 1,
              },
            ]}>
            <PhotoMagnet name={mag.name} color={mag.color} photoUrl={mag.photoUrl} size={34} />
            <Text style={[styles.sentence, { color: isNew ? tokens.paperInk : tokens.text }]}>{sentence}</Text>
            <Text style={[styles.time, { color: tokens.textSecondary }]}>{when(item.createdAt)}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 0 },
  header: { gap: 14, paddingBottom: 6 },
  kicker: { fontFamily: FontFamily.bold, fontSize: 12.5 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 32, lineHeight: 46 },
  section: { fontFamily: FontFamily.extraBold, fontSize: 11.5, letterSpacing: 0.7, paddingTop: 18, paddingBottom: 10, paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 12, minHeight: 56 },
  sentence: { flex: 1, fontFamily: FontFamily.semiBold, fontSize: 14, lineHeight: 19 },
  time: { fontFamily: FontFamily.regular, fontSize: 11.5, alignSelf: 'flex-start' },
  center: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 24 },
  centerTitle: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 24, lineHeight: 35, textAlign: 'center' },
  centerSub: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
