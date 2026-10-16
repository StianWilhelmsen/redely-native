/**
 * The small shared building blocks every Magneten screen is made of. Use these instead of
 * styling raw Pressables/TextInputs per screen, so all screens stay one app.
 *
 * Text rule: Kalam (handwriting) is for what is "on the door" - screen titles, note
 * titles, Magne's lines. Everything you operate (buttons, fields, chips) is Rethink Sans.
 */

import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { TAB_BAR_SPACE } from '@/components/magneten/tab-bar';
import { FontFamily } from '@/constants/theme';
import { Feel, Settle } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

/** A scrolling screen on the door, with safe-area padding. `tabs` leaves room for the tab bar. */
export function Screen({
  children,
  tabs = false,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  tabs?: boolean;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + 12,
    paddingBottom: (tabs ? TAB_BAR_SPACE : 24) + insets.bottom,
  };
  if (!scroll) {
    return <View style={[styles.screen, { backgroundColor: tokens.door }, padding, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.door }}
      contentContainerStyle={[styles.screen, padding, contentStyle]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

/** Small line + handwritten title, the header on every screen. */
export function Title({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  const { tokens } = usePalette();
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={[styles.kicker, { color: tokens.textSecondary }]}>{kicker}</Text> : null}
        <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { tokens } = usePalette();
  return <Text style={[styles.section, { color: tokens.textSecondary }]}>{children.toUpperCase()}</Text>;
}

/** A white rounded surface for settings-style content (not a note - notes use <Note>). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { tokens } = usePalette();
  return <View style={[styles.card, { backgroundColor: tokens.paper }, style]}>{children}</View>;
}

type ButtonVariant = 'ink' | 'outline' | 'magne' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'ink',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { tokens } = usePalette();
  const bg = { ink: tokens.ink, outline: 'transparent', magne: tokens.magne, ghost: 'transparent' }[variant];
  const fg = { ink: tokens.onInk, outline: tokens.text, magne: '#FFFFFF', ghost: tokens.textSecondary }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 2, borderColor: tokens.text, paddingVertical: 13 },
        variant === 'magne' && styles.magneShade,
        variant === 'ghost' && { paddingVertical: 8 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, style, ...input }: TextInputProps & { label: string }) {
  const { tokens } = usePalette();
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={tokens.textSecondary}
        accessibilityLabel={label}
        {...input}
        style={[styles.input, { backgroundColor: tokens.paper, color: tokens.text, borderColor: tokens.border }]}
      />
    </View>
  );
}

/** A selectable pill. Pass `member` to lead with that person's photo magnet. */
export function Chip({
  label,
  selected = false,
  onPress,
  member,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  member?: { name: string; color: string; photoUrl?: string | null };
}) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={() => {
        Feel.tick();
        onPress?.();
      }}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: selected ? tokens.ink : tokens.paper },
        member && { paddingLeft: 4 },
      ]}>
      {member ? <PhotoMagnet name={member.name} color={member.color} photoUrl={member.photoUrl} size={22} /> : null}
      <Text style={[styles.chipText, { color: selected ? tokens.onInk : tokens.text }]}>{label}</Text>
    </Pressable>
  );
}

/** On/off switch with a springy knob, as on the canvas. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { tokens } = usePalette();
  const x = useSharedValue(value ? 20 : 0);
  useEffect(() => {
    x.value = withTiming(value ? 20 : 0, { duration: 260, easing: Settle });
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Pressable
      onPress={() => {
        Feel.tick();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={[styles.track, { backgroundColor: value ? tokens.stamp : tokens.border }]}>
      <Animated.View style={[styles.knob, knob]} />
    </Pressable>
  );
}

/** A label/value row inside a Card. */
export function Row({ label, value, onPress, children }: { label: string; value?: string; onPress?: () => void; children?: ReactNode }) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.row, { borderBottomColor: tokens.backgroundSelected }]}>
      <Text style={[styles.rowLabel, { color: tokens.text }]}>{label}</Text>
      {children ?? (value ? <Text style={[styles.rowValue, { color: tokens.textSecondary }]}>{value}</Text> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 18, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  kicker: { fontFamily: FontFamily.bold, fontSize: 12.5 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 32, lineHeight: 46 },
  section: { fontFamily: FontFamily.extraBold, fontSize: 11.5, letterSpacing: 0.7, paddingTop: 8, paddingHorizontal: 4 },
  card: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 2 },
  button: { borderRadius: 999, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  magneShade: { borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.18)' },
  buttonText: { fontFamily: FontFamily.bold, fontSize: 15.5 },
  fieldLabel: { fontFamily: FontFamily.bold, fontSize: 13, paddingLeft: 4 },
  input: { borderWidth: 2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontFamily: FontFamily.semiBold, fontSize: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontFamily: FontFamily.bold, fontSize: 13 },
  track: { width: 50, height: 30, borderRadius: 999, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  rowLabel: { fontFamily: FontFamily.semiBold, fontSize: 14.5, flexShrink: 1 },
  rowValue: { fontFamily: FontFamily.regular, fontSize: 13 },
});
