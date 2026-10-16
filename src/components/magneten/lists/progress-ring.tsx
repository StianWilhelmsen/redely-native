import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { FontFamily } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const R = 26;
const C = 2 * Math.PI * R;

/** The store-mode ring: fills with a little overshoot each time something lands in the basket. */
export function ProgressRing({ done, total, label }: { done: number; total: number; label: string }) {
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(total ? done / total : 0);

  useEffect(() => {
    progress.value = withTiming(total ? done / total : 0, {
      duration: reduceMotion ? 0 : 600,
      easing: Easing.bezier(0.3, 1.2, 0.5, 1),
    });
  }, [done, total, reduceMotion, progress]);

  const props = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - Math.min(1.04, Math.max(0, progress.value))),
  }));

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.box}>
      <Svg width={60} height={60} viewBox="0 0 60 60">
        <Circle cx={30} cy={30} r={R} fill="none" stroke={tokens.border} strokeWidth={7} />
        <AnimatedCircle
          cx={30}
          cy={30}
          r={R}
          fill="none"
          stroke={tokens.stamp}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={C}
          animatedProps={props}
          transform="rotate(-90 30 30)"
        />
      </Svg>
      <Text style={[styles.count, { color: tokens.text }]}>
        {done}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', fontFamily: FontFamily.extraBold, fontSize: 14 },
});
