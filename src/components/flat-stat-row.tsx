import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FlatStatItem = {
  value: number;
  label: string;
  /** Highlight this stat's number in the brand color - use for at most one per row. */
  accent?: boolean;
};

/** Unboxed 2-4 column stat row with hairline dividers between cells. */
export function FlatStatRow({ items }: { items: FlatStatItem[] }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
          <View style={styles.cell}>
            <AnimatedNumber value={item.value} type="heading" themeColor={item.accent ? 'brand' : 'text'} />
            <ThemedText type="small" themeColor="textSecondary">
              {item.label}
            </ThemedText>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
  cell: {
    flex: 1,
    gap: 2,
  },
});
