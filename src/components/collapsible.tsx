import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DURATION = 260;
const EASING = Easing.out(Easing.cubic);
/** How far the body starts above its resting place, so it slides out from under the
 *  toggle instead of only fading in. */
const SLIDE = 10;

type Props = {
  /** The toggle's label while closed (e.g. "Se de 8 oppgavene"). */
  label: string;
  /** The toggle's label while open. Falls back to `label`. */
  openLabel?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

/**
 * A disclosure row that opens what is under it by sliding it out, rather than making it
 * appear. Controlled: the parent owns `open`, because more than one of these can be open
 * at a time and only the parent knows which.
 *
 * The body is measured in place (absolutely positioned inside a clipped box, so it keeps
 * its natural height no matter what the box is animating to) and the box's height is
 * driven from that measurement. One chevron is rotated rather than swapped for its
 * up-pointing twin: the turn is what tells you which way the row is going.
 */
export function Collapsible({ label, openLabel, open, onToggle, children }: Props) {
  const theme = useTheme();
  const progress = useSharedValue(open ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: DURATION, easing: EASING });
  }, [open, progress]);

  const boxStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (progress.value - 1) * SLIDE }],
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const handleContentLayout = (event: LayoutChangeEvent) => {
    contentHeight.value = event.nativeEvent.layout.height;
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="brand">
          {open ? (openLabel ?? label) : label}
        </ThemedText>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={13} color={theme.brand} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.box, boxStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View
          style={[styles.body, bodyStyle]}
          onLayout={handleContentLayout}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  box: {
    overflow: 'hidden',
  },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
