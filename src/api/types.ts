/**
 * The Magneten API contract, typed. Mirrors docs/API.md in the backend repo exactly -
 * when the backend changes a shape, change it here and let tsc find every use.
 *
 * Dates are kept as the ISO strings the server sends; parse at the edge where you
 * format them.
 */

export type Uuid = string;
/** ISO-8601 with offset, always Europe/Oslo, e.g. "2026-10-21T17:00:00+02:00". */
export type Timestamp = string;
/** "YYYY-MM-DD", an Oslo calendar date. */
export type DateString = string;
/** "HH:mm". */
export type TimeString = string;

export type HouseholdType = 'FAMILY' | 'COUPLE' | 'SHARED_HOME' | 'OTHER';
export type MemberRole = 'ADULT' | 'CHILD' | 'HELPER';
export type MemberColor = '#2F5BD8' | '#7A4FD6' | '#1A9AA6' | '#E8B400' | '#E0559A' | '#5E9E2E';
export type Visibility = 'ALL' | 'ADULTS' | 'PRIVATE';
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type PaperDto = 'WHITE' | 'YELLOW' | 'PINK' | 'MINT';
export type ListKind = 'SHOPPING' | 'CHECKLIST';
export type Plan = 'FREE' | 'PLUSS';
export type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'EXPIRED';
export type ActivityType =
  | 'NOTE_CREATED'
  | 'NOTE_ASSIGNED'
  | 'NOTE_COMPLETED'
  | 'COMMENT_ADDED'
  | 'EVENT_CREATED'
  | 'MEMBER_JOINED'
  | 'MEMBER_ADDED'
  | 'AREA_ASSIGNED';

// ---- Me ------------------------------------------------------------------

export type NotificationPrefs = {
  reminders: boolean;
  assignments: boolean;
  comments: boolean;
  activity: boolean;
};

export type MyHousehold = {
  householdId: Uuid;
  name: string;
  type: HouseholdType;
  isPluss: boolean;
  memberId: Uuid;
  role: MemberRole;
  displayName: string;
  color: MemberColor;
  photoUrl: string | null;
};

export type Me = {
  id: number;
  email: string | null;
  name: string | null;
  locale: 'nb' | 'en';
  termsAcceptedAt: Timestamp | null;
  hasPushToken: boolean;
  notifications: NotificationPrefs;
  createdAt: Timestamp;
  /** Oldest membership first. */
  households: MyHousehold[];
};

export type UpdateMeInput = { name?: string; locale?: 'nb' | 'en'; acceptTerms?: boolean };

// ---- Households & members -------------------------------------------------

export type Member = {
  id: Uuid;
  displayName: string;
  role: MemberRole;
  color: MemberColor;
  photoUrl: string | null;
  birthYear: number | null;
  hasLogin: boolean;
  isMe: boolean;
  createdAt: Timestamp;
};

export type Household = {
  id: Uuid;
  name: string;
  type: HouseholdType;
  timezone: string;
  createdAt: Timestamp;
  plan: Plan;
  isPluss: boolean;
  myMemberId: Uuid;
  myRole: MemberRole;
  members: Member[];
};

export type CreateHouseholdInput = {
  name: string;
  type: HouseholdType;
  displayName?: string;
  color?: MemberColor;
};

export type UpdateHouseholdInput = { name?: string; type?: HouseholdType; timezone?: string };

export type AddMemberInput = {
  displayName: string;
  role: MemberRole;
  color?: MemberColor | null;
  birthYear?: number | null;
};

export type UpdateMemberInput = {
  displayName: string;
  role: MemberRole;
  color: MemberColor;
  birthYear?: number | null;
};

// ---- Invites --------------------------------------------------------------

export type Invite = {
  id: Uuid;
  code: string;
  role: MemberRole;
  memberId: Uuid | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
};

export type InvitePreview = {
  code: string;
  householdId: Uuid;
  householdName: string;
  householdType: HouseholdType;
  role: MemberRole;
  memberDisplayName: string | null;
  invitedByName: string | null;
  expiresAt: Timestamp;
  alreadyMember: boolean;
};

// ---- Notes ----------------------------------------------------------------

export type ChecklistItem = { id: Uuid; text: string; done: boolean; position: number };

export type Note = {
  id: Uuid;
  title: string;
  body: string | null;
  dueDate: DateString | null;
  dueTime: TimeString | null;
  recurrence: Recurrence;
  recurrenceWeekdays: Weekday[];
  assigneeMemberId: Uuid | null;
  areaId: Uuid | null;
  visibility: Visibility;
  paper: PaperDto;
  rewardOre: number | null;
  completedAt: Timestamp | null;
  completedByMemberId: Uuid | null;
  createdByMemberId: Uuid | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  checklist: ChecklistItem[];
  commentCount: number;
};

export type NoteInput = {
  title: string;
  body?: string | null;
  dueDate?: DateString | null;
  dueTime?: TimeString | null;
  recurrence?: Recurrence;
  recurrenceWeekdays?: Weekday[];
  assigneeMemberId?: Uuid | null;
  areaId?: Uuid | null;
  visibility?: Visibility;
  paper?: PaperDto;
  rewardOre?: number | null;
  checklist?: { id?: Uuid | null; text: string; done?: boolean | null }[];
};

export type NotesQuery = {
  status?: 'open' | 'done' | 'all';
  assigneeMemberId?: Uuid;
  areaId?: Uuid;
  dueFrom?: DateString;
  dueTo?: DateString;
};

export type CompleteNoteResult = { note: Note; next: Note | null };

// ---- Comments -------------------------------------------------------------

export type Comment = {
  id: Uuid;
  noteId: Uuid | null;
  eventId: Uuid | null;
  memberId: Uuid | null;
  text: string;
  createdAt: Timestamp;
};

// ---- Calendar -------------------------------------------------------------

export type CalendarEvent = {
  id: Uuid;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Timestamp;
  endsAt: Timestamp;
  allDay: boolean;
  recurrence: Recurrence;
  recurrenceWeekdays: Weekday[];
  recurrenceUntil: DateString | null;
  reminderMinutes: number | null;
  visibility: Visibility;
  driverMemberId: Uuid | null;
  memberIds: Uuid[];
  createdByMemberId: Uuid | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount: number;
};

export type EventOccurrence = {
  eventId: Uuid;
  startsAt: Timestamp;
  endsAt: Timestamp;
  event: CalendarEvent;
};

export type EventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Timestamp;
  endsAt?: Timestamp | null;
  allDay?: boolean;
  recurrence?: Recurrence;
  recurrenceWeekdays?: Weekday[];
  recurrenceUntil?: DateString | null;
  reminderMinutes?: number | null;
  visibility?: Visibility;
  driverMemberId?: Uuid | null;
  memberIds?: Uuid[];
};

// ---- Areas ----------------------------------------------------------------

export type Area = {
  id: Uuid;
  name: string;
  description: string | null;
  ownerMemberId: Uuid | null;
  openNoteCount: number;
  createdAt: Timestamp;
};

export type AreaInput = { name: string; description?: string | null; ownerMemberId?: Uuid | null };

// ---- Lists ----------------------------------------------------------------

export type ShoppingList = {
  id: Uuid;
  name: string;
  kind: ListKind;
  storeName: string | null;
  openItemCount: number;
  doneItemCount: number;
  createdAt: Timestamp;
};

export type ListItem = {
  id: Uuid;
  text: string;
  quantity: string | null;
  category: string | null;
  position: number;
  addedByMemberId: Uuid | null;
  done: boolean;
  doneAt: Timestamp | null;
  doneByMemberId: Uuid | null;
  createdAt: Timestamp;
};

export type ListWithItems = { list: ShoppingList; items: ListItem[] };

export type ListInput = { name: string; kind: ListKind; storeName?: string | null };
export type NewItemInput = { text: string; quantity?: string | null; category?: string | null };
export type PatchItemInput = {
  text?: string | null;
  quantity?: string | null;
  category?: string | null;
  done?: boolean | null;
};

// ---- Activity -------------------------------------------------------------

export type ActivityEntry = {
  id: number;
  type: ActivityType;
  actorMemberId: Uuid | null;
  targetMemberId: Uuid | null;
  noteId: Uuid | null;
  eventId: Uuid | null;
  listId: Uuid | null;
  subject: string | null;
  createdAt: Timestamp;
};

export type ActivityPage = {
  items: ActivityEntry[];
  nextBefore: number | null;
  lastSeenId: number | null;
  unseenCount: number;
};

// ---- Subscription ---------------------------------------------------------

export type Subscription = {
  plan: Plan;
  status: SubscriptionStatus;
  isPluss: boolean;
  provider: string | null;
  store: string | null;
  productId: string | null;
  currentPeriodEnd: Timestamp | null;
  payerName: string | null;
  isPayer: boolean;
  aiUsage: { month: string; ukeplanReads: number; ukeplanReadLimit: number | null };
};

// ---- Realtime -------------------------------------------------------------

export type HouseholdEventType =
  | 'HOUSEHOLD_UPDATED'
  | 'HOUSEHOLD_DELETED'
  | 'MEMBERS_CHANGED'
  | 'NOTE_CHANGED'
  | 'NOTE_DELETED'
  | 'NOTE_COMMENTS_CHANGED'
  | 'EVENT_CHANGED'
  | 'EVENT_DELETED'
  | 'EVENT_COMMENTS_CHANGED'
  | 'AREA_CHANGED'
  | 'AREA_DELETED'
  | 'LIST_CHANGED'
  | 'LIST_DELETED'
  | 'LIST_ITEMS_CHANGED'
  | 'ACTIVITY_ADDED'
  | 'SUBSCRIPTION_UPDATED'
  | 'REMOVED_FROM_HOUSEHOLD';

export type HouseholdEvent = {
  type: HouseholdEventType;
  householdId: Uuid;
  entityId: string;
  actorMemberId: Uuid | null;
};

/** Stable error codes from the backend (docs/API.md › Errors). */
export type ApiErrorCode =
  | 'validation_failed'
  | 'bad_request'
  | 'invalid_member'
  | 'invalid_area'
  | 'invalid_color'
  | 'invalid_timezone'
  | 'invalid_locale'
  | 'due_date_required'
  | 'invalid_time_range'
  | 'range_too_large'
  | 'unsupported_image'
  | 'unauthorized'
  | 'adult_required'
  | 'role_not_allowed'
  | 'forbidden'
  | 'household_not_found'
  | 'member_not_found'
  | 'note_not_found'
  | 'event_not_found'
  | 'area_not_found'
  | 'list_not_found'
  | 'item_not_found'
  | 'comment_not_found'
  | 'checklist_item_not_found'
  | 'invite_not_found'
  | 'not_found'
  | 'method_not_allowed'
  | 'already_member'
  | 'member_already_linked'
  | 'household_full'
  | 'list_full'
  | 'last_adult'
  | 'invite_expired'
  | 'file_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'account_deletion_failed'
  | 'internal_error'
  | 'storage_unavailable';
