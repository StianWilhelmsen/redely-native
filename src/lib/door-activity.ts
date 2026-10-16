import type { ActivityEntry, DateString, Member } from '@/api';
import { dateOfTimestamp } from '@/lib/door-dates';

type T = (key: string, options?: Record<string, unknown>) => string;

/** Split a newest-first feed into today and everything before. */
export function groupActivity(items: ActivityEntry[], today: DateString) {
  const todayItems: ActivityEntry[] = [];
  const earlier: ActivityEntry[] = [];
  const seen = new Set<number>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    (dateOfTimestamp(item.createdAt) === today ? todayItems : earlier).push(item);
  }
  return { today: todayItems, earlier };
}

/** One sentence per activity, e.g. "Emma tok «Tømme oppvasken»". */
export function activitySentence(
  entry: ActivityEntry,
  memberById: (id: string | null | undefined) => Member | undefined,
  t: T
): string {
  const actorMember = memberById(entry.actorMemberId);
  const targetMember = memberById(entry.targetMemberId);
  const actor = actorMember ? (actorMember.isMe ? t('door.activity.you') : actorMember.displayName) : t('door.activity.someone');
  const target = targetMember
    ? targetMember.isMe
      ? t('door.activity.youObject')
      : targetMember.displayName
    : t('door.activity.someoneObject');
  const subject = entry.subject ?? t('door.activity.untitled');
  const vars = { actor, target, subject };

  switch (entry.type) {
    case 'NOTE_CREATED':
      return targetMember && entry.targetMemberId !== entry.actorMemberId
        ? t('door.activity.NOTE_CREATED_for', vars)
        : t('door.activity.NOTE_CREATED', vars);
    case 'AREA_ASSIGNED':
      return entry.actorMemberId && entry.actorMemberId !== entry.targetMemberId
        ? t('door.activity.AREA_ASSIGNED_by', vars)
        : t('door.activity.AREA_ASSIGNED', { ...vars, target: targetMember?.isMe ? t('door.activity.you') : target });
    default:
      return t(`door.activity.${entry.type}`, vars);
  }
}
