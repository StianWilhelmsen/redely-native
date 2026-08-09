import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PRIVACY_DOCUMENT, TERMS_DOCUMENT, type LegalDocument } from '@/constants/legal-content';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Renders the Terms of Use / Privacy Policy in-app. App Store Review Guideline 5.1.1(i)
 * requires the privacy policy to be reachable "within the app in an easily accessible
 * manner" on top of the App Store Connect metadata URL, and 3.1.2 requires both documents
 * to be linked from the subscription purchase screen itself.
 */
export default function LegalScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { document } = useLocalSearchParams<{ document: string }>();

  const doc: LegalDocument = document === 'personvern' ? PRIVACY_DOCUMENT : TERMS_DOCUMENT;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
          hitSlop={Spacing.two}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <ThemedText type="smallBold" numberOfLines={1}>
            {doc.title}
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        <ThemedText type="display" style={styles.title}>
          {doc.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Sist oppdatert {doc.updated}
        </ThemedText>
        <ThemedText type="small" style={styles.intro}>
          {doc.intro}
        </ThemedText>

        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <ThemedText type="heading">{section.heading}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              {section.body}
            </ThemedText>
          </View>
        ))}
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  intro: {
    lineHeight: 21,
  },
  section: {
    gap: Spacing.one,
  },
  body: {
    lineHeight: 21,
  },
});
