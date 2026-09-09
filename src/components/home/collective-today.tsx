import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AvatarBadge } from '@/components/avatar-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { rowEntrance } from '@/lib/animations';
import { localDateKey, parseDueDateLocal, weekdayLabel } from '@/lib/date-utils';
import type { ActivityEvent, Member, Task } from '@/types/api';

type Props = {
  members: Member[];
  tasks: Task[];
  activity: ActivityEvent[] | undefined;
  meId: number | undefined;
  /** The period a housemate counts as busy in - one day, or the whole week. Both ends are
   *  inclusive, so the week view keeps Monday and Tuesday once they are behind us. */
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  /** The week view lists every task in the period; the day view keeps to one headline task. */
  listAll?: boolean;
};

type MemberStatus = {
  member: Member;
  /** Every task of theirs inside the period, soonest first. */
  periodTasks: Task[];
  /** The task that best represents what they are doing in this period, if any. */
  task: Task | null;
  headline: string;
  detail: string;
  state: 'done' | 'pending' | 'free';
};

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function weekdayOf(date: Date): string {
  return date.toLocaleDateString('nb-NO', { weekday: 'long' });
}

/**
 * What everyone else is up to. Read-only on purpose: the backend only lets a task be
 * ticked off by the person it belongs to, so showing a tappable box next to someone
 * else's chore would be an invitation to a dead end.
 */
export function CollectiveToday({
  members,
  tasks,
  activity,
  meId,
  periodStart,
  periodEnd,
  periodLabel,
  listAll = false,
}: Props) {
  const theme = useTheme();
  const startKey = localDateKey(periodStart);
  const endKey = localDateKey(periodEnd);

  const others = members.filter((member) => member.id !== meId);
  if (others.length === 0) return null;

  const statuses: MemberStatus[] = others.map((member) => {
    const theirs = tasks.filter((task) => task.assignedTo?.id === member.id);

    const periodTasks = theirs
      .filter((task) => {
        const due = parseDueDateLocal(task.dueDate);
        if (!due) return false;
        const key = localDateKey(due);
        return key >= startKey && key <= endKey;
      })
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

    const open = periodTasks.filter((task) => !task.completed);
    const done = periodTasks.filter((task) => task.completed);

    // The week lists every chore below the row, so the row itself only has to say how far
    // through them they are.
    if (listAll && periodTasks.length > 0) {
      return {
        member,
        periodTasks,
        task: null,
        headline: member.name,
        detail: `${done.length} av ${periodTasks.length} gjort`,
        state: open.length > 0 ? 'pending' : 'done',
      };
    }

    // An open chore is what the others actually need to know about, so it wins over one
    // that is already finished - and the soonest open one wins over the rest.
    if (open.length > 0) {
      return {
        member,
        periodTasks,
        task: open[0],
        headline: `${member.name} · ${open[0].title}`,
        detail: 'Ikke ennå',
        state: 'pending',
      };
    }

    if (done.length > 0) {
      const task = done[0];
      const completedAt = activity?.find(
        (event) => event.type === 'TASK_COMPLETED' && event.taskId === task.id
      )?.createdAt;
      return {
        member,
        periodTasks,
        task,
        headline: `${member.name} · ${task.title}`,
        detail: completedAt ? `Gjort ${timeOfDay(completedAt)}` : 'Gjort',
        state: 'done',
      };
    }

    // Nothing in this period - say when they are next up instead, so an empty row still
    // answers "and them?" rather than just being blank.
    const upcoming = theirs
      .filter((task) => {
        const due = parseDueDateLocal(task.dueDate);
        return !task.completed && !!due && localDateKey(due) > endKey;
      })
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    const next = upcoming[0];
    const nextDue = next ? parseDueDateLocal(next.dueDate) : null;

    return {
      member,
      periodTasks,
      task: null,
      headline: `${member.name} · Fri ${periodLabel}`,
      detail: next && nextDue ? `Neste: ${next.title}, ${weekdayOf(nextDue)}` : 'Ingenting planlagt',
      state: 'free',
    };
  });

  return (
    <View>
      {statuses.map(({ member, periodTasks, headline, detail, state }, index) => (
        <Animated.View key={member.id} entering={rowEntrance(index)}>
          <View style={styles.row}>
            <AvatarBadge
              userId={member.id}
              name={member.name}
              pictureUrl={member.pictureUrl}
              shape="circle"
              size={34}
            />

            <View style={styles.text}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {headline}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {detail}
              </ThemedText>
            </View>

            {/* When the tasks are listed below, each carries its own box - one summary box
                on the row would only repeat the count already in the detail line. */}
            {!listAll && state === 'done' && (
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: theme.brand, borderColor: theme.brand },
                ]}>
                <Ionicons name="checkmark" size={14} color={theme.onBrand} />
              </View>
            )}
            {!listAll && state === 'pending' && (
              <View style={[styles.indicator, { borderColor: theme.border }]} />
            )}
          </View>

          {listAll && periodTasks.length > 0 && (
            <View style={styles.tasks}>
              {periodTasks.map((task) => {
                const due = parseDueDateLocal(task.dueDate);
                return (
                  <View key={task.id} style={styles.taskRow}>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      numberOfLines={1}
                      style={styles.taskDay}>
                      {due ? weekdayLabel(due) : ''}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      numberOfLines={1}
                      style={[styles.taskTitle, task.completed && styles.completed]}>
                      {task.title}
                    </ThemedText>
                    <View
                      style={[
                        styles.dot,
                        task.completed
                          ? { backgroundColor: theme.brand, borderColor: theme.brand }
                          : { borderColor: theme.border },
                      ]}>
                      {task.completed && (
                        <Ionicons name="checkmark" size={12} color={theme.onBrand} />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
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
  text: {
    flex: 1,
    minWidth: 0,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Indented past the avatar so the tasks line up under the member's name and read as
  // belonging to the row above them.
  tasks: {
    paddingLeft: 34 + Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskDay: {
    width: 68,
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
  },
  completed: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
