import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AvatarBadge } from '@/components/avatar-badge';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Task } from '@/types/api';

type Props = {
  task: Task;
  onToggle: (task: Task) => void;
  /** Long-press opens actions (reassign/delete). */
  onActions?: (task: Task) => void;
  busy?: boolean;
  subtitle?: string;
  /** Position in its group, used to stagger the entrance animation. */
  index?: number;
};

/** Floating task card: circle checkbox, title + subtitle, assignee avatar badge. */
export function TaskCard({ task, onToggle, onActions, busy, subtitle, index = 0 }: Props) {
  const theme = useTheme();

  const checkScale = useSharedValue(task.completed ? 1 : 0);
  const [burst, setBurst] = useState(false);
  const wasCompleted = useRef(task.completed);

  useEffect(() => {
    const justCompleted = task.completed && !wasCompleted.current;
    checkScale.value = task.completed
      ? withSequence(withTiming(1.08, { duration: 110 }), withTiming(1, { duration: 110 }))
      : withTiming(0, { duration: 110 });

    if (justCompleted) {
      setBurst(true);
    }
    wasCompleted.current = task.completed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.completed]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      entering={FadeInDown.delay(Math.min(index, 8) * 2).duration(260).springify().damping(40)}
      exiting={FadeOut.duration(180)}
      style={styles.wrapper}>
      <Pressable
        disabled={busy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed, disabled: busy }}
        onPress={() => {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(
              task.completed ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
            );
          }
          onToggle(task);
        }}
        onLongPress={onActions ? () => onActions(task) : undefined}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.backgroundElement },
          task.completed && styles.completed,
          pressed && styles.pressed,
        ]}>
        <View style={[styles.checkbox, { borderColor: task.completed ? theme.brand : theme.border }]}>
          <Animated.View style={[styles.checkFill, { backgroundColor: theme.brand }, checkStyle]}>
            <Ionicons name="checkmark" size={14} color={theme.onBrand} />
          </Animated.View>
        </View>

        <View style={styles.body}>
          <ThemedText
            type="default"
            numberOfLines={2}
            style={task.completed ? styles.strikethrough : undefined}
            themeColor={task.completed ? 'textSecondary' : 'text'}>
            {task.title}
          </ThemedText>
          {subtitle && (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          )}
        </View>

        {task.assignedTo && (
          <AvatarBadge userId={task.assignedTo.id} name={task.assignedTo.name} pictureUrl={task.assignedTo.pictureUrl} size={34} />
        )}

        {burst && (
          <PointsBurst points={task.points} color={theme.brand} onDone={() => setBurst(false)} />
        )}
      </Pressable>
    </Animated.View>
  );
}

function PointsBurst({ points, color, onDone }: { points: number; color: string; onDone: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.quad) });
    const timeout = setTimeout(onDone, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: progress.value * -22 }, { scale: 0.85 + progress.value * 0.3 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.pointsBurst, style]}>
      <ThemedText type="smallBold" style={{ color }}>
        +{points}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radii.card,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(0,0,0,0.06)' } : null),
  },
  completed: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  checkFill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 1,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  pointsBurst: {
    position: 'absolute',
    right: Spacing.four,
    top: Spacing.one,
  },
});
