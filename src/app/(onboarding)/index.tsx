import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Magne } from '@/components/magneten/magne';
import { getDraft, updateDraft, type HomeChoice } from '@/components/magneten/onboarding/draft';
import { Spacer, StepDots } from '@/components/magneten/onboarding/parts';
import { Button, Screen } from '@/components/magneten/ui';
import { FontFamily, MemberColors } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { takePendingInviteCode } from '@/lib/pending-invite';
import { useMeState } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

const CHOICES: { key: HomeChoice; pin: string; tilt: number }[] = [
  { key: 'family', pin: '', tilt: -1.5 },
  { key: 'couple', pin: MemberColors[0], tilt: 1.5 },
  { key: 'twoHomes', pin: MemberColors[2], tilt: 1 },
  { key: 'shared', pin: MemberColors[1], tilt: -1 },
];

/** Step 1: who lives together. Also the way in for someone holding an invite code. */
export default function HomeTypeStep() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { current } = useMeState();
  const [choice, setChoice] = useState<HomeChoice>(getDraft().choice);

  useEffect(() => {
    // An invite link opened before signing in: go and accept it.
    const pending = takePendingInviteCode();
    if (pending) {
      router.push({ pathname: '/join/[code]', params: { code: pending } });
      return;
    }
    // Restarted after the household was made: carry on from the invitation.
    if (current) router.replace('/onboarding/invite');
    // Only on arrival - a household created in step 3 must not yank this screen around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => {
    updateDraft({ choice });
    router.push('/onboarding/you');
  };

  return (
    <Screen contentStyle={styles.content}>
      <StepDots step={1} />

      <View style={styles.hello}>
        <Magne pose="hei" size={104} />
        <View style={[styles.bubble, { backgroundColor: tokens.paper }]}>
          <Text style={[styles.bubbleText, { color: tokens.paperInk }]} accessibilityRole="header">
            {t('onboarding.type.magne')}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {CHOICES.map((c) => {
          const selected = c.key === choice;
          return (
            <Pressable
              key={c.key}
              onPress={() => {
                Feel.tick();
                setChoice(c.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(`onboarding.type.${c.key}.title`)}. ${t(`onboarding.type.${c.key}.sub`)}`}
              style={[styles.cell, { transform: [{ rotate: `${c.tilt}deg` }] }]}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: selected ? tokens.paperYellow : tokens.paper,
                    borderColor: selected ? tokens.text : 'transparent',
                  },
                ]}>
                <Text style={[styles.cardTitle, { color: tokens.paperInk }]}>{t(`onboarding.type.${c.key}.title`)}</Text>
                <Text style={[styles.cardSub, { color: tokens.textSecondary }]}>{t(`onboarding.type.${c.key}.sub`)}</Text>
              </View>
              <View style={[styles.pin, { backgroundColor: c.pin || tokens.magne }]} />
            </Pressable>
          );
        })}
      </View>

      <Spacer />

      <Text style={[styles.hint, { color: tokens.textSecondary }]}>{t('onboarding.type.hint')}</Text>
      <Button label={t('actions.next')} onPress={next} />
      <Button variant="outline" label={t('onboarding.type.haveCode')} onPress={() => router.push('/onboarding/code')} style={styles.ghost} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  hello: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 12 },
  bubble: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    marginBottom: 58,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bubbleText: { fontFamily: FontFamily.hand, fontSize: 21, lineHeight: 25 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18, paddingTop: 14 },
  cell: { width: '48%', paddingTop: 9 },
  card: {
    minHeight: 112,
    paddingTop: 22,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
    borderWidth: 3,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: { fontFamily: FontFamily.hand, fontSize: 20, lineHeight: 23 },
  cardSub: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  pin: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    elevation: 4,
  },
  hint: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  ghost: { minHeight: 44 },
});
