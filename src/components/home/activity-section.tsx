import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { relativeDayLabel } from '@/lib/date-utils';
import type { ActivityEvent } from '@/types/api';

function describeEvent(event: ActivityEvent): string {
  const actor = event.actorName ?? 'Noen';
  switch (event.type) {
    case 'TASK_COMPLETED':
      return `${actor} fullførte "${event.taskTitle ?? 'en oppgave'}"`;
    case 'TASK_UNCOMPLETED':
      return `${actor} angret "${event.taskTitle ?? 'en oppgave'}"`;
    case 'TASK_REASSIGNED':
      return `${actor} omfordelte "${event.taskTitle ?? 'en oppgave'}"`;
    case 'QUICK_ACTION_DONE':
      return `${actor} gjorde ${event.quickActionEmoji ?? ''} ${event.quickActionTitle ?? 'en småoppgave'}`;
    default:
      return `${actor} gjorde noe`;
  }
}

export function ActivitySection({ events }: { events: ActivityEvent[] }) {
  const theme = useTheme();
  const recent = events.slice(0, 8);

  return (
    <Section title="Siste aktivitet">
      {recent.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Ingen aktivitet ennå — fullfør en oppgave for å komme i gang.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {recent.map((event, index) => (
            <Animated.View
              key={`${event.type}-${event.id}`}
              entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(240)}
              style={styles.row}>
              <View style={[styles.dot, { backgroundColor: theme.brand }]} />
              <View style={styles.body}>
                <ThemedText type="small">{describeEvent(event)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {relativeDayLabel(event.createdAt)}
                </ThemedText>
              </View>
            </Animated.View>
          ))}
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.half,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  body: {
    flex: 1,
    gap: 1,
  },
});
