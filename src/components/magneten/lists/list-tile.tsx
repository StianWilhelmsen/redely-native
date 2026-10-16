import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ShoppingList } from '@/api';
import { FontFamily } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

type Paper = 'paper' | 'paperMint' | 'paperPink' | 'paperYellow';
const PAPERS: Paper[] = ['paper', 'paperMint', 'paperPink', 'paper', 'paperYellow', 'paper'];
const TILTS = [-1.5, 1.5, 1, -1, -2, 1.5];

/** A list as a note on the door: pin in a magnet colour, name, a line, progress. */
export function ListTile({
  list,
  index,
  pinColor,
  onPress,
}: {
  list: ShoppingList;
  index: number;
  pinColor: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const total = list.openItemCount + list.doneItemCount;
  const pct = total ? list.doneItemCount / total : 0;
  const sub =
    list.kind === 'SHOPPING'
      ? (list.storeName ?? t('lists.tile.shopping'))
      : total === 0
        ? t('lists.tile.emptyList')
        : list.openItemCount === 0
          ? t('lists.tile.allDone')
          : t('lists.tile.left', { count: list.openItemCount });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('lists.tile.progress', { name: list.name, done: list.doneItemCount, total })}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: tokens[PAPERS[index % PAPERS.length]],
          transform: [{ rotate: `${TILTS[index % TILTS.length]}deg` }, { scale: pressed ? 0.97 : 1 }],
        },
      ]}>
      <View style={[styles.pin, { backgroundColor: pinColor }]} />
      <Text style={[styles.name, { color: tokens.paperInk }]} numberOfLines={2}>
        {list.name}
      </Text>
      <Text style={[styles.sub, { color: tokens.textSecondary }]} numberOfLines={1}>
        {sub}
      </Text>
      <View style={styles.progressRow}>
        <View style={[styles.track, { backgroundColor: tokens.paperInk + '1F' }]}>
          <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: tokens.paperInk }]} />
        </View>
        <Text style={[styles.count, { color: tokens.paperInk }]}>
          {list.doneItemCount}/{total}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 112,
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  pin: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
  },
  name: { fontFamily: FontFamily.hand, fontSize: 20, lineHeight: 23 },
  sub: { fontFamily: FontFamily.regular, fontSize: 12 },
  progressRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  track: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  count: { fontFamily: FontFamily.bold, fontSize: 11.5 },
});
