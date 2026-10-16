import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

/** A bottom sheet on paper: handwritten title, whatever content, tap outside to close. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('actions.close')}
        />
        <View style={[styles.sheet, { backgroundColor: tokens.door, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.grip, { backgroundColor: tokens.border }]} />
          {title ? (
            <Text style={[styles.title, { color: tokens.text }]} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13,19,21,0.45)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, gap: 14 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
  title: { fontFamily: FontFamily.hand, fontSize: 26, lineHeight: 30 },
});
