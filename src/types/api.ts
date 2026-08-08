// Mirrors wilhelmsen.project.model / .dto Jackson serialization exactly (camelCase getters).

export type Member = {
  id: number;
  name: string;
  pictureUrl: string | null;
  admin: boolean;
};

export type Collective = {
  id: number;
  name: string;
};

export type Me = {
  id: number;
  auth0Id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  admin: boolean;
  age: number | null;
  onboarded: boolean;
  notifyTasks: boolean;
  notifyActivity: boolean;
  notifyExpenses: boolean;
  collective: Collective | null;
};

export type RepeatFrequency = 'NONE' | 'WEEKLY' | 'DAILY';

export type Task = {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null; // ISO yyyy-MM-dd
  completed: boolean;
  assignedTo: { id: number; name: string; pictureUrl: string | null } | null;
  points: number;
  quick: boolean;
  repeatFrequency: RepeatFrequency;
  /** Only meaningful when repeatFrequency isn't NONE: rotate between members vs. always the same person. */
  rotateAssignee: boolean;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  dueDate?: string; // yyyy-MM-dd
  assignedUserId: number;
  points?: number;
  quick?: boolean;
  repeatFrequency?: RepeatFrequency;
  rotateAssignee?: boolean;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  dueDate?: string; // yyyy-MM-dd
  clearDueDate?: boolean;
  assignedUserId?: number;
  points?: number;
  repeatFrequency?: RepeatFrequency;
  rotateAssignee?: boolean;
};

export type QuickAction = {
  key: string;
  title: string;
  emoji: string;
  countThisWeek: number;
  countAllTime: number;
};

export type ActivityEvent = {
  id: number;
  type: 'TASK_COMPLETED' | 'TASK_UNCOMPLETED' | 'TASK_REASSIGNED' | 'QUICK_ACTION_DONE';
  createdAt: string; // ISO instant
  actorUserId: number | null;
  actorName: string | null;
  pointsDelta: number | null;
  taskId: number | null;
  taskTitle: string | null;
  quickActionKey: string | null;
  quickActionTitle: string | null;
  quickActionEmoji: string | null;
};

export type Badge = {
  code: string;
  label: string;
  emoji: string;
};

export type UserStats = {
  userId: number;
  name: string;
  pictureUrl: string | null;
  weekPoints: number;
  lifetimePoints: number;
  level: number;
  badges: Badge[];
};

export type WeeklyTask = {
  taskId: number;
  title: string;
  points: number;
  completed: boolean;
  assigneeUserId: number | null;
  assigneeName: string | null;
  assigneePictureUrl: string | null;
  /** 0 = Monday ... 6 = Sunday. Null while the chore is still open. */
  completedDayIndex: number | null;
};

export type WeeklyQuickActions = {
  userId: number;
  name: string;
  pictureUrl: string | null;
  count: number;
  topActionTitle: string | null;
  topActionEmoji: string | null;
  topActionCount: number;
};

export type WeeklyStats = {
  collectiveName: string | null;
  weekStart: string; // yyyy-MM-dd
  weekEnd: string;
  totalPoints: number;
  goalPoints: number;
  completedTasks: number;
  quickActions: number;
  goalReached: boolean;
  previousWeekPoints: number;
  plannedTasks: number;
  plannedTasksCompleted: number;
  tasks: WeeklyTask[];
  quickActionsByUser: WeeklyQuickActions[];
  /** Mon–Sun activity (task completions + quick actions) for the recap chart. */
  dayCounts: DayCount[];
  /** Consecutive weeks the current MVP has held the title. 0 when there is no MVP. */
  mvpStreakWeeks: number;
  mvp: UserStats | null;
  leaderboard: UserStats[];
};

export type ShoppingItem = {
  id: number;
  name: string;
  purchased: boolean;
  addedBy: { id: number; name: string; pictureUrl: string | null } | null;
};

export type ExpenseShare = {
  id: number;
  user: { id: number; name: string; pictureUrl: string | null };
  amountOwed: number;
  paid: boolean;
  paidAt: string | null;
};

export type Expense = {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  paidBy: { id: number; name: string; pictureUrl: string | null } | null;
  shares: ExpenseShare[];
};

export type StarterPackTask = {
  title: string;
  description: string;
};

export type StarterPack = {
  id: string;
  name: string;
  tagline: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  emoji: string;
  tasks: StarterPackTask[];
};

export type Invite = {
  id: number;
  code: string;
  createdAt: string;
};

export type DayCount = {
  day: string;
  count: number;
};

export type LeaderboardEntry = {
  userId: number;
  name: string;
  pictureUrl: string | null;
  completed: number;
  assigned: number;
  completionPercent: number;
  mvp: boolean;
};

export type CollectiveStats = {
  streakDays: number;
  completedThisMonth: number;
  moneySharedThisMonth: number;
  overdueCount: number;
  weeklyCompletions: DayCount[];
  leaderboard: LeaderboardEntry[];
};

export type DayActivity = {
  date: string; // yyyy-MM-dd
  count: number;
};

export type MyStats = {
  completionPercentThisMonth: number;
  completedThisMonth: number;
  streakDays: number;
  /** Every day of the current calendar month, including days that haven't happened yet
   *  (at 0) — the "Meg" tab's contribution heatmap. */
  monthActivity: DayActivity[];
  weekPoints: number;
  lifetimePoints: number;
  level: number;
  pointsToNextLevel: number;
  /** How far into the current level, 0-100 — computed server-side so the level formula
   *  lives in exactly one place. */
  levelProgressPercent: number;
  badges: Badge[];
  /** The whole collective's points this week, and the shared target they fill. */
  collectiveWeekPoints: number;
  goalPoints: number;
};

export type ChatMessage = {
  id: number;
  senderId: number;
  senderName: string;
  senderPictureUrl: string | null;
  content: string | null;
  imageUrl: string | null;
  createdAt: string; // ISO instant
};

export type ChatReadState = {
  userId: number;
  lastReadMessageId: number;
};

export type ChatConversation = {
  type: 'GROUP' | 'DIRECT';
  peerId: number | null;
  title: string;
  pictureUrl: string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
};
