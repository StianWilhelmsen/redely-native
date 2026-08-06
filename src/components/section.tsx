import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SectionProps = ViewProps & {
  title: string;
  /** Small text rendered right-aligned next to the title. */
  meta?: string;
};

/**
 * A screen section: heading sits directly on the background, content unboxed.
 * This — not a card around everything — is the default way to group content.
 */
export function Section({ title, meta, children, style, ...rest }: SectionProps) {
  return (
    <View style={[styles.section, style]} {...rest}>
      <View style={styles.header}>
        <ThemedText type="heading">{title}</ThemedText>
        {meta && (
          <ThemedText type="small" themeColor="textSecondary">
            {meta}
          </ThemedText>
        )}
      </View>
      {children}
    </View>
  );
}

/** Hairline row separator for lists sitting on the background. */
export function Separator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 26 + Spacing.three, // aligns with text after a 26px leading control
  },
});
