import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Badge } from '@/types/api';

type Props = {
  level: number;
  lifetimePoints: number;
  weekPoints: number;
  pointsToNextLevel: number;
  /** 0-100, computed server-side - the level formula isn't duplicated here. */
  levelProgressPercent: number;
  badges: Badge[];
};

/**
 * Your own level, points and earned badges - the personal half of the points system.
 * Unboxed on purpose: sits directly on the screen background like every other Section,
 * rather than inside its own card.
 */
export function LevelSection({
  level,
  lifetimePoints,
  weekPoints,
  pointsToNextLevel,
  levelProgressPercent,
  badges,
}: Props) {
  const theme = useTheme();

  const percent = Math.max(0, Math.min(100, levelProgressPercent));

  return (
    <Section title="Nivå">
      <View style={styles.topRow}>
        <View style={[styles.levelBadge, { backgroundColor: theme.brand }]}>
          <ThemedText type="small" themeColor="onBrand" style={styles.levelLabel}>
            NIVÅ
          </ThemedText>
          <ThemedText type="heading" themeColor="onBrand" style={styles.levelValue}>
            {level}
          </ThemedText>
        </View>

        <View style={styles.pointsCol}>
          <View style={styles.pointsRow}>
            <AnimatedNumber value={weekPoints} type="heading" themeColor="brand" style={styles.pointsValue} />
            <ThemedText type="small" themeColor="textSecondary">
              poeng denne uka
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {lifetimePoints} poeng totalt
          </ThemedText>
        </View>
      </View>

      <View style={styles.progressBlock}>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.brand }]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {pointsToNextLevel} poeng til nivå {level + 1}
        </ThemedText>
      </View>

      {badges.length > 0 && (
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <View
              key={badge.code}
              style={[styles.badgeChip, { backgroundColor: `${theme.brandSecondary}26` }]}>
              <ThemedText type="small">{badge.emoji}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.badgeLabel}>
                {badge.label}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLabel: {
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.85,
  },
  levelValue: {
    fontSize: 26,
    lineHeight: 30,
  },
  pointsCol: {
    flex: 1,
    gap: 2,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  pointsValue: {
    fontSize: 24,
    lineHeight: 28,
  },
  progressBlock: {
    gap: Spacing.one,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 1,
  },
  badgeLabel: {
    fontSize: 12,
  },
});
