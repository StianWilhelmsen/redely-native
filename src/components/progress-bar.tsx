import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** 0-100. Values outside are clamped. */
  percent: number;
  trackColor: string;
  /** Omit when passing `children` - the segments paint themselves. */
  color?: string;
  height?: number;
  /** Rendered inside the filled portion, e.g. one segment per contributor. */
  children?: ReactNode;
};

/**
 * A bar that fills to its value rather than appearing at it. The motion is the point:
 * a static bar states a number, a filling one shows the distance covered - which is what
 * a shared goal is asking you to feel.
 */
export function ProgressBar({ percent, trackColor, color, height = 8, children }: Props) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(100, percent)), {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <Animated.View style={[styles.fill, fillStyle, color ? { backgroundColor: color } : null]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    flexDirection: 'row',
  },
});
