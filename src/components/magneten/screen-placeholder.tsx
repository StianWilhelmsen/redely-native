import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Magne } from '@/components/magneten/magne';
import { FontFamily } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

/** Temporary stand-in while a screen is being built. Delete once nothing uses it. */
export function ScreenPlaceholder({ name }: { name: string }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <View style={[styles.root, { backgroundColor: tokens.door }]}>
      <Magne pose="lurer" size={100} />
      <Text style={[styles.title, { color: tokens.text }]}>{name}</Text>
      <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('placeholder')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontFamily: FontFamily.hand, fontSize: 26 },
  sub: { fontFamily: FontFamily.regular, fontSize: 14 },
});
