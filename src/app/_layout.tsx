import { Kalam_400Regular, Kalam_700Bold } from '@expo-google-fonts/kalam';
import {
  RethinkSans_400Regular,
  RethinkSans_500Medium,
  RethinkSans_600SemiBold,
  RethinkSans_700Bold,
  RethinkSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/rethink-sans';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { OfflineBanner } from '@/components/offline-banner';
import { FontFamily } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { restoreLanguageSetting } from '@/i18n';
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

/** The door while it loads: Magne pulling, one line of text. */
function Waiting({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <View style={[styles.center, { backgroundColor: tokens.door }]}>
      <Magne pose={error ? 'lurer' : 'trekker'} size={110} />
      <Text style={[styles.waitText, { color: tokens.textSecondary }]}>
        {error ? errorMessage(error) : t('loading')}
      </Text>
      {error && onRetry ? (
        <Text onPress={onRetry} accessibilityRole="button" style={[styles.retry, { color: tokens.text }]}>
          {t('actions.retry')}
        </Text>
      ) : null}
    </View>
  );
}

/** Everything that needs a signed-in user: push token, notification taps. */
function SignedInEffects() {
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
 * The three worlds, each behind a guard:
 * signed out → (auth); signed in without a household (or mid-onboarding) → (onboarding);
 * otherwise → the tabs and everything opened from them.
 */
function SignedInNavigator() {
  const { me, meError, meLoading, mutateMe, current } = useMeState();
  const onboardingActive = useOnboardingActive();

  if (!me || meLoading || onboardingActive === undefined) {
    return <Waiting error={me ? undefined : meError} onRetry={() => mutateMe()} />;
  }

  const inOnboarding = !current || onboardingActive;

  return (
    <>
      <SignedInEffects />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={inOnboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={!inOnboarding}>
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
        {/* Reachable from a link whether or not you already have a household. */}
        <Stack.Screen name="join/[code]" />
        <Stack.Screen name="legal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="design" />
      </Stack>
    </>
  );
}

function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    ensurePurchasesConfigured();
  }, []);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return null;

  if (status === 'signedOut') {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="join/[code]" />
        <Stack.Screen name="legal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="design" />
      </Stack>
    );
  }

  return (
    <HouseholdProvider>
      <HouseholdSocketProvider>
        <SignedInNavigator />
      </HouseholdSocketProvider>
    </HouseholdProvider>
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
            <RootNavigator />
            <OfflineBanner />
          </AuthProvider>
        </NavigationTheme>
      </PaletteProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  waitText: {
    fontFamily: FontFamily.hand,
    fontSize: 20,
    textAlign: 'center',
  },
  retry: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    padding: 10,
  },
});

const errorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DCE6E8' },
  content: { padding: 24, paddingTop: 80, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1B2326' },
  message: { fontSize: 15, color: '#B92C1A' },
  stack: { fontSize: 11, color: '#55666B', fontFamily: 'Courier' },
});
