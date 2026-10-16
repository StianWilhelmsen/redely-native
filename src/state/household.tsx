/**
 * Who you are and which household ("door") you are looking at.
 *
 * A person can belong to several households (a family home, a parent's home where they
 * help out, later a linked co-parenting home). Exactly one is "current"; every household
 * screen reads `hid` from here. The choice is remembered across launches.
 *
 * Mounted once under the signed-in part of the app. Screens use `useHousehold()` (throws
 * without a current household - only use it under the tabs) or `useMeState()` (safe
 * everywhere signed in, e.g. onboarding).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import useSWR, { type KeyedMutator } from 'swr';

import { api, keys, type Household, type Me, type Member, type MyHousehold, type Uuid } from '@/api';
import { currentLanguage } from '@/i18n';
import { syncPurchasesIdentity } from '@/lib/purchases';

const CURRENT_KEY = 'magneten:household';

type MeState = {
  me: Me | undefined;
  meError: unknown;
  meLoading: boolean;
  mutateMe: KeyedMutator<Me>;
  /** The household on screen, or null when the user has none yet (→ onboarding). */
  current: MyHousehold | null;
  switchHousehold: (hid: Uuid) => void;
};

const MeContext = createContext<MeState | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { data: me, error: meError, isLoading: meLoading, mutate: mutateMe } = useSWR(keys.me(), api.me.get);
  const [storedId, setStoredId] = useState<Uuid | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(CURRENT_KEY)
      .then((v) => setStoredId(v))
      .catch(() => setStoredId(null));
  }, []);

  // Keep the server's idea of our language in step with the app's, so pushes arrive in
  // the language the person reads the app in.
  useEffect(() => {
    if (me && me.locale !== currentLanguage()) {
      api.me.update({ locale: currentLanguage() }).then((next) => mutateMe(next, { revalidate: false })).catch(() => {});
    }
  }, [me, mutateMe]);

  const current = useMemo<MyHousehold | null>(() => {
    if (!me || storedId === undefined) return null;
    return me.households.find((x) => x.householdId === storedId) ?? me.households[0] ?? null;
  }, [me, storedId]);

  const switchHousehold = useCallback((hid: Uuid) => {
    setStoredId(hid);
    AsyncStorage.setItem(CURRENT_KEY, hid).catch(() => {});
  }, []);

  // One Pluss per household: RevenueCat's subscriber is the household on screen.
  useEffect(() => {
    if (!current) return;
    syncPurchasesIdentity(current.householdId).catch((e) => console.warn('[purchases] identity sync failed', e));
  }, [current]);

  const value = useMemo<MeState>(
    () => ({
      me,
      meError,
      meLoading: meLoading || (!!me && storedId === undefined),
      mutateMe,
      current,
      switchHousehold,
    }),
    [me, meError, meLoading, mutateMe, current, storedId, switchHousehold]
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMeState(): MeState {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMeState must be used within HouseholdProvider');
  return ctx;
}

export type HouseholdState = {
  hid: Uuid;
  /** What /api/me says about my membership - available instantly. */
  membership: MyHousehold;
  /** The full household with members - may still be loading. */
  household: Household | undefined;
  members: Member[];
  memberById: (id: Uuid | null | undefined) => Member | undefined;
  me: Member | undefined;
  isAdult: boolean;
  isPluss: boolean;
  mutateHousehold: KeyedMutator<Household>;
};

/** The current household. Only for screens that cannot exist without one (the tabs). */
export function useHousehold(): HouseholdState {
  const { current } = useMeState();
  const hid = current?.householdId;
  const { data: household, mutate } = useSWR(hid ? keys.household(hid) : null, () => api.households.get(hid!));

  const state = useMemo(() => {
    if (!current || !hid) return null;
    const members = household?.members ?? [];
    const byId = new Map(members.map((m) => [m.id, m]));
    return {
      hid,
      membership: current,
      household,
      members,
      memberById: (id) => (id ? byId.get(id) : undefined),
      me: byId.get(current.memberId),
      isAdult: current.role === 'ADULT',
      isPluss: household?.isPluss ?? current.isPluss,
      mutateHousehold: mutate,
    } satisfies HouseholdState;
  }, [hid, current, household, mutate]);

  if (!state) throw new Error('useHousehold used without a current household');
  return state;
}
