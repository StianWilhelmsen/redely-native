import type { ListItem } from '@/api';

import { groupByCategory, listAsText } from '../lists-items';

const item = (text: string, category: string | null, done = false, quantity: string | null = null): ListItem => ({
  id: text,
  text,
  quantity,
  category,
  position: 0,
  addedByMemberId: null,
  done,
  doneAt: null,
  doneByMemberId: null,
  createdAt: '2026-10-16T12:00:00+02:00',
});

describe('lists-items', () => {
  it('groups by category with the uncategorised last', () => {
    const groups = groupByCategory([
      item('Kaffe', null),
      item('Melk', 'Meieri'),
      item('Bananer', 'Frukt'),
      item('Ost', 'meieri '),
    ]);
    expect(groups.map((g) => g.category)).toEqual(['Meieri', 'Frukt', null]);
    expect(groups[0].items.map((i) => i.text)).toEqual(['Melk', 'Ost']);
  });

  it('writes a share text with open items first', () => {
    expect(listAsText('Handlelappen', [item('Melk', null, true), item('Ost', null, false, '1 pose')])).toBe(
      'Handlelappen\n\n[ ] Ost (1 pose)\n[x] Melk'
    );
  });
});
