import type { Task } from '@/types/api';

/**
 * One recurring chore, as people think of it. The backend stores a row per occurrence
 * (WeeklyRepeatService generates a fortnight ahead), tied together by `recurrenceGroupId`.
 * `current` is the occurrence the chore's single row speaks for: the next one still open,
 * else the next one at all, else the latest there is.
 */
export type Series = {
  key: string;
  frequency: 'WEEKLY' | 'DAILY';
  current: Task;
};

/** Due date order, undated last. Dates are yyyy-MM-dd, so string order is date order. */
export function byDueDate(a: Task, b: Task): number {
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
}

export function currentOccurrence(instances: Task[], todayKey: string): Task {
  const dated = instances.filter((t) => t.dueDate).sort(byDueDate);
  return (
    dated.find((t) => t.dueDate! >= todayKey && !t.completed) ??
    dated.find((t) => t.dueDate! >= todayKey) ??
    dated[dated.length - 1] ??
    instances[0]
  );
}

/** Rows made by a backend from before the group id was exposed fold by title and rhythm
 *  instead, which is right except for two different chores that share a name. */
function seriesKey(task: Task): string {
  return task.recurrenceGroupId ?? `${task.repeatFrequency}:${task.title.trim().toLowerCase()}`;
}

export function buildSeries(tasks: Task[], todayKey: string): Series[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.quick || task.repeatFrequency === 'NONE') continue;
    const key = seriesKey(task);
    const group = groups.get(key);
    if (group) group.push(task);
    else groups.set(key, [task]);
  }
  return [...groups.entries()]
    .map(([key, instances]) => {
      const current = currentOccurrence(instances, todayKey);
      return { key, frequency: current.repeatFrequency as 'WEEKLY' | 'DAILY', current };
    })
    .sort(
      (a, b) =>
        byDueDate(a.current, b.current) || a.current.title.localeCompare(b.current.title, 'nb')
    );
}
