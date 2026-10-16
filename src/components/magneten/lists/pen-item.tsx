import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FontFamily } from '@/constants/theme';
import { Durations, Feel } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

export const LINE_HEIGHT = 40;

/** The pen's curve, scaled to the word it crosses out. */
function strokePath(w: number) {
  return `M0 7 C ${w * 0.2} 3, ${w * 0.4} 10, ${w * 0.6} 5 S ${w * 0.9} 4, ${w} 6`;
}

/**
 * One line on the notepad. Ticking draws a hand-drawn pen stroke through the word (left
 * to right, 420 ms, small tick); a line someone just added "writes in" from the left and
 * its magnet dot pops.
 */
export function PenItem({
  text,
  quantity,
  done,
  color,
  fresh,
  onPress,
  onLongPress,
  a11yHint,
}: {
  text: string;
  quantity: string | null;
  done: boolean;
  /** The adder's magnet colour. */
  color: string;
  fresh: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  a11yHint?: string;
}) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const pen = useSharedValue(done ? 1 : 0);
  const reveal = useSharedValue(fresh && !reduceMotion ? 0 : 1);
  const dot = useSharedValue(fresh && !reduceMotion ? 0 : 1);

  useEffect(() => {
    pen.value = withTiming(done ? 1 : 0, {
      duration: reduceMotion ? 0 : done ? Durations.pen : 200,
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    });
  }, [done, reduceMotion, pen]);

  useEffect(() => {
    if (!fresh || reduceMotion) return;
    reveal.value = withTiming(1, { duration: 650, easing: Easing.steps(14) });
    dot.value = withDelay(260, withSequence(withTiming(1.4, { duration: 200 }), withTiming(1, { duration: 220 })));
    // Plays once, when the line first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stroke = width + 8;
  const strikeStyle = useAnimatedStyle(() => ({ width: pen.value * stroke }));
  const inkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(pen.value, [0, 1], [tokens.paperInk, tokens.textSecondary]),
  }));
  const coverStyle = useAnimatedStyle(() => ({ left: reveal.value * (width + 4) }));
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));

  return (
    <Pressable
      onPress={() => {
        if (!done) Feel.tick();
        onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={quantity ? `${text}, ${quantity}` : text}
      accessibilityHint={a11yHint}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: t('lists.item.title') }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onLongPress?.()}
      style={[styles.row, { borderBottomColor: tokens.border }]}>
      <View style={styles.word}>
        <Animated.Text
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          numberOfLines={1}
          style={[styles.text, inkStyle]}>
          {text}
        </Animated.Text>
        <Animated.View pointerEvents="none" style={[styles.strike, { left: -4 }, strikeStyle]}>
          {width > 0 ? (
            <Svg width={stroke} height={12} viewBox={`0 0 ${stroke} 12`}>
              <Path d={strokePath(stroke)} fill="none" stroke={tokens.stamp} strokeWidth={3} strokeLinecap="round" />
            </Svg>
          ) : null}
        </Animated.View>
        {fresh && !reduceMotion ? (
          <Animated.View pointerEvents="none" style={[styles.cover, { backgroundColor: tokens.paper }, coverStyle]} />
        ) : null}
      </View>
      {quantity ? <Text style={[styles.qty, { color: tokens.textSecondary }]}>{quantity}</Text> : null}
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: LINE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
  },
  word: { flexShrink: 1, flexGrow: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  text: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 20, lineHeight: 29, maxWidth: '100%' },
  strike: { position: 'absolute', top: LINE_HEIGHT / 2 - 7, height: 12, overflow: 'hidden' },
  cover: { position: 'absolute', top: 0, bottom: 0, right: -2 },
  qty: { fontFamily: FontFamily.medium, fontSize: 12.5 },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.2)',
  },
});
