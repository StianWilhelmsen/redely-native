import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarBadge } from '@/components/avatar-badge';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Control, FontFamily, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

/**
 * Your own account: the name and face your housemates see, and - because an app that
 * lets you create an account has to let you delete it from inside it (App Store guideline
 * 5.1.1(v)) - the way out.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data: me, mutate: mutateMe } = useMe();

  const [name, setName] = useState(me?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim().length > 0 && name.trim() !== me?.name;

  const handlePickPicture = async () => {
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

    setUploading(true);
    try {
      await api.updateProfilePicture(me?.name ?? name, {
        uri: asset.uri,
        name: asset.fileName ?? `profile.${ext}`,
        type,
      });
      await mutateMe();
    } catch (err) {
      Alert.alert('Noe gikk galt', err instanceof Error ? err.message : 'Kunne ikke laste opp bildet.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Navn kan ikke være tomt.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateProfileName(trimmed);
      await mutateMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setSaving(false);
    }
  };

  /** Two prompts, and the second says what actually disappears rather than asking
   *  "are you sure?" a second time. */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Slette kontoen din?',
      'Profilen, meldingene og utgiftene dine blir borte for godt. Dette kan ikke angres.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Helt sikker?', 'Siste sjanse — kontoen slettes permanent.', [
              { text: 'Avbryt', style: 'cancel' },
              {
                text: 'Slett kontoen',
                style: 'destructive',
                onPress: async () => {
                  setDeleting(true);
                  try {
                    await api.deleteAccount();
                    // The account is gone, so the session is meaningless.
                    await signOut();
                  } catch (err) {
                    Alert.alert(
                      'Kunne ikke slette kontoen',
                      err instanceof Error ? err.message : 'Prøv igjen, eller kontakt oss.'
                    );
                  } finally {
                    setDeleting(false);
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.three}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.navTitle, { color: theme.text }]}>Navn og bilde</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Endre profilbilde"
          onPress={handlePickPicture}
          disabled={uploading}
          style={styles.avatarWrap}>
          <AvatarBadge
            userId={me?.id ?? 0}
            name={me?.name ?? '?'}
            pictureUrl={me?.pictureUrl}
            shape="circle"
            size={96}
          />
          <View
            style={[
              styles.avatarBadge,
              { backgroundColor: theme.brand, borderColor: theme.background },
            ]}>
            {uploading ? (
              <ActivityIndicator size="small" color={theme.onBrand} />
            ) : (
              <Ionicons name="camera" size={14} color={theme.onBrand} />
            )}
          </View>
        </Pressable>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Fornavn
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError(null);
            }}
            onSubmitEditing={handleSaveName}
            placeholder="Fornavn"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            E-post
          </ThemedText>
          {/* Read-only: the address comes from whichever identity provider signed you in,
              so changing it here would only make the two disagree. */}
          <View style={[styles.readOnly, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {me?.email}
            </ThemedText>
          </View>
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}

        {dirty && <PrimaryButton label="Lagre" onPress={handleSaveName} loading={saving} size="large" />}

        <View style={styles.danger}>
          <ThemedText type="eyebrow" style={styles.dangerLabel}>
            Farlig sone
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.dangerBody}>
            Sletting fjerner profilen din, meldingene dine og utgiftene du har lagt ut. Er du alene
            i kollektivet, slettes kollektivet også. Dette kan ikke angres.
          </ThemedText>
          <Pressable onPress={handleDeleteAccount} disabled={deleting} hitSlop={Spacing.two}>
            <ThemedText type="smallBold" themeColor="danger">
              {deleting ? 'Sletter…' : 'Slett konto'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  avatarWrap: {
    alignSelf: 'center',
    position: 'relative',
    marginTop: Spacing.two,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    height: Control.height,
    borderRadius: Control.radius,
    paddingHorizontal: Spacing.three + Spacing.half,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  readOnly: {
    height: Control.height,
    borderRadius: Control.radius,
    paddingHorizontal: Spacing.three + Spacing.half,
    justifyContent: 'center',
  },
  danger: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  dangerLabel: {
    marginBottom: Spacing.half,
  },
  dangerBody: {
    lineHeight: 19,
  },
});
