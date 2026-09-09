import { buildSeries, currentOccurrence } from '@/lib/task-series';
import type { Task } from '@/types/api';

let nextId = 1;

function task(overrides: Partial<Task>): Task {
  return {
    id: nextId++,
    title: 'Vask badet',
    description: null,
    dueDate: null,
    completed: false,
    assignedTo: null,
    points: 2,
    quick: false,
    repeatFrequency: 'WEEKLY',
    rotateAssignee: true,
    recurrenceGroupId: 'grp-bad',
    ...overrides,
  };
}

const TODAY = '2026-09-09';

describe('currentOccurrence', () => {
  it('prefers the next occurrence that is still open', () => {
    const done = task({ dueDate: '2026-09-12', completed: true });
    const open = task({ dueDate: '2026-09-19' });
    expect(currentOccurrence([open, done], TODAY)).toBe(open);
  });

  it('falls back to the next occurrence even if it is done', () => {
    const done = task({ dueDate: '2026-09-12', completed: true });
    expect(currentOccurrence([done], TODAY)).toBe(done);
  });

  it('falls back to the latest past occurrence when nothing is ahead', () => {
    const older = task({ dueDate: '2026-08-22' });
    const newer = task({ dueDate: '2026-08-29' });
    expect(currentOccurrence([older, newer], TODAY)).toBe(newer);
  });
});

describe('buildSeries', () => {
  it('folds the rows of one chore into a single series by group id', () => {
    const rows = [
      task({ dueDate: '2026-09-05', completed: true }),
      task({ dueDate: '2026-09-12' }),
      task({ dueDate: '2026-09-19' }),
    ];
    const series = buildSeries(rows, TODAY);
    expect(series).toHaveLength(1);
    expect(series[0].current.dueDate).toBe('2026-09-12');
    expect(series[0].frequency).toBe('WEEKLY');
  });

  it('keeps two chores with the same title apart when they have different group ids', () => {
    const rows = [
      task({ title: 'Vask gulv', recurrenceGroupId: 'a', dueDate: '2026-09-12' }),
      task({ title: 'Vask gulv', recurrenceGroupId: 'b', dueDate: '2026-09-13' }),
    ];
    expect(buildSeries(rows, TODAY)).toHaveLength(2);
  });

  it('folds by title and rhythm when the backend sends no group id', () => {
    const rows = [
      task({ recurrenceGroupId: undefined, dueDate: '2026-09-12' }),
      task({ recurrenceGroupId: undefined, dueDate: '2026-09-19' }),
      task({ recurrenceGroupId: undefined, dueDate: '2026-09-10', repeatFrequency: 'DAILY' }),
    ];
    const series = buildSeries(rows, TODAY);
    expect(series.map((s) => s.frequency).sort()).toEqual(['DAILY', 'WEEKLY']);
  });

  it('leaves one-off and quick tasks out', () => {
    const rows = [
      task({ repeatFrequency: 'NONE', dueDate: '2026-09-12' }),
      task({ quick: true, repeatFrequency: 'NONE' }),
    ];
    expect(buildSeries(rows, TODAY)).toHaveLength(0);
  });

  it('orders by the current occurrence date, then title', () => {
    const rows = [
      task({ title: 'Støvsug', recurrenceGroupId: 'c', dueDate: '2026-09-14' }),
      task({ title: 'Vask badet', recurrenceGroupId: 'a', dueDate: '2026-09-12' }),
      task({ title: 'Handle', recurrenceGroupId: 'b', dueDate: '2026-09-12' }),
    ];
    expect(buildSeries(rows, TODAY).map((s) => s.current.title)).toEqual([
      'Handle',
      'Vask badet',
      'Støvsug',
    ]);
  });
});
