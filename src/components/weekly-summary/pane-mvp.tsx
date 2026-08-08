import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import {
  Chip,
  Eyebrow,
  PaneLayout,
  Reveal,
  RevealPop,
  StoryAvatar,
  storyText,
} from '@/components/weekly-summary/story-atoms';
import { Ink, PaneSkins } from '@/components/weekly-summary/story-theme';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { mvpChips, mvpQuote } from '@/lib/weekly-summary-copy';
import type { UserStats, WeeklyStats } from '@/types/api';

const AVATAR_SIZE = 132;

export function PaneMvp({ data, mvp }: { data: WeeklyStats; mvp: UserStats }) {
  const quick = data.quickActionsByUser.find((entry) => entry.userId === mvp.userId);
  const chips = mvpChips(data, mvp);

  return (
    <PaneLayout>
      <Reveal order={0}>
        <Eyebrow>Ukens MVP</Eyebrow>
      </Reveal>

      <View style={styles.center}>
        <RevealPop order={2}>
          <View style={styles.avatarWrap}>
            <StoryAvatar
              userId={mvp.userId}
              name={mvp.name}
              pictureUrl={mvp.pictureUrl}
              size={AVATAR_SIZE}
              variant="solid"
              solidTextColor={PaneSkins.mvp.gradient[0]}
            />
            <View style={styles.crown}>
              <Ionicons name="star" size={17} color="#5A3A05" />
            </View>
          </View>
        </RevealPop>

        <Reveal order={5} style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {mvp.name}
          </Text>
          <Text style={[storyText.body, styles.meta]}>
            {`${mvp.weekPoints} ${mvp.weekPoints === 1 ? 'poeng' : 'poeng'}`}
            {quick && quick.count > 0
              ? ` · ${quick.count} ${quick.count === 1 ? 'småjobb' : 'småjobber'}`
              : ''}
          </Text>
        </Reveal>

        <Reveal order={6} style={styles.quoteWrap}>
          <Text style={styles.quote}>{`«${mvpQuote(mvp, quick)}»`}</Text>
        </Reveal>
      </View>

      <View style={styles.chips}>
        {chips.map((chip, index) => (
          <Reveal key={chip} order={7 + index}>
            <Chip strong>{chip}</Chip>
          </Reveal>
        ))}
      </View>
    </PaneLayout>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  crown: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5C452',
  },
  identity: {
    alignItems: 'center',
    gap: 2,
  },
  name: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: Ink.primary,
  },
  meta: {
    color: Ink.secondary,
  },
  quoteWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: Radii.card,
    backgroundColor: Ink.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Ink.hairline,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  quote: {
    // No italic here on purpose — Poppins ships no italic cut, and Android won't
    // synthesize one, so it would render as a plain fallback face.
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: Ink.primary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
