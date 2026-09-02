import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadChat, useUnreadPayments } from '@/hooks/use-unread';

type AppTab = {
  name: string;
  href: '/' | '/shopping' | '/chat' | '/kollektiv' | '/me';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: AppTab[] = [
  { name: 'home', href: '/', label: 'Hjem', icon: 'home-outline' },
  { name: 'shopping', href: '/shopping', label: 'Handleliste', icon: 'cart-outline' },
  { name: 'chat', href: '/chat', label: 'Chat', icon: 'chatbubble-outline' },
  { name: 'kollektiv', href: '/kollektiv', label: 'Kollektiv', icon: 'people-outline' },
  { name: 'me', href: '/me', label: 'Meg', icon: 'person-outline' },
];

const COLLECTIVE_ONLY_PATHS = ['/shopping', '/chat', '/kollektiv'];

function activeIndexForPath(pathname: string, tabs: AppTab[]): number {
  const index = tabs.findIndex((tab) => tab.href !== '/' && pathname.startsWith(tab.href));
  return index >= 0 ? index : 0;
}

export default function AppTabs() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const { unreadCount: chatUnread } = useUnreadChat();
  const { unreadCount: paymentsUnread } = useUnreadPayments();
  const hasCollective = !!me?.collective;
  const tabs = hasCollective ? TABS : TABS.filter((tab) => tab.name === 'home' || tab.name === 'me');

  // Removing the triggers keeps the collective features out of the tab bar. This second
  // guard handles restored navigation state and deep links after the profile resolves.
  useEffect(() => {
    if (!me || hasCollective) return;
    if (COLLECTIVE_ONLY_PATHS.some((path) => pathname.startsWith(path))) {
      router.replace('/');
    }
  }, [hasCollective, me, pathname]);

  // Persists outside the app too (app icon), unlike an in-app-only dot - this is
  // the only place these notifications leave a trace once the push itself is gone.
  const totalUnread = chatUnread + paymentsUnread;
  const totalUnreadRef = useRef(totalUnread);
  totalUnreadRef.current = totalUnread;

  useEffect(() => {
    Notifications.setBadgeCountAsync(totalUnread).catch(() => {});
  }, [totalUnread]);

  // Belt-and-suspenders: also re-sync whenever the app returns to the foreground.
  // Guards against a stale badge from e.g. a cold-launch race where this effect's
  // first run fires before SWR/AsyncStorage have finished loading their real values.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Notifications.setBadgeCountAsync(totalUnreadRef.current).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const showDot: Partial<Record<string, boolean>> = {
    chat: chatUnread > 0,
    shopping: paymentsUnread > 0,
  };

  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <TabBar tabs={tabs}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} showDot={!!showDot[tab.name]}>
                {tab.label}
              </TabButton>
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  children,
  isFocused,
  icon,
  showDot,
  ...props
}: TabTriggerSlotProps & { icon: keyof typeof Ionicons.glyphMap; showDot?: boolean }) {
  const theme = useTheme();

  return (
    <Pressable {...props} style={styles.tabButton}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={isFocused ? theme.text : theme.textSecondary} />
        {showDot && (
          <View style={[styles.dot, { backgroundColor: theme.danger, borderColor: theme.backgroundElement }]} />
        )}
      </View>
      <ThemedText
        type={isFocused ? 'smallBold' : 'small'}
        themeColor={isFocused ? 'text' : 'textSecondary'}
        numberOfLines={1}
        style={styles.label}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const INDICATOR_INSET = Spacing.one;
const TAB_HEIGHT = 44;

function TabBar({ tabs, ...props }: TabListProps & { tabs: AppTab[] }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const pathname = usePathname();
  const activeIndex = activeIndexForPath(pathname, tabs);

  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth / tabs.length;
  const translateX = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (barWidth === 0) return;
    translateX.value = withTiming(tabWidth * activeIndex + INDICATOR_INSET, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, barWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, Spacing.two),
        },
      ]}>
      <View {...props} onLayout={handleLayout} style={styles.row}>
        {barWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              indicatorStyle,
              { width: tabWidth - INDICATOR_INSET * 2, backgroundColor: theme.backgroundSelected },
            ]}
          />
        )}
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: TAB_HEIGHT,
    borderRadius: Radii.pill,
  },
  tabButton: {
    flex: 1,
    minHeight: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
  },
  iconWrap: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
