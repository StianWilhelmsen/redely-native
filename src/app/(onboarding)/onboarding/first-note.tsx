import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSWRConfig } from 'swr';

import { api, errorMessage, keys, type NoteInput, type PaperDto } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { Note } from '@/components/magneten/note';
import { draftAdultNames, resetDraft } from '@/components/magneten/onboarding/draft';
import { ideasFor, paperOf, type WhenKey } from '@/components/magneten/onboarding/ideas';
import { ErrorText, MiniDoor, Spacer, StepDots } from '@/components/magneten/onboarding/parts';
import { Button, Field, Screen } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { useMeState } from '@/state/household';
import { setOnboardingActive } from '@/state/onboarding-flag';
import { usePalette } from '@/theme/palette-context';

type Placed = { title: string; when: WhenKey | null; paper: PaperDto; run: number };

/** Step 6: one real note smacks onto a mini door, then off to the real one. */
export default function FirstNoteStep() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { current } = useMeState();
  const { mutate } = useSWRConfig();
  const hid = current?.householdId;
  const ideas = ideasFor(current?.type);
  const adults = draftAdultNames();

  const [own, setOwn] = useState('');
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [run, setRun] = useState(0);
  const [cheer, setCheer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Magne shouts "smack" with the note, then settles into a cheer.
  useEffect(() => {
    if (!placed) return;
    const timer = setTimeout(() => setCheer(true), 700);
    return () => clearTimeout(timer);
  }, [placed]);

  const pin = async (title: string, when: WhenKey | null, paper: PaperDto, extra: Omit<NoteInput, 'title'> = {}) => {
    if (!hid || !title.trim()) return;
    const nextRun = run + 1;
    setRun(nextRun);
    setError(null);
    // On the door at once; the request catches up.
    setCheer(false);
    setPlaced({ title: title.trim(), when, paper, run: nextRun });
    try {
      await api.notes.create(hid, { title: title.trim(), paper, ...extra });
      mutate(keys.notes(hid));
      setOwn('');
    } catch (e) {
      setPlaced(null);
      setError(errorMessage(e));
    }
  };

  const finish = () => {
    resetDraft();
    setOnboardingActive(false);
    router.replace('/');
  };

  const member = current
    ? { name: current.displayName, color: current.color, photoUrl: current.photoUrl }
    : { name: '', color: tokens.textSecondary };

  return (
    <Screen contentStyle={styles.content}>
      <StepDots step={6} />

      <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header" accessibilityLiveRegion="polite">
        {placed ? t('onboarding.first.doneTitle') : t('onboarding.first.title')}
      </Text>
      <Text style={[styles.sub, { color: tokens.textSecondary }]}>
        {placed
          ? adults.length === 1
            ? t('onboarding.first.doneSub', { name: adults[0] })
            : t('onboarding.first.doneSubGeneric')
          : t('onboarding.first.sub')}
      </Text>

      <MiniDoor shakeKey={placed?.run ?? 0} style={styles.door}>
        {placed ? (
          <View style={styles.noteSlot}>
            <Note
              key={placed.run}
              smackIn
              title={placed.title}
              meta={placed.when ? t(`onboarding.first.when.${placed.when}`) : undefined}
              paper={paperOf(placed.paper)}
              tilt={-2}
              member={member}
            />
          </View>
        ) : (
          <Text style={[styles.empty, { color: tokens.textSecondary }]}>{t('onboarding.first.empty')}</Text>
        )}
        <View style={styles.magne} pointerEvents="none">
          <Magne pose={placed ? (cheer ? 'jubler' : 'glad') : 'hei'} size={70} />
        </View>
      </MiniDoor>

      {placed ? (
        <>
          <Spacer />
          <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.actions}>
            <Button label={t('onboarding.first.goToDoor')} onPress={finish} />
            <Button variant="ghost" label={t('onboarding.first.another')} onPress={() => setPlaced(null)} style={styles.ghost} />
          </Animated.View>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('onboarding.first.pick')}</Text>
          <View style={styles.chips}>
            {ideas.map((idea) => (
              <Pressable
                key={idea.key}
                accessibilityRole="button"
                onPress={() => {
                  Feel.tick();
                  pin(t(`onboarding.first.ideas.${idea.key}`), idea.when, idea.paper, idea.input());
                }}
                style={({ pressed }) => [
                  styles.idea,
                  { borderColor: tokens.text, backgroundColor: tokens.paper, opacity: pressed ? 0.8 : 1 },
                ]}>
                <Text style={[styles.ideaText, { color: tokens.text }]}>{t(`onboarding.first.ideas.${idea.key}`)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.ownRow}>
            <Field
              label={t('onboarding.first.ownLabel')}
              value={own}
              onChangeText={setOwn}
              placeholder={t('onboarding.first.ownPlaceholder')}
              maxLength={200}
              returnKeyType="done"
              onSubmitEditing={() => pin(own, null, 'WHITE')}
              style={styles.flex}
            />
            <Button label={t('onboarding.first.pin')} onPress={() => pin(own, null, 'WHITE')} disabled={!own.trim()} style={styles.pinButton} />
          </View>
          <ErrorText>{error}</ErrorText>
          <Spacer />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  flex: { flex: 1 },
  title: { fontFamily: FontFamily.hand, fontSize: 30, lineHeight: 34, marginTop: 6 },
  sub: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: -8 },
  door: { height: 260, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  noteSlot: { width: 190 },
  empty: { fontFamily: FontFamily.handRegular, fontSize: 20 },
  magne: { position: 'absolute', left: 10, bottom: -6 },
  label: { fontFamily: FontFamily.bold, fontSize: 13, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  idea: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  ideaText: { fontFamily: FontFamily.bold, fontSize: 14 },
  ownRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  pinButton: { borderRadius: 14, paddingVertical: 14 },
  actions: { gap: 6 },
  ghost: { minHeight: 44 },
});
