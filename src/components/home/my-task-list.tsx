import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Task } from '@/types/api';

type Props = {
  tasks: Task[];
  onToggle: (task: Task) => void;
  /** Long-press opens the task for editing - the row's short press is the checkbox. */
  onOpen: (task: Task) => void;
  emptyText: string;
};

/**
 * The signed-in member's own tasks, as a plain checklist. Everything about a row is
 * secondary to the one thing it is for: a tap anywhere on it ticks the box.
 */
export function MyTaskList({ tasks, onToggle, onOpen, emptyText }: Props) {
  const theme = useTheme();

  if (tasks.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText type="small" themeColor="textSecondary">
          {emptyText}
        </ThemedText>
      </View>
    );
  }

  return (
    <View>
      {tasks.map((task) => (
        <Pressable
          key={task.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
          accessibilityLabel={`${task.title}, ${task.points} poeng`}
          accessibilityHint="Hold inne for å endre oppgaven"
          onPress={() => onToggle(task)}
          onLongPress={() => onOpen(task)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View
            style={[
              styles.checkbox,
              task.completed
                ? { backgroundColor: theme.brand, borderColor: theme.brand }
                : { borderColor: theme.border },
            ]}>
            {task.completed && <Ionicons name="checkmark" size={15} color={theme.onBrand} />}
          </View>

          <View style={styles.text}>
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              style={task.completed && styles.completed}>
              {task.title}
            </ThemedText>
            {!!task.description && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {task.description}
              </ThemedText>
            )}
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {task.points} p
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  completed: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  empty: {
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
