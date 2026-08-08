import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const PARTICLE_COUNT = 22;

type ParticleParams = {
  x: number;
  rotate: number;
  delay: number;
  size: number;
  duration: number;
};

function ConfettiParticle({ color, params }: { color: string; params: ParticleParams }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      params.delay,
      withTiming(1, { duration: params.duration, easing: Easing.out(Easing.cubic) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateY: progress.value * 170 },
      { translateX: progress.value * params.x },
      { rotate: `${progress.value * params.rotate}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: color, width: params.size, height: params.size * 1.4 },
        style,
      ]}
    />
  );
}

/**
 * Mount this to play a one-shot confetti burst; unmount it (or change `burstKey`)
 * to replay. Non-interactive — sits above content, ignores touches.
 *
 * `colors` overrides the palette-derived default, for surfaces that don't follow the
 * app palette (the weekly story runs on its own fixed colors).
 */
export function ConfettiBurst({
  burstKey,
  colors: colorOverride,
}: {
  burstKey: number | string;
  colors?: string[];
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const colors = colorOverride ?? [theme.brand, theme.brandSecondary, theme.success, theme.danger];

  const particles = useMemo<ParticleParams[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => ({
        x: (Math.random() - 0.5) * width * 0.7,
        rotate: (Math.random() - 0.5) * 720,
        delay: Math.random() * 150,
        size: 6 + Math.random() * 6,
        duration: 700 + Math.random() * 500,
      })),
    // Regenerate only when replayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, width]
  );

  return (
    <View pointerEvents="none" style={styles.container}>
      {particles.map((params, index) => (
        <ConfettiParticle key={index} color={colors[index % colors.length]} params={params} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    zIndex: 50,
  },
  particle: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
