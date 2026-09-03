import { FadeInDown, LinearTransition } from 'react-native-reanimated';

/** How many rows still stagger before the rest arrive together. Past this, waiting stops
 *  reading as sequence and starts reading as the list being slow. */
const MAX_STAGGERED_ROWS = 8;

/**
 * Rows arrive in the order they are meant to be read rather than all at once. Short and
 * shallow on purpose - this should register as the list settling into place, not as an
 * animation you have to sit through before you can act.
 */
export function rowEntrance(index: number) {
  return FadeInDown.delay(Math.min(index, MAX_STAGGERED_ROWS) * 45)
    .duration(260)
    .springify()
    .damping(18);
}

/** Applied to rows that can move between sections (a shopping item being ticked off), so
 *  the item glides to its new home instead of vanishing from one list and appearing in
 *  another - which loses track of which item it was. */
export const rowTransition = LinearTransition.springify().damping(20).stiffness(160);
