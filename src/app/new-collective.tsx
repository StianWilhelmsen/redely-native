import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Line, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Fonts, Radii, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

/** Shared with sign-in and onboarding: one control height, one radius. */
const CONTROL_HEIGHT = 52;
const CONTROL_RADIUS = 14;

const STEP_COUNT = 3;

const PHOTO_BOX_SIZE = 140;
const NAME_SUGGESTIONS = ['Adressen', 'Kollektivet på Grünerløkka', 'Hjemme'];

type PickedImage = { uri: string; name: string; type: string };

/** Diagonal hatching behind the empty photo box - decorative, so it stays out of the
 *  accessibility tree and never intercepts the tap that opens the picker. */
function Hatching({ color }: { color: string }) {
  const spacing = 18;
  const count = Math.ceil((PHOTO_BOX_SIZE * 2) / spacing);
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <Line
          key={i}
          x1={i * spacing - PHOTO_BOX_SIZE}
          y1={PHOTO_BOX_SIZE}
          x2={i * spacing}
          y2={0}
          stroke={color}
          strokeWidth={7}
          opacity={0.45}
        />
      ))}
    </Svg>
  );
}

export default function NewCollectiveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { mutate: mutateMe } = useMe();
  const nameInputRef = useRef<TextInput>(null);

  const [step] = useState(0);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
    const type = asset.mimeType ?? (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);
    setImage({ uri: asset.uri, name: asset.fileName ?? `collective.${ext}`, type });
  };

  const handleTakePhoto = async () => {
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

  const handlePickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Ingen tilgang', 'Du må gi tilgang til bilder for å sette kollektivbilde.');
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

  /** Drops any picked photo and moves on to the part that isn't optional. */
  const handleSkipPhoto = () => {
    setImage(null);
    nameInputRef.current?.focus();
  };

  const handleNext = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Gi kollektivet et navn.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createCollective(trimmed);
      // The photo is a second call by design - the collective has to exist (and the
      // creator be its admin) before a picture can be attached to it. A failure here
      // must not undo a collective that was created successfully.
      if (image) {
        try {
          await api.updateCollectivePicture(image);
        } catch {
          Alert.alert(
            'Kollektivet er opprettet',
            'Bildet ble ikke lastet opp. Du kan legge det til fra kollektivinnstillinger.'
          );
        }
      }
      // The navigator leaves onboarding as soon as `me` reports a collective.
      await mutateMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.progressRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
          onPress={() => router.back()}
          hitSlop={Spacing.three}>
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
        </Pressable>
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          Gi kollektivet et ansikt
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Bildet vises øverst i appen for alle som bor her. Ta et av stua, døra eller gjengen.
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={image ? 'Endre kollektivbilde' : 'Legg til kollektivbilde'}
          onPress={handlePickFromLibrary}
          style={[
            styles.photoBox,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.photoImage} contentFit="cover" />
          ) : (
            <>
              <Hatching color={theme.border} />
              <ThemedText style={[styles.photoLabel, { color: theme.textSecondary }]}>
                kollektivbilde
              </ThemedText>
            </>
          )}
        </Pressable>

        <View style={styles.actionChips}>
          {(
            [
              { label: 'Ta bilde', onPress: handleTakePhoto },
              { label: 'Galleri', onPress: handlePickFromLibrary },
              { label: 'Hopp over', onPress: handleSkipPhoto },
            ] as const
          ).map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionChip,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{action.label}</ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Navn på kollektivet
          </ThemedText>
          <TextInput
            ref={nameInputRef}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError(null);
            }}
            onSubmitEditing={handleNext}
            placeholder="Sofienberg 12"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            maxLength={60}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        <View style={styles.suggestions}>
          {NAME_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              onPress={() => {
                setName(suggestion);
                if (error) setError(null);
              }}
              style={({ pressed }) => [
                styles.suggestion,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small" numberOfLines={1}>
                {suggestion}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <View style={styles.spacer} />

        <Pressable
          accessibilityRole="button"
          onPress={handleNext}
          disabled={submitting}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.brand },
            submitting && styles.disabled,
            pressed && !submitting && styles.pressed,
          ]}>
          {submitting ? (
            <ActivityIndicator color={theme.onBrand} />
          ) : (
            <ThemedText style={[styles.controlLabel, { color: theme.onBrand }]}>Neste</ThemedText>
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
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  photoBox: {
    alignSelf: 'center',
    width: PHOTO_BOX_SIZE,
    height: PHOTO_BOX_SIZE,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: Spacing.five,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  actionChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  actionChip: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
  },
  field: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  input: {
    height: CONTROL_HEIGHT,
    borderRadius: CONTROL_RADIUS,
    paddingHorizontal: Spacing.three + Spacing.half,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  suggestion: {
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: '100%',
  },
  error: {
    marginTop: Spacing.three,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.five,
  },
  primaryButton: {
    height: CONTROL_HEIGHT,
    borderRadius: CONTROL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  controlLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
