import { StyleSheet, View } from 'react-native';

import { CollectiveAvatar } from '@/components/collective-avatar';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  name: string;
  pictureUrl: string | null;
  memberCount: number;
  weekNumber: number;
};

/** Identity only - settings for the collective are reached from Innstillinger, so this
 *  header has nothing to act on and stays a label. */
export function CollectiveHeader({ name, pictureUrl, memberCount, weekNumber }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <CollectiveAvatar pictureUrl={pictureUrl} size={56} />
      <View style={styles.text}>
        <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {memberCount} {memberCount === 1 ? 'medlem' : 'medlemmer'} · uke {weekNumber}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
  },
});
