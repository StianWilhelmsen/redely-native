/**
 * Small pieces shared by the family screens (Familien, Meg, a member, Hvem eier hva,
 * Inviter, Pluss, barnemodus). Generic primitives live in ../ui.tsx; these are the
 * family-specific ones.
 */

import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import type { MemberColor, MemberRole } from '@/api';
import { Magne, type MagnePose } from '@/components/magneten/magne';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { FontFamily, MemberColors } from '@/constants/theme';
import { Feel, Settle } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

// ---- Icons ------------------------------------------------------------------

type IconName = 'back' | 'close' | 'chevron' | 'lock' | 'camera';

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' ? <Path d="M15 5l-7 7 7 7" {...stroke} strokeLinejoin="round" /> : null}
      {name === 'close' ? <Path d="M6 6l12 12M18 6L6 18" {...stroke} /> : null}
      {name === 'chevron' ? <Path d="M9 5l7 7-7 7" {...stroke} /> : null}
      {name === 'lock' ? (
        <>
          <Rect x={5} y={11} width={14} height={10} rx={2} stroke={color} strokeWidth={2} fill="none" />
          <Path d="M8 11V8a4 4 0 018 0v3" stroke={color} strokeWidth={2} fill="none" />
        </>
      ) : null}
      {name === 'camera' ? (
        <>
          <Path d="M3 7.5h4l1.5-2.5h7L17 7.5h4V19H3z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" fill="none" />
          <Path d="M12 9.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" stroke={color} strokeWidth={2.2} fill="none" />
        </>
      ) : null}
    </Svg>
  );
}

/** The round white back / close button in the top corner. */
export function CircleButton({
  icon,
  label,
  onPress = () => router.back(),
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.circle, { backgroundColor: tokens.paper, opacity: pressed ? 0.8 : 1 }, style]}>
      <Icon name={icon} size={icon === 'close' || icon === 'lock' ? 18 : 20} color={tokens.text} />
    </Pressable>
  );
}

/** A top bar with a back (or close) button on the left and anything on the right. */
export function TopBar({ icon = 'back', right }: { icon?: 'back' | 'close'; right?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={styles.topBar}>
      {icon === 'back' ? <CircleButton icon="back" label={t('actions.back')} /> : <View />}
      <View style={styles.topRight}>
        {right}
        {icon === 'close' ? <CircleButton icon="close" label={t('actions.close')} /> : null}
      </View>
    </View>
  );
}

/** A small dark pill button, as "Inviter" in the header. */
export function PillButton({
  label,
  onPress,
  light = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  light?: boolean;
  accessibilityLabel?: string;
}) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: light ? tokens.paper : tokens.ink, opacity: pressed ? 0.85 : 1 },
      ]}>
      <Text style={[styles.pillText, { color: light ? tokens.text : tokens.onInk }]}>{label}</Text>
    </Pressable>
  );
}

// ---- Roles -------------------------------------------------------------------

export function useRoleLabel() {
  const { t } = useTranslation();
  return (role: MemberRole) => t(`family.roles.${role}`);
}

export function RolePill({ role }: { role: MemberRole }) {
  const { tokens } = usePalette();
  const label = useRoleLabel();
  return (
    <View style={[styles.rolePill, { backgroundColor: tokens.backgroundSelected }]}>
      <Text style={[styles.rolePillText, { color: tokens.textSecondary }]}>{label(role)}</Text>
    </View>
  );
}

// ---- Segmented control -------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
}) {
  const { tokens } = usePalette();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.seg, { backgroundColor: tokens.backgroundSelected }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (selected) return;
              Feel.tick();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={[styles.segItem, selected && { backgroundColor: tokens.ink }]}>
            <Text
              numberOfLines={1}
              style={[styles.segText, { color: selected ? tokens.onInk : tokens.textSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- Colour picker -----------------------------------------------------------

function Swatch({ hex, selected, onPress, label }: { hex: string; selected: boolean; onPress: () => void; label: string }) {
  const { tokens } = usePalette();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(selected ? 1.12 : 1);
  useEffect(() => {
    scale.value = withTiming(selected ? 1.12 : 1, { duration: reduceMotion ? 0 : 200, easing: Settle });
  }, [selected, reduceMotion, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={3}
      style={styles.swatchHit}>
      <Animated.View
        style={[
          styles.swatch,
          { backgroundColor: hex, borderColor: selected ? tokens.text : tokens.paper },
          animated,
        ]}
      />
    </Pressable>
  );
}

/** The six magnet colours. Picking one snaps the magnet (see SnapMagnet). */
export function ColorSwatches({
  value,
  onChange,
  disabled = false,
}: {
  value: MemberColor;
  onChange: (c: MemberColor) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const pick = (hex: MemberColor) => {
    // The magnet's snap carries the haptic; without movement, play it here instead.
    if (reduceMotion) Feel.snap();
    onChange(hex);
  };
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('family.color.label')}
      style={[styles.swatches, disabled && { opacity: 0.5 }]}
      pointerEvents={disabled ? 'none' : 'auto'}>
      {MemberColors.map((hex, i) => (
        <Swatch
          key={hex}
          hex={hex}
          selected={hex === value}
          label={t('family.color.pick', { name: t(`family.color.names.${i}`) })}
          onPress={() => hex !== value && pick(hex as MemberColor)}
        />
      ))}
    </View>
  );
}

/**
 * A photo magnet that clicks onto the door again whenever its colour changes - the
 * feedback for picking a new magnet colour. The snap brings its own haptic; with reduced
 * motion there is no movement, so the haptic is played here instead.
 */
export function SnapMagnet({
  name,
  color,
  photoUrl,
  size,
}: {
  name: string;
  color: string;
  photoUrl?: string | null;
  size: number;
}) {
  // Snap on every change after the first render, never on opening the screen.
  const [prev, setPrev] = useState(color);
  const [snap, setSnap] = useState(false);
  if (prev !== color) {
    setPrev(color);
    setSnap(true);
  }
  return <PhotoMagnet key={color} name={name} color={color} photoUrl={photoUrl} size={size} snapIn={snap} />;
}

// ---- Paper -------------------------------------------------------------------

/**
 * A piece of paper held up by a plain round magnet - for content that lives "on the
 * door" but is not a task: the week summary, the Pluss notes, an invite code.
 */
export function PaperNote({
  children,
  paper,
  magnet,
  tilt = 0,
  centered = false,
  outline,
  style,
}: {
  children: ReactNode;
  paper: string;
  magnet: string;
  tilt?: number;
  centered?: boolean;
  outline?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.paperWrap, style]}>
      <View
        style={[
          styles.paper,
          { backgroundColor: paper, transform: [{ rotate: `${tilt}deg` }] },
          outline ? { borderWidth: 3, borderColor: outline } : null,
        ]}>
        {children}
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.dot,
          { backgroundColor: magnet },
          centered ? { left: '50%', marginLeft: -11 } : { left: 22 },
        ]}
      />
    </View>
  );
}

// ---- Magne -------------------------------------------------------------------

/** Magne with a yellow speech bubble, as on "Hvem eier hva". */
export function MagneSays({
  pose = 'lurer',
  size = 62,
  children,
}: {
  pose?: MagnePose;
  size?: number;
  children: ReactNode;
}) {
  const { tokens } = usePalette();
  return (
    <View style={styles.says}>
      <Magne pose={pose} size={size} />
      <View style={[styles.bubble, { backgroundColor: tokens.paperYellow }]}>{children}</View>
    </View>
  );
}

/** Magne's line: handwritten, on paper ink. */
export function MagneLine({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { tokens } = usePalette();
  return <Text style={[styles.magneLine, { color: tokens.paperInk }, style as object]}>{children}</Text>;
}

/** Whole-screen waiting state: Magne pulling. */
export function Waiting({ label }: { label?: string }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <View style={[styles.center, { backgroundColor: tokens.door }]} accessibilityLiveRegion="polite">
      <Magne pose="trekker" size={96} />
      <Text style={[styles.centerText, { color: tokens.textSecondary }]}>{label ?? t('loading')}</Text>
    </View>
  );
}

/** Empty or "can't find it" state: Magne asleep (or wondering) and a line. */
export function Empty({ pose = 'sover', title, children }: { pose?: MagnePose; title: string; children?: ReactNode }) {
  const { tokens } = usePalette();
  return (
    <View style={styles.empty}>
      <Magne pose={pose} size={84} />
      <Text style={[styles.emptyTitle, { color: tokens.text }]}>{title}</Text>
      {children}
    </View>
  );
}

/** A white link tile with a chevron, as "Hvem eier hva" / "Barnemodus". */
export function LinkTile({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.tile, { backgroundColor: tokens.paper, opacity: pressed ? 0.85 : 1 }]}>
      <Text numberOfLines={2} style={[styles.tileText, { color: tokens.text }]}>
        {label}
      </Text>
      <Icon name="chevron" size={16} color={tokens.text} />
    </Pressable>
  );
}

/** A tinted chip with a member's photo magnet - "who owns this". */
export function MemberChip({ name, color, photoUrl }: { name: string; color: string; photoUrl?: string | null }) {
  const { tokens, scheme } = usePalette();
  return (
    <View style={[styles.memberChip, { backgroundColor: `${color}${scheme === 'dark' ? '44' : '22'}` }]}>
      <PhotoMagnet name={name} color={color} photoUrl={photoUrl} size={22} />
      <Text numberOfLines={1} style={[styles.memberChipText, { color: tokens.text }]}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  pillText: { fontFamily: FontFamily.bold, fontSize: 13 },
  rolePill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  rolePillText: { fontFamily: FontFamily.bold, fontSize: 11.5 },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  segItem: { flex: 1, borderRadius: 999, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segText: { fontFamily: FontFamily.bold, fontSize: 13 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderBottomColor: 'rgba(0,0,0,0.18)' },
  paperWrap: { paddingTop: 10 },
  paper: {
    flexGrow: 1,
    paddingTop: 20,
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  dot: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  says: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubble: {
    flex: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 22,
    gap: 8,
  },
  magneLine: { fontFamily: FontFamily.hand, fontSize: 17, lineHeight: 21 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerText: { fontFamily: FontFamily.hand, fontSize: 20, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 16 },
  emptyTitle: { fontFamily: FontFamily.hand, fontSize: 21, lineHeight: 25, textAlign: 'center' },
  tile: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tileText: { fontFamily: FontFamily.bold, fontSize: 14, flexShrink: 1 },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 3,
    maxWidth: 160,
  },
  memberChipText: { fontFamily: FontFamily.bold, fontSize: 12.5, flexShrink: 1 },
});
