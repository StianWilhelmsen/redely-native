import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadChat, useUnreadPayments } from '@/hooks/use-unread';

type AppTab = {
  name: string;
  href: '/' | '/shopping' | '/chat' | '/kollektiv' | '/me';
  label: string;
  /** Outline when idle, solid when selected - the weight change is what marks the tab,
   *  now that there is no pill sliding behind it. */
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TABS: AppTab[] = [
  { name: 'home', href: '/', label: 'Hjem', icon: 'home-outline', iconActive: 'home' },
  { name: 'shopping', href: '/shopping', label: 'Handle', icon: 'cart-outline', iconActive: 'cart' },
  { name: 'chat', href: '/chat', label: 'Chat', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { name: 'kollektiv', href: '/kollektiv', label: 'Kollektiv', icon: 'people-outline', iconActive: 'people' },
  { name: 'me', href: '/me', label: 'Meg', icon: 'person-outline', iconActive: 'person' },
];

const COLLECTIVE_ONLY_PATHS = ['/shopping', '/chat', '/kollektiv'];

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
    // key: expo-router's tab navigator registers its triggers when it mounts - adding
    // Handleliste/Chat/Kollektiv to the list after the fact (right after creating a
    // collective) renders buttons the navigator doesn't know about, so taps do nothing
    // until the app restarts. Remounting when the tab set changes re-registers them.
    <Tabs key={hasCollective ? 'with-collective' : 'no-collective'}>
      <TabSlot />
      <TabList asChild>
        <TabBar tabs={tabs}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton
                icon={tab.icon}
                iconActive={tab.iconActive}
                showDot={!!showDot[tab.name]}>
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
  iconActive,
  showDot,
  ...props
}: TabTriggerSlotProps & {
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  showDot?: boolean;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  // A short dip-and-settle when a tab becomes the active one. Small on purpose: the tab
  // bar is furniture, and furniture that performs gets tiring by the tenth tap.
  useEffect(() => {
    if (!isFocused) return;
    scale.value = withSequence(
      withTiming(0.9, { duration: 80 }),
      withSpring(1, { damping: 18, stiffness: 240 })
    );
  }, [isFocused, scale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable {...props} style={styles.tabButton}>
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Ionicons
          name={isFocused ? iconActive : icon}
          size={22}
          color={isFocused ? theme.text : theme.textSecondary}
        />
        {showDot && (
          <View style={[styles.dot, { backgroundColor: theme.danger, borderColor: theme.background }]} />
        )}
      </Animated.View>
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

const TAB_HEIGHT = 44;

function TabBar({ ...props }: TabListProps & { tabs: AppTab[] }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, Spacing.two),
        },
      ]}>
      <View {...props} style={styles.row}>
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
