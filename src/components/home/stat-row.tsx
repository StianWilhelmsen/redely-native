import { Platform, StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Stat = {
  label: string;
  value: number;
  caption: string;
  /** Highlight this stat's number in the brand color (use for at most one). */
  emphasize?: boolean;
};

/** One quiet elevated summary card — monochrome numbers, hairline dividers. */
export function StatRow({ stats }: { stats: Stat[] }) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={styles.cell}>
          {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
          <View style={styles.cellContent}>
            <AnimatedNumber
              value={stat.value}
              type="display"
              themeColor={stat.emphasize ? 'brand' : 'text'}
              style={styles.value}
            />
            <ThemedText type="smallBold" style={styles.label}>
              {stat.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
              {stat.caption}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 20,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } : null),
  },
  cell: {
    flex: 1,
    flexDirection: 'row',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  cellContent: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  value: {
    fontSize: 28,
    lineHeight: 34,
  },
  label: {
    fontSize: 13,
  },
  caption: {
    fontSize: 12,
    lineHeight: 15,
  },
});
