/**
 * Every headline, caption and joke in the weekly story is derived from the week's own
 * numbers — nothing here invents a fact. The playful lines pick from a small pool, seeded
 * by the week and the member, so the same week always reads the same way instead of
 * reshuffling every time the story is reopened.
 */

import type { UserStats, WeeklyQuickActions, WeeklyStats, WeeklyTask } from '@/types/api';

export const WEEKDAYS_NB = [
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
  'søndag',
] as const;

const MONTHS_NB = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
] as const;

const NUMBER_WORDS_NB = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni'] as const;

/** Parses a yyyy-MM-dd key at midday, so no time zone can push it onto the neighbouring day. */
function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function stableIndex(seed: string, poolSize: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % poolSize;
}

function pick<T>(pool: readonly T[], seed: string): T {
  return pool[stableIndex(seed, pool.length)];
}

function numberWord(n: number): string {
  return n >= 0 && n < NUMBER_WORDS_NB.length ? NUMBER_WORDS_NB[n] : String(n);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** ISO-8601 week number — the "Uke 32" in the story header. */
export function isoWeekNumber(dateKey: string): number {
  const date = parseDateKey(dateKey);
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Shift to the Thursday of the same week: ISO weeks are the ones their Thursday falls in.
  target.setUTCDate(target.getUTCDate() - ((target.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** "3.–9. august", collapsing to "30. juli–5. august" when the week straddles two months. */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = parseDateKey(weekStart);
  const end = parseDateKey(weekEnd);
  const endLabel = `${end.getDate()}. ${MONTHS_NB[end.getMonth()]}`;
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}.–${endLabel}`
    : `${start.getDate()}. ${MONTHS_NB[start.getMonth()]}–${endLabel}`;
}

/** "mandag 10. august" — the day the next week's slate is wiped clean. */
export function formatNextWeekStart(weekEnd: string): string {
  const next = parseDateKey(weekEnd);
  next.setDate(next.getDate() + 1);
  return `mandag ${next.getDate()}. ${MONTHS_NB[next.getMonth()]}`;
}

export function goalPercent(data: WeeklyStats): number {
  if (data.goalPoints <= 0) return 0;
  return Math.min(100, Math.round((data.totalPoints / data.goalPoints) * 100));
}

export function coverTitle(isFinished: boolean): string {
  return isFinished ? 'Sånn gikk uken deres' : 'Sånn går uken deres';
}

export function goalHeadline(percent: number): string {
  if (percent >= 100) return 'Målet er nådd';
  if (percent >= 75) return 'Dere er nesten i mål';
  if (percent >= 50) return 'Dere er over halvveis';
  if (percent >= 25) return 'Dere er godt i gang';
  if (percent > 0) return 'Uken kom tregt i gang';
  return 'Blanke ark';
}

/** "+3 poeng fra forrige uke" — omitted entirely when there is nothing to compare against. */
export function pointsDeltaLabel(data: WeeklyStats): string | null {
  const delta = data.totalPoints - data.previousWeekPoints;
  if (data.previousWeekPoints === 0 && data.totalPoints === 0) return null;
  if (delta === 0) return 'Akkurat som forrige uke';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} poeng fra forrige uke`;
}

export function tasksHeadline(done: number, total: number): string {
  if (total === 0) return 'Ingen faste oppgaver';
  if (done === total) return total === 1 ? 'Den ene er i boks' : `Alle ${total} i boks`;
  return `${done} av ${total} i boks`;
}

/** "Sofie · onsdag" for a finished chore, "Markus · ikke gjort" for one still open. */
export function taskMetaLabel(task: WeeklyTask): string {
  const who = task.assigneeName ?? 'Ingen';
  if (!task.completed) return `${who} · ikke gjort`;
  if (task.completedDayIndex == null) return who;
  return `${who} · ${WEEKDAYS_NB[task.completedDayIndex]}`;
}

/** The line under the chore list: what rolls over, or a pat on the back when nothing does. */
export function taskRolloverNote(tasks: WeeklyTask[]): string {
  const open = tasks.filter((task) => !task.completed);
  if (tasks.length === 0) return 'Ingen faste oppgaver var satt opp denne uken.';
  if (open.length === 0) return 'Hele planen er unnagjort. Ikke dårlig.';

  const first = open[0];
  const rest = open.length - 1;
  const whose = first.assigneeName ? ` ${first.assigneeName} har fått den igjen.` : '';
  const others = rest > 0 ? ` Og ${rest} ${rest === 1 ? 'til' : 'andre'}.` : '';
  return `${first.title} ruller over til neste uke.${whose}${others}`;
}

export function quickActionsHeadline(count: number): string {
  if (count === 0) return 'Ingen småjobber denne uken';
  if (count === 1) return 'Én ting ingen ba om';
  return `${count} ting ingen ba om`;
}

const QUICK_SUFFIXES = [
  'Ingen ba om det.',
  'Uten å nevne det.',
  'Respekt.',
  'Bare gjort.',
  'Helt uoppfordret.',
  'Legendarisk.',
] as const;

/** The one-liner under each member on the småjobber pane, built from their own top chore. */
export function quickActionFlavor(entry: WeeklyQuickActions, weekStart: string): string {
  const suffix = pick(QUICK_SUFFIXES, `${weekStart}:${entry.userId}`);
  if (!entry.topActionTitle) {
    return `${entry.count} ${entry.count === 1 ? 'småjobb' : 'småjobber'}. ${suffix}`;
  }
  if (entry.topActionCount >= 2) {
    return `${entry.topActionTitle} ${numberWord(entry.topActionCount)} ganger. ${suffix}`;
  }
  return `${entry.topActionTitle}. ${suffix}`;
}

/** The quote on the MVP pane. Always a restatement of something they actually did. */
export function mvpQuote(mvp: UserStats, quick: WeeklyQuickActions | undefined): string {
  if (quick?.topActionTitle) {
    const openers = [
      `${quick.topActionTitle} før noen rakk å spørre.`,
      `${quick.topActionTitle}. Uten å lage sak av det.`,
      `${quick.topActionTitle} — helt av seg selv.`,
    ] as const;
    return pick(openers, `${mvp.userId}:${quick.topActionTitle}`);
  }
  if (quick && quick.count > 0) {
    return `${quick.count} ${quick.count === 1 ? 'småjobb' : 'småjobber'}. Null oppstyr.`;
  }
  return `${mvp.weekPoints} poeng uten å si et ord.`;
}

/** The MVP's badges — at most three, and only ones the numbers actually back up. */
export function mvpChips(data: WeeklyStats, mvp: UserStats): string[] {
  const chips: string[] = [];
  const quick = data.quickActionsByUser.find((entry) => entry.userId === mvp.userId);
  const mostQuick = data.quickActionsByUser[0];

  if (quick && mostQuick && quick.userId === mostQuick.userId && quick.count > 0) {
    chips.push('Flest småjobber');
  }
  if (data.mvpStreakWeeks >= 2) {
    chips.push(`${data.mvpStreakWeeks} uker på rad`);
  }

  const tasksDone = data.tasks.filter(
    (task) => task.completed && task.assigneeUserId === mvp.userId
  ).length;
  if (tasksDone > 0) {
    chips.push(`${tasksDone} ${tasksDone === 1 ? 'fast oppgave' : 'faste oppgaver'}`);
  }
  if (chips.length < 3) {
    chips.push(`Nivå ${mvp.level}`);
  }
  return chips.slice(0, 3);
}

export function leaderboardHeadline(leaderboard: UserStats[]): string {
  const top = leaderboard[0];
  if (!top || top.weekPoints === 0) return 'Alle på null';
  const runnerUp = leaderboard[1];
  if (runnerUp && runnerUp.weekPoints === top.weekPoints) return 'Det står likt';
  return `${top.name} leder`;
}

export function recapHeadline(percent: number, collectiveName: string | null): string {
  const where = collectiveName ? `, ${collectiveName}` : '';
  if (percent >= 100) return `Ukemålet er i boks${where}`;
  if (percent >= 70) return `Solid uke${where}`;
  if (percent >= 35) return `Grei uke${where}`;
  if (percent > 0) return `Rolig uke${where}`;
  return `Blanke ark${where}`;
}

/** "Onsdag var toppdagen — 5 gjøremål unnagjort." */
export function topDayCaption(data: WeeklyStats): string {
  let bestIndex = -1;
  let best = 0;
  data.dayCounts.forEach((day, index) => {
    if (day.count > best) {
      best = day.count;
      bestIndex = index;
    }
  });
  if (bestIndex < 0) return 'Ingen gjøremål ble huket av denne uken.';
  return `${capitalize(WEEKDAYS_NB[bestIndex])} var toppdagen — ${best} ${
    best === 1 ? 'gjøremål' : 'gjøremål'
  } unnagjort.`;
}

/** The message posted to the shared chat from the last pane. */
export function shareMessage(data: WeeklyStats): string {
  const lines = [
    `📊 Uke ${isoWeekNumber(data.weekStart)} (${formatWeekRange(data.weekStart, data.weekEnd)})`,
    `${data.totalPoints}/${data.goalPoints} poeng${data.goalReached ? ' — målet er nådd! 🎉' : ''}`,
    `${data.plannedTasksCompleted}/${data.plannedTasks} faste oppgaver · ${data.quickActions} småjobber`,
  ];
  if (data.mvp) lines.push(`👑 Ukens MVP: ${data.mvp.name} (${data.mvp.weekPoints} p)`);
  return lines.join('\n');
}
