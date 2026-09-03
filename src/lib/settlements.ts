import type { Expense } from '@/types/api';

/** One expense's contribution to what two people owe each other. */
export type SettlementLine = {
  /** Your unpaid share, when this is money you owe. Null when they owe you - their
   *  share is not yours to mark as paid. */
  shareId: number | null;
  expenseId: number;
  description: string;
  /** ISO yyyy-MM-dd, straight off the expense. */
  date: string;
  amount: number;
  youOwe: boolean;
};

/** Everything still open between you and one other person, netted. */
export type Settlement = {
  personId: number;
  name: string;
  pictureUrl: string | null;
  /** Positive: they owe you. Negative: you owe them. */
  net: number;
  lines: SettlementLine[];
  /** Your unpaid shares to them - exactly what settling up marks as paid. */
  shareIds: number[];
};

/**
 * Turns the collective's expenses into one row per person you have an open balance with.
 *
 * Both directions are folded into the same row on purpose: if you owe Maren 300 for the
 * electricity and she owes you 50 for the soap, what either of you wants to know is that
 * it comes to 250 - not two separate debts pointing opposite ways.
 */
export function buildSettlements(expenses: Expense[], meId: number | undefined): Settlement[] {
  if (meId == null) return [];

  const byPerson = new Map<number, Settlement>();
  const entryFor = (id: number, name: string, pictureUrl: string | null): Settlement => {
    const existing = byPerson.get(id);
    if (existing) return existing;
    const created: Settlement = { personId: id, name, pictureUrl, net: 0, lines: [], shareIds: [] };
    byPerson.set(id, created);
    return created;
  };

  for (const expense of expenses) {
    const description = expense.description || 'Handletur';
    const payer = expense.paidBy;
    if (!payer) continue;

    for (const share of expense.shares) {
      if (share.paid) continue;

      // You owe the payer your share of something they fronted.
      if (share.user.id === meId && payer.id !== meId) {
        const entry = entryFor(payer.id, payer.name, payer.pictureUrl);
        entry.net -= share.amountOwed;
        entry.shareIds.push(share.id);
        entry.lines.push({
          shareId: share.id,
          expenseId: expense.id,
          description,
          date: expense.date,
          amount: share.amountOwed,
          youOwe: true,
        });
        continue;
      }

      // They owe you their share of something you fronted.
      if (payer.id === meId && share.user.id !== meId) {
        const entry = entryFor(share.user.id, share.user.name, share.user.pictureUrl);
        entry.net += share.amountOwed;
        entry.lines.push({
          shareId: null,
          expenseId: expense.id,
          description,
          date: expense.date,
          amount: share.amountOwed,
          youOwe: false,
        });
      }
    }
  }

  return Array.from(byPerson.values())
    .filter((settlement) => Math.round(Math.abs(settlement.net)) > 0)
    // Deepest debt first - that is the one worth doing something about.
    .sort((a, b) => a.net - b.net)
    .map((settlement) => ({
      ...settlement,
      lines: [...settlement.lines].sort((a, b) => b.date.localeCompare(a.date)),
    }));
}

export function netBalance(settlements: Settlement[]): number {
  return settlements.reduce((sum, settlement) => sum + settlement.net, 0);
}

export function formatKr(amount: number): string {
  return `${Math.round(amount).toLocaleString('nb-NO')} kr`;
}
