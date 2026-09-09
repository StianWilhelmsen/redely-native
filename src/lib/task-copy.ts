import type { RepeatFrequency } from '@/types/api';

/** The words the app uses for a task's shape - shared by the form and the overview so a
 *  task reads the same where it is made and where it is listed. */
export const REPEAT_OPTIONS: { key: RepeatFrequency; label: string }[] = [
  { key: 'NONE', label: 'Én gang' },
  { key: 'WEEKLY', label: 'Ukentlig' },
  { key: 'DAILY', label: 'Daglig' },
];

// Deliberately narrow (and labelled by effort rather than raw numbers): rotation already
// evens out who takes the heavy chores, so a wider spread would mostly invite inflating
// your own tasks. Mirrors TaskService.MIN/MAX_TASK_POINTS on the backend.
export const POINT_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Liten' },
  { value: 2, label: 'Vanlig' },
  { value: 3, label: 'Stor' },
];

export function frequencyLabel(frequency: RepeatFrequency): string {
  return REPEAT_OPTIONS.find((option) => option.key === frequency)?.label ?? 'Én gang';
}

/** "Stor, 3 p" - the effort word first, since that is what people chose, with the number
 *  the leaderboard counts in behind it. Tasks made before the scale was narrowed can sit
 *  outside it; those show the number alone. */
export function effortLabel(points: number): string {
  const label = POINT_OPTIONS.find((option) => option.value === points)?.label;
  return label ? `${label}, ${points} p` : `${points} p`;
}
