import { ImageBackground, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';

export type MembershipCardVariant = 'trial' | 'base' | 'plus';

/** The blank cards live in assets - logo, plan label and "MEDLEM" are printed on them;
 *  everything that varies per household is laid over the bottom edge here. */
// Requested without the @3x suffix: Metro picks the density variant itself, and only the
// 3x file is shipped since the card is never drawn smaller than that art scales down to.
const CARD_ART: Record<MembershipCardVariant, number> = {
  trial: require('@/assets/images/card-trial.png'),
  base: require('@/assets/images/card-base.png'),
  plus: require('@/assets/images/card-plus.png'),
};

/** Source art is 960x600, so the card keeps a 16:10 face at any width. */
const ASPECT = 960 / 600;

type Props = {
  variant: MembershipCardVariant;
  name: string;
  /** Two short facts for the bottom-right corner, e.g. "Opptil 6 medlemmer" and "Fra okt 2026". */
  details: [string, string];
  width?: number;
};

export function MembershipCard({ variant, name, details, width = 300 }: Props) {
  const height = width / ASPECT;
  // The art's "MEDLEM" label sits at 80–87% of the height; the name goes right under it
  // and the details share that bottom band on the right.
  const bandTop = height * 0.875;
  const inset = width * 0.083;

  const light = variant !== 'plus';
  const nameColor = '#FFFFFF';
  const detailColor = light ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)';

  return (
    <ImageBackground
      source={CARD_ART[variant]}
      resizeMode="cover"
      style={[styles.card, { width, height }]}
      imageStyle={styles.art}
      accessibilityLabel={`Medlemskort for ${name}`}>
      <ThemedText
        numberOfLines={1}
        style={[
          styles.name,
          { top: bandTop, left: inset, maxWidth: width * 0.5, color: nameColor },
        ]}>
        {name}
      </ThemedText>
      <View style={[styles.details, { top: bandTop - 2, right: inset }]}>
        {details.map((line) => (
          <ThemedText key={line} numberOfLines={1} style={[styles.detail, { color: detailColor }]}>
            {line}
          </ThemedText>
        ))}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  art: {
    borderRadius: 22,
  },
  name: {
    position: 'absolute',
    fontFamily: FontFamily.bold,
    fontSize: 15,
    lineHeight: 18,
  },
  details: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  detail: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    lineHeight: 12,
  },
});
