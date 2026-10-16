/**
 * Turning a note into the short lines printed on it, in the reader's language.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Area, DateString, Member, Note, Recurrence, Weekday } from '@/api';
import { addDays, daysBetween, formatKr, formatShortDate, formatWeekday, WEEK_ORDER } from '@/lib/door-dates';

export function useNoteLabels() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return useMemo(() => {
    const dayWord = (date: DateString, today: DateString): string => {
      if (date === today) return t('door.note.today');
      if (date === addDays(today, 1)) return t('door.note.tomorrow');
      if (date === addDays(today, -1)) return t('door.note.yesterday');
      return formatShortDate(date, lang);
    };

    /** The small line above the title on the door. */
    const meta = (note: Note, today: DateString): string | undefined => {
      if (!note.dueDate) return undefined;
      if (note.dueDate < today) {
        return daysBetween(note.dueDate, today) === 1
          ? t('door.overdueYesterday')
          : t('door.overdueSince', { day: daysBetween(note.dueDate, today) < 7 ? formatWeekday(note.dueDate, lang) : formatShortDate(note.dueDate, lang) });
      }
      if (note.dueDate === today) return note.dueTime ?? undefined;
      return note.dueTime ? `${dayWord(note.dueDate, today)} ${note.dueTime}` : dayWord(note.dueDate, today);
    };

    const reward = (note: Note) => (note.rewardOre ? t('door.reward', { kr: formatKr(note.rewardOre, lang) }) : undefined);

    /** The small line at the bottom: who · area · reward. */
    const footer = (note: Note, assignee: Member | undefined, area: Area | undefined): string =>
      [assignee?.displayName ?? t('door.anyone'), area?.name, reward(note)].filter(Boolean).join(' · ');

    const when = (note: Note, today: DateString): string => {
      if (!note.dueDate) return t('door.note.noDate');
      const day = dayWord(note.dueDate, today);
      return note.dueTime ? t('door.note.dateTime', { date: day, time: note.dueTime }) : day;
    };

    const weekdays = (days: Weekday[]): string => {
      const sorted = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => t(`door.weekday.${d}`));
      if (sorted.length <= 1) return sorted.join('');
      return t('door.repeat.joiner', { list: sorted.slice(0, -1).join(', '), last: sorted[sorted.length - 1] });
    };

    const repeat = (recurrence: Recurrence, days: Weekday[]): string => {
      if (recurrence === 'WEEKLY' && days.length > 0) return t('door.repeat.weekdays', { days: weekdays(days) });
      return t(`door.repeat.${recurrence}`);
    };

    return { meta, footer, when, repeat, reward, dayWord, lang };
  }, [t, lang]);
}
