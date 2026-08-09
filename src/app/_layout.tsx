import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { AppState, ScrollView, StyleSheet, Text } from 'react-native';
import useSWR, { useSWRConfig } from 'swr';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OfflineBanner } from '@/components/offline-banner';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedView } from '@/components/themed-view';
import { WeeklySummaryGate } from '@/components/weekly-summary-gate';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { CollectiveSocketProvider, useCollectiveEvent } from '@/lib/collective-socket';
import { syncPushTokenIfGranted } from '@/lib/push-notifications';
import { ensurePurchasesConfigured, syncPurchasesIdentity } from '@/lib/purchases';
import { PaletteProvider, usePalette } from '@/theme/palette-context';

SplashScreen.preventAutoHideAsync();

// Without a handler, a push arriving while the app is open is swallowed entirely -
// no banner, no sound, and (crucially) the payload's badge count is never applied.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * If anything throws during render, show the error on screen instead of silently
 * hanging on the splash - production builds have no dev overlay, so without this a
 * render crash is indistinguishable from an infinite splash.
 */
class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() {
    SplashScreen.hideAsync().catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={errorStyles.root} contentContainerStyle={errorStyles.content}>
          <Text style={errorStyles.title}>Noe gikk galt</Text>
          <Text style={errorStyles.message}>{String(this.state.error?.message ?? this.state.error)}</Text>
          <Text style={errorStyles.stack}>{this.state.error?.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function NavigationTheme({ children }: { children: ReactNode }) {
  const { tokens, scheme } = usePalette();

  return (
    <ThemeProvider
      value={{
        dark: scheme === 'dark',
        fonts: DefaultTheme.fonts,
        colors: {
          primary: tokens.brand,
          background: tokens.background,
          card: tokens.backgroundElement,
          text: tokens.text,
          border: tokens.border,
          notification: tokens.danger,
        },
      }}>
      {children}
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  const { data: me } = useSWR(status === 'signedIn' ? 'me' : null, api.me);
  const { mutate } = useSWRConfig();
  const meId = me?.id;
  const collectiveId = me?.collective?.id;

  // Configuring the SDK doesn't depend on being signed in - do it as early as the app
  // renders anything, same reasoning as RevenueCat's own setup guidance. Identity only
  // syncs once a collective is known, since that (not the user) is who's billed - see
  // src/lib/purchases.ts.
  useEffect(() => {
    ensurePurchasesConfigured();
  }, []);

  useEffect(() => {
    if (!collectiveId) return;
    syncPurchasesIdentity(collectiveId).catch((error) => {
      console.warn('Could not sync purchases identity', error);
    });
  }, [collectiveId]);

  // Pushed the instant RevenueCatWebhookController finishes processing a purchase -
  // without this, billing status only caught up whenever something else happened to
  // revalidate it (reopening the sheet, a poll interval), which read as "nothing updated"
  // right after a purchase that had, in fact, gone through.
  useCollectiveEvent('SUBSCRIPTION_UPDATED', () => {
    mutate('billing-status');
  });

  useEffect(() => {
    if (status !== 'signedIn' || !meId) return;

    const syncToken = () => {
      syncPushTokenIfGranted().catch((error) => {
        console.warn('Could not sync push token', error);
      });
    };

    syncToken();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') syncToken();
    });
    return () => subscription.remove();
  }, [status, meId]);

  useEffect(() => {
    if (status !== 'signedIn' || !meId) return;

    const redirect = (notification: Notifications.Notification): boolean => {
      const url = notification.request.content.data?.url;
      if (typeof url !== 'string' || !url.startsWith('/weekly-summary')) return false;

      const weekStart = /[?&]weekStart=(\d{4}-\d{2}-\d{2})/.exec(url)?.[1];
      router.push({
        pathname: '/weekly-summary',
        params: weekStart ? { weekStart } : {},
      });
      return true;
    };

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification && redirect(lastResponse.notification)) {
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });
    return () => subscription.remove();
  }, [status, meId]);

  const stillResolvingProfile = status === 'signedIn' && !me;

  if (status === 'loading' || stillResolvingProfile) {
    return (
      <ThemedView style={styles.loading}>
        <Image
          source={require('@/assets/images/android-icon-foreground.png')}
          style={styles.loadingMark}
          contentFit="contain"
        />
        <RefreshSpinner active />
      </ThemedView>
    );
  }

  const needsOnboarding = status === 'signedIn' && !!me && !me.onboarded;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'signedIn' && !needsOnboarding}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="collective-settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="notification-settings" options={{ presentation: 'card' }} />
          {/* Full screen, not a sheet: the weekly story is edge-to-edge and paints its
              own background all the way into the safe areas. */}
          <Stack.Screen name="weekly-summary" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="tasks" options={{ presentation: 'modal' }} />
          <Stack.Screen name="expenses" options={{ presentation: 'modal' }} />
          <Stack.Screen name="starter-pack" options={{ presentation: 'modal' }} />
          <Stack.Screen name="weeks" options={{ presentation: 'modal' }} />
        </Stack.Protected>

        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {status === 'signedIn' && !needsOnboarding && meId ? <WeeklySummaryGate userId={meId} /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  // Failsafe: never let font loading strand the user on the native splash. If fonts
  // haven't resolved either way within 3s, render anyway with system font fallbacks.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Native splash stays visible (preventAutoHideAsync) until fonts are in - but a
  // font *error* (or hang) must not block rendering forever.
  if (!fontsLoaded && !fontError && !fontTimeout) {
    return null;
  }

  return (
    <RootErrorBoundary>
      <PaletteProvider>
        <NavigationTheme>
          <AuthProvider>
            <CollectiveSocketProvider>
              <AnimatedSplashOverlay />
              <RootNavigator />
              <OfflineBanner />
            </CollectiveSocketProvider>
          </AuthProvider>
        </NavigationTheme>
      </PaletteProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingMark: {
    width: 72,
    height: 72,
  },
});

const errorStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5EEE1',
  },
  content: {
    padding: 24,
    paddingTop: 80,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  message: {
    fontSize: 15,
    color: '#B3261E',
  },
  stack: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'Courier',
  },
});
