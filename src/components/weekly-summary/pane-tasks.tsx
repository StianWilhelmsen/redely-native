import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import {
  Eyebrow,
  PaneLayout,
  Reveal,
  Title,
  storyText,
} from '@/components/weekly-summary/story-atoms';
import { Ink, PaneSkins } from '@/components/weekly-summary/story-theme';
import { Radii, Spacing } from '@/constants/theme';
import { taskMetaLabel, taskRolloverNote, tasksHeadline } from '@/lib/weekly-summary-copy';
import type { WeeklyStats, WeeklyTask } from '@/types/api';

/** Beyond this the list stops fitting the pane, so the rest is summed up on one line. */
const MAX_ROWS = 5;

export function PaneTasks({ data }: { data: WeeklyStats }) {
  const rows = data.tasks.slice(0, MAX_ROWS);
  const hidden = data.tasks.length - rows.length;

  return (
    <PaneLayout>
      <Reveal order={0}>
        <Eyebrow>Faste oppgaver</Eyebrow>
      </Reveal>
      <Reveal order={1} style={styles.title}>
        <Title>{tasksHeadline(data.plannedTasksCompleted, data.plannedTasks)}</Title>
      </Reveal>

      <View style={styles.list}>
        {rows.map((task, index) => (
          <Reveal key={task.taskId} order={3 + index}>
            <TaskRow task={task} />
          </Reveal>
        ))}
        {hidden > 0 && (
          <Reveal order={3 + rows.length}>
            <Text style={[storyText.rowMeta, styles.hidden]}>
              {`+ ${hidden} ${hidden === 1 ? 'oppgave til' : 'oppgaver til'}`}
            </Text>
          </Reveal>
        )}
      </View>

      <Reveal order={3 + rows.length + 1}>
        <Text style={[storyText.body, styles.note]}>{taskRolloverNote(data.tasks)}</Text>
      </Reveal>
    </PaneLayout>
  );
}

function TaskRow({ task }: { task: WeeklyTask }) {
  return (
    <View style={[styles.row, { backgroundColor: task.completed ? Ink.surfaceStrong : Ink.surface }]}>
      <View
        style={[
          styles.marker,
          task.completed
            ? { backgroundColor: PaneSkins.tasks.accent }
            : { borderWidth: 1.5, borderColor: Ink.faint },
        ]}>
        <Ionicons
          name={task.completed ? 'checkmark' : 'alert'}
          size={15}
          color={task.completed ? PaneSkins.tasks.gradient[0] : Ink.muted}
        />
      </View>
      <View style={styles.rowText}>
        <Text
          style={[storyText.rowTitle, !task.completed && { color: Ink.secondary }]}
          numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={[storyText.rowMeta, !task.completed && { color: Ink.faint }]} numberOfLines={1}>
          {taskMetaLabel(task)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.two,
  },
  list: {
    flex: 1,
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two + 2,
  },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  hidden: {
    paddingLeft: Spacing.three - 2,
    color: Ink.muted,
  },
  note: {
    fontSize: 13,
    color: Ink.muted,
  },
});
