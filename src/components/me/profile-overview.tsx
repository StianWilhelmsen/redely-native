import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { AvatarBadge } from '@/components/avatar-badge';
import { FlatDivider } from '@/components/flat-divider';
import { FlatStatRow } from '@/components/flat-stat-row';
import { HighlightQuote } from '@/components/highlight-quote';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { levelTitle } from '@/lib/level-titles';
import type { Badge, Me } from '@/types/api';

type Props = {
  me: Me;
  memberCount: number;
  totalOwed: number;
  onOwedPress: () => void;
  onEditPicture: () => void;
  uploadingPicture: boolean;
  onSettingsPress: () => void;

  level: number;
  lifetimePoints: number;
  weekPoints: number;
  pointsToNextLevel: number;
  levelProgressPercent: number;
  badges: Badge[];
  streakDays: number;
  weekQuickActions: number;
  /** A generated one-liner about the week's most-repeated småjobb, or null if there's
   *  nothing to highlight yet (not attributed to anyone - just your own activity). */
  highlight: string | null;
};

type ProfileIdentityProps = Pick<
  Props,
  'me' | 'memberCount' | 'onEditPicture' | 'uploadingPicture' | 'onSettingsPress'
>;

function formatKr(amount: number): string {
  return `${Math.round(amount)} kr`;
}

/** The account header is useful even before the user belongs to a collective. */
export function ProfileIdentity({
  me,
  memberCount,
  onEditPicture,
  uploadingPicture,
  onSettingsPress,
}: ProfileIdentityProps) {
  const theme = useTheme();

  return (
    <View style={styles.identityRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Endre profilbilde"
        onPress={onEditPicture}
        disabled={uploadingPicture}
        style={styles.avatarWrap}>
        <AvatarBadge userId={me.id} name={me.name} pictureUrl={me.pictureUrl} shape="circle" size={56} />
        <View style={[styles.avatarEditBadge, { backgroundColor: theme.brand, borderColor: theme.background }]}>
          {uploadingPicture ? (
            <ActivityIndicator size="small" color={theme.onBrand} />
          ) : (
            <Ionicons name="camera" size={10} color={theme.onBrand} />
          )}
        </View>
      </Pressable>

      <View style={styles.identityText}>
        <ThemedText style={[styles.identityName, { color: theme.text }]} numberOfLines={1}>
          {me.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {me.collective
            ? `${me.collective.name} · ${memberCount} medlem${memberCount === 1 ? '' : 'mer'}`
            : me.email}
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Innstillinger"
        onPress={onSettingsPress}
        hitSlop={Spacing.three}>
        <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

/** Identity, level progress and this week's headline stats - one flowing unit, no card
 *  boundary, matching the rest of the screen's unboxed sections. */
export function ProfileOverview({
  me,
  memberCount,
  totalOwed,
  onOwedPress,
  onEditPicture,
  uploadingPicture,
  onSettingsPress,
  level,
  lifetimePoints,
  weekPoints,
  pointsToNextLevel,
  levelProgressPercent,
  badges,
  streakDays,
  weekQuickActions,
  highlight,
}: Props) {
  const theme = useTheme();
  const percent = Math.max(0, Math.min(100, levelProgressPercent));
  const title = levelTitle(level);
  const topBadge = badges[0];

  return (
    <View style={styles.root}>
      <ProfileIdentity
        me={me}
        memberCount={memberCount}
        onEditPicture={onEditPicture}
        uploadingPicture={uploadingPicture}
        onSettingsPress={onSettingsPress}
      />

      {totalOwed > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Du skylder ${formatKr(totalOwed)}. Gå til regninger.`}
          onPress={onOwedPress}
          style={({ pressed }) => [
            styles.owedPill,
            { backgroundColor: `${theme.danger}1C` },
            pressed && styles.owedPillPressed,
          ]}>
          <ThemedText type="small" style={{ color: theme.danger }}>
            Du skylder {formatKr(totalOwed)} →
          </ThemedText>
        </Pressable>
      )}

      {topBadge && (
        <View style={[styles.badgePill, { backgroundColor: `${theme.brandSecondary}26` }]}>
          <Text style={styles.badgeEmoji}>{topBadge.emoji}</Text>
          <ThemedText type="smallBold">{topBadge.label}</ThemedText>
        </View>
      )}

      <FlatDivider />

      <View style={styles.levelBlock}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          {title ? `Nivå ${level} · ${title}` : `Nivå ${level}`}
        </ThemedText>
        <View style={styles.levelNumbersRow}>
          <View style={styles.levelNumbersLeft}>
            <AnimatedNumber value={lifetimePoints} type="title" style={styles.bigNumber} />
            <ThemedText type="small" themeColor="textSecondary">
              poeng
            </ThemedText>
          </View>
          <View style={styles.levelNumbersRight}>
            <ThemedText type="heading" style={styles.nextLevelNumber}>
              {pointsToNextLevel}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              til nivå {level + 1}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.brand }]} />
        </View>
      </View>

      <FlatDivider />

      <FlatStatRow
        items={[
          { value: weekPoints, label: 'denne uka', accent: true },
          { value: weekQuickActions, label: 'småjobber' },
          { value: streakDays, label: 'dager på rad' },
        ]}
      />

      {highlight && (
        <>
          <FlatDivider />
          <HighlightQuote text={highlight} caption="Ukens høydepunkt" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  identityName: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  owedPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  owedPillPressed: {
    opacity: 0.75,
  },
  badgePill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Spacing.one + 2,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.one + 2,
  },
  badgeEmoji: {
    fontSize: 15,
  },
  levelBlock: {
    gap: Spacing.two,
  },
  levelNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  levelNumbersLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  bigNumber: {
    fontSize: 40,
    lineHeight: 46,
  },
  levelNumbersRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  nextLevelNumber: {
    fontSize: 22,
    lineHeight: 26,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
