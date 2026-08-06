import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentOption<T extends string> = { key: T; label: string };

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** iOS-style capsule segmented control: a lighter pill that slides to the selected option. */
export function PillSegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();
  const activeIndex = Math.max(0, options.findIndex((o) => o.key === value));

  const [rowWidth, setRowWidth] = useState(0);
  const segmentWidth = rowWidth / options.length;
  const translateX = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (rowWidth === 0) return;
    translateX.value = withTiming(segmentWidth * activeIndex, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, rowWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View onLayout={handleLayout} style={styles.row}>
        {rowWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              indicatorStyle,
              { width: segmentWidth, backgroundColor: theme.backgroundElement },
            ]}
          />
        )}
        {options.map((option) => {
          const active = option.key === value;
          return (
            <Pressable key={option.key} onPress={() => onChange(option.key)} style={styles.segment}>
              <ThemedText type={active ? 'smallBold' : 'small'} themeColor={active ? 'text' : 'textSecondary'}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: Radii.pill,
    padding: 3,
  },
  row: {
    flexDirection: 'row',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: Radii.pill,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
  },
});
