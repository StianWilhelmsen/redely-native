import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { FontFamily } from '@/constants/theme';
import { Durations, Feel, Settle } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

/**
 * A note on the kid door: bigger paper, a bigger title, and a big tick box a child can't
 * miss. Ticking it plays the same "done" movement as the grown-up door - the paper tips
 * loose and the "gjort!" stamp lands.
 */
export function KidNote({
  title,
  meta,
  paper,
  tilt,
  done,
  magnet,
  onTick,
}: {
  title: string;
  meta?: string;
  paper: string;
  tilt: number;
  done: boolean;
  magnet: { name: string; color: string; photoUrl?: string | null };
  onTick: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const doneness = useSharedValue(done ? 1 : 0);
  const stamp = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : Durations.done;
    doneness.value = withTiming(done ? 1 : 0, { duration, easing: Settle });
    stamp.value = done
      ? withDelay(reduceMotion ? 0 : Durations.stampDelay, withTiming(1, { duration: 300, easing: Settle }))
      : withTiming(0, { duration: 150 });
  }, [done, reduceMotion, doneness, stamp]);

  const noteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(doneness.value, [0, 1], [1, 0.6]),
    transform: [
      { translateY: doneness.value * 6 },
      { rotate: `${interpolate(doneness.value, [0, 1], [tilt, tilt * -3 || 3])}deg` },
      { scale: interpolate(doneness.value, [0, 1], [1, 0.97]) },
    ],
  }));
  const tickStyle = useAnimatedStyle(() => ({ opacity: doneness.value, transform: [{ scale: 0.6 + doneness.value * 0.4 }] }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ rotate: '-12deg' }, { scale: interpolate(stamp.value, [0, 1], [1.6, 1]) }],
  }));

  return (
    <Animated.View style={[styles.wrap, noteStyle]}>
      <Pressable
        onPress={() => {
          if (done) return;
          Feel.done();
          onTick();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={t('note.markDone', { title })}
        style={[styles.paper, { backgroundColor: paper }]}>
        <View style={styles.text}>
          {meta ? <Text style={[styles.meta, { color: tokens.textSecondary }]}>{meta}</Text> : null}
          <Text style={[styles.title, { color: tokens.paperInk }]}>{title}</Text>
        </View>
        <View style={[styles.box, { borderColor: tokens.paperInk }]}>
          <Animated.View style={tickStyle}>
            <Svg width={30} height={30} viewBox="0 0 24 24">
              <Path d="M5 12.5l4.5 4.5L19 7" stroke={tokens.stamp} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </Animated.View>
        </View>
        <Animated.Text style={[styles.stamp, { color: tokens.stamp, borderColor: tokens.stamp }, stampStyle]}>
          {t('note.done')}
        </Animated.Text>
      </Pressable>
      <View pointerEvents="none" style={styles.magnet}>
        <PhotoMagnet name={magnet.name} color={magnet.color} photoUrl={magnet.photoUrl} size={30} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 14 },
  paper: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 96,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  text: { flex: 1, gap: 2 },
  meta: { fontFamily: FontFamily.bold, fontSize: 13 },
  title: { fontFamily: FontFamily.hand, fontSize: 26, lineHeight: 30 },
  box: { width: 48, height: 48, borderRadius: 12, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  magnet: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  stamp: {
    position: 'absolute',
    right: 70,
    bottom: 10,
    fontFamily: FontFamily.hand,
    fontSize: 22,
    borderWidth: 2.5,
    borderRadius: 6,
    paddingHorizontal: 6,
  },
});
