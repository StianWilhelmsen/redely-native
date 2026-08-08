/**
 * The weekly story runs on its own fixed colors rather than the active app palette. Each
 * pane owns a mood — the week's goal is green, the chore list blue, the MVP purple — and
 * that sequence is the point: swiping through it should feel like moving between rooms.
 * Everything sits on a dark, saturated ground, so all ink here is white with alpha.
 */

export type PaneSkin = {
  /** Diagonal gradient, top-left to bottom-right. */
  gradient: [string, string];
  /** Soft radial light, positioned in fractions of the pane. */
  glow?: { color: string; cx: number; cy: number; radius: number; opacity: number };
  /** Fills, rings and highlights on this pane. */
  accent: string;
};

export const PaneSkins = {
  cover: {
    gradient: ['#0C4C34', '#2F8C61'],
    glow: { color: '#5FCC97', cx: 0.5, cy: 1.05, radius: 0.9, opacity: 0.35 },
    accent: '#8FE9BE',
  },
  goal: {
    gradient: ['#0F6042', '#43A170'],
    accent: '#EDF9F2',
  },
  tasks: {
    gradient: ['#22508F', '#3F7AC2'],
    accent: '#BFDBFF',
  },
  quickActions: {
    gradient: ['#A85B0C', '#D9A33C'],
    accent: '#FFE0AE',
  },
  mvp: {
    gradient: ['#330C3D', '#8A3796'],
    glow: { color: '#D96FE0', cx: 0.5, cy: 0.92, radius: 0.85, opacity: 0.45 },
    accent: '#F4CBF8',
  },
  leaderboard: {
    gradient: ['#4A1409', '#A9542A'],
    glow: { color: '#E08340', cx: 0.5, cy: 1.0, radius: 0.85, opacity: 0.4 },
    accent: '#FFC48F',
  },
  recap: {
    gradient: ['#12170F', '#232A24'],
    accent: '#FFFFFF',
  },
} satisfies Record<string, PaneSkin>;

/** White-on-dark ink scale shared by every pane. */
export const Ink = {
  primary: '#FFFFFF',
  secondary: 'rgba(255, 255, 255, 0.74)',
  muted: 'rgba(255, 255, 255, 0.55)',
  faint: 'rgba(255, 255, 255, 0.38)',
  surface: 'rgba(255, 255, 255, 0.10)',
  surfaceStrong: 'rgba(255, 255, 255, 0.17)',
  hairline: 'rgba(255, 255, 255, 0.16)',
  track: 'rgba(255, 255, 255, 0.20)',
} as const;

/** Festive colors for the confetti bursts — readable against every pane above. */
export const StoryConfetti = ['#FFD966', '#7BE0AC', '#F4A9FF', '#9FC6F5', '#FFFFFF'];
