import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { CollectiveAvatar } from '@/components/collective-avatar';
import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatInviteCode } from '@/lib/invite-code';
import type { Collective, Member } from '@/types/api';

type Props = {
  collective: Collective | null | undefined;
  code: string | undefined;
  members: Member[] | undefined;
  meId: number | undefined;
};

export function InviteStep({ collective, code, members, meId }: Props) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const displayCode = code ? formatInviteCode(code) : null;
  const shareMessage = displayCode
    ? `Bli med i ${collective?.name ?? 'kollektivet'} på Redely. Koden er ${displayCode}.`
    : '';

  const handleCopy = async () => {
    if (!displayCode) return;
    await Clipboard.setStringAsync(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    if (!shareMessage) return;
    try {
      await Share.share({ message: shareMessage });
    } catch {
      // Dismissing the share sheet is a normal outcome, not a failure to report.
    }
  };

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
        Del koden i gruppechatten. Den virker i 7 dager.
      </ThemedText>

      <View style={[styles.codeCard, { backgroundColor: theme.backgroundElement }]}>
        {displayCode ? (
          <ThemedText
            accessibilityLabel={`Invitasjonskode ${displayCode.split('').join(' ')}`}
            style={[styles.code, { color: theme.text }]}>
            {displayCode}
          </ThemedText>
        ) : (
          <RefreshSpinner active />
        )}

        <View style={styles.codeActions}>
          <Pressable
            accessibilityRole="button"
            onPress={handleShare}
            disabled={!displayCode}
            style={({ pressed }) => [
              styles.codeButton,
              { backgroundColor: theme.brand },
              !displayCode && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
              Del lenke
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleCopy}
            disabled={!displayCode}
            style={({ pressed }) => [
              styles.codeButton,
              { backgroundColor: theme.backgroundSelected },
              !displayCode && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{copied ? 'Kopiert!' : 'Kopier'}</ThemedText>
          </Pressable>
        </View>
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
  codeCard: {
    borderRadius: Radii.card,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  code: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 3,
  },
  codeActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  codeButton: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
