import { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';

/** How many rows still stagger before the rest arrive together. Past this, waiting stops
 *  reading as sequence and starts reading as the list being slow. */
const MAX_STAGGERED_ROWS = 8;

/**
 * Rows arrive in the order they are meant to be read rather than all at once.
 *
 * Deliberately not a spring: a row that overshoots and settles draws attention to the
 * animation, and this is a list you are trying to read, not a thing to watch. A short
 * fade over a few pixels of travel is enough to say "these arrived in this order".
 *
 * Put this on a plain `Animated.View` wrapping the row, never on an animated `Pressable`
 * that styles itself with the `({ pressed }) => ...` callback form. Reanimated's
 * `createAnimatedComponent` wraps whatever it finds in `style` into an array, and a
 * Pressable only calls its style callback when the prop is a bare function - so the
 * callback ends up sitting inside an array that nothing ever invokes and the row renders
 * with no styles at all, which reads as a row that has silently lost its `flexDirection`.
 */
export function rowEntrance(index: number) {
  return FadeInDown.delay(Math.min(index, MAX_STAGGERED_ROWS) * 40)
    .duration(220)
    .easing(Easing.out(Easing.quad))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
}

/** Applied to rows that can move between sections (a shopping item being ticked off), so
 *  the item glides to its new home instead of vanishing from one list and appearing in
 *  another - which loses track of which item it was. Timed, not sprung, for the same
 *  reason as above. */
export const rowTransition = LinearTransition.duration(240).easing(Easing.out(Easing.quad));
