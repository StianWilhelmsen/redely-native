import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SectionProps = ViewProps & {
  title: string;
  /** Right-aligned next to the title - plain text renders as a muted caption,
   *  anything else (e.g. a "Se alle" link) renders as-is. */
  meta?: string | ReactNode;
  /** 'eyebrow' is the quieter uppercase label used where the section is one band of
   *  several on a scrolling screen, rather than a heading in its own right. */
  variant?: 'heading' | 'eyebrow';
};

/**
 * A screen section: heading sits directly on the background, content unboxed.
 * This — not a card around everything — is the default way to group content.
 */
export function Section({ title, meta, children, style, variant = 'heading', ...rest }: SectionProps) {
  return (
    <View style={[styles.section, style]} {...rest}>
      <View style={styles.header}>
        <ThemedText type={variant === 'eyebrow' ? 'eyebrow' : 'heading'}>{title}</ThemedText>
        {meta &&
          (typeof meta === 'string' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {meta}
            </ThemedText>
          ) : (
            meta
          ))}
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
