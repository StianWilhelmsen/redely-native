import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localDateKey, parseDueDateLocal } from '@/lib/date-utils';
import type { ActivityEvent, Member, Task } from '@/types/api';

type Props = {
  members: Member[];
  tasks: Task[];
  activity: ActivityEvent[] | undefined;
  meId: number | undefined;
  /** Whether a housemate counts as busy for today only, or for the whole week. */
  periodEnd: Date;
  periodLabel: string;
};

type MemberStatus = {
  member: Member;
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
  periodEnd,
  periodLabel,
}: Props) {
  const theme = useTheme();
  const today = new Date();
  const todayKey = localDateKey(today);

  const others = members.filter((member) => member.id !== meId);
  if (others.length === 0) return null;

  const statuses: MemberStatus[] = others.map((member) => {
    const theirs = tasks.filter((task) => task.assignedTo?.id === member.id);

    const inPeriod = theirs.filter((task) => {
      const due = parseDueDateLocal(task.dueDate);
      return !!due && localDateKey(due) >= todayKey && due <= periodEnd;
    });

    // An open chore is what the others actually need to know about, so it wins over one
    // that is already finished - and the soonest open one wins over the rest.
    const open = inPeriod
      .filter((task) => !task.completed)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    const done = inPeriod.filter((task) => task.completed);

    if (open.length > 0) {
      return {
        member,
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
        return !task.completed && !!due && due > periodEnd;
      })
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    const next = upcoming[0];
    const nextDue = next ? parseDueDateLocal(next.dueDate) : null;

    return {
      member,
      task: null,
      headline: `${member.name} · Fri ${periodLabel}`,
      detail: next && nextDue ? `Neste: ${next.title}, ${weekdayOf(nextDue)}` : 'Ingenting planlagt',
      state: 'free',
    };
  });

  return (
    <View>
      {statuses.map(({ member, headline, detail, state }) => (
        <View key={member.id} style={styles.row}>
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

          {state === 'done' && (
            <View style={[styles.indicator, { backgroundColor: theme.brand, borderColor: theme.brand }]}>
              <Ionicons name="checkmark" size={14} color={theme.onBrand} />
            </View>
          )}
          {state === 'pending' && (
            <View style={[styles.indicator, { borderColor: theme.border }]} />
          )}
        </View>
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
});
