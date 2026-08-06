import { useEffect, useState } from 'react';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Animates a numeric display value toward `target` whenever it changes.
 * Does NOT animate on first mount (starts at `target` immediately) so
 * screens don't count up from zero on every load.
 */
export function useAnimatedCounter(target: number, duration = 500): number {
  const progress = useSharedValue(target);
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    progress.value = withTiming(target, { duration, easing: Easing.out(Easing.cubic) });
  }, [target, duration, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (previous === null || current !== previous) {
        runOnJS(setDisplay)(current);
      }
    },
    []
  );

  return display;
}
