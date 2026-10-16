import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Magne, type MagnePose } from '@/components/magneten/magne';
import { Note, type NoteMember, type Paper } from '@/components/magneten/note';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { FontFamily, MemberColors } from '@/constants/theme';
import { Durations } from '@/design/motion';
import { currentLanguage, setLanguageSetting } from '@/i18n';
import { usePalette } from '@/theme/palette-context';

const FAMILY: Record<string, NoteMember> = {
  Ingrid: { name: 'Ingrid', color: MemberColors[0] },
  Jonas: { name: 'Jonas', color: MemberColors[1] },
  Emma: { name: 'Emma', color: MemberColors[2] },
  Oskar: { name: 'Oskar', color: MemberColors[3] },
};

type DemoNote = { key: string; meta: string; who: keyof typeof FAMILY; paper: Paper; tilt: number };

const ALL_NOTES: DemoNote[] = [
  { key: 'drop', meta: '07:45', who: 'Jonas', paper: 'white', tilt: -2.5 },
  { key: 'pickup', meta: '14:30', who: 'Ingrid', paper: 'white', tilt: 2 },
  { key: 'dishes', meta: '16:00', who: 'Emma', paper: 'mint', tilt: 1.5 },
  { key: 'taco', meta: '18:00', who: 'Jonas', paper: 'pink', tilt: -1.5 },
  { key: 'gift', meta: '24.10', who: 'Emma', paper: 'yellow', tilt: 2.5 },
  { key: 'gym', meta: '19:00', who: 'Oskar', paper: 'white', tilt: -1 },
];

const POSES: MagnePose[] = ['hei', 'smack', 'glad', 'jubler', 'trekker', 'lurer', 'sover'];

/**
 * The living design system: every Magneten building block, running for real, in both
 * languages and both schemes. Open /design on a device to judge motion and haptics -
 * the canvas can show the look, only a phone can show the feel.
 */
export default function DesignScreen() {
  const { t, i18n } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  const [count, setCount] = useState(4);
  const [done, setDone] = useState<Record<string, boolean>>({ drop: true });
  const [newest, setNewest] = useState<string | null>(null);
  const [pose, setPose] = useState<MagnePose>('hei');
  const [playKey, setPlayKey] = useState(0);

  // The door shakes a little when a note smacks onto it.
  const shake = useSharedValue(0);
  const doorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const addNote = () => {
    if (count >= ALL_NOTES.length) return;
    setNewest(ALL_NOTES[count].key);
    setCount(count + 1);
    const land = Durations.smack * 0.55;
    shake.set(withDelay(
      land,
      withSequence(
        withTiming(1.5, { duration: 45 }),
        withTiming(-1.5, { duration: 45 }),
        withTiming(1, { duration: 45 }),
        withTiming(0, { duration: 60 })
      )
    ));
  };

  const notes = ALL_NOTES.slice(0, count);
  const allDone = notes.every((n) => done[n.key]);

  return (
    <ScrollView
      style={{ backgroundColor: tokens.door }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.header}>
        <Magne pose={allDone ? 'jubler' : 'glad'} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{t('design.title')}</Text>
          <Text style={[styles.h1, { color: tokens.text }]}>{t('app.tagline')}</Text>
        </View>
      </View>

      <View style={styles.row}>
        {(['nb', 'en'] as const).map((lng) => (
          <Pressable
            key={lng}
            onPress={() => setLanguageSetting(lng)}
            accessibilityRole="button"
            accessibilityState={{ selected: currentLanguage() === lng }}
            style={[
              styles.chip,
              { backgroundColor: i18n.language === lng ? tokens.ink : tokens.paper },
            ]}>
            <Text style={[styles.chipText, { color: i18n.language === lng ? tokens.onInk : tokens.text }]}>
              {lng === 'nb' ? 'Norsk' : 'English'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.h2, { color: tokens.text }]}>{t('design.notesHeading')}</Text>
      <Animated.View style={[styles.grid, doorStyle]}>
        {notes.map((n) => (
          <View key={n.key} style={styles.cell}>
            <Note
              title={t(`demo.notes.${n.key}`)}
              meta={n.meta}
              footer={FAMILY[n.who].name}
              member={FAMILY[n.who]}
              paper={n.paper}
              tilt={n.tilt}
              done={!!done[n.key]}
              onToggle={() => setDone((d) => ({ ...d, [n.key]: !d[n.key] }))}
              smackIn={n.key === newest}
            />
          </View>
        ))}
      </Animated.View>
      <View style={styles.row}>
        <Pressable
          onPress={addNote}
          disabled={count >= ALL_NOTES.length}
          accessibilityRole="button"
          accessibilityLabel={t('design.addNote')}
          style={[styles.plus, { backgroundColor: tokens.magne, opacity: count >= ALL_NOTES.length ? 0.4 : 1 }]}>
          <Text style={styles.plusText}>+</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setCount(3);
            setNewest(null);
            setDone({});
          }}
          accessibilityRole="button"
          style={[styles.chip, { backgroundColor: tokens.paper }]}>
          <Text style={[styles.chipText, { color: tokens.text }]}>{t('design.resetDoor')}</Text>
        </Pressable>
      </View>

      <Text style={[styles.h2, { color: tokens.text }]}>{t('design.magnetsHeading')}</Text>
      <View style={styles.row}>
        {Object.values(FAMILY).map((m, i) => (
          <PhotoMagnet key={m.name} name={m.name} color={m.color} size={[24, 34, 44, 56][i]} snapIn />
        ))}
      </View>

      <Text style={[styles.h2, { color: tokens.text }]}>{t('design.magneHeading')}</Text>
      <View style={[styles.magneStage, { backgroundColor: tokens.paper }]}>
        <Magne pose={pose} size={150} playKey={playKey} />
        <Text style={[styles.says, { color: tokens.paperInk }]}>«{t(`magne.says.${pose}`, { count: 6 })}»</Text>
      </View>
      <View style={styles.wrapRow}>
        {POSES.map((p) => (
          <Pressable
            key={p}
            onPress={() => {
              setPose(p);
              setPlayKey((k) => k + 1);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: pose === p }}
            style={[styles.chip, { backgroundColor: pose === p ? tokens.ink : tokens.paper }]}>
            <Text style={[styles.chipText, { color: pose === p ? tokens.onInk : tokens.text }]}>
              {t(`magne.pose.${p}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  kicker: {
    fontFamily: FontFamily.bold,
    fontSize: 12.5,
  },
  h1: {
    fontFamily: FontFamily.hand, paddingHorizontal: 3,
    fontSize: 28,
    lineHeight: 41,
  },
  h2: {
    fontFamily: FontFamily.hand, paddingHorizontal: 3,
    fontSize: 22, lineHeight: 32,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  cell: {
    width: '48%',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  chipText: {
    fontFamily: FontFamily.bold,
    fontSize: 13.5,
  },
  plus: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 34,
  },
  magneStage: {
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  says: {
    fontFamily: FontFamily.hand,
    fontSize: 19, lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
