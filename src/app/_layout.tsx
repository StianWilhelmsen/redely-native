import { Kalam_400Regular, Kalam_700Bold } from '@expo-google-fonts/kalam';
import {
  RethinkSans_400Regular,
  RethinkSans_500Medium,
  RethinkSans_600SemiBold,
  RethinkSans_700Bold,
  RethinkSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/rethink-sans';
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { AppState, ScrollView, StyleSheet, Text } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { restoreLanguageSetting } from '@/i18n';
import { takePendingInviteCode } from '@/lib/pending-invite';
import { syncPushTokenIfGranted } from '@/lib/push-notifications';
import { ensurePurchasesConfigured } from '@/lib/purchases';
import { HouseholdProvider, useMeState } from '@/state/household';
import { HouseholdSocketProvider } from '@/state/household-socket';
import { useOnboardingActive } from '@/state/onboarding-flag';
import { PaletteProvider, usePalette } from '@/theme/palette-context';

SplashScreen.preventAutoHideAsync();
// A language picked in an earlier session; until it is read, the phone's language shows.
restoreLanguageSetting().catch(() => {});

// Without a handler, a push arriving while the app is open is swallowed entirely.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Production builds have no dev overlay, so a render crash would otherwise look like an
 * endless splash. Show it instead.
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
          <Text style={errorStyles.title}>Noe gikk galt / Something went wrong</Text>
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
          primary: tokens.magne,
          background: tokens.door,
          card: tokens.door,
          text: tokens.text,
          border: tokens.border,
          notification: tokens.magne,
        },
      }}>
      {children}
    </ThemeProvider>
  );
}

/** Everything that needs a signed-in user: push token, notification taps, invite links. */
function SignedInEffects({ onDoor }: { onDoor: boolean }) {
  // An invite link opened while signed out is parked until sign-in. Someone without a
  // household picks it up in onboarding; someone who already has one is sent to join here.
  useEffect(() => {
    if (!onDoor) return;
    const code = takePendingInviteCode();
    if (code) router.push({ pathname: '/join/[code]', params: { code } });
  }, [onDoor]);

  useEffect(() => {
    const sync = () => syncPushTokenIfGranted().catch((e) => console.warn('Could not sync push token', e));
    sync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const open = (n: Notifications.Notification) => {
      const data = n.request.content.data as { noteId?: string; eventId?: string } | undefined;
      if (data?.noteId) router.push({ pathname: '/note/[id]', params: { id: data.noteId } });
      else if (data?.eventId) router.push({ pathname: '/event/[id]', params: { id: data.eventId } });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, []);

  return null;
}

/**
 * One navigator for the whole app, with guards deciding which routes exist:
 * still loading → "waiting"; signed out → (auth); signed in without a household (or
 * mid-onboarding) → (onboarding); otherwise the tabs and everything opened from them.
 *
 * It must stay ONE <Stack>: swapping navigators on sign-in left the user stranded on the
 * code screen, because the router kept the old route. With guards, the router itself
 * moves people to the first route that just became available.
 */
function RootNavigator() {
  const { status } = useAuth();
  const { me, meLoading, current } = useMeState();
  const onboardingActive = useOnboardingActive();

  useEffect(() => {
    ensurePurchasesConfigured();
  }, []);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  const signedIn = status === 'signedIn';
  const ready =
    status === 'signedOut' || (signedIn && !!me && !meLoading && onboardingActive !== undefined);
  const inOnboarding = !current || !!onboardingActive;

  return (
    <>
      {signedIn && ready ? <SignedInEffects onDoor={!inOnboarding} /> : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!ready}>
          <Stack.Screen name="waiting" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={ready && status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={ready && signedIn && inOnboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={ready && signedIn && !inOnboarding}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="note/[id]" />
          <Stack.Screen name="note/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="event/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="list/[id]" />
          <Stack.Screen name="shop/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="activity" />
          <Stack.Screen name="me" />
          <Stack.Screen name="areas" />
          <Stack.Screen name="member/[id]" />
          <Stack.Screen name="kid/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pluss" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* Reachable from a link whether or not you are signed in or have a household. */}
        <Stack.Screen name="join/[code]" />
        <Stack.Screen name="legal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="design" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    RethinkSans_400Regular,
    RethinkSans_500Medium,
    RethinkSans_600SemiBold,
    RethinkSans_700Bold,
    RethinkSans_800ExtraBold,
    Kalam_400Regular,
    Kalam_700Bold,
  });

  // Never strand anyone on the native splash: after 3 s render with system fonts.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded && !fontError && !fontTimeout) return null;

  return (
    <RootErrorBoundary>
      <PaletteProvider>
        <NavigationTheme>
          <AuthProvider>
            <HouseholdProvider>
              <HouseholdSocketProvider>
                <RootNavigator />
                <OfflineBanner />
              </HouseholdSocketProvider>
            </HouseholdProvider>
          </AuthProvider>
        </NavigationTheme>
      </PaletteProvider>
    </RootErrorBoundary>
  );
}

const errorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DCE6E8' },
  content: { padding: 24, paddingTop: 80, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1B2326' },
  message: { fontSize: 15, color: '#B92C1A' },
  stack: { fontSize: 11, color: '#55666B', fontFamily: 'Courier' },
});
