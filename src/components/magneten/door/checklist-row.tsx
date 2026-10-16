import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FontFamily } from '@/constants/theme';
import { Durations, Feel } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

/** One checklist line on a note: a box that ticks and a pen stroke through the text. */
export function ChecklistRow({ text, done, onToggle }: { text: string; done: boolean; onToggle: (() => void) | null }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const stroke = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    stroke.value = withTiming(done ? 1 : 0, {
      duration: reduceMotion ? 0 : done ? Durations.pen : 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [done, reduceMotion, stroke]);

  const line = useAnimatedStyle(() => ({ width: stroke.value * width }));

  return (
    <Pressable
      onPress={() => {
        if (!onToggle) return;
        Feel.tick();
        onToggle();
      }}
      disabled={!onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !onToggle }}
      accessibilityLabel={t('door.note.tickItem', { text })}
      style={styles.row}>
      <View style={[styles.box, { borderColor: tokens.paperInk, backgroundColor: done ? tokens.paperInk : 'transparent' }]}>
        {done ? (
          <Svg width={12} height={12} viewBox="0 0 14 14">
            <Path d="M2 7.5l3 3 7-7" fill="none" stroke={tokens.paper} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        ) : null}
      </View>
      <View style={styles.textWrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <Text
          style={[
            styles.text,
            done
              ? { color: tokens.textSecondary, fontFamily: FontFamily.handRegular }
              : { color: tokens.paperInk, fontFamily: FontFamily.hand },
          ]}>
          {text}
        </Text>
        <Animated.View pointerEvents="none" style={[styles.strike, { backgroundColor: tokens.textSecondary }, line]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flexShrink: 1, justifyContent: 'center' },
  text: { fontSize: 19, lineHeight: 24 },
  strike: { position: 'absolute', left: 0, top: '52%', height: 2, borderRadius: 1 },
});
