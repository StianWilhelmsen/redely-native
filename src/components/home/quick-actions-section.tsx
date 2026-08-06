import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { QuickActionIcons } from '@/lib/quick-action-icons';
import type { QuickAction } from '@/types/api';

type Props = {
  actions: QuickAction[];
  onComplete: (key: string) => Promise<void>;
};

export function QuickActionsSection({ actions, onComplete }: Props) {
  const weekTotal = actions.reduce((sum, a) => sum + a.countThisWeek, 0);

  return (
    <Section title="Småoppgaver" meta={weekTotal > 0 ? `${weekTotal} denne uka` : undefined}>
      <View style={styles.grid}>
        {actions.map((action) => (
          <QuickActionChip key={action.key} action={action} onComplete={onComplete} />
        ))}
      </View>
    </Section>
  );
}

function QuickActionChip({ action, onComplete }: { action: QuickAction; onComplete: (key: string) => Promise<void> }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const [burst, setBurst] = useState(false);
  const busyRef = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    scale.value = withSequence(
      withTiming(0.88, { duration: 80 }),
      withTiming(1.06, { duration: 130 }),
      withTiming(1, { duration: 110 })
    );
    setBurst(true);

    onComplete(action.key).finally(() => {
      busyRef.current = false;
    });

    setTimeout(() => setBurst(false), 700);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.backgroundElement },
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <Animated.View style={[styles.chipInner, animatedStyle]}>
        {QuickActionIcons[action.key] ? (
          <Image source={QuickActionIcons[action.key]} style={styles.icon} contentFit="contain" />
        ) : (
          <ThemedText style={styles.emoji}>{action.emoji}</ThemedText>
        )}
        <ThemedText type="small" style={styles.chipTitle} numberOfLines={3}>
          {action.title}
        </ThemedText>
      </Animated.View>

      {action.countThisWeek > 0 && (
        <View style={[styles.countBadge, { backgroundColor: `${theme.brand}1F` }]}>
          <ThemedText type="smallBold" themeColor="brand" style={styles.countText}>
            {action.countThisWeek}
          </ThemedText>
        </View>
      )}

      {burst && <PlusOneBurst color={theme.brand} />}
    </Pressable>
  );
}

function PlusOneBurst({ color }: { color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 650 });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: progress.value * -26 }, { scale: 0.9 + progress.value * 0.35 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.burst, style]}>
      <ThemedText type="smallBold" style={{ color }}>
        +1
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  icon: {
    width: 32,
    height: 32,
  },
  chipTitle: {
    textAlign: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    borderRadius: Spacing.three,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
  },
  burst: {
    position: 'absolute',
    top: Spacing.two,
    alignSelf: 'center',
  },
});
