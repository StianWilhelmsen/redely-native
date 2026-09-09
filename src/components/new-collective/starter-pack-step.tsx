import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Collapsible } from '@/components/collapsible';
import { ErrorState } from '@/components/error-state';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StarterPack } from '@/types/api';

type Props = {
  packs: StarterPack[] | undefined;
  error: unknown;
  onRetry: () => void;
  selectedPackId: string | null;
  onSelect: (packId: string) => void;
};

export function StarterPackStep({ packs, error, onRetry, selectedPackId, onSelect }: Props) {
  const theme = useTheme();
  // Which packs have their task list open. Independent of selection: comparing what is
  // actually in two packs is the whole point, so opening one must not close another.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (packId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  return (
    <>
      <ThemedText style={[styles.title, { color: theme.text }]}>
        Hvor mye skal dere gjøre?
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
        En ferdig ukeplan fordelt på alle. Du kan endre alt etterpå.
      </ThemedText>

      {error && !packs ? (
        <View style={styles.state}>
          <ErrorState message="Klarte ikke å hente startpakkene." onRetry={onRetry} />
        </View>
      ) : !packs ? (
        <View style={styles.state}>
          <RefreshSpinner active />
        </View>
      ) : (
        <View style={styles.list}>
          {packs.map((pack, index) => {
            const selected = pack.id === selectedPackId;
            const isOpen = expanded.has(pack.id);
            return (
              <View key={pack.id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${pack.name}. ${pack.tagline}`}
                  onPress={() => onSelect(pack.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <View style={styles.rowText}>
                    <ThemedText type="heading">{pack.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.rowBody}>
                      {pack.tagline}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      selected
                        ? { backgroundColor: theme.brand, borderColor: theme.brand }
                        : { borderColor: theme.border },
                    ]}>
                    {selected && <Ionicons name="checkmark" size={15} color={theme.onBrand} />}
                  </View>
                </Pressable>

                <Collapsible
                  open={isOpen}
                  onToggle={() => toggleExpanded(pack.id)}
                  label={`Se de ${pack.tasks.length} oppgavene`}
                  openLabel="Skjul oppgavene">
                  <View style={styles.tasks}>
                    {pack.tasks.map((task) => (
                      <View key={task.title} style={styles.task}>
                        <View style={[styles.bullet, { backgroundColor: theme.brand }]} />
                        <View style={styles.taskText}>
                          <ThemedText type="small">{task.title}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {task.description}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                </Collapsible>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  state: {
    marginTop: Spacing.five,
  },
  list: {
    marginTop: Spacing.five,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowBody: {
    marginTop: Spacing.half,
    lineHeight: 20,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasks: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  task: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.half,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
  },
  taskText: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
