import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DayCount } from '@/types/api';

const TRACK_HEIGHT = 72;
const TOAST_AUTO_HIDE_MS = 1800;
// Bubble + tail height plus a small gap, so the toast sits just above the bar's own top edge.
const TOAST_CLEARANCE = 38;

export function BarChart({ data }: { data: DayCount[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((d) => d.count));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  const handlePressBar = (index: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndex(index);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setSelectedIndex(null), TOAST_AUTO_HIDE_MS);
  };

  return (
    <View style={styles.row}>
      {data.map((d, index) => {
        const height = Math.max(4, Math.round((d.count / max) * TRACK_HEIGHT));
        const selected = selectedIndex === index;
        return (
          <View key={`${d.day}-${index}`} style={styles.col}>
            {selected && (
              <Animated.View
                entering={FadeIn.duration(140)}
                exiting={FadeOut.duration(140)}
                style={[styles.toast, { top: TRACK_HEIGHT - height - TOAST_CLEARANCE }]}>
                <View style={[styles.toastBubble, { backgroundColor: theme.brand }]}>
                  <ThemedText type="smallBold" themeColor="onBrand">
                    {d.count}
                  </ThemedText>
                </View>
                <View style={[styles.toastTail, { borderTopColor: theme.brand }]} />
              </Animated.View>
            )}
            <Pressable
              onPress={() => handlePressBar(index)}
              hitSlop={{ top: 12, bottom: 4, left: 6, right: 6 }}
              style={[styles.track, { height: TRACK_HEIGHT }]}>
              <Animated.View
                entering={FadeIn.delay(index * 40).duration(300)}
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: d.count > 0 ? theme.brand : theme.border,
                    opacity: selected ? 0.75 : 1,
                  },
                ]}
              />
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {d.day}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  track: {
    width: '100%',
    maxWidth: 22,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  label: {
    fontSize: 11,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  toastBubble: {
    minWidth: 28,
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radii.pill,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  toastTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
