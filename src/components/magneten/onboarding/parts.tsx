/**
 * Small pieces shared by the sign-in, onboarding and join screens: the step dots, the
 * round back button, a pinned paper card, a mini fridge door that shakes when something
 * lands on it, and the "magneten" wordmark.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { FontFamily } from '@/constants/theme';
import { Durations } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

export const ONBOARDING_STEPS = 6;

/** The six dots at the top of onboarding; the current one is a dash. */
export function StepDots({ step, total = ONBOARDING_STEPS }: { step: number; total?: number }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.steps', { step, total })}
      accessibilityValue={{ min: 1, max: total, now: step }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: i + 1 === step ? 22 : 6,
              backgroundColor: i + 1 <= step ? tokens.text : tokens.textSecondary,
              opacity: i + 1 <= step ? 1 : 0.4,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Round white back button, as on the sign-in boards. */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      accessibilityRole="button"
      accessibilityLabel={t('actions.back')}
      hitSlop={4}
      style={({ pressed }) => [styles.back, { backgroundColor: tokens.paper, opacity: pressed ? 0.8 : 1 }]}>
      <Ionicons name="chevron-back" size={22} color={tokens.text} />
    </Pressable>
  );
}

export type PaperTone = 'white' | 'yellow' | 'pink' | 'mint';

/**
 * A piece of paper on the door, held up by `pin` (a photo magnet, or a plain red pin
 * when `pin` is omitted and `redPin` is set). Not a task note - use <Note> for those.
 */
export function PinNote({
  children,
  paper = 'white',
  tilt = 0,
  pin,
  redPin = false,
  pinSize = 36,
  style,
  contentStyle,
}: {
  children: ReactNode;
  paper?: PaperTone;
  tilt?: number;
  pin?: ReactNode;
  redPin?: boolean;
  pinSize?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { tokens } = usePalette();
  const bg = { white: tokens.paper, yellow: tokens.paperYellow, pink: tokens.paperPink, mint: tokens.paperMint }[paper];
  return (
    <View style={[{ paddingTop: pin ? pinSize / 2 : redPin ? 10 : 0, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <View
        style={[
          styles.paper,
          { backgroundColor: bg, paddingTop: pin ? pinSize / 2 + 14 : redPin ? 18 : 14 },
          contentStyle,
        ]}>
        {children}
      </View>
      {pin ? (
        <View pointerEvents="none" style={styles.pin}>
          {pin}
        </View>
      ) : redPin ? (
        <View pointerEvents="none" style={[styles.redPin, { backgroundColor: tokens.magne }]} />
      ) : null}
    </View>
  );
}

/**
 * A small fridge door. Bump `shakeKey` when something lands on it: after `delay` ms (the
 * moment of impact) the door gives a short rattle.
 */
export function MiniDoor({
  children,
  shakeKey = 0,
  delay = Durations.smack * 0.55,
  style,
}: {
  children: ReactNode;
  shakeKey?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (!shakeKey || reduceMotion) return;
    x.value = withDelay(
      delay,
      withSequence(
        withTiming(2, { duration: 50 }),
        withTiming(-2, { duration: 50 }),
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: 80 })
      )
    );
    y.value = withDelay(delay, withSequence(withTiming(1, { duration: 50 }), withTiming(-1, { duration: 50 }), withTiming(0, { duration: 140 })));
  }, [shakeKey, delay, reduceMotion, x, y]);

  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  return (
    <Animated.View
      style={[
        styles.door,
        { backgroundColor: tokens.backgroundSelected, borderColor: tokens.border },
        shake,
        style,
      ]}>
      <View style={[styles.handle, { backgroundColor: tokens.border }]} />
      {children}
    </Animated.View>
  );
}

/** Magne's horseshoe as a flat glyph, for the wordmark. */
export function MagnetGlyph({ size = 30, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size * (136 / 120)} viewBox="0 0 120 136">
      <Path d="M14 112 V62 A46 46 0 0 1 106 62 V112 H78 V62 A18 18 0 0 0 42 62 V112 Z" fill={color} />
      <Rect x={14} y={110} width={28} height={22} rx={2} fill="#CBD4D8" />
      <Rect x={78} y={110} width={28} height={22} rx={2} fill="#CBD4D8" />
    </Svg>
  );
}

export function Wordmark({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={t('auth.welcome.replay')}
      style={styles.wordmark}>
      <View style={{ marginBottom: 4 }}>
        <MagnetGlyph color={tokens.magne} />
      </View>
      <Text style={[styles.wordmarkText, { color: tokens.text }]}>{t('auth.welcome.wordmark')}</Text>
    </Pressable>
  );
}

/** Mounts its child after `delay` ms - for staggered entrances. Instant when motion is reduced. */
export function Later({ delay, children }: { delay: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion || delay <= 0);
  useEffect(() => {
    if (shown) return;
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [delay, shown]);
  return shown ? <>{children}</> : null;
}

/** A small error line under a form. */
export function ErrorText({ children }: { children: string | null | undefined }) {
  const { tokens } = usePalette();
  if (!children) return null;
  return (
    <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.error, { color: tokens.danger }]}>
      {children}
    </Text>
  );
}

/** Pushes what follows to the bottom of a growing screen. */
export function Spacer() {
  return <View style={{ flexGrow: 1, minHeight: 12 }} />;
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 4 },
  dot: { height: 6, borderRadius: 3 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  paper: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 6,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.35,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  pin: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  redPin: {
    position: 'absolute',
    top: 0,
    left: 22,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  door: {
    borderRadius: 18,
    borderWidth: 3,
    overflow: 'visible',
  },
  handle: { position: 'absolute', right: 14, top: 70, width: 8, height: 80, borderRadius: 4 },
  wordmark: { alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 4, minHeight: 44 },
  wordmarkText: { fontFamily: FontFamily.extraBold, fontSize: 38, letterSpacing: -1.3, lineHeight: 42 },
  error: { fontFamily: FontFamily.semiBold, fontSize: 13.5, textAlign: 'center' },
});
