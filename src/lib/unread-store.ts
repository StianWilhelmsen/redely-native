import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = () => void;

/**
 * Tiny shared "last seen" marker backed by AsyncStorage, readable/writable from
 * multiple independent mount points (a root-level badge, plus the actual screen
 * that marks things read) while staying in sync between them - same subscribe/
 * notify shape as auth-store.ts, just generic over a single numeric watermark.
 */
function createReadMarker(storageKey: string) {
  let value: number | null = null; // null = not loaded from storage yet
  let loadPromise: Promise<void> | null = null;
  const listeners = new Set<Listener>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function ensureLoaded() {
    if (value !== null || loadPromise) return;
    loadPromise = AsyncStorage.getItem(storageKey).then((stored) => {
      value = stored ? Number(stored) : 0;
      notify();
    });
  }

  return {
    getValue(): number {
      return value ?? 0;
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
export const paymentsReadMarker = createReadMarker('ryddig-kollektiv:payments-last-seen-at');
