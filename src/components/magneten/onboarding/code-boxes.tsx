import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FontFamily } from '@/constants/theme';
import { Settle } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

export type CodeBoxesState = 'idle' | 'ok' | 'error';

type Props = {
  value: string;
  onChangeText: (raw: string) => void;
  length?: number;
  state?: CodeBoxesState;
  /** Bump to shake the row (a wrong code). */
  shakeKey?: number;
  accessibilityLabel: string;
  autoFocus?: boolean;
  editable?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

export type CodeBoxesHandle = { focus: () => void };

/** One character landing in its box with a little pop. */
function Digit({ char, color }: { char: string; color: string }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.4);
  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withSequence(withTiming(1.2, { duration: 180 }), withTiming(1, { duration: 80 }));
    // Pops once, when the character appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.Text style={[styles.digit, { color }, pop]}>{char}</Animated.Text>;
}

/**
 * A row of boxes showing a code, typed into one invisible input on top of them (so the
 * system keyboard, paste and one-time-code autofill all work).
 */
export const CodeBoxes = forwardRef<CodeBoxesHandle, Props>(function CodeBoxes(
  {
    value,
    onChangeText,
    length = 6,
    state = 'idle',
    shakeKey = 0,
    accessibilityLabel,
    autoFocus = true,
    editable = true,
    keyboardType = 'number-pad',
    textContentType,
    autoComplete,
    autoCapitalize = 'none',
  },
  ref
) {
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const input = useRef<TextInput>(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

  const x = useSharedValue(0);
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!shakeKey || reduceMotion) return;
    x.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 60 }),
      withTiming(-5, { duration: 60 }),
      withTiming(4, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  }, [shakeKey, reduceMotion, x]);
  useEffect(() => {
    lift.value = withTiming(state === 'ok' ? -4 : 0, { duration: reduceMotion ? 0 : 300, easing: Settle });
  }, [state, reduceMotion, lift]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: lift.value }] }));

  const chars = value.split('');

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <Animated.View style={[styles.row, rowStyle]}>
        {Array.from({ length }, (_, i) => {
          const char = chars[i];
          const isNext = i === chars.length && state === 'idle';
          const border =
            state === 'ok' ? tokens.stamp : state === 'error' ? tokens.danger : isNext ? tokens.text : tokens.border;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { borderColor: border, backgroundColor: state === 'ok' ? tokens.paperMint : tokens.paper },
              ]}>
              {char ? (
                <Digit key={`${i}-${char}`} char={char} color={state === 'ok' ? tokens.stamp : tokens.paperInk} />
              ) : null}
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        editable={editable}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        style={styles.hidden}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 58,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontFamily: FontFamily.extraBold, fontSize: 26 },
  hidden: { ...StyleSheet.absoluteFill, opacity: 0.02, color: 'transparent', fontSize: 1 },
});
