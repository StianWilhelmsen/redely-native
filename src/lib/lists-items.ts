/**
 * Pure helpers for lists: grouping for store mode, the share text, and the templates a
 * new checklist can start from (their names and items live in lists.json).
 */

import type { ListItem } from '@/api';

export type ItemGroup = { category: string | null; items: ListItem[] };

/**
 * Items grouped by category in first-seen order (the list's own order), with the
 * uncategorised group last. Category names compare case-insensitively.
 */
export function groupByCategory(items: ListItem[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();
  const loose: ListItem[] = [];
  for (const item of items) {
    const name = item.category?.trim();
    if (!name) {
      loose.push(item);
      continue;
    }
    const key = name.toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, { category: name, items: [] });
    groups.get(key)!.items.push(item);
  }
  const out = [...groups.values()];
  if (loose.length) out.push({ category: null, items: loose });
  return out;
}

/** Plain-text version of a list for the share sheet: open items first, done ones ticked. */
export function listAsText(name: string, items: ListItem[]): string {
  const line = (i: ListItem) => `${i.done ? '[x]' : '[ ]'} ${i.text}${i.quantity ? ` (${i.quantity})` : ''}`;
  const open = items.filter((i) => !i.done).map(line);
  const done = items.filter((i) => i.done).map(line);
  return [name, '', ...open, ...done].join('\n');
}

export const LIST_TEMPLATES = ['cabin', 'school', 'may17', 'winterTyres', 'kidsParty'] as const;
export type ListTemplate = (typeof LIST_TEMPLATES)[number];
