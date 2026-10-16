import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api';
import { Magne } from '@/components/magneten/magne';
import { FontFamily } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

/** The door while it loads: Magne pulling, one line of text. */
export function Waiting({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  return (
    <View style={[styles.center, { backgroundColor: tokens.door }]}>
      <Magne pose={error ? 'lurer' : 'trekker'} size={110} />
      <Text style={[styles.waitText, { color: tokens.textSecondary }]}>
        {error ? errorMessage(error) : t('loading')}
      </Text>
      {error && onRetry ? (
        <Text onPress={onRetry} accessibilityRole="button" style={[styles.retry, { color: tokens.text }]}>
          {t('actions.retry')}
        </Text>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  waitText: {
    fontFamily: FontFamily.hand,
    paddingHorizontal: 3,
    fontSize: 20,
    lineHeight: 29,
    textAlign: 'center',
  },
  retry: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    padding: 10,
  },
});
