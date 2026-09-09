import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { RefreshSpinner } from '@/components/refresh-spinner';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatInviteCode, inviteLink } from '@/lib/invite-code';

type Props = {
  collectiveName: string | null | undefined;
  /** Bare code from the API; undefined while it is still being minted. */
  code: string | undefined;
};

const QR_SIZE = 168;

/**
 * The invite itself, in the two forms it travels in: a QR code for whoever is standing
 * next to you, and the short code for the group chat. The same card serves the last step
 * of creating a collective and the Inviter screen, so an invite looks the same wherever
 * it is handed out.
 */
export function InviteCodeCard({ collectiveName, code }: Props) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const displayCode = code ? formatInviteCode(code) : null;
  const shareMessage = displayCode
    ? `Bli med i ${collectiveName ?? 'kollektivet'} på Redely. Koden er ${displayCode}.`
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
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {/* Always dark-on-white, whatever the scheme: phone cameras read a QR code by its
          contrast, and an inverted one on a dark surface is a coin toss. */}
      <View style={styles.qrTile}>
        {code ? (
          <QRCode
            value={inviteLink(code)}
            size={QR_SIZE}
            color="#1F1B18"
            backgroundColor="#FFFFFF"
            ecl="M"
          />
        ) : (
          <View style={styles.qrPlaceholder}>
            <RefreshSpinner active />
          </View>
        )}
      </View>

      {displayCode && (
        <ThemedText
          accessibilityLabel={`Invitasjonskode ${displayCode.split('').join(' ')}`}
          style={[styles.code, { color: theme.text }]}>
          {displayCode}
        </ThemedText>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={handleShare}
          disabled={!displayCode}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.brand },
            !displayCode && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
            Del kode
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleCopy}
          disabled={!displayCode}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.backgroundSelected },
            !displayCode && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold">{copied ? 'Kopiert!' : 'Kopier'}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.three,
  },
  qrTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.chip,
    padding: Spacing.three,
  },
  qrPlaceholder: {
    width: QR_SIZE,
    height: QR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
