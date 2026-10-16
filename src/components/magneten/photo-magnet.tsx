import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FontFamily } from '@/constants/theme';
import { Durations, Feel, Landing } from '@/design/motion';

type Props = {
  name: string;
  /** The member's magnet colour - always the ring, photo or not. */
  color: string;
  photoUrl?: string | null;
  size: number;
  /** Plays the "click onto the door" movement when the magnet first appears. */
  snapIn?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A household member as a fridge photo magnet: the photo sits inside a ring in the
 * member's colour, with a gloss highlight. Without a photo the initial sits on the colour.
 * Under 24 pt the photo stops being readable, so only the colour is drawn.
 */
export function PhotoMagnet({ name, color, photoUrl, size, snapIn, style }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const pad = Math.max(2, Math.round(size * 0.09));
  const inner = size - pad * 2;
  const showPhoto = !!photoUrl && size >= 24;

  const y = useSharedValue(snapIn && !reduceMotion ? -size * 0.4 : 0);
  const scale = useSharedValue(snapIn && !reduceMotion ? 1.5 : 1);
  const opacity = useSharedValue(snapIn && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (!snapIn || reduceMotion) return;
    const land = Durations.snap * 0.55;
    y.value = withTiming(0, { duration: land, easing: Landing });
    opacity.value = withTiming(1, { duration: land });
    scale.value = withSequence(
      withTiming(0.85, { duration: land, easing: Landing }),
      withTiming(1.1, { duration: Durations.snap * 0.2 }),
      withTiming(1, { duration: Durations.snap * 0.25 })
    );
    const timer = setTimeout(Feel.snap, land);
    return () => clearTimeout(timer);
    // Only on mount: a magnet clicks on once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={showPhoto ? t('magnet.photoOf', { name }) : name}
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: pad,
          backgroundColor: color,
          shadowRadius: Math.max(2, size * 0.07),
          shadowOffset: { width: 0, height: Math.max(1, size * 0.04) },
        },
        animated,
        style,
      ]}>
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        {showPhoto ? (
          <Image source={{ uri: photoUrl! }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : size >= 24 ? (
          <Text style={[styles.initial, { fontSize: inner * 0.48 }]}>
            {name.trim().charAt(0).toUpperCase()}
          </Text>
        ) : null}
        <View
          pointerEvents="none"
          style={[
            styles.gloss,
            { width: inner * 0.46, height: inner * 0.26, left: inner * 0.1, top: inner * 0.1 },
          ]}
        />
      </View>
      {/* The bevel: a darker lip along the bottom edge, like a real magnet. */}
      <View
        pointerEvents="none"
        style={[styles.lip, { borderRadius: size / 2, borderBottomWidth: Math.max(1, size * 0.05) }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    elevation: 3,
  },
  inner: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  initial: {
    fontFamily: FontFamily.extraBold,
    color: '#FFFFFF',
  },
  gloss: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    transform: [{ rotate: '-30deg' }],
  },
  lip: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(0,0,0,0.22)',
  },
});
