import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ScrollViewProps & {
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Small label above the title (e.g. collective address, "Kollektivet ditt"). */
  eyebrow?: string;
  /** Screen title. */
  title?: string;
  /** Supporting line under the title. */
  subtitle?: string;
  /** Rendered to the right of the title (e.g. an avatar or a settings icon). */
  headerRight?: ReactNode;
  /** Extra content below the title (segmented control, search pill, highlight card). */
  headerExtra?: ReactNode;
};

/**
 * Screen layout: everything sits on one neutral, palette-tinted background —
 * color is reserved for accents (buttons, badges, highlight cards), not a
 * saturated header canvas.
 */
export function ScreenScroll({
  children,
  style,
  refreshing,
  onRefresh,
  eyebrow,
  title,
  subtitle,
  headerRight,
  headerExtra,
  ...rest
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const hasHeader = !!title || !!headerExtra;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      automaticallyAdjustKeyboardInsets
      // Without this, the first tap on a button while the keyboard is open is
      // swallowed by the dismiss gesture instead of hitting the button.
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand}
            colors={[theme.brand]}
            progressBackgroundColor={theme.backgroundElement}
          />
        ) : undefined
      }
      {...rest}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
          style,
        ]}>
        <RefreshSpinner active={!!refreshing} />
        {hasHeader && (
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                {eyebrow && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {eyebrow}
                  </ThemedText>
                )}
                {title && <ThemedText type="display">{title}</ThemedText>}
                {subtitle && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                    {subtitle}
                  </ThemedText>
                )}
              </View>
              {/* Nothing by default: a screen that wants something here (Hjem's collective
                  avatar) says so. The app's own mark used to sit here on every screen,
                  which spent the most valuable corner of the layout telling people which
                  app they had already opened. */}
              {headerRight}
            </View>
            {headerExtra}
          </View>
        )}

        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    marginTop: Spacing.one,
    maxWidth: 320,
  },
});
