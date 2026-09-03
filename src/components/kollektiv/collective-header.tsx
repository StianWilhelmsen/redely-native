import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CollectiveAvatar } from '@/components/collective-avatar';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  name: string;
  pictureUrl: string | null;
  memberCount: number;
  weekNumber: number;
  onSettingsPress: () => void;
};

export function CollectiveHeader({
  name,
  pictureUrl,
  memberCount,
  weekNumber,
  onSettingsPress,
}: Props) {
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kollektivinnstillinger"
        onPress={onSettingsPress}
        hitSlop={Spacing.three}
        style={({ pressed }) => pressed && styles.pressed}>
        <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
      </Pressable>
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
  pressed: {
    opacity: 0.6,
  },
});
