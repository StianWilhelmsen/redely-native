/**
 * Small pieces shared by the door, note and activity screens: icons, the round header
 * buttons, a segmented control and the neutral "nobody" magnet.
 */

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Member } from '@/api';
import type { NoteMember } from '@/components/magneten/note';
import { FontFamily, type PaletteTokens } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

type IconName = 'back' | 'more' | 'plus' | 'bell' | 'send' | 'close' | 'trash';

export function Icon({ name, color, size = 20 }: { name: IconName; color: string; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' ? <Path d="M15 5l-7 7 7 7" {...stroke} /> : null}
      {name === 'close' ? <Path d="M6 6l12 12M18 6L6 18" {...stroke} /> : null}
      {name === 'plus' ? <Path d="M12 5v14M5 12h14" {...stroke} strokeWidth={3} /> : null}
      {name === 'more' ? (
        <>
          <Circle cx={6} cy={12} r={1.8} fill={color} />
          <Circle cx={12} cy={12} r={1.8} fill={color} />
          <Circle cx={18} cy={12} r={1.8} fill={color} />
        </>
      ) : null}
      {name === 'bell' ? (
        <>
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" {...stroke} strokeWidth={2} />
          <Path d="M10 20.5a2 2 0 0 0 4 0" {...stroke} strokeWidth={2} />
        </>
      ) : null}
      {name === 'send' ? <Path d="M4 12l16-8-6 16-2.5-6.5z" {...stroke} strokeWidth={2} /> : null}
      {name === 'trash' ? <Path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" {...stroke} strokeWidth={2} /> : null}
    </Svg>
  );
}

/** A 44 pt round paper button for headers (back, more, bell). */
export function RoundButton({
  icon,
  label,
  onPress,
  badge,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.round, { backgroundColor: tokens.paper, opacity: pressed ? 0.8 : 1 }, style]}>
      <Icon name={icon} color={tokens.text} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: tokens.magne, borderColor: tokens.door }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** A pill-shaped segmented control (Lapp | Hendelse, Alle | Bare voksne | Bare meg). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  stretch = false,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  stretch?: boolean;
}) {
  const { tokens } = usePalette();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: tokens.backgroundSelected }, stretch && { alignSelf: 'stretch' }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={o.disabled}
            onPress={() => {
              if (selected) return;
              Feel.tick();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: o.disabled }}
            style={[
              styles.segment,
              stretch && { flex: 1 },
              selected && { backgroundColor: tokens.ink },
              o.disabled && { opacity: 0.4 },
            ]}>
            <Text
              numberOfLines={1}
              style={[styles.segmentText, { color: selected ? tokens.onInk : tokens.textSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The magnet a member holds a note up with; a plain grey one for unassigned notes. */
export function magnetFor(member: Member | undefined, tokens: PaletteTokens): NoteMember {
  if (!member) return { name: '', color: tokens.textSecondary, photoUrl: null };
  return { name: member.displayName, color: member.color, photoUrl: member.photoUrl };
}

/** A member's colour washed out, for the soft chip behind a name. */
export function tint(hex: string, alpha = 0.18): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontFamily: FontFamily.extraBold, fontSize: 10.5 },
  segmented: { flexDirection: 'row', borderRadius: 999, padding: 3, alignSelf: 'flex-start' },
  segment: { paddingHorizontal: 14, minHeight: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontFamily: FontFamily.bold, fontSize: 13 },
});
