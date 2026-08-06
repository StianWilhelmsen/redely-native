import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palettes, PaletteMeta, Spacing } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

export function PaletteSwitcher() {
  const { paletteId, setPaletteId, scheme } = usePalette();

  return (
    <View style={styles.list}>
      {PaletteMeta.map((meta) => {
        const preview = Palettes[meta.id][scheme];
        const selected = meta.id === paletteId;

        return (
          <Pressable
            key={meta.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setPaletteId(meta.id);
            }}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type={selected ? 'backgroundSelected' : 'backgroundElement'}
              style={[styles.card, selected && { borderColor: preview.brand, borderWidth: 2 }]}>
              <View style={styles.swatchRow}>
                <View
                  style={[
                    styles.swatch,
                    styles.swatchFirst,
                    { backgroundColor: preview.background, borderColor: preview.border, borderWidth: 1 },
                  ]}
                />
                <View style={[styles.swatch, { backgroundColor: preview.brand }]} />
                <View style={[styles.swatch, { backgroundColor: preview.brandSecondary }]} />
              </View>

              <View style={styles.textColumn}>
                <ThemedText type="smallBold">{meta.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {meta.description}
                </ThemedText>
              </View>

              {selected && (
                <ThemedText type="smallBold" themeColor="brand" style={styles.selectedMark}>
                  Selected
                </ThemedText>
              )}
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderColor: 'transparent',
    borderWidth: 2,
  },
  swatchRow: {
    flexDirection: 'row',
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -8,
  },
  swatchFirst: {
    marginLeft: 0,
  },
  textColumn: {
    flex: 1,
    gap: Spacing.half,
  },
  selectedMark: {
    marginLeft: 'auto',
  },
});
