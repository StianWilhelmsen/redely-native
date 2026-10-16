import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

/** A pill with 2-3 equal options, one dark - "Hele familien / Bare voksne / Bare meg". */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'ink',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** 'ink' = dark selected pill (forms); 'paper' = white selected pill (top switcher). */
  tone?: 'ink' | 'paper';
}) {
  const { tokens } = usePalette();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.track, { backgroundColor: tone === 'ink' ? tokens.backgroundSelected : tokens.border }]}>
      {options.map((o) => {
        const selected = o.value === value;
        const bg = selected ? (tone === 'ink' ? tokens.ink : tokens.paper) : 'transparent';
        const fg = selected ? (tone === 'ink' ? tokens.onInk : tokens.text) : tokens.textSecondary;
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
            style={[styles.option, tone === 'paper' && styles.optionFit, { backgroundColor: bg }]}>
            <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  option: { flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  optionFit: { flex: 0, paddingHorizontal: 16 },
  label: { fontFamily: FontFamily.bold, fontSize: 13 },
});
