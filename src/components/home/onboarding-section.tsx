import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

/** Invite codes are 5 alphanumeric characters (see InviteService on the backend). */
const CODE_LENGTH = 5;

const NAME_SUGGESTIONS = ['Kollektivet på Grünerløkka', 'Sofienberg 12', 'Hjemme'];

type Props = {
  onDone: () => void;
};

export function OnboardingSection({ onDone }: Props) {
  const theme = useTheme();
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const [collectiveName, setCollectiveName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const codeInputRef = useRef<TextInput>(null);

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
    const code = inviteCode.trim();
    if (code.length < CODE_LENGTH) {
      setJoinError('Koden er på fem tegn.');
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

  // The keyboard (or a paste) can hand us anything - normalize here so the cells only
  // ever render characters a code can actually contain.
  const handleCodeChange = (raw: string) => {
    setInviteCode(
      raw
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, CODE_LENGTH)
    );
    if (joinError) setJoinError(null);
  };

  return (
    <View style={styles.stack}>
      <View style={[styles.modePicker, { backgroundColor: theme.backgroundElement }]}>
        {(
          [
            { key: 'create', label: 'Opprett nytt' },
            { key: 'join', label: 'Bli med' },
          ] as const
        ).map((option) => {
          const selected = mode === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setMode(option.key)}
              style={[styles.modeButton, selected && { backgroundColor: theme.brand }]}>
              <ThemedText
                type="smallBold"
                style={{ color: selected ? theme.onBrand : theme.textSecondary }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {mode === 'create' ? (
        <View style={styles.form}>
          <View style={styles.formHeading}>
            <ThemedText type="heading">Gi kollektivet et navn</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Du kan endre navnet og invitere resten av gjengen etterpå.
            </ThemedText>
          </View>

          <TextInput
            value={collectiveName}
            onChangeText={(text) => {
              setCollectiveName(text);
              if (createError) setCreateError(null);
            }}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            onSubmitEditing={handleCreate}
            placeholder="F.eks. Kollektivet på Grünerløkka"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            maxLength={60}
            style={[
              styles.nameInput,
              { color: theme.text, borderBottomColor: nameFocused ? theme.brand : theme.border },
            ]}
          />

          <View style={styles.suggestions}>
            {NAME_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                onPress={() => {
                  setCollectiveName(suggestion);
                  if (createError) setCreateError(null);
                }}
                style={({ pressed }) => [
                  styles.suggestion,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="small" numberOfLines={1}>
                  {suggestion}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {createError && (
            <ThemedText type="small" themeColor="danger">
              {createError}
            </ThemedText>
          )}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={[styles.ctaGlow, { backgroundColor: theme.brand, shadowColor: theme.brand }]}>
            <PrimaryButton
              label="Opprett kollektiv"
              onPress={handleCreate}
              loading={creating}
              size="large"
            />
          </View>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.formHeading}>
            <ThemedText type="heading">Skriv inn invitasjonskoden</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Den som opprettet kollektivet finner koden under innstillinger.
            </ThemedText>
          </View>

          {/* One real input drives all five cells: it sits invisibly on top of the row so
              caret, paste and backspace behave like in a normal text field. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invitasjonskode"
            onPress={() => codeInputRef.current?.focus()}
            style={styles.codeRow}>
            {Array.from({ length: CODE_LENGTH }, (_, i) => {
              const char = inviteCode[i] ?? '';
              const active = codeFocused && i === Math.min(inviteCode.length, CODE_LENGTH - 1);
              return (
                <View
                  key={i}
                  style={[
                    styles.codeCell,
                    {
                      backgroundColor: char ? `${theme.brand}1F` : theme.backgroundElement,
                      borderColor: active ? theme.brand : char ? `${theme.brand}55` : theme.border,
                      borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <ThemedText style={[styles.codeChar, { color: theme.text }]}>{char}</ThemedText>
                </View>
              );
            })}

            <TextInput
              ref={codeInputRef}
              value={inviteCode}
              onChangeText={handleCodeChange}
              onFocus={() => setCodeFocused(true)}
              onBlur={() => setCodeFocused(false)}
              onSubmitEditing={handleJoin}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              maxLength={CODE_LENGTH}
              returnKeyType="done"
              caretHidden
              style={styles.codeInputOverlay}
            />
          </Pressable>

          {joinError ? (
            <ThemedText type="small" themeColor="danger">
              {joinError}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Fant du ikke koden? Be om en ny fra en du bor med.
            </ThemedText>
          )}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={[styles.ctaGlow, { backgroundColor: theme.brand, shadowColor: theme.brand }]}>
            <PrimaryButton
              label="Bli med i kollektivet"
              onPress={handleJoin}
              loading={joining}
              size="large"
            />
          </View>
        </View>
      )}

      <View style={styles.reassurance}>
        <View style={[styles.reassuranceDot, { backgroundColor: theme.brand }]} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.reassuranceText}>
          Nye kollektiv får én måned gratis. Ingen betaling kreves nå.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.four,
  },
  modePicker: {
    flexDirection: 'row',
    borderRadius: Radii.pill,
    padding: Spacing.one + Spacing.half,
    gap: Spacing.one,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.three,
  },
  formHeading: {
    gap: Spacing.one,
  },
  nameInput: {
    fontFamily: FontFamily.medium,
    fontSize: 18,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: 0,
    borderBottomWidth: 2,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  suggestion: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
  codeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  codeCell: {
    flex: 1,
    height: 64,
    borderRadius: Radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: {
    fontFamily: FontFamily.semiBold,
    fontSize: 24,
    lineHeight: 32,
  },
  // Invisible, but it is the field that actually holds focus - it has to cover the
  // cells so a tap anywhere on the row lands on the input itself.
  codeInputOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    fontSize: 24,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
  },
  ctaGlow: {
    borderRadius: 24,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  reassurance: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  reassuranceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  reassuranceText: {
    flexShrink: 1,
  },
});
