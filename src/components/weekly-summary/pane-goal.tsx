import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import {
  Chip,
  Eyebrow,
  PaneLayout,
  Reveal,
  RevealPop,
  StatTile,
  StoryNumber,
  Title,
  revealAt,
  storyText,
  useStage,
} from '@/components/weekly-summary/story-atoms';
import { Ink, PaneSkins } from '@/components/weekly-summary/story-theme';
import { FontFamily, Spacing } from '@/constants/theme';
import { goalHeadline, goalPercent, pointsDeltaLabel } from '@/lib/weekly-summary-copy';
import type { WeeklyStats } from '@/types/api';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DONUT_SIZE = 184;
const DONUT_STROKE = 13;

export function PaneGoal({ data }: { data: WeeklyStats }) {
  const percent = goalPercent(data);
  const delta = pointsDeltaLabel(data);

  return (
    <PaneLayout>
      <Reveal order={0}>
        <Eyebrow>Felles ukesmål</Eyebrow>
      </Reveal>
      <Reveal order={1} style={styles.title}>
        <Title>{goalHeadline(percent)}</Title>
      </Reveal>

      <View style={styles.center}>
        <RevealPop order={3}>
          <GoalDonut percent={percent} totalPoints={data.totalPoints} goalPoints={data.goalPoints} />
        </RevealPop>
        {delta && (
          <Reveal order={6} style={styles.delta}>
            <Chip>{delta}</Chip>
          </Reveal>
        )}
      </View>

      <View style={styles.tiles}>
        <StatTile
          order={7}
          value={`${data.plannedTasksCompleted}/${data.plannedTasks}`}
          label="faste oppgaver"
        />
        <StatTile order={8} value={String(data.quickActions)} label="småjobber" />
      </View>
    </PaneLayout>
  );
}

/** The ring sweeps in as the pane reveals, with the point count ticking up alongside it. */
function GoalDonut({
  percent,
  totalPoints,
  goalPoints,
}: {
  percent: number;
  totalPoints: number;
  goalPoints: number;
}) {
  const stage = useStage();
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - (revealAt(stage.value, 3) * percent) / 100),
  }));

  return (
    <View style={styles.donut}>
      <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={radius}
          stroke={Ink.track}
          strokeWidth={DONUT_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={radius}
          stroke={PaneSkins.goal.accent}
          strokeWidth={DONUT_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={arcProps}
          rotation={-90}
          origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.donutCenter}>
        <StoryNumber value={totalPoints} order={3} style={styles.donutValue} />
        <Text style={[storyText.body, styles.donutCaption]}>{`av ${goalPoints} poeng`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.two,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  donut: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutValue: {
    fontFamily: FontFamily.bold,
    fontSize: 52,
    lineHeight: 60,
    color: Ink.primary,
  },
  donutCaption: {
    fontSize: 13,
    color: Ink.secondary,
  },
  delta: {
    alignItems: 'center',
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
