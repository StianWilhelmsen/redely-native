import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { MembershipCard } from '@/components/subscription/membership-card';
import { ThemedText } from '@/components/themed-text';
import { BASE_PLAN } from '@/constants/plans';
import { FontFamily, Radii, Spacing, Theme } from '@/constants/theme';

type Props = {
  collectiveName: string | null | undefined;
  /** ISO instant from billing status; null until it has loaded. */
  trialEndsAt: string | null | undefined;
};

/** The screen is dark whatever the device scheme - it is a moment, not a settings page. */
const DARK = Theme.dark;
const ACCENT = Theme.light.brand;

const REASSURANCES = [
  { lead: 'Ingen kortinfo.', rest: 'Vi spør ikke om betaling nå.' },
  { lead: 'Ingen binding.', rest: 'Ingenting tegnes automatisk.' },
  { lead: 'Vi sier fra i tide.', rest: 'Påminnelse 5 dager før slutt.' },
];

const CARD_DELAY = 120;
const HEADLINE_DELAY = 520;
const FIRST_LINE_DELAY = 900;
const LINE_STAGGER = 170;

function trialDays(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 30;
  const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);
  return days > 0 ? days : 30;
}

function formatEnd(trialEndsAt: string | null | undefined): string {
  const end = trialEndsAt ? new Date(trialEndsAt) : new Date(Date.now() + 30 * 86_400_000);
  return end.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The last step of creating a collective: the free month, as a card being handed over.
 * The card lands first, the headline follows, and the three reassurances arrive one at
 * a time - each is a separate promise, and reading them as a list is the point.
 */
export function TrialStep({ collectiveName, trialEndsAt }: Props) {
  const days = trialDays(trialEndsAt);

  return (
    <View style={styles.root}>
      <Animated.View
        entering={FadeInDown.delay(CARD_DELAY)
          .duration(620)
          .easing(Easing.out(Easing.cubic))}
        style={styles.cardWrap}>
        <MembershipCard
          variant="trial"
          name={collectiveName || 'Kollektivet'}
          details={[`${days} dager`, `Til ${formatEnd(trialEndsAt)}`]}
          width={280}
        />
      </Animated.View>

      <Animated.View entering={FadeIn.delay(HEADLINE_DELAY).duration(420)} style={styles.headline}>
        <ThemedText style={styles.eyebrow}>VELKOMMEN TIL OSS</ThemedText>
        <ThemedText style={styles.title}>
          {days} dager.{'\n'}Alt inkludert.
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Hele kollektivet har full tilgang til Redely – på oss.
        </ThemedText>
      </Animated.View>

      <View style={styles.lines}>
        {REASSURANCES.map((line, index) => (
          <Animated.View
            key={line.lead}
            entering={FadeInUp.delay(FIRST_LINE_DELAY + index * LINE_STAGGER)
              .duration(380)
              .easing(Easing.out(Easing.quad))}
            style={styles.line}>
            <View style={styles.dot} />
            <ThemedText style={styles.lineText}>
              <ThemedText style={styles.lineLead}>{line.lead}</ThemedText> {line.rest}
            </ThemedText>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/** Footnote under the Start button, kept here so the price is stated in exactly one place. */
export const TRIAL_STEP_FOOTNOTE = `Ett abonnement dekker hele kollektivet – fra ${BASE_PLAN.priceNok} kr/mnd, når dere vil.`;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  cardWrap: {
    marginTop: Spacing.two,
    transform: [{ rotate: '-4deg' }],
  },
  headline: {
    alignItems: 'center',
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  eyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: ACCENT,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
    color: DARK.text,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: DARK.textSecondary,
    maxWidth: 300,
  },
  lines: {
    alignSelf: 'stretch',
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: DARK.backgroundElement,
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  lineText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: DARK.textSecondary,
  },
  lineLead: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: DARK.text,
  },
});
