import { StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { InviteCodeCard } from '@/components/invite-code-card';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Collective, Member } from '@/types/api';

type Props = {
  collective: Collective | null | undefined;
  code: string | undefined;
  members: Member[] | undefined;
  meId: number | undefined;
};

export function InviteStep({ collective, code, members, meId }: Props) {
  const theme = useTheme();

  return (
    <>
      <View style={styles.header}>
        <CollectiveAvatar pictureUrl={collective?.pictureUrl} size={48} />
        <View style={styles.headerText}>
          <ThemedText type="heading" numberOfLines={1}>
            {collective?.name ?? 'Kollektivet'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Opprettet · bare deg foreløpig
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.title, { color: theme.text }]}>Hent inn de andre</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
        La dem skanne QR-koden, eller del koden i gruppechatten. Den virker i 7 dager.
      </ThemedText>

      <View style={styles.card}>
        <InviteCodeCard collectiveName={collective?.name} code={code} />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.membersLabel}>
        Hvem bor her?
      </ThemedText>

      <View style={styles.members}>
        {(members ?? []).map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <AvatarBadge
              userId={member.id}
              name={member.name}
              pictureUrl={member.pictureUrl}
              shape="circle"
              size={32}
            />
            <ThemedText type="smallBold" style={styles.memberName} numberOfLines={1}>
              {member.name}
            </ThemedText>
            {member.id === meId && (
              <ThemedText type="small" themeColor="textSecondary">
                deg
              </ThemedText>
            )}
          </View>
        ))}

        {/* A placeholder seat rather than an empty list: it says the code is live and
            waiting, which is the one thing this screen is asking them to act on. */}
        <View style={styles.memberRow}>
          <View style={[styles.pendingAvatar, { borderColor: theme.border }]} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.memberName}>
            Venter på at noen bruker koden…
          </ThemedText>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
    marginTop: Spacing.four,
  },
  subtitle: {
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  card: {
    marginTop: Spacing.four,
  },
  membersLabel: {
    marginTop: Spacing.four,
  },
  members: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  memberName: {
    flex: 1,
    minWidth: 0,
  },
  pendingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
