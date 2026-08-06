import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  message?: string;
  onRetry?: () => void;
};

/** Use whenever an SWR fetch fails — never let a failed request just spin forever. */
export function ErrorState({ message = 'Klarte ikke å hente data.', onRetry }: Props) {
  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="danger" style={styles.text}>
        {message}
      </ThemedText>
      {onRetry && <PrimaryButton label="Prøv igjen" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  text: {
    textAlign: 'center',
  },
});
