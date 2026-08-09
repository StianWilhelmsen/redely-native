/**
 * The two subscription plans, mirroring wilhelmsen.project.service.SubscriptionService on
 * the backend - which is the source of truth. There's no "list available plans" endpoint,
 * so these are kept in sync by hand; the product ids in particular must match App Store
 * Connect and RevenueCat exactly or purchases fail silently.
 */
export type PlanId = 'base' | 'plus';

export type Plan = {
  id: PlanId;
  productId: string;
  name: string;
  priceNok: number;
  memberLimit: number;
  /** Household size used for the "ca. X kr hver" line - illustrative, not the plan's
   *  actual cap (dividing Pluss's 79kr by its real 50-person ceiling would read as an
   *  absurd, misleading price). */
  examplePeopleCount: number;
};

export const BASE_PLAN: Plan = {
  id: 'base',
  productId: 'collective_monthly_base',
  name: 'Kollektiv Grunn',
  priceNok: 49,
  memberLimit: 6,
  examplePeopleCount: 6,
};

export const PLUS_PLAN: Plan = {
  id: 'plus',
  productId: 'collective_monthly_plus',
  name: 'Kollektiv Pluss',
  priceNok: 79,
  memberLimit: 50,
  examplePeopleCount: 12,
};

export const PLANS: Plan[] = [BASE_PLAN, PLUS_PLAN];

/**
 * Which plan a collective is on. The member limit is the only thing the backend reports
 * that distinguishes them (it sets it from the purchased product id - see
 * SubscriptionService#applyPlanForProduct), so it's what we read back.
 */
export function planForMemberLimit(maxMembers: number): Plan {
  return maxMembers > BASE_PLAN.memberLimit ? PLUS_PLAN : BASE_PLAN;
}

/**
 * Whether a status means an actual App Store purchase has happened. TRIALING never has -
 * the free month is granted server-side on collective creation, entirely outside Apple.
 * READ_ONLY is excluded too: it covers both a lapsed subscription and a trial that simply
 * ran out, and those can't be told apart here.
 */
export function hasPurchasedPlan(status: string): boolean {
  return status === 'ACTIVE' || status === 'PAST_DUE' || status === 'CANCELED';
}
