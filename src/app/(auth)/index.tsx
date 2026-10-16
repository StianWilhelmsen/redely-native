import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Magne } from '@/components/magneten/magne';
import { Note, type Paper } from '@/components/magneten/note';
import { Later, Spacer, Wordmark } from '@/components/magneten/onboarding/parts';
import { Button, Screen } from '@/components/magneten/ui';
import { FontFamily, MemberColors } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

type DemoNote = {
  title: 'drop' | 'meeting' | 'football' | 'taco';
  person: 'jonas' | 'ingrid' | 'emma' | 'oskar';
  color: string;
  paper: Paper;
  tilt: number;
  delay: number;
  pos: { left?: number; right?: number; top: number; width: number };
};

const NOTES: DemoNote[] = [
  { title: 'drop', person: 'jonas', color: MemberColors[0], paper: 'white', tilt: -4, delay: 200, pos: { left: 8, top: 18, width: 132 } },
  { title: 'meeting', person: 'ingrid', color: MemberColors[4], paper: 'yellow', tilt: 3, delay: 500, pos: { right: 6, top: 4, width: 138 } },
  { title: 'football', person: 'emma', color: MemberColors[2], paper: 'mint', tilt: 2, delay: 800, pos: { left: 24, top: 150, width: 128 } },
  { title: 'taco', person: 'oskar', color: MemberColors[3], paper: 'pink', tilt: -2, delay: 1100, pos: { right: 20, top: 140, width: 128 } },
];

/** Signed out, first thing anyone sees: notes smacking onto a door, Magne waving. */
export default function Welcome() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  // Tapping the wordmark replays the whole entrance.
  const [run, setRun] = useState(0);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.top}>
        <Wordmark onPress={() => setRun((r) => r + 1)} />
      </View>

      <View key={run} style={styles.door}>
        {NOTES.map((n) => (
          <Later key={n.title} delay={n.delay}>
            <View style={[styles.noteSlot, n.pos]}>
              <Note
                smackIn
                title={t(`auth.welcome.notes.${n.title}`)}
                member={{ name: t(`auth.welcome.people.${n.person}`), color: n.color }}
                paper={n.paper}
                tilt={n.tilt}
              />
            </View>
          </Later>
        ))}
        <Animated.View entering={FadeInUp.delay(1400).duration(500)} style={styles.magne}>
          <Magne pose="hei" size={100} />
        </Animated.View>
      </View>

      <Animated.View key={`text-${run}`} entering={FadeInUp.delay(1600).duration(500)} style={styles.copy}>
        <Text style={[styles.headline, { color: tokens.text }]} accessibilityRole="header">
          {t('auth.welcome.headline')}
        </Text>
        <Text style={[styles.body, { color: tokens.textSecondary }]}>{t('auth.welcome.body')}</Text>
      </Animated.View>

      <Spacer />

      <Animated.View entering={FadeInUp.delay(1800).duration(500)} style={styles.actions}>
        <Button label={t('auth.welcome.start')} onPress={() => router.push('/sign-in')} />
        <Button
          variant="ghost"
          label={t('auth.welcome.haveAccount')}
          onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'login' } })}
          style={styles.secondary}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24 },
  top: { marginTop: 36 },
  door: { height: 330, marginTop: 22 },
  noteSlot: { position: 'absolute' },
  magne: { position: 'absolute', left: '50%', bottom: -6, marginLeft: -50 },
  copy: { alignItems: 'center', gap: 8, marginTop: 30 },
  headline: { fontFamily: FontFamily.hand, fontSize: 34, lineHeight: 38, textAlign: 'center' },
  body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  actions: { gap: 6 },
  secondary: { minHeight: 44 },
});
