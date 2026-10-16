/**
 * Every movement in Magneten, with its timing and its haptic, in one place. The numbers
 * match the "Bevegelseskatalog" board on the design canvas - change both together.
 *
 * Rule of thumb: a movement always has a reason (something landed, something got done),
 * and a reason always comes with a haptic, so the app feels the same with eyes closed.
 */

import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native-reanimated';

export const Durations = {
  /** A new note flies in, hits the door and settles. */
  smack: 560,
  /** A note tips loose; the stamp lands 180 ms in. */
  done: 520,
  stampDelay: 180,
  /** Pen stroke through a shopping item. */
  pen: 420,
  /** A finished list is torn off and falls. */
  tear: 900,
  /** A photo magnet clicks onto the door. */
  snap: 560,
  /** Gap between notes being pulled in from a week plan. */
  pullStagger: 120,
} as const;

/** The overshoot curve used for landings. */
export const Landing = Easing.bezier(0.2, 0.8, 0.3, 1);
/** Spring-ish settle for state changes such as done/undone. */
export const Settle = Easing.bezier(0.34, 1.56, 0.64, 1);

/**
 * Haptics never throw into the UI: a device without a Taptic Engine, or a simulator,
 * just stays quiet.
 */
function safely(run: () => Promise<void>) {
  run().catch(() => {});
}

export const Feel = {
  /** The note hits the door. */
  smack: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Something got done. Light on purpose - finishing chores should not feel like an alarm. */
  done: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A list torn off. */
  tear: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** A magnet clicks on: two quick ticks. */
  snap: () => {
    safely(() => Haptics.selectionAsync());
    setTimeout(() => safely(() => Haptics.selectionAsync()), 90);
  },
  /** One small tick - pen strokes, pulled-in notes, picking a colour. */
  tick: () => safely(() => Haptics.selectionAsync()),
  /** The whole door is clear. */
  cheer: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
