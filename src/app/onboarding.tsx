import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/constants/legal';
import { Control, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@/lib/invite-code';
import { forgetProviderName, getRememberedProviderName } from '@/lib/provider-profile';

const STEP_COUNT = 2;

type PickedImage = { uri: string; name: string; type: string };

/** The field asks for a first name; providers hand over a full one. */
function firstNameOf(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? '';
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me, mutate: mutateMe } = useMe();
  // Straight off the session's user_metadata - what the identity provider itself said,
  // before /api/me gets a chance to substitute a placeholder for it.
  const providerName = useAuth().user?.name;

  // Someone who already has a profile but no collective (they left one, or the app was
  // updated mid-flow) resumes at the collective step rather than being asked who they are
  // all over again.
  const [step, setStep] = useState(() => (me?.onboarded ? 1 : 0));
  const [firstName, setFirstName] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  // The backend stands in the email's local part (or "Ny bruker") when the provider gave
  // no name at all - both are placeholders, not something to hand back to the user.
  const emailLocalPart = me?.email?.includes('@') ? me.email.split('@')[0] : undefined;
  const storedName =
    me?.name && me.name !== emailLocalPart && me.name !== 'Ny bruker' ? me.name : undefined;

  // Sign in with Apple (and Google) already told us the user's name, and App Review
  // guideline 4 forbids asking for it again on top of that - so the field arrives filled
  // in and this step is a confirmation, not a form. Still editable: housemates see this
  // name, and a legal first name isn't always what people go by.
  //
  // Three sources, in order of how close they are to what the provider actually said:
  // the one-shot capture from the Apple sheet, the session's user_metadata, and finally
  // the name the backend already stored. The last one needs the guard below - /api/me
  // invents a placeholder when the provider gave nothing, and prefilling the field with
  // "78b674nrtm" is worse than leaving it empty.
  useEffect(() => {
    let cancelled = false;
    getRememberedProviderName().then((remembered) => {
      if (cancelled) return;
      const prefill =
        firstNameOf(remembered) || firstNameOf(providerName) || firstNameOf(storedName);
      if (prefill) setFirstName((current) => current || prefill);
    });
    return () => {
      cancelled = true;
    };
  }, [providerName, storedName]);

  const applyPickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
    const type = asset.mimeType ?? (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);
    setImage({ uri: asset.uri, name: asset.fileName ?? `profile.${ext}`, type });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til kameraet for å ta et bilde.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    applyPickedAsset(result.assets[0]);
  };

  const pickFromLibrary = async () => {
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
    applyPickedAsset(result.assets[0]);
  };

  // One entry point for the photo, as designed - the choice between camera and library
  // (and removing it again) belongs in a native prompt, not in three chips on the screen.
  const handlePhotoPress = () => {
    Alert.alert('Profilbilde', undefined, [
      { text: 'Ta bilde', onPress: takePhoto },
      { text: 'Velg fra galleri', onPress: pickFromLibrary },
      ...(image
        ? [{ text: 'Fjern bilde', style: 'destructive' as const, onPress: () => setImage(null) }]
        : []),
      { text: 'Avbryt', style: 'cancel' as const },
    ]);
  };

  const handleProfileSubmit = async () => {
    if (!firstName.trim()) {
      setError('Skriv inn fornavnet ditt.');
      return;
    }
    if (!acceptedTerms) {
      setError('Du må godta vilkårene og personvernerklæringen.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.completeOnboarding({
        name: firstName.trim(),
        acceptedTerms: true,
        picture: image ?? undefined,
      });
      await forgetProviderName();
      await mutateMe();
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinCollective = async () => {
    if (inviteCode.length < INVITE_CODE_LENGTH) {
      setError('Koden er på fem tegn.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await api.joinCollective(inviteCode);
      await mutateMe();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Fant ingen kollektiv med den koden.');
      } else if (err instanceof ApiError && err.status === 410) {
        setError('Koden er utløpt. Be om en ny fra en du bor med.');
      } else if (err instanceof ApiError && err.status === 409) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Noe gikk galt.');
      }
    } finally {
      setJoining(false);
    }
  };

  // The keyboard (or a paste of the whole "RYD-XXXXX" a housemate shared) can hand us
  // anything - normalize to the bare code the API expects.
  const handleCodeChange = (raw: string) => {
    setInviteCode(normalizeInviteCode(raw));
    if (error) setError(null);
  };

  const initial = (firstName.trim()[0] ?? '?').toUpperCase();
  const busy = submitting || joining;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
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
        <ThemedText type="small" themeColor="textSecondary" style={styles.stepCounter}>
          {step + 1} av {STEP_COUNT}
        </ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        {/* Remounting on `key={step}` is what replays the entrance animation - without it
            React would reuse the same node and the steps would swap with no transition. */}
        <Animated.View key={step} entering={FadeInRight.duration(260)} style={styles.stepBody}>
          {step === 0 ? (
            <>
              <ThemedText style={[styles.title, { color: theme.text }]}>Hvem er du?</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
                Samboerne ser navnet og bildet ditt på oppgaver og i chatten.
              </ThemedText>

              <View style={styles.photoRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={image ? 'Endre profilbilde' : 'Legg til profilbilde'}
                  onPress={handlePhotoPress}
                  style={[
                    styles.avatar,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  {image ? (
                    <Image source={{ uri: image.uri }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <ThemedText style={[styles.avatarInitial, { color: theme.textSecondary }]}>
                      {initial}
                    </ThemedText>
                  )}
                </Pressable>

                <Pressable onPress={handlePhotoPress} style={styles.photoText} hitSlop={Spacing.two}>
                  <ThemedText type="smallBold" themeColor="brand">
                    {image ? 'Endre bilde' : 'Legg til bilde'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Valgfritt – vi bruker forbokstaven ellers.
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  Fornavn
                </ThemedText>
                <TextInput
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    if (error) setError(null);
                  }}
                  placeholder="Fornavn"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { backgroundColor: theme.backgroundElement, color: theme.text },
                  ]}
                />
              </View>

              {/* The two documents are linked individually rather than the whole sentence
                  being one tap target - agreeing and reading are different intents, and
                  tapping "vilkårene" to read them shouldn't silently tick the box. */}
              <View style={styles.consentRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  onPress={() => {
                    setAcceptedTerms((v) => !v);
                    if (error) setError(null);
                  }}
                  hitSlop={Spacing.two}
                  style={[
                    styles.checkbox,
                    { borderColor: acceptedTerms ? theme.brand : theme.border },
                    acceptedTerms && { backgroundColor: theme.brand },
                  ]}>
                  {acceptedTerms && <Ionicons name="checkmark" size={15} color={theme.onBrand} />}
                </Pressable>
                <ThemedText type="small" themeColor="textSecondary" style={styles.consentText}>
                  Jeg godtar{' '}
                  <ThemedText type="smallBold" themeColor="brand" onPress={() => router.push(TERMS_ROUTE)}>
                    vilkårene
                  </ThemedText>{' '}
                  og{' '}
                  <ThemedText
                    type="smallBold"
                    themeColor="brand"
                    onPress={() => router.push(PRIVACY_ROUTE)}>
                    personvernerklæringen
                  </ThemedText>
                  . Vi lagrer bare det som trengs for kollektivet.
                </ThemedText>
              </View>
            </>
          ) : (
            <>
              <ThemedText style={[styles.title, { color: theme.text }]}>
                Hei, {firstName.trim() || firstNameOf(me?.name) || 'du'}.{'\n'}Hvor bor du?
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
                Et kollektiv er dere som deler bolig. Én oppretter, resten blir med.
              </ThemedText>

              {/* No name field here on purpose: this card is a doorway, and naming (plus
                  the photo) is the "Nytt kollektiv" flow the button below opens. */}
              <View style={[styles.card, styles.cardPrimary, { borderColor: theme.brand }]}>
                <ThemedText type="heading">Opprett nytt kollektiv</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.cardBody}>
                  Gi det navn og bilde, så inviterer du de andre. Første måned er gratis.
                </ThemedText>
              </View>

              <View style={[styles.card, { borderColor: theme.border }]}>
                <ThemedText type="heading">Bli med i et som finnes</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.cardBody}>
                  Skriv inn koden du fikk fra en samboer.
                </ThemedText>
                <View style={styles.joinRow}>
                  <TextInput
                    ref={codeInputRef}
                    value={inviteCode}
                    onChangeText={handleCodeChange}
                    onSubmitEditing={handleJoinCollective}
                    placeholder="• • • • •"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={INVITE_CODE_LENGTH + 4}
                    returnKeyType="done"
                    style={[
                      styles.input,
                      styles.codeInput,
                      { backgroundColor: theme.backgroundElement, color: theme.text },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleJoinCollective}
                    disabled={busy || inviteCode.length < INVITE_CODE_LENGTH}
                    style={({ pressed }) => [
                      styles.joinButton,
                      { backgroundColor: theme.backgroundSelected },
                      (busy || inviteCode.length < INVITE_CODE_LENGTH) && styles.disabled,
                      pressed && styles.pressed,
                    ]}>
                    {joining ? (
                      <ActivityIndicator color={theme.text} />
                    ) : (
                      <ThemedText style={[styles.controlLabel, { color: theme.text }]}>
                        Bli med
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </Animated.View>

        {error && (
          <ThemedText type="small" themeColor="danger" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <View style={styles.spacer} />

        <Pressable
          accessibilityRole="button"
          onPress={step === 0 ? handleProfileSubmit : () => router.push('/new-collective')}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.brand },
            busy && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color={theme.onBrand} />
          ) : (
            <ThemedText style={[styles.controlLabel, { color: theme.onBrand }]}>
              {step === 0 ? 'Neste' : 'Opprett kollektiv'}
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  progressTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  stepCounter: {
    fontVariant: ['tabular-nums'],
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  stepBody: {
    gap: 0,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    marginTop: Spacing.five,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: FontFamily.semiBold,
    fontSize: 28,
    lineHeight: 34,
  },
  photoText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  field: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  input: {
    height: Control.height,
    borderRadius: Control.radius,
    paddingHorizontal: Spacing.three + Spacing.half,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + Spacing.half,
    marginTop: Spacing.four,
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
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: Control.radius + 2,
    padding: Spacing.three + Spacing.half,
    marginTop: Spacing.four,
  },
  cardPrimary: {
    borderWidth: 1.5,
  },
  cardBody: {
    marginTop: Spacing.half,
    lineHeight: 20,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    marginTop: Spacing.three,
  },
  codeInput: {
    flex: 1,
    letterSpacing: 4,
  },
  joinButton: {
    height: Control.height,
    borderRadius: Control.radius,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  error: {
    marginTop: Spacing.three,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.five,
  },
  primaryButton: {
    height: Control.height,
    borderRadius: Control.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
