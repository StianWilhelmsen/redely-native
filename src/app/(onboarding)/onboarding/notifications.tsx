import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Magne } from '@/components/magneten/magne';
import { Spacer, StepDots } from '@/components/magneten/onboarding/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Screen } from '@/components/magneten/ui';
import { FontFamily, MemberColors } from '@/constants/theme';
import { requestAndRegisterPushToken } from '@/lib/push-notifications';
import { usePalette } from '@/theme/palette-context';

/** Step 5: what a push from Magneten looks like, before the system asks. */
export default function NotificationsStep() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const [busy, setBusy] = useState(false);

  const next = () => router.push('/onboarding/first-note');

  const allow = async () => {
    setBusy(true);
    try {
      await requestAndRegisterPushToken();
    } catch (e) {
      // Permission may still have been granted; the token is synced again on next launch.
      console.warn('[onboarding] push registration failed', e);
    } finally {
      setBusy(false);
      next();
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <StepDots step={5} />

      <View style={styles.head}>
        <Magne pose="lurer" size={90} />
        <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
          {t('onboarding.push.title')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('onboarding.push.sub')}</Text>
      </View>

      <View style={styles.list}>
        <Example
          delay={200}
          icon={<PhotoMagnet name={t('onboarding.push.examples.jonas')} color={MemberColors[0]} size={34} />}
          when={t('onboarding.push.examples.pickupWhen')}
          text={t('onboarding.push.examples.pickup')}
        />
        <Example
          delay={500}
          icon={<PhotoMagnet name={t('onboarding.push.examples.emma')} color={MemberColors[2]} size={34} />}
          when={t('onboarding.push.examples.dishesWhen')}
          text={t('onboarding.push.examples.dishes')}
        />
        <Example
          delay={800}
          icon={
            <View style={[styles.magneIcon, { backgroundColor: tokens.door }]}>
              <Magne pose="glad" size={26} />
            </View>
          }
          when={t('onboarding.push.examples.weekWhen')}
          text={t('onboarding.push.examples.week')}
        />
      </View>

      <Spacer />
      <Button label={t('onboarding.push.yes')} onPress={allow} loading={busy} />
      <Button variant="ghost" label={t('onboarding.push.no')} onPress={next} disabled={busy} style={styles.ghost} />
    </Screen>
  );
}

function Example({ delay, icon, when, text }: { delay: number; icon: ReactNode; when: string; text: string }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(500)}
      accessible
      accessibilityLabel={`${when}: ${text}`}
      style={[styles.push, { backgroundColor: tokens.ink }]}>
      {icon}
      <View style={styles.pushText}>
        <Text style={[styles.pushMeta, { color: tokens.onInk }]}>
          {t('onboarding.push.app')} · {when}
        </Text>
        <Text style={[styles.pushBody, { color: tokens.onInk }]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  head: { alignItems: 'center', gap: 4, marginTop: 6 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 28, lineHeight: 41, textAlign: 'center' },
  sub: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
  list: { gap: 10, marginTop: 8 },
  push: { borderRadius: 18, paddingVertical: 11, paddingHorizontal: 13, flexDirection: 'row', gap: 10, alignItems: 'center', opacity: 0.92 },
  pushText: { flex: 1 },
  pushMeta: { fontFamily: FontFamily.bold, fontSize: 11.5, opacity: 0.7 },
  pushBody: { fontFamily: FontFamily.semiBold, fontSize: 14 },
  magneIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ghost: { minHeight: 44 },
});
