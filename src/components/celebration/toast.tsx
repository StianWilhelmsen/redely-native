import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  message: string;
  /** Called once the fade-out finishes. Unmount the Toast here. */
  onHide: () => void;
};

/** Self-dismissing toast: fades/slides in, holds, fades out, then calls onHide. */
export function Toast({ message, onHide }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 1800 }),
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) runOnJS(onHide)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -16 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { top: insets.top + Spacing.three, backgroundColor: theme.brand }, style]}>
      <ThemedText type="smallBold" themeColor="onBrand">
        {message}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: 24,
    zIndex: 60,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
