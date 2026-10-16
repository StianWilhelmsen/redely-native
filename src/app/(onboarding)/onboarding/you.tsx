import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, errorMessage, type MemberColor, type PhotoFile } from '@/api';
import { COLOR_NAMES, getDraft, updateDraft } from '@/components/magneten/onboarding/draft';
import { BackButton, ErrorText, Spacer, StepDots } from '@/components/magneten/onboarding/parts';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Field, Screen } from '@/components/magneten/ui';
import { FontFamily, MemberColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { Feel } from '@/design/motion';
import { getRememberedProviderName, updateLastSignInName } from '@/lib/provider-profile';
import { useMeState } from '@/state/household';
import { usePalette } from '@/theme/palette-context';

function surnameOf(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/** Step 2: your name, the home's name, your magnet colour and (optionally) your photo. */
export default function YouStep() {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const { user } = useAuth();
  const { me, mutateMe } = useMeState();
  const draft = getDraft();
  const isFamily = draft.choice === 'family' || draft.choice === 'twoHomes';

  const [name, setName] = useState(draft.name);
  const [homeName, setHomeName] = useState(draft.homeName);
  const [homeTouched, setHomeTouched] = useState(!!draft.homeName);
  const [color, setColor] = useState<MemberColor>(draft.color);
  const [photo, setPhoto] = useState<PhotoFile | null>(draft.photo);
  const [snap, setSnap] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from whatever we know: Apple's one-time name, the account, the session.
  useEffect(() => {
    if (draft.name) return;
    let alive = true;
    getRememberedProviderName().then((remembered) => {
      if (!alive) return;
      const full = remembered || me?.name || user?.name || '';
      if (!full) return;
      setName((n) => n || full.split(/\s+/)[0]);
      const surname = surnameOf(full);
      if (surname && isFamily) setHomeName((h) => h || t('onboarding.you.familyName', { surname }));
    });
    return () => {
      alive = false;
    };
    // Prefill once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickColor = (c: MemberColor) => {
    if (c === color) return;
    Feel.tick();
    setColor(c);
    setSnap((s) => s + 1);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('onboarding.you.photoDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const type = asset.mimeType ?? 'image/jpeg';
    setPhoto({ uri: asset.uri, name: asset.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`, type });
    setSnap((s) => s + 1);
  };

  const next = async () => {
    const cleanName = name.trim();
    const cleanHome = homeName.trim();
    if (!cleanName) return setError(t('onboarding.you.nameRequired'));
    if (!cleanHome) return setError(t('onboarding.you.homeRequired'));
    setError(null);
    setBusy(true);
    try {
      // Terms are accepted by continuing past sign-in; this is where they are recorded.
      const updated = await api.me.update({ acceptTerms: true, name: cleanName });
      mutateMe(updated, { revalidate: false });
      updateLastSignInName(cleanName).catch(() => {});
      updateDraft({ name: cleanName, homeName: cleanHome, color, photo, photoUploaded: photo === draft.photo && draft.photoUploaded });
      router.push('/onboarding/family');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton />
        <View style={styles.dots}>
          <StepDots step={2} />
        </View>
        <View style={styles.backSpace} />
      </View>

      <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
        {t('onboarding.you.title')}
      </Text>

      <View style={styles.magnetWrap}>
        <View>
          <PhotoMagnet key={snap} snapIn={snap > 0} name={name || '?'} color={color} photoUrl={photo?.uri} size={120} />
          <Pressable
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel={photo ? t('onboarding.you.changePhoto') : t('onboarding.you.addPhoto')}
            style={[styles.camera, { backgroundColor: tokens.ink, borderColor: tokens.door }]}>
            <Ionicons name="camera-outline" size={20} color={tokens.onInk} />
          </Pressable>
        </View>
      </View>

      <Field
        label={t('onboarding.you.nameLabel')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          const surname = surnameOf(v);
          if (!homeTouched && isFamily && surname) setHomeName(t('onboarding.you.familyName', { surname }));
        }}
        placeholder={t('onboarding.you.namePlaceholder')}
        autoComplete="name"
        textContentType="givenName"
        maxLength={80}
      />
      <Field
        label={t('onboarding.you.homeLabel')}
        value={homeName}
        onChangeText={(v) => {
          setHomeName(v);
          setHomeTouched(true);
        }}
        placeholder={isFamily ? t('onboarding.you.homePlaceholderFamily') : t('onboarding.you.homePlaceholder')}
        maxLength={80}
      />

      <View style={styles.colors}>
        <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('onboarding.you.colorLabel')}</Text>
        <View style={styles.swatches}>
          {MemberColors.map((c) => {
            const selected = c === color;
            return (
              <Pressable
                key={c}
                onPress={() => pickColor(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('onboarding.you.pickColor', { name: t(`onboarding.you.colors.${COLOR_NAMES[c]}`) })}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: selected ? tokens.text : tokens.paper,
                    transform: [{ scale: selected ? 1.12 : 1 }],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <ErrorText>{error}</ErrorText>
      <Spacer />
      <Button label={t('actions.next')} onPress={next} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  dots: { flex: 1 },
  backSpace: { width: 44 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 30, lineHeight: 44, textAlign: 'center', marginTop: 6 },
  magnetWrap: { alignItems: 'center', paddingVertical: 6 },
  camera: {
    position: 'absolute',
    right: -4,
    bottom: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colors: { gap: 10, marginTop: 4 },
  label: { fontFamily: FontFamily.bold, fontSize: 13, paddingLeft: 4 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderBottomWidth: 3,
  },
});
