/**
 * "Onboarding is still running." Creating the household happens halfway through
 * onboarding (step 3), after which the person still has invite, notifications and the
 * first note ahead of them. Without this flag the root guard would see a household and
 * jump straight to the door. Persisted, so closing the app mid-way resumes onboarding.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'magneten:onboarding-active';
let active = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

AsyncStorage.getItem(KEY)
  .then((v) => {
    active = v === '1';
  })
  .catch(() => {})
  .finally(() => {
    loaded = true;
    emit();
  });

export function setOnboardingActive(next: boolean) {
  active = next;
  emit();
  (next ? AsyncStorage.setItem(KEY, '1') : AsyncStorage.removeItem(KEY)).catch(() => {});
}

/** `undefined` until storage has been read. */
export function useOnboardingActive(): boolean | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (loaded ? active : undefined)
  );
}
