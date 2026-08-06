import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A thin banner pinned to the top of the screen whenever the device has no usable
 * network connection. Without this, every screen just shows its own generic
 * ErrorState independently on each failed fetch, which reads as scattered random
 * failures rather than one coherent "you're offline" state.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null while NetInfo is still determining it -
      // only treat that as offline once we have a definite "no" from either signal.
      const hasConnection = state.isConnected !== false && state.isInternetReachable !== false;
      setOffline(!hasConnection);
    });
    return unsubscribe;
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(offline ? 36 + insets.top : 0, { duration: 220 }),
    opacity: withTiming(offline ? 1 : 0, { duration: 220 }),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, animatedStyle, { backgroundColor: theme.danger, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={14} color={theme.onBrand} />
        <ThemedText type="small" style={[styles.text, { color: theme.onBrand }]}>
          Ingen internettforbindelse
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    overflow: 'hidden',
  },
  content: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  text: {
    fontSize: 12,
  },
});
