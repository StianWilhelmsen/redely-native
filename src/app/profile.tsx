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
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

/** The name and face your housemates see. Nothing else: the email is the identity
 *  provider's business, and deleting the account lives with the other account actions
 *  at the bottom of Innstillinger. */
export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: me, mutate: mutateMe } = useMe();

  const [name, setName] = useState(me?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}

        {dirty && <PrimaryButton label="Lagre" onPress={handleSaveName} loading={saving} size="large" />}
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
});
