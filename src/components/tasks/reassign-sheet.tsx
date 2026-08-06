import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Member } from '@/types/api';

type Props = {
  visible: boolean;
  members: Member[];
  onClose: () => void;
  onSelect: (userId: number) => void;
};

export function ReassignSheet({ visible, members, onClose, onSelect }: Props) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView type="backgroundElement" style={[styles.sheet, { borderColor: theme.border }]}>
        <ThemedText type="smallBold" style={styles.title}>
          Tildel til
        </ThemedText>
        {members.map((member) => (
          <Pressable
            key={member.id}
            onPress={() => onSelect(member.id)}
            style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
            <ThemedText>{member.name}</ThemedText>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel}>
          <ThemedText type="small" themeColor="textSecondary">
            Avbryt
          </ThemedText>
        </Pressable>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  title: {
    marginBottom: Spacing.two,
  },
  row: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  cancel: {
    paddingTop: Spacing.three,
    alignItems: 'center',
  },
});
