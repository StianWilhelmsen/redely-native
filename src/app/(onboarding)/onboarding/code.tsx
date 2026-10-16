import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Magne } from '@/components/magneten/magne';
import { CodeBoxes } from '@/components/magneten/onboarding/code-boxes';
import { BackButton, ErrorText, Spacer } from '@/components/magneten/onboarding/parts';
import { Button, Screen } from '@/components/magneten/ui';
import { FontFamily } from '@/constants/theme';
import { INVITE_CODE_LENGTH, isCompleteInviteCode, normalizeInviteCode } from '@/lib/invite-code';
import { usePalette } from '@/theme/palette-context';

/** "Jeg har en invitasjonskode": type or paste it, then the join screen takes over. */
export default function InviteCodeEntry() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = (value = code) => {
    if (!isCompleteInviteCode(value)) {
      setError(t('onboarding.code.invalid'));
      return;
    }
    router.push({ pathname: '/join/[code]', params: { code: normalizeInviteCode(value) } });
  };

  return (
    <Screen contentStyle={styles.content}>
      <BackButton />
      <View style={styles.head}>
        <Magne pose="lurer" size={84} />
        <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
          {t('onboarding.code.title')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('onboarding.code.sub')}</Text>
      </View>

      <CodeBoxes
        value={code}
        length={INVITE_CODE_LENGTH}
        onChangeText={(raw) => {
          const next = normalizeInviteCode(raw);
          setCode(next);
          setError(null);
          // A pasted link or a complete code goes straight on.
          if (next.length === INVITE_CODE_LENGTH && raw.length > code.length + 1) go(next);
        }}
        accessibilityLabel={t('onboarding.code.label')}
        keyboardType="default"
        autoCapitalize="characters"
      />
      <ErrorText>{error}</ErrorText>

      <Spacer />
      <Button label={t('onboarding.code.go')} onPress={() => go()} disabled={code.length < INVITE_CODE_LENGTH} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  head: { alignItems: 'center', gap: 6 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 28, lineHeight: 41, textAlign: 'center' },
  sub: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
});
