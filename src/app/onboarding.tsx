import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

const STEP_COUNT = 3;

type PickedImage = { uri: string; name: string; type: string };

export default function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me, mutate: mutateMe } = useMe();

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which way the next step should slide in from, so going back reads as going back.
  const [direction, setDirection] = useState<1 | -1>(1);

  const goBack = () => {
    setError(null);
    if (step === 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til bilder for å sette profilbilde.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
    const type = asset.mimeType ?? (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);
    setImage({ uri: asset.uri, name: asset.fileName ?? `profile.${ext}`, type });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const parsedAge = age.trim() ? Number(age.trim()) : undefined;
      await api.completeOnboarding({
        name: firstName.trim(),
        age: parsedAge,
        acceptedTerms: true,
        picture: image ?? undefined,
      });
      await mutateMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setError(null);
    setDirection(1);
    if (step === 0) {
      if (!firstName.trim()) {
        setError('Skriv inn fornavnet ditt.');
        return;
      }
      if (age.trim() && (!/^\d+$/.test(age.trim()) || Number(age.trim()) <= 0)) {
        setError('Skriv inn en gyldig alder.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (!acceptedTerms) {
      setError('Du må godta vilkårene og personvernerklæringen.');
      return;
    }
    handleSubmit();
  };

  const handleSkipPicture = () => {
    setImage(null);
    setDirection(1);
    setStep(2);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.navBar}>
        <Pressable onPress={goBack} disabled={step === 0} hitSlop={Spacing.two} style={styles.backButton}>
          {step > 0 && <Ionicons name="chevron-back" size={20} color={theme.text} />}
        </Pressable>
        <View style={styles.progressRow}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                { backgroundColor: i <= step ? theme.brand : theme.backgroundSelected },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        {/* Remounting on `key={step}` is what replays the entrance animation - without it
            React would reuse the same node and the steps would swap with no transition. */}
        <Animated.View
          key={step}
          entering={(direction === 1 ? FadeInRight : FadeInLeft).duration(260)}
          style={styles.stepBody}>
        {step === 0 && (
          <>
            <ThemedText type="display" style={styles.title}>
              Hvem er du?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Samboerne dine ser dette på profilen din.
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="eyebrow" style={styles.fieldLabel}>
                Fornavn
              </ThemedText>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Fornavn"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="eyebrow" style={styles.fieldLabel}>
                Alder
              </ThemedText>
              <TextInput
                value={age}
                onChangeText={setAge}
                placeholder="Alder (valgfritt)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <ThemedText type="display" style={styles.title}>
              Legg til et bilde
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Gjør det lettere å kjenne deg igjen i kollektivet.
            </ThemedText>

            <Pressable
              onPress={handlePickImage}
              style={[styles.pickerCircle, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              {image ? (
                <Image source={{ uri: image.uri }} style={styles.pickedImage} contentFit="cover" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={28} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.pickerText}>
                    Last opp bilde
                  </ThemedText>
                </>
              )}
            </Pressable>
          </>
        )}

        {step === 2 && (
          <>
            <ThemedText type="display" style={styles.title}>
              Nesten klar
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Les gjennom før du blir med i kollektivet.
            </ThemedText>

            <View style={[styles.termsCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Vilkår for bruk</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsBody}>
                Ved å bli med i Ryddig Kollektiv godtar du at oppgaver, utgifter og aktivitet deles med de
                andre medlemmene i kollektivet ditt. Du kan når som helst forlate kollektivet fra
                innstillinger.
              </ThemedText>
              <ThemedText type="smallBold" style={styles.termsSectionSpacing}>
                Personvern
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.termsBody}>
                Vi lagrer kun det som trengs for å drifte kollektivet — navn, alder, profilbilde og
                aktivitet. Data deles aldri med tredjeparter.
              </ThemedText>
            </View>

            <Pressable onPress={() => setAcceptedTerms((v) => !v)} style={styles.consentRow} hitSlop={Spacing.one}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: acceptedTerms ? theme.brand : theme.border },
                  acceptedTerms && { backgroundColor: theme.brand },
                ]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color={theme.onBrand} />}
              </View>
              <ThemedText type="small" style={styles.consentText}>
                Jeg godtar vilkårene og personvernerklæringen
              </ThemedText>
            </Pressable>
          </>
        )}
        </Animated.View>

        {error && (
          <ThemedText type="small" themeColor="danger" style={styles.error}>
            {error}
          </ThemedText>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton
          label={step < 2 ? 'Neste' : 'Bli med i kollektivet'}
          onPress={handleNext}
          loading={submitting}
          disabled={step === 2 && !acceptedTerms}
        />
        {step === 1 && (
          <Pressable onPress={handleSkipPicture} style={styles.skipButton} hitSlop={Spacing.two}>
            <ThemedText type="small" themeColor="textSecondary">
              Hopp over
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  backButton: {
    width: 24,
    alignItems: 'flex-start',
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  // The step wrapper became the single child of `content`, so it has to carry the spacing
  // that used to come from `content`'s gap between the step's own elements.
  stepBody: {
    gap: Spacing.four,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: -Spacing.two,
  },
  field: {
    gap: Spacing.two,
  },
  fieldLabel: {
    opacity: 0.8,
  },
  input: {
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  pickerCircle: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: Spacing.one,
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  pickerText: {
    textAlign: 'center',
  },
  termsCard: {
    borderRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  termsBody: {
    lineHeight: 20,
  },
  termsSectionSpacing: {
    marginTop: Spacing.two,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  consentText: {
    flex: 1,
  },
  error: {
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.one,
  },
});
