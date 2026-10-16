import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Feel } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

export type RoundIcon = 'back' | 'close' | 'prev' | 'next' | 'plus' | 'more' | 'share' | 'send';

function Icon({ name, color }: { name: RoundIcon; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (name) {
    case 'back':
    case 'prev':
      return <Path d="M15 5l-7 7 7 7" {...stroke} />;
    case 'next':
      return <Path d="M9 5l7 7-7 7" {...stroke} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6L6 18" {...stroke} />;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...stroke} strokeWidth={3} />;
    case 'share':
      return <Path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6" {...stroke} />;
    case 'send':
      return <Path d="M4 12l16-8-6 16-2.5-6.5z" {...stroke} />;
    case 'more':
      return (
        <>
          <Circle cx={5.5} cy={12} r={2} fill={color} />
          <Circle cx={12} cy={12} r={2} fill={color} />
          <Circle cx={18.5} cy={12} r={2} fill={color} />
        </>
      );
  }
}

/** A 44 pt round button with one icon - back, close, week arrows, the red +. */
export function RoundButton({
  icon,
  label,
  onPress,
  variant = 'paper',
  size = 44,
  disabled = false,
}: {
  icon: RoundIcon;
  label: string;
  onPress: () => void;
  variant?: 'paper' | 'magne' | 'ink';
  size?: number;
  disabled?: boolean;
}) {
  const { tokens } = usePalette();
  const bg = { paper: tokens.paper, magne: tokens.magne, ink: tokens.ink }[variant];
  const fg = variant === 'paper' ? tokens.text : '#FFFFFF';
  return (
    <Pressable
      onPress={() => {
        Feel.tick();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'magne' && styles.shade,
      ]}>
      <Svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24">
        <Icon name={icon} color={fg} />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  shade: { borderBottomWidth: 3, borderBottomColor: 'rgba(0,0,0,0.18)' },
});
