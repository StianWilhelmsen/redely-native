import { Image } from 'expo-image';
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
              </View>
              {headerRight ?? (
                <Image
                  source={require('@/assets/images/android-icon-foreground.png')}
                  style={styles.brandMarkImage}
                  contentFit="contain"
                />
              )}
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
  brandMarkImage: {
    width: 80,
    height: 80,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
});
