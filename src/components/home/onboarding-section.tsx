import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

type Props = {
  onDone: () => void;
};

export function OnboardingSection({ onDone }: Props) {
  const theme = useTheme();

  const [collectiveName, setCollectiveName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = collectiveName.trim();
    if (!name) {
      setCreateError('Skriv inn et navn på kollektivet.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api.createCollective(name);
      onDone();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Skriv inn en invitasjonskode.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      await api.joinCollective(code);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setJoinError('Fant ingen kollektiv med den koden.');
      } else if (err instanceof ApiError && err.status === 409) {
        setJoinError('Du er allerede medlem av dette kollektivet.');
      } else {
        setJoinError(err instanceof Error ? err.message : 'Noe gikk galt.');
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.stack}>
      <Card tone="brand">
        <ThemedText type="heading">Start et kollektiv</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Opprett kollektivet og inviter de du bor med etterpå.
        </ThemedText>
        <TextInput
          value={collectiveName}
          onChangeText={setCollectiveName}
          placeholder="F.eks. Kollektivet på Grünerløkka"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
        />
        {createError && (
          <ThemedText type="small" themeColor="danger">
            {createError}
          </ThemedText>
        )}
        <PrimaryButton label="Opprett kollektiv" onPress={handleCreate} loading={creating} />
      </Card>

      <Section title="Har du fått en kode?">
        <ThemedText type="small" themeColor="textSecondary">
          Skriv inn invitasjonskoden for å bli med i et eksisterende kollektiv.
        </ThemedText>
        <View style={styles.joinRow}>
          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="F.eks. 7K2M9"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={5}
            style={[
              styles.input,
              styles.joinInput,
              { backgroundColor: theme.backgroundElement, color: theme.text },
            ]}
          />
          <PrimaryButton label="Bli med" onPress={handleJoin} loading={joining} variant="secondary" />
        </View>
        {joinError && (
          <ThemedText type="small" themeColor="danger">
            {joinError}
          </ThemedText>
        )}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.five,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  joinRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  joinInput: {
    flex: 1,
  },
});
