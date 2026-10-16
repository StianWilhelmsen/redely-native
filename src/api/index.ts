/**
 * Every Magneten endpoint as a typed function. Grouped like docs/API.md. Household
 * routes take the household id first.
 */

import { request } from './client';
import type {
  ActivityPage,
  AddMemberInput,
  Area,
  AreaInput,
  CalendarEvent,
  Comment,
  CompleteNoteResult,
  CreateHouseholdInput,
  DateString,
  EventInput,
  EventOccurrence,
  Household,
  Invite,
  InvitePreview,
  ListInput,
  ListItem,
  ListWithItems,
  Me,
  Member,
  MemberRole,
  MyHousehold,
  NewItemInput,
  Note,
  NoteInput,
  NotesQuery,
  NotificationPrefs,
  PatchItemInput,
  ShoppingList,
  Subscription,
  UpdateHouseholdInput,
  UpdateMeInput,
  UpdateMemberInput,
  Uuid,
} from './types';

export { ApiError, ConnectionError, errorMessage } from './client';
export * from './types';

const h = (hid: Uuid) => `/api/households/${hid}`;

export type PhotoFile = { uri: string; name: string; type: string };

function photoForm(photo: PhotoFile): FormData {
  const form = new FormData();
  form.append('photo', photo as unknown as Blob);
  return form;
}

export const api = {
  me: {
    get: () => request<Me>('GET', '/api/me'),
    update: (input: UpdateMeInput) => request<Me>('PATCH', '/api/me', { body: input }),
    setPushToken: (token: string | null) => request<void>('PUT', '/api/me/push-token', { body: { token } }),
    setNotificationPrefs: (prefs: Partial<NotificationPrefs>) =>
      request<NotificationPrefs>('PATCH', '/api/me/notification-preferences', { body: prefs }),
    delete: () => request<void>('DELETE', '/api/me'),
  },

  households: {
    create: (input: CreateHouseholdInput) => request<Household>('POST', '/api/households', { body: input }),
    get: (hid: Uuid) => request<Household>('GET', h(hid)),
    update: (hid: Uuid, input: UpdateHouseholdInput) => request<Household>('PATCH', h(hid), { body: input }),
    delete: (hid: Uuid) => request<void>('DELETE', h(hid)),
    leave: (hid: Uuid) => request<void>('POST', `${h(hid)}/leave`),
  },

  members: {
    list: (hid: Uuid) => request<Member[]>('GET', `${h(hid)}/members`),
    add: (hid: Uuid, input: AddMemberInput) => request<Member>('POST', `${h(hid)}/members`, { body: input }),
    update: (hid: Uuid, memberId: Uuid, input: UpdateMemberInput) =>
      request<Member>('PUT', `${h(hid)}/members/${memberId}`, { body: input }),
    remove: (hid: Uuid, memberId: Uuid) => request<void>('DELETE', `${h(hid)}/members/${memberId}`),
    uploadPhoto: (hid: Uuid, memberId: Uuid, photo: PhotoFile) =>
      request<Member>('POST', `${h(hid)}/members/${memberId}/photo`, { body: photoForm(photo) }),
    deletePhoto: (hid: Uuid, memberId: Uuid) => request<Member>('DELETE', `${h(hid)}/members/${memberId}/photo`),
  },

  invites: {
    create: (hid: Uuid, input: { role: MemberRole; memberId?: Uuid | null }) =>
      request<Invite>('POST', `${h(hid)}/invites`, { body: input }),
    list: (hid: Uuid) => request<Invite[]>('GET', `${h(hid)}/invites`),
    revoke: (hid: Uuid, inviteId: Uuid) => request<void>('DELETE', `${h(hid)}/invites/${inviteId}`),
    preview: (code: string) => request<InvitePreview>('GET', `/api/invites/${encodeURIComponent(code)}`),
    accept: (code: string, displayName?: string) =>
      request<MyHousehold>('POST', `/api/invites/${encodeURIComponent(code)}/accept`, {
        body: displayName ? { displayName } : {},
      }),
  },

  notes: {
    list: (hid: Uuid, query: NotesQuery = {}) => request<Note[]>('GET', `${h(hid)}/notes`, { query }),
    get: (hid: Uuid, noteId: Uuid) => request<Note>('GET', `${h(hid)}/notes/${noteId}`),
    create: (hid: Uuid, input: NoteInput) => request<Note>('POST', `${h(hid)}/notes`, { body: input }),
    update: (hid: Uuid, noteId: Uuid, input: NoteInput) =>
      request<Note>('PUT', `${h(hid)}/notes/${noteId}`, { body: input }),
    delete: (hid: Uuid, noteId: Uuid) => request<void>('DELETE', `${h(hid)}/notes/${noteId}`),
    complete: (hid: Uuid, noteId: Uuid) => request<CompleteNoteResult>('POST', `${h(hid)}/notes/${noteId}/complete`),
    uncomplete: (hid: Uuid, noteId: Uuid) => request<Note>('POST', `${h(hid)}/notes/${noteId}/uncomplete`),
    tickChecklist: (hid: Uuid, noteId: Uuid, itemId: Uuid, done: boolean) =>
      request<Note>('PATCH', `${h(hid)}/notes/${noteId}/checklist/${itemId}`, { body: { done } }),
    comments: (hid: Uuid, noteId: Uuid) => request<Comment[]>('GET', `${h(hid)}/notes/${noteId}/comments`),
    addComment: (hid: Uuid, noteId: Uuid, text: string) =>
      request<Comment>('POST', `${h(hid)}/notes/${noteId}/comments`, { body: { text } }),
  },

  events: {
    range: (hid: Uuid, from: DateString, to: DateString) =>
      request<EventOccurrence[]>('GET', `${h(hid)}/events`, { query: { from, to } }),
    get: (hid: Uuid, eventId: Uuid) => request<CalendarEvent>('GET', `${h(hid)}/events/${eventId}`),
    create: (hid: Uuid, input: EventInput) => request<CalendarEvent>('POST', `${h(hid)}/events`, { body: input }),
    update: (hid: Uuid, eventId: Uuid, input: EventInput) =>
      request<CalendarEvent>('PUT', `${h(hid)}/events/${eventId}`, { body: input }),
    delete: (hid: Uuid, eventId: Uuid) => request<void>('DELETE', `${h(hid)}/events/${eventId}`),
    comments: (hid: Uuid, eventId: Uuid) => request<Comment[]>('GET', `${h(hid)}/events/${eventId}/comments`),
    addComment: (hid: Uuid, eventId: Uuid, text: string) =>
      request<Comment>('POST', `${h(hid)}/events/${eventId}/comments`, { body: { text } }),
  },

  comments: {
    delete: (hid: Uuid, commentId: Uuid) => request<void>('DELETE', `${h(hid)}/comments/${commentId}`),
  },

  areas: {
    list: (hid: Uuid) => request<Area[]>('GET', `${h(hid)}/areas`),
    create: (hid: Uuid, input: AreaInput) => request<Area>('POST', `${h(hid)}/areas`, { body: input }),
    update: (hid: Uuid, areaId: Uuid, input: AreaInput) =>
      request<Area>('PUT', `${h(hid)}/areas/${areaId}`, { body: input }),
    delete: (hid: Uuid, areaId: Uuid) => request<void>('DELETE', `${h(hid)}/areas/${areaId}`),
  },

  lists: {
    list: (hid: Uuid) => request<ShoppingList[]>('GET', `${h(hid)}/lists`),
    get: (hid: Uuid, listId: Uuid) => request<ListWithItems>('GET', `${h(hid)}/lists/${listId}`),
    create: (hid: Uuid, input: ListInput) => request<ShoppingList>('POST', `${h(hid)}/lists`, { body: input }),
    update: (hid: Uuid, listId: Uuid, input: ListInput) =>
      request<ShoppingList>('PUT', `${h(hid)}/lists/${listId}`, { body: input }),
    delete: (hid: Uuid, listId: Uuid) => request<void>('DELETE', `${h(hid)}/lists/${listId}`),
    addItem: (hid: Uuid, listId: Uuid, input: NewItemInput) =>
      request<ListItem>('POST', `${h(hid)}/lists/${listId}/items`, { body: input }),
    patchItem: (hid: Uuid, listId: Uuid, itemId: Uuid, input: PatchItemInput) =>
      request<ListItem>('PATCH', `${h(hid)}/lists/${listId}/items/${itemId}`, { body: input }),
    deleteItem: (hid: Uuid, listId: Uuid, itemId: Uuid) =>
      request<void>('DELETE', `${h(hid)}/lists/${listId}/items/${itemId}`),
    clearDone: (hid: Uuid, listId: Uuid) =>
      request<{ removed: number }>('POST', `${h(hid)}/lists/${listId}/items/clear-done`),
    reorder: (hid: Uuid, listId: Uuid, itemIds: Uuid[]) =>
      request<ListItem[]>('PUT', `${h(hid)}/lists/${listId}/items/order`, { body: { itemIds } }),
  },

  activity: {
    page: (hid: Uuid, before?: number, limit = 50) =>
      request<ActivityPage>('GET', `${h(hid)}/activity`, { query: { before, limit } }),
    markSeen: (hid: Uuid, lastSeenId?: number) =>
      request<void>('POST', `${h(hid)}/activity/seen`, { body: lastSeenId ? { lastSeenId } : {} }),
  },

  subscription: {
    get: (hid: Uuid) => request<Subscription>('GET', `${h(hid)}/subscription`),
    purchaseCompleted: (hid: Uuid) => request<Subscription>('POST', `${h(hid)}/subscription/purchase-completed`),
  },
};

/**
 * SWR cache keys, in one place so a realtime event can invalidate exactly what it
 * touched. Always build keys through these helpers - never hand-write the arrays.
 */
export const keys = {
  me: () => ['me'] as const,
  household: (hid: Uuid) => ['household', hid] as const,
  notes: (hid: Uuid, scope: string = 'open') => ['notes', hid, scope] as const,
  note: (hid: Uuid, noteId: Uuid) => ['note', hid, noteId] as const,
  noteComments: (hid: Uuid, noteId: Uuid) => ['note-comments', hid, noteId] as const,
  events: (hid: Uuid, from: DateString, to: DateString) => ['events', hid, from, to] as const,
  event: (hid: Uuid, eventId: Uuid) => ['event', hid, eventId] as const,
  eventComments: (hid: Uuid, eventId: Uuid) => ['event-comments', hid, eventId] as const,
  areas: (hid: Uuid) => ['areas', hid] as const,
  lists: (hid: Uuid) => ['lists', hid] as const,
  list: (hid: Uuid, listId: Uuid) => ['list', hid, listId] as const,
  activity: (hid: Uuid) => ['activity', hid] as const,
  invites: (hid: Uuid) => ['invites', hid] as const,
  subscription: (hid: Uuid) => ['subscription', hid] as const,
};
