/**
 * Every list mutation, optimistic. Each change is applied to the SWR cache at once with a
 * functional update (so rapid taps on different items never undo each other), then sent;
 * the server's answer replaces the item, and a failure rolls back just that item.
 */

import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useSWRConfig } from 'swr';

import { api, errorMessage, keys, type ListItem, type ListWithItems, type PatchItemInput, type Uuid } from '@/api';

type Updater = (cur: ListWithItems | undefined) => ListWithItems | undefined;

export function useListActions(hid: Uuid, listId: Uuid, myMemberId: Uuid | null) {
  const { mutate } = useSWRConfig();
  const key = keys.list(hid, listId);
  /** Temporary id → server id, so a row keeps its React key when its add is confirmed. */
  const aliases = useRef(new Map<Uuid, Uuid>());

  const update = useCallback(
    (fn: (items: ListItem[]) => ListItem[]) =>
      mutate(key, ((cur) => (cur ? { ...cur, items: fn(cur.items) } : cur)) as Updater, { revalidate: false }),
    // key is rebuilt each render but stable in content
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate, hid, listId]
  );
  const refreshOverview = useCallback(() => mutate(keys.lists(hid)), [mutate, hid]);
  const replace = (id: Uuid, next: ListItem) => update((items) => items.map((i) => (i.id === id ? next : i)));

  const patch = async (item: ListItem, input: PatchItemInput) => {
    if (item.id.startsWith('tmp-')) return;
    const before = item;
    update((items) =>
      items.map((i) =>
        i.id === item.id
          ? {
              ...i,
              text: input.text ?? i.text,
              quantity: input.quantity === undefined || input.quantity === null ? i.quantity : input.quantity || null,
              category: input.category === undefined || input.category === null ? i.category : input.category || null,
              done: input.done ?? i.done,
            }
          : i
      )
    );
    try {
      replace(item.id, await api.lists.patchItem(hid, listId, item.id, input));
      refreshOverview();
    } catch (e) {
      replace(item.id, before);
      Alert.alert(errorMessage(e));
    }
  };

  const toggle = (item: ListItem, done = !item.done) => patch(item, { done });

  const add = async (text: string) => {
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const temp: ListItem = {
      id: tmpId,
      text,
      quantity: null,
      category: null,
      position: Number.MAX_SAFE_INTEGER,
      addedByMemberId: myMemberId,
      done: false,
      doneAt: null,
      doneByMemberId: null,
      createdAt: new Date().toISOString(),
    };
    update((items) => [...items, temp]);
    try {
      const created = await api.lists.addItem(hid, listId, { text });
      aliases.current.set(created.id, tmpId);
      // A realtime refetch may already have brought the real item in.
      update((items) =>
        items.some((i) => i.id === created.id) ? items.filter((i) => i.id !== tmpId) : items.map((i) => (i.id === tmpId ? created : i))
      );
      refreshOverview();
    } catch (e) {
      update((items) => items.filter((i) => i.id !== tmpId));
      Alert.alert(errorMessage(e));
    }
  };

  const remove = async (item: ListItem) => {
    update((items) => items.filter((i) => i.id !== item.id));
    try {
      await api.lists.deleteItem(hid, listId, item.id);
      refreshOverview();
    } catch (e) {
      mutate(key);
      Alert.alert(errorMessage(e));
    }
  };

  /**
   * Removes the ticked items on the server. Throws on failure - the caller owns the
   * animation around it, and calls `dropDone()` when the ticked lines may leave the screen.
   */
  const clearDone = async () => (await api.lists.clearDone(hid, listId)).removed;

  const dropDone = () => {
    update((items) => items.filter((i) => !i.done));
    refreshOverview();
  };

  /** Stable React key for a row, surviving the temporary → server id swap. */
  const rowKey = (id: Uuid) => aliases.current.get(id) ?? id;

  return { toggle, patch, add, remove, clearDone, dropDone, rowKey };
}
