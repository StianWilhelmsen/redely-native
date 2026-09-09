import { getValidIdToken } from '@/lib/auth-store';
import { env } from '@/lib/env';
import type {
  ActivityEvent,
  BillingStatus,
  ChatConversation,
  ChatMessage,
  ChatReadState,
  Collective,
  CollectiveStats,
  CreateTaskInput,
  Expense,
  ExpenseShare,
  Invite,
  Me,
  Member,
  MyStats,
  QuickAction,
  ShoppingItem,
  StarterPack,
  Task,
  UpdateTaskInput,
  WeeklyStats,
} from '@/types/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * A request that never reached the backend at all. React Native rejects fetch with the
 * same opaque "Network request failed" whether the phone is in flight mode, mid-handover
 * or the service is restarting, and call sites put `err.message` straight in an alert - so
 * English plumbing was what people actually read. Said once, here, in Norwegian.
 */
export class ConnectionError extends Error {
  constructor() {
    super('Fikk ikke kontakt med serveren. Prøv igjen om litt.');
    this.name = 'ConnectionError';
  }
}

/**
 * Call sites show `err.message` straight to the user, so a structured error body has to be
 * unwrapped here or the raw JSON ends up in an alert. The backend sends
 * `{"error": "...", "message": "..."}` for the cases it explains in Norwegian - notably
 * ReadOnlySubscriptionInterceptor's 402 when a collective's subscription has lapsed - and
 * Spring's own errors carry a `message` too. Anything unparseable falls back to the raw
 * text, which is still better than nothing for debugging.
 */
function errorMessageFrom(body: string): string {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    return typeof parsed.message === 'string' && parsed.message ? parsed.message : body;
  } catch {
    return body;
  }
}

/**
 * Backoff for repeatable reads. The backend does not sleep - it is not on Render's free
 * tier - so this is not about waiting out a cold start: it covers the gaps a running
 * service still has. A deploy takes the instance out for a few seconds (502/503, which
 * isRetryableStatus already treats as worth repeating), and a phone moving between wifi
 * and mobile drops whatever was in flight.
 *
 * ~30s of patience keeps the whole wait inside one attempt, so the screen shows a spinner
 * throughout rather than flickering between spinner and error. An earlier budget of ~2.5s
 * gave up inside those gaps and reported "kan ikke koble til serveren" on a working
 * connection - then succeeded on SWR's next attempt, which is why it only flashed. A
 * genuinely offline device is told so by OfflineBanner meanwhile.
 */
const GET_RETRY_DELAYS_MS = [700, 1800, 4000, 8000, 15000];

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read requests are safe to repeat. A restarting instance or a brief network transition
 * can otherwise turn one failed request into a full-screen error even though the next
 * attempt would work. Mutations are deliberately never retried because repeating a write could
 * create duplicates.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD';
  const attempts = canRetry ? GET_RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const hasAnotherAttempt = attempt < attempts - 1;
      if (!hasAnotherAttempt || !isRetryableStatus(response.status)) return response;
    } catch (error) {
      // Every rejection from fetch means the same thing to the person holding the phone:
      // we never got through. The underlying error is plumbing ("Network request failed"),
      // so it goes to the log and the user gets the sentence above.
      if (attempt === attempts - 1) {
        if (__DEV__) console.warn('[api] request failed', url, error);
        throw new ConnectionError();
      }
    }

    await wait(GET_RETRY_DELAYS_MS[attempt]);
  }

  throw new ConnectionError();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const idToken = await getValidIdToken();
  const isFormData = init.body instanceof FormData;

  const res = await fetchWithRetry(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, errorMessageFrom(text) || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export const api = {
  me: () => request<Me>('/api/me'),
  updateProfileName: (name: string) => {
    const form = new FormData();
    form.append('name', name);
    return request<Me>('/api/me/profile', { method: 'PATCH', body: form });
  },
  updateProfilePicture: (currentName: string, image: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('name', currentName);
    form.append('picture', image as unknown as Blob);
    return request<Me>('/api/me/profile', { method: 'PATCH', body: form });
  },
  completeOnboarding: (input: {
    name: string;
    acceptedTerms: boolean;
    picture?: { uri: string; name: string; type: string };
  }) => {
    const form = new FormData();
    form.append('name', input.name);
    form.append('acceptedTerms', String(input.acceptedTerms));
    if (input.picture) form.append('picture', input.picture as unknown as Blob);
    return request<Me>('/api/me/onboarding', { method: 'PATCH', body: form });
  },
  registerPushToken: (token: string | null) =>
    request<Me>('/api/me/push-token', { method: 'PUT', body: JSON.stringify({ token }) }),
  updateNotificationPreferences: (prefs: {
    notifyTasks: boolean;
    notifyActivity: boolean;
    notifyExpenses: boolean;
    notifyChat: boolean;
  }) =>
    request<Me>('/api/me/notification-preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),
  members: () => request<Member[]>('/api/collectives/members'),
  createCollective: (name: string) =>
    request<Collective>('/api/collectives', { method: 'POST', body: JSON.stringify({ name }) }),
  leaveCollective: () => request<void>('/api/collectives/leave', { method: 'POST' }),
  renameCollective: (name: string) =>
    request<Collective>('/api/collectives', { method: 'PATCH', body: JSON.stringify({ name }) }),
  updateCollectivePicture: (image: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('picture', image as unknown as Blob);
    return request<Collective>('/api/collectives/picture', { method: 'PATCH', body: form });
  },
  removeMember: (userId: number) =>
    request<void>(`/api/collectives/members/${userId}`, { method: 'DELETE' }),
  makeMemberAdmin: (userId: number) =>
    request<void>(`/api/collectives/members/${userId}/admin`, { method: 'PATCH' }),
  onlineMembers: () => request<number[]>('/api/collectives/online'),

  createInvite: () => request<Invite>('/api/invites', { method: 'POST' }),
  joinCollective: (code: string) =>
    request<Collective>('/api/invites/join', { method: 'POST', body: JSON.stringify({ code }) }),

  tasks: () => request<Task[]>('/api/tasks'),
  createTask: (input: CreateTaskInput) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (id: number, input: UpdateTaskInput) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setTaskCompleted: (id: number, completed: boolean) =>
    request<Task>(`/api/tasks/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
  assignTask: (id: number, assignedUserId: number) =>
    request<Task>(`/api/tasks/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedUserId }),
    }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  createStarterPackTasks: () => request<Task[]>('/api/tasks/starter-pack', { method: 'POST' }),

  starterPacks: () => request<StarterPack[]>('/api/task-templates/packs'),
  applyStarterPack: (packId: string, days = 7) =>
    request<Task[]>(`/api/task-templates/packs/${packId}/apply?days=${days}`, { method: 'POST' }),

  quickActions: () => request<QuickAction[]>('/api/quick-actions'),
  completeQuickAction: (key: string) =>
    request<QuickAction>(`/api/quick-actions/${key}/done`, { method: 'POST' }),

  activity: () => request<ActivityEvent[]>('/api/activity'),
  weeklyStats: () => request<WeeklyStats>('/api/stats/weekly'),
  weeklyStatsForWeek: (weekStart: string) =>
    request<WeeklyStats>(`/api/stats/weekly?weekStart=${encodeURIComponent(weekStart)}`),
  collectiveStats: () => request<CollectiveStats>('/api/stats/collective'),
  myStats: () => request<MyStats>('/api/stats/me'),

  shoppingItems: () => request<ShoppingItem[]>('/api/shopping-items'),
  createShoppingItem: (name: string) =>
    request<ShoppingItem>('/api/shopping-items', { method: 'POST', body: JSON.stringify({ name }) }),
  setShoppingItemPurchased: (id: number, purchased: boolean) =>
    request<ShoppingItem>(`/api/shopping-items/${id}/purchased`, {
      method: 'PUT',
      body: JSON.stringify({ purchased }),
    }),
  deleteShoppingItem: (id: number) =>
    request<void>(`/api/shopping-items/${id}`, { method: 'DELETE' }),
  clearPurchasedShoppingItems: () =>
    request<void>('/api/shopping-items/purchased', { method: 'DELETE' }),

  expenses: () => request<Expense[]>('/api/expenses'),
  createShoppingTripExpense: (
    amount: number,
    description: string,
    paidByUserId?: number,
    participantUserIds?: number[]
  ) =>
    request<Expense>('/api/expenses/shopping-trip', {
      method: 'POST',
      body: JSON.stringify({ amount, description, paidByUserId, participantUserIds }),
    }),
  deleteExpense: (id: number) => request<void>(`/api/expenses/${id}`, { method: 'DELETE' }),
  myUnpaidShares: () => request<ExpenseShare[]>('/api/expenses/my-unpaid'),
  markSharePaid: (shareId: number) =>
    request<ExpenseShare>(`/api/expenses/shares/${shareId}/paid`, { method: 'POST' }),

  deleteAccount: () => request<void>('/api/me', { method: 'DELETE' }),

  chatConversations: () => request<ChatConversation[]>('/api/chat/conversations'),
  /** Omit peerId for the shared chat; pass before to load older history. */
  chatMessages: (peerId?: number, before?: number) => {
    const params = new URLSearchParams();
    if (peerId != null) params.set('peerId', String(peerId));
    if (before != null) params.set('before', String(before));
    const query = params.toString();
    return request<ChatMessage[]>(`/api/chat/messages${query ? `?${query}` : ''}`);
  },
  sendChatMessage: (
    content: string,
    peerId?: number,
    image?: { uri: string; name: string; type: string }
  ) => {
    const form = new FormData();
    if (content) form.append('content', content);
    if (peerId != null) form.append('peerId', String(peerId));
    if (image) form.append('image', image as unknown as Blob);
    return request<ChatMessage>('/api/chat/messages', { method: 'POST', body: form });
  },
  chatReadStates: (peerId?: number) =>
    request<ChatReadState[]>(
      `/api/chat/read-states${peerId != null ? `?peerId=${peerId}` : ''}`
    ),
  markChatRead: (messageId: number, peerId?: number) =>
    request<void>('/api/chat/read', {
      method: 'PUT',
      body: JSON.stringify({ messageId, peerId: peerId ?? null }),
    }),
  billingStatus: () => request<BillingStatus>('/api/billing/status'),
  /** Tells the backend who just bought which plan - RevenueCat's webhook only knows the
   *  collective - so the rest of the household can be welcomed by name. */
  confirmPurchase: (productId: string) =>
    request<BillingStatus>('/api/billing/purchase-completed', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),
};
