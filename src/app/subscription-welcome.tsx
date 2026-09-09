import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { MembershipCard } from '@/components/subscription/membership-card';
import { ThemedText } from '@/components/themed-text';
import { BASE_PLAN, PLUS_PLAN, type Plan } from '@/constants/plans';
import { Control, FontFamily, Radii, Spacing, Theme } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';

/** Dark whatever the scheme, like the trial card it echoes. */
const DARK = Theme.dark;
const GOLD = '#C9A24C';

const CARD_DELAY = 120;
const HEADLINE_DELAY = 520;
const FIRST_ROW_DELAY = 900;
const ROW_STAGGER = 150;

const COUNT_WORDS = ['', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti'];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || 'dere';
}

function monthYear(date: Date): string {
  return date.toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' }).replace('.', '');
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });
}

type Row = { lead: string; rest?: string };

function rowsFor(plan: Plan): Row[] {
  if (plan.id === 'plus') {
    return [
      { lead: 'Alt i Kollektiv Grunn' },
      { lead: `Opptil ${plan.memberLimit} medlemmer`, rest: ' – studenthus og store kollektiv' },
      { lead: 'Én invitasjonskode for alle' },
    ];
  }
  return [
    { lead: 'Roterende oppgaver og småjobber' },
    { lead: 'Felles handleliste og utgiftsdeling' },
    { lead: 'Chat, ukemål og ukesoppsummering' },
    { lead: `Opptil ${plan.memberLimit} medlemmer` },
  ];
}

/** The split, in the household's own numbers - or an example while it is still just one person. */
function splitCopy(plan: Plan, memberCount: number): string {
  if (memberCount >= 2) {
    const each = Math.round(plan.priceNok / memberCount);
    return `≈ ${each} kr per person for dere ${countWord(memberCount)}. Legg det inn som en utgift i Handle, så holder Redely styr på det.`;
  }
  const example = plan.examplePeopleCount;
  const each = Math.ceil(plan.priceNok / example);
  return `Med ${example} beboere blir det under ${each} kr per person. Legg det inn som en utgift i Handle.`;
}

/**
 * Shown once right after a plan is bought: the card that is now theirs, and what it
 * covers. Opened by the subscription sheet; the plan comes as a param because the
 * backend's own record of it arrives with the RevenueCat webhook, a few seconds later.
 */
export default function SubscriptionWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { plan: planParam, payer: payerParam } = useLocalSearchParams<{ plan?: string; payer?: string }>();
  const plan = planParam === 'plus' ? PLUS_PLAN : BASE_PLAN;
  const isPlus = plan.id === 'plus';
  const accent = isPlus ? GOLD : Theme.light.brand;

  const { data: me } = useMe();
  const { data: members } = useSWR(me?.collective ? 'members' : null, api.members);
  const { data: billing } = useSWR(me?.collective ? 'billing-status' : null, api.billingStatus);

  const memberCount = members?.length ?? billing?.memberCount ?? 1;
  const rows = rowsFor(plan);
  const renewal = billing?.currentPeriodEnd ? `Fornyes ${longDate(billing.currentPeriodEnd)}` : 'Fornyes hver måned';

  // Opened by the buyer right after paying (no payer param: it is them), by a push
  // notification (payer in the URL), or by the welcome gate once billing names the payer.
  const payer = payerParam || firstName(billing?.payerName ?? me?.name);

  const subtitle = isPlus
    ? `Betalt av ${payer} · ${plan.priceNok} kr/mnd. Plass til hele huset – fra nå.`
    : `Betalt av ${payer} · ${plan.priceNok} kr/mnd. ${
        memberCount >= 2 ? `Alle ${countWord(memberCount)} har` : 'Du har'
      } full tilgang fra nå.`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInDown.delay(CARD_DELAY).duration(620).easing(Easing.out(Easing.cubic))}
          style={styles.cardWrap}>
          <MembershipCard
            variant={plan.id}
            name={me?.collective?.name || 'Kollektivet'}
            details={[`Opptil ${plan.memberLimit} medlemmer`, `Fra ${monthYear(new Date())}`]}
            width={280}
          />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(HEADLINE_DELAY).duration(420)} style={styles.headline}>
          <ThemedText style={[styles.eyebrow, { color: accent }]}>TAKK FOR TILLITEN</ThemedText>
          <ThemedText style={styles.title}>Velkommen til{'\n'}{plan.name}</ThemedText>
          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(FIRST_ROW_DELAY - 150).duration(300)}>
          <ThemedText style={styles.sectionLabel}>DETTE HAR DERE NÅ</ThemedText>
        </Animated.View>
        <View style={styles.rows}>
          {rows.map((row, index) => (
            <Animated.View
              key={row.lead}
              entering={FadeInUp.delay(FIRST_ROW_DELAY + index * ROW_STAGGER)
                .duration(360)
                .easing(Easing.out(Easing.quad))}
              style={[styles.row, index > 0 && styles.rowDivider]}>
              <View style={[styles.check, { backgroundColor: accent }]}>
                <Ionicons name="checkmark" size={13} color={isPlus ? DARK.background : '#FFFFFF'} />
              </View>
              <ThemedText style={styles.rowText}>
                <ThemedText style={styles.rowLead}>{row.lead}</ThemedText>
                {row.rest}
              </ThemedText>
            </Animated.View>
          ))}
        </View>

        <Animated.View
          entering={FadeInUp.delay(FIRST_ROW_DELAY + rows.length * ROW_STAGGER + 80).duration(380)}
          style={styles.splitCard}>
          <ThemedText style={styles.splitTitle}>Del kostnaden som dere vil</ThemedText>
          <ThemedText style={styles.splitBody}>{splitCopy(plan, memberCount)}</ThemedText>
        </Animated.View>

        <View style={styles.spacer} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <ThemedText style={styles.buttonLabel}>Tilbake til kollektivet</ThemedText>
        </Pressable>
        <ThemedText style={styles.footnote}>{renewal} · administreres i Apple-ID</ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  cardWrap: {
    alignSelf: 'center',
    transform: [{ rotate: '-4deg' }],
    marginTop: Spacing.two,
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
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
    color: DARK.text,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: DARK.textSecondary,
    maxWidth: 320,
  },
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: DARK.textSecondary,
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  rows: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DARK.border,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: DARK.textSecondary,
  },
  rowLead: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: DARK.text,
  },
  splitCard: {
    marginTop: Spacing.four,
    backgroundColor: DARK.backgroundElement,
    borderRadius: Radii.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  splitTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: DARK.text,
  },
  splitBody: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: DARK.textSecondary,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.four,
  },
  button: {
    height: Control.height,
    borderRadius: Control.radius,
    backgroundColor: Theme.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: Theme.light.text,
  },
  footnote: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    textAlign: 'center',
    color: DARK.textSecondary,
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.85,
  },
});
