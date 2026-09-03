import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { AvatarBadge } from '@/components/avatar-badge';
import { FlatDivider } from '@/components/flat-divider';
import { FlatStatRow } from '@/components/flat-stat-row';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { levelTitle } from '@/lib/level-titles';
import type { Me } from '@/types/api';

type ProfileIdentityProps = {
  me: Me;
  memberCount: number;
  onEditPicture: () => void;
  uploadingPicture: boolean;
  onSettingsPress: () => void;
};

type Props = ProfileIdentityProps & {
  level: number;
  lifetimePoints: number;
  weekPoints: number;
  pointsToNextLevel: number;
  levelProgressPercent: number;
  streakDays: number;
  weekQuickActions: number;
};

/** The account header is useful even before the rest of the stats have loaded. */
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
            <Ionicons name="camera" size={11} color={theme.onBrand} />
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

/**
 * Identity, level progress and this week's headline numbers - one flowing unit with
 * hairlines rather than card boundaries, matching the rest of the screen.
 */
export function ProfileOverview({
  me,
  memberCount,
  onEditPicture,
  uploadingPicture,
  onSettingsPress,
  level,
  lifetimePoints,
  weekPoints,
  pointsToNextLevel,
  levelProgressPercent,
  streakDays,
  weekQuickActions,
}: Props) {
  const theme = useTheme();
  const percent = Math.max(0, Math.min(100, levelProgressPercent));
  const title = levelTitle(level);

  return (
    <View style={styles.root}>
      <ProfileIdentity
        me={me}
        memberCount={memberCount}
        onEditPicture={onEditPicture}
        uploadingPicture={uploadingPicture}
        onSettingsPress={onSettingsPress}
      />

      <FlatDivider />

      <View style={styles.levelBlock}>
        <ThemedText type="eyebrow">
          {title ? `Nivå ${level} · ${title}` : `Nivå ${level}`}
        </ThemedText>
        <View style={styles.levelNumbersRow}>
          <View style={styles.levelNumbersLeft}>
            <AnimatedNumber value={lifetimePoints} style={styles.bigNumber} />
            <ThemedText type="small" themeColor="textSecondary">
              poeng
            </ThemedText>
          </View>
          <View style={styles.levelNumbersRight}>
            <ThemedText style={[styles.nextLevelNumber, { color: theme.text }]}>
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
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
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
    gap: Spacing.two,
  },
  bigNumber: {
    fontFamily: FontFamily.bold,
    fontSize: 38,
    lineHeight: 44,
  },
  levelNumbersRight: {
    alignItems: 'flex-end',
  },
  nextLevelNumber: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
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
