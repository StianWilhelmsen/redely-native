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
import { Control, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { QuickActionIcons } from '@/lib/quick-action-icons';
import type { QuickAction } from '@/types/api';

type Props = {
  actions: QuickAction[];
  onComplete: (key: string) => Promise<void>;
};

/**
 * The small, repeatable chores nobody schedules - taking the bins out, wiping the
 * counter. They are not tasks: there is nothing to tick off and nothing to assign, only
 * a tally of how often each has been done this week.
 */
export function QuickActionsSection({ actions, onComplete }: Props) {
  return (
    <Section title="Småjobber" meta="trykk for å telle" variant="eyebrow">
      <View style={styles.grid}>
        {actions.map((action) => (
          <QuickActionCard key={action.key} action={action} onComplete={onComplete} />
        ))}
      </View>
    </Section>
  );
}

function QuickActionCard({
  action,
  onComplete,
}: {
  action: QuickAction;
  onComplete: (key: string) => Promise<void>;
}) {
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
      accessibilityRole="button"
      accessibilityLabel={`${action.title}, gjort ${action.countThisWeek} ganger denne uka`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <Animated.View style={animatedStyle}>
        {QuickActionIcons[action.key] ? (
          <Image source={QuickActionIcons[action.key]} style={styles.icon} contentFit="contain" />
        ) : (
          <ThemedText style={styles.emoji}>{action.emoji}</ThemedText>
        )}
      </Animated.View>

      <ThemedText type="smallBold" numberOfLines={2} style={styles.title}>
        {action.title}
      </ThemedText>

      {/* Always shown, zero included: the point of the tile is the running count, and a
          badge that appears only after the first tap hides what the tile is for. */}
      <ThemedText
        type="small"
        themeColor={action.countThisWeek > 0 ? 'brand' : 'textSecondary'}
        style={styles.count}>
        ×{action.countThisWeek}
      </ThemedText>

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
    gap: Spacing.two + Spacing.half,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 104,
    borderRadius: Control.radius,
    padding: Spacing.three,
    justifyContent: 'space-between',
  },
  icon: {
    width: 30,
    height: 30,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  title: {
    marginTop: Spacing.three,
  },
  count: {
    position: 'absolute',
    top: Spacing.two + Spacing.half,
    right: Spacing.three,
    fontVariant: ['tabular-nums'],
  },
  burst: {
    position: 'absolute',
    top: Spacing.two,
    alignSelf: 'center',
  },
});
