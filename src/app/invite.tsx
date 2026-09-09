import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import useSWR from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { ErrorState } from '@/components/error-state';
import { InviteCodeCard } from '@/components/invite-code-card';
import { ScreenScroll } from '@/components/screen-scroll';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

/**
 * Where an existing collective brings in one more person. The backend hands back the
 * collective's live code rather than minting a new one on every visit (InviteService),
 * so opening this screen twice shows the same code that was already shared.
 */
export default function InviteScreen() {
  const theme = useTheme();
  const { data: me } = useMe();
  const collective = me?.collective ?? null;
  const {
    data: invite,
    error,
    mutate,
  } = useSWR(collective ? 'collective-invite' : null, api.createInvite, {
    revalidateOnFocus: false,
  });
  const { data: members } = useSWR(collective ? 'members' : null, api.members);

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lukk"
      onPress={() => router.back()}
      hitSlop={Spacing.two}
      style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="close" size={20} color={theme.text} />
    </Pressable>
  );

  return (
    <ScreenScroll eyebrow={collective?.name ?? 'Kollektiv'} title="Inviter" headerRight={closeButton}>
      <ThemedText type="default" themeColor="textSecondary" style={styles.lead}>
        La den nye samboeren skanne QR-koden med mobilkameraet, eller del koden i
        gruppechatten. Den virker i 7 dager.
      </ThemedText>

      {error ? (
        <ErrorState message="Klarte ikke å lage invitasjonskode." onRetry={() => mutate()} />
      ) : (
        <InviteCodeCard collectiveName={collective?.name} code={invite?.code} />
      )}

      <Section
        title="Hvem bor her"
        meta={members ? `${members.length} ${members.length === 1 ? 'medlem' : 'medlemmer'}` : undefined}
        variant="eyebrow">
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
              {member.id === me?.id && (
                <ThemedText type="small" themeColor="textSecondary">
                  deg
                </ThemedText>
              )}
            </View>
          ))}
          <View style={styles.memberRow}>
            <View style={[styles.pendingAvatar, { borderColor: theme.border }]} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.memberName}>
              Venter på at noen bruker koden…
            </ThemedText>
          </View>
        </View>
      </Section>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lead: {
    lineHeight: 22,
    maxWidth: 360,
  },
  members: {
    gap: Spacing.three,
    paddingTop: Spacing.one,
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
