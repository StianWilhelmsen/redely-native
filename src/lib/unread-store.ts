import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = () => void;

/**
 * Tiny shared "last seen" marker backed by AsyncStorage, readable/writable from
 * multiple independent mount points (a root-level badge, plus the actual screen
 * that marks things read) while staying in sync between them - same subscribe/
 * notify shape as auth-store.ts, just generic over a single numeric watermark.
 */
function createReadMarker(storageKey: string, firstRun: 'zero' | 'now' = 'zero') {
  let value: number | null = null; // null = not loaded from storage yet
  let loadPromise: Promise<void> | null = null;
  const listeners = new Set<Listener>();

  // What an *unset* marker should mean. For an id watermark, 0 is right ("seen
  // nothing"). For a timestamp watermark, 0 is 1970 - which would make every item
  // that ever existed count as unread on a fresh install, so those start at "now".
  const unsetValue = () => (firstRun === 'now' ? Date.now() : 0);

  function notify() {
    for (const listener of listeners) listener();
  }

  function ensureLoaded() {
    if (value !== null || loadPromise) return;
    loadPromise = AsyncStorage.getItem(storageKey).then((stored) => {
      if (stored) {
        value = Number(stored);
      } else {
        // Persist immediately so the baseline is stable across launches, rather
        // than drifting forward every time the app starts.
        value = unsetValue();
        AsyncStorage.setItem(storageKey, String(value)).catch(() => {});
      }
      notify();
    });
  }

  return {
    getValue(): number {
      // Before the read finishes, fall back to the unset baseline rather than 0 -
      // erring towards "nothing unread" so a slow load can't flash a false badge.
      return value ?? unsetValue();
    },
    markRead(newValue: number) {
      value = newValue;
      AsyncStorage.setItem(storageKey, String(newValue)).catch(() => {});
      notify();
    },
    subscribe(listener: Listener): () => void {
      ensureLoaded();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const chatReadMarker = createReadMarker('ryddig-kollektiv:chat-last-read-id');
export const paymentsReadMarker = createReadMarker('ryddig-kollektiv:payments-last-seen-at', 'now');
