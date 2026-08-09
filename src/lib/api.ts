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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const idToken = await getValidIdToken();
  const isFormData = init.body instanceof FormData;

  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `Request failed: ${res.status}`);
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
    age?: number;
    acceptedTerms: boolean;
    picture?: { uri: string; name: string; type: string };
  }) => {
    const form = new FormData();
    form.append('name', input.name);
    if (input.age != null) form.append('age', String(input.age));
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
  }) =>
    request<Me>('/api/me/notification-preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),
  sendTestNotification: () => request<void>('/api/me/test-notification', { method: 'POST' }),
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
};
