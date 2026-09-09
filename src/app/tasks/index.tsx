import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { FlatDivider } from '@/components/flat-divider';
import { PillSegmentedControl, type SegmentOption } from '@/components/pill-segmented-control';
import { PrimaryButton } from '@/components/primary-button';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatShortDate, localDateKey, parseDueDateLocal } from '@/lib/date-utils';
import { QuickActionIcons } from '@/lib/quick-action-icons';
import { effortLabel, frequencyLabel } from '@/lib/task-copy';
import { buildSeries, byDueDate, type Series } from '@/lib/task-series';
import type { QuickAction, Task } from '@/types/api';

type Tab = 'recurring' | 'once' | 'quick';
type Filter = 'all' | 'mine' | 'rotating';

const TABS: SegmentOption<Tab>[] = [
  { key: 'recurring', label: 'Gjentakende' },
  { key: 'once', label: 'Én gang' },
  { key: 'quick', label: 'Småjobber' },
];

/** "lør. 5. sep." - the day of the week carries more than the date for a chore that comes
 *  round every week. */
function dayAndDate(dueDate: string): string {
  const date = parseDueDateLocal(dueDate)!;
  return `${date.toLocaleDateString('nb-NO', { weekday: 'short' })} ${formatShortDate(date)}`;
}

function firstName(name: string): string {
  return name.trim().split(' ')[0] || name;
}

export default function AllTasksScreen() {
  const theme = useTheme();
  const { data: me } = useMe();
  const { data: tasks, error, isLoading, mutate } = useSWR('tasks', api.tasks);
  const { data: quickActions, mutate: mutateQuickActions } = useSWR(
    'quick-actions',
    api.quickActions
  );

  const [tab, setTab] = useState<Tab>('recurring');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([mutate(), mutateQuickActions()]);
    setRefreshing(false);
  };

  const openTask = (task: Task) =>
    router.push({ pathname: '/tasks/new', params: { id: String(task.id) } });

  const todayKey = localDateKey(new Date());
  const meId = me?.id;

  const series = tasks ? buildSeries(tasks, todayKey) : [];
  const onceTasks = (tasks ?? []).filter((t) => !t.quick && t.repeatFrequency === 'NONE');

  const headerButtons = (
    <View style={styles.headerButtons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lukk"
        onPress={() => router.back()}
        hitSlop={Spacing.two}
        style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="close" size={20} color={theme.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ny oppgave"
        onPress={() => router.push('/tasks/new')}
        hitSlop={Spacing.two}
        style={({ pressed }) => [
          styles.roundButton,
          { backgroundColor: theme.brand },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="add" size={24} color={theme.onBrand} />
      </Pressable>
    </View>
  );

  return (
    <ScreenScroll
      eyebrow={me?.collective?.name ?? 'Kollektiv'}
      title="Oppgaver"
      headerRight={headerButtons}
      headerExtra={
        <PillSegmentedControl
          options={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setFilter('all');
          }}
        />
      }
      refreshing={refreshing}
      onRefresh={handleRefresh}>
      {error ? (
        <ErrorState message="Klarte ikke å hente oppgavene." onRetry={() => mutate()} />
      ) : isLoading || !tasks ? (
        <RefreshSpinner active />
      ) : tab === 'recurring' ? (
        <RecurringTab
          series={series}
          meId={meId}
          filter={filter}
          onFilter={setFilter}
          onOpen={openTask}
        />
      ) : tab === 'once' ? (
        <OnceTab
          tasks={onceTasks}
          meId={meId}
          todayKey={todayKey}
          filter={filter}
          onFilter={setFilter}
          onOpen={openTask}
        />
      ) : (
        <QuickTab actions={quickActions} />
      )}
    </ScreenScroll>
  );
}

function RecurringTab({
  series,
  meId,
  filter,
  onFilter,
  onOpen,
}: {
  series: Series[];
  meId: number | undefined;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onOpen: (task: Task) => void;
}) {
  const mine = series.filter((s) => s.current.assignedTo?.id === meId);
  const visible =
    filter === 'mine' ? mine : filter === 'rotating' ? series.filter((s) => s.current.rotateAssignee) : series;
  const weekly = visible.filter((s) => s.frequency === 'WEEKLY');
  const daily = visible.filter((s) => s.frequency === 'DAILY');

  const renderRow = (item: Series) => {
    const task = item.current;
    const parts = [frequencyLabel(item.frequency)];
    if (item.frequency === 'WEEKLY' && task.dueDate) parts.push(dayAndDate(task.dueDate));
    parts.push(effortLabel(task.points));
    return (
      <TaskRow
        key={item.key}
        task={task}
        meta={parts.join(' · ')}
        assigneeCaption={
          task.rotateAssignee ? 'Roterer' : task.assignedTo ? `Kun ${firstName(task.assignedTo.name)}` : ''
        }
        onPress={() => onOpen(task)}
      />
    );
  };

  return (
    <>
      <FilterChips
        options={[
          { key: 'all', label: 'Alle', count: series.length },
          { key: 'mine', label: 'Mine', count: mine.length },
          { key: 'rotating', label: 'Roterer' },
        ]}
        value={filter}
        onChange={onFilter}
      />

      {series.length === 0 ? (
        // A collective with no recurring tasks at all is one that never got a starter
        // pack - the create flow can be abandoned after the collective exists - so the
        // way back to that step is offered here, not just a plus button.
        <View style={styles.emptyBlock}>
          <EmptyText>
            Ingen gjentakende oppgaver ennå. Velg en startpakke, eller trykk + for å lage
            den første selv.
          </EmptyText>
          <PrimaryButton
            label="Velg startpakke"
            variant="secondary"
            onPress={() => router.push('/starter-pack')}
          />
        </View>
      ) : visible.length === 0 ? (
        <EmptyText>
          {filter === 'mine'
            ? 'Ingen av de gjentakende oppgavene er dine akkurat nå.'
            : 'Ingen av de gjentakende oppgavene roterer.'}
        </EmptyText>
      ) : (
        <>
          {weekly.length > 0 && (
            <Section title="Ukentlig" meta="tildelt nå" variant="eyebrow">
              <RowList items={weekly} render={renderRow} />
            </Section>
          )}
          {daily.length > 0 && (
            <Section title="Daglig" meta="tildelt nå" variant="eyebrow">
              <RowList items={daily} render={renderRow} />
            </Section>
          )}
        </>
      )}
    </>
  );
}

function OnceTab({
  tasks,
  meId,
  todayKey,
  filter,
  onFilter,
  onOpen,
}: {
  tasks: Task[];
  meId: number | undefined;
  todayKey: string;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onOpen: (task: Task) => void;
}) {
  const mine = tasks.filter((t) => t.assignedTo?.id === meId);
  const visible = filter === 'mine' ? mine : tasks;
  const open = visible.filter((t) => !t.completed).sort(byDueDate);
  const done = visible.filter((t) => t.completed).sort((a, b) => byDueDate(b, a));

  const renderRow = (task: Task) => {
    const overdue = !task.completed && !!task.dueDate && task.dueDate < todayKey;
    const when = task.dueDate ? dayAndDate(task.dueDate) : 'Ingen dato';
    return (
      <TaskRow
        key={task.id}
        task={task}
        meta={`${overdue ? 'Forfalt · ' : ''}${when} · ${effortLabel(task.points)}`}
        metaColor={overdue ? 'danger' : undefined}
        assigneeCaption={task.assignedTo ? firstName(task.assignedTo.name) : ''}
        onPress={() => onOpen(task)}
      />
    );
  };

  return (
    <>
      <FilterChips
        options={[
          { key: 'all', label: 'Alle', count: tasks.length },
          { key: 'mine', label: 'Mine', count: mine.length },
        ]}
        value={filter}
        onChange={onFilter}
      />

      {visible.length === 0 ? (
        <EmptyText>
          {tasks.length === 0
            ? 'Ingen engangsoppgaver. Trykk + for å legge til noe som bare skal gjøres én gang.'
            : 'Ingen av engangsoppgavene er dine.'}
        </EmptyText>
      ) : (
        <>
          {open.length > 0 && (
            <Section title="Åpne" meta={String(open.length)} variant="eyebrow">
              <RowList items={open} render={renderRow} />
            </Section>
          )}
          {done.length > 0 && (
            <Section title="Gjort" meta={String(done.length)} variant="eyebrow">
              <RowList items={done} render={renderRow} />
            </Section>
          )}
        </>
      )}
    </>
  );
}

/** Read-only here on purpose: småjobber are counted from Hjem, where a tap is a tap.
 *  This tab answers "what counts, and how often has it been done". */
function QuickTab({ actions }: { actions: QuickAction[] | undefined }) {
  const theme = useTheme();

  if (!actions) return <RefreshSpinner active />;
  if (actions.length === 0) return <EmptyText>Ingen småjobber.</EmptyText>;

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        De små tingene ingen planlegger. Tell dem fra Hjem-fanen – her ser du hvor ofte de
        blir gjort.
      </ThemedText>
      <Section title="Denne uka" meta="totalt" variant="eyebrow">
        <RowList
          items={actions}
          render={(action) => (
            <View key={action.key} style={styles.row}>
              <View style={[styles.quickIcon, { backgroundColor: theme.backgroundElement }]}>
                {QuickActionIcons[action.key] ? (
                  <Image source={QuickActionIcons[action.key]} style={styles.quickImage} contentFit="contain" />
                ) : (
                  <ThemedText style={styles.quickEmoji}>{action.emoji}</ThemedText>
                )}
              </View>
              <View style={styles.rowText}>
                <ThemedText type="heading" numberOfLines={1}>
                  {action.title}
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor={action.countThisWeek > 0 ? 'brand' : 'textSecondary'}>
                  ×{action.countThisWeek} denne uka
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
                {action.countAllTime}
              </ThemedText>
            </View>
          )}
        />
      </Section>
    </>
  );
}

function TaskRow({
  task,
  meta,
  metaColor,
  assigneeCaption,
  onPress,
}: {
  task: Task;
  meta: string;
  metaColor?: 'danger';
  assigneeCaption: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${meta}`}
      accessibilityHint="Åpner oppgaven"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <ThemedText type="heading" numberOfLines={1} style={task.completed && styles.completed}>
          {task.title}
        </ThemedText>
        <ThemedText type="small" themeColor={metaColor ?? 'textSecondary'} numberOfLines={1}>
          {meta}
        </ThemedText>
      </View>

      {task.assignedTo && (
        <View style={styles.assignee}>
          <AvatarBadge
            userId={task.assignedTo.id}
            name={task.assignedTo.name}
            pictureUrl={task.assignedTo.pictureUrl}
            shape="circle"
            size={30}
          />
          {!!assigneeCaption && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.assigneeCaption} numberOfLines={1}>
              {assigneeCaption}
            </ThemedText>
          )}
        </View>
      )}

      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

function RowList<T>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  return (
    <View>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <FlatDivider />}
          {render(item)}
        </Fragment>
      ))}
    </View>
  );
}

function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { key: Filter; label: string; count?: number }[];
  value: Filter;
  onChange: (value: Filter) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.key)}
            style={[
              styles.chip,
              { borderColor: active ? theme.text : theme.border },
              active && { backgroundColor: theme.text },
            ]}>
            <ThemedText
              type={active ? 'smallBold' : 'small'}
              style={active ? { color: theme.background } : undefined}>
              {option.count != null ? `${option.label} ${option.count}` : option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyText({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  completed: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  assignee: {
    alignItems: 'center',
    gap: 2,
    width: 64,
  },
  assigneeCaption: {
    fontSize: 10,
    lineHeight: 14,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickImage: {
    width: 26,
    height: 26,
  },
  quickEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  empty: {
    paddingVertical: Spacing.three,
  },
  emptyBlock: {
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
