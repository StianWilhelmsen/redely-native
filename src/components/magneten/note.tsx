import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { FontFamily } from '@/constants/theme';
import { Durations, Feel, Landing, Settle } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

export type Paper = 'white' | 'yellow' | 'pink' | 'mint';

export type NoteMember = { name: string; color: string; photoUrl?: string | null };

type Props = {
  title: string;
  /** Small line above the title: a time, "Middag", "Før lørdag". */
  meta?: string;
  /** Small line at the bottom: who, or what kind of note. */
  footer?: string;
  member: NoteMember;
  paper?: Paper;
  /** Degrees. Every note hangs a little crooked; give each one its own angle. */
  tilt?: number;
  done?: boolean;
  onToggle?: () => void;
  /** Play the smack when this note first appears (a note someone just added). */
  smackIn?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A note on the fridge door: paper, a photo magnet holding it up, the title in
 * handwriting. Tapping it marks it done - the note tips loose and a "gjort!" stamp lands.
 * New notes arrive with the smack.
 */
export function Note({
  title,
  meta,
  footer,
  member,
  paper = 'white',
  tilt = 0,
  done = false,
  onToggle,
  smackIn = false,
  style,
}: Props) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const paperColor = {
    white: tokens.paper,
    yellow: tokens.paperYellow,
    pink: tokens.paperPink,
    mint: tokens.paperMint,
  }[paper];

  // 0 = hanging, 1 = done (tipped loose, faded). Animated so undo is just as smooth.
  const doneness = useSharedValue(done ? 1 : 0);
  const stamp = useSharedValue(done ? 1 : 0);
  const arrive = useSharedValue(smackIn && !reduceMotion ? 0 : 1);
  const impact = useSharedValue(1);

  useEffect(() => {
    if (!smackIn || reduceMotion) return;
    const land = Durations.smack * 0.55;
    arrive.value = withTiming(1, { duration: land, easing: Landing });
    impact.value = withDelay(
      land,
      withSequence(
        withTiming(0.94, { duration: 1 }),
        withTiming(1.035, { duration: Durations.smack * 0.17 }),
        withTiming(0.99, { duration: Durations.smack * 0.14 }),
        withTiming(1, { duration: Durations.smack * 0.14 })
      )
    );
    const timer = setTimeout(Feel.smack, land);
    return () => clearTimeout(timer);
    // A note smacks on once, when it first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const duration = reduceMotion ? 0 : Durations.done;
    doneness.value = withTiming(done ? 1 : 0, { duration, easing: Settle });
    stamp.value = done
      ? withDelay(reduceMotion ? 0 : Durations.stampDelay, withTiming(1, { duration: 300, easing: Settle }))
      : withTiming(0, { duration: 150 });
  }, [done, reduceMotion, doneness, stamp]);

  const noteStyle = useAnimatedStyle(() => {
    const rotate = interpolate(doneness.value, [0, 1], [tilt, tilt * -3 || 4]);
    const flyRotate = interpolate(arrive.value, [0, 1], [tilt * -4 || 10, 0]);
    return {
      opacity: interpolate(doneness.value, [0, 1], [1, 0.55]) * interpolate(arrive.value, [0, 0.3, 1], [0, 1, 1]),
      transform: [
        { translateY: interpolate(arrive.value, [0, 1], [-70, 0]) + doneness.value * 8 },
        { rotate: `${rotate + flyRotate}deg` },
        {
          scale:
            interpolate(arrive.value, [0, 1], [1.45, 1]) *
            impact.value *
            interpolate(doneness.value, [0, 1], [1, 0.95]),
        },
      ],
    };
  });

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ rotate: '-12deg' }, { scale: interpolate(stamp.value, [0, 1], [1.6, 1]) }],
  }));

  const toggle = () => {
    if (!done) Feel.done();
    onToggle?.();
  };

  return (
    <Animated.View style={[styles.wrap, noteStyle, style]}>
      <Pressable
        onPress={toggle}
        disabled={!onToggle}
        accessibilityRole="button"
        accessibilityState={{ checked: done }}
        accessibilityLabel={t('note.markDone', { title })}
        style={[styles.paper, { backgroundColor: paperColor }]}>
        {meta ? <Text style={[styles.meta, { color: tokens.textSecondary }]}>{meta}</Text> : null}
        <Text style={[styles.title, { color: tokens.paperInk }]}>{title}</Text>
        {footer ? <Text style={[styles.footer, { color: tokens.textSecondary }]}>{footer}</Text> : null}
        <Animated.Text style={[styles.stamp, { color: tokens.stamp, borderColor: tokens.stamp }, stampStyle]}>
          {t('note.done')}
        </Animated.Text>
      </Pressable>
      <View pointerEvents="none" style={styles.magnet}>
        <PhotoMagnet name={member.name} color={member.color} photoUrl={member.photoUrl} size={28} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 14,
  },
  paper: {
    minHeight: 104,
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 4,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  magnet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  meta: {
    fontFamily: FontFamily.bold,
    fontSize: 11.5,
  },
  title: {
    fontFamily: FontFamily.hand, paddingHorizontal: 3,
    fontSize: 18.5,
    lineHeight: 27,
  },
  footer: {
    marginTop: 'auto',
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
  },
  stamp: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    fontFamily: FontFamily.hand,
    fontSize: 19, lineHeight: 28,
    borderWidth: 2.5,
    borderRadius: 6,
    paddingHorizontal: 6,
  },
});
