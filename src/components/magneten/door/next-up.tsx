import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import type { NoteMember } from '@/components/magneten/note';
import { FontFamily } from '@/constants/theme';
import { usePalette } from '@/theme/palette-context';

type Props = {
  minutesAway: number;
  time: string;
  title: string;
  /** "Jonas · Husk fotballbagen i gangen" */
  line: string;
  member: NoteMember;
  onPress: () => void;
};

/** The yellow "Neste nå" note with the red edge at the top of the door. */
export function NextUpCard({ minutesAway, time, title, line, member, onPress }: Props) {
  const { t } = useTranslation();
  const { tokens } = usePalette();

  const away =
    minutesAway < 1
      ? t('door.nextUpNow')
      : t('door.nextUpIn', {
          time:
            minutesAway < 60
              ? t('door.minutes', { count: minutesAway })
              : minutesAway % 60 === 0
                ? t('door.hours', { hours: minutesAway / 60 })
                : t('door.hoursMinutes', { hours: Math.floor(minutesAway / 60), minutes: minutesAway % 60 }),
        });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${away}, ${time}, ${title}, ${line}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: tokens.paperYellow, borderColor: tokens.magne, opacity: pressed ? 0.9 : 1 },
      ]}>
      <View style={styles.magnet} pointerEvents="none">
        <PhotoMagnet name={member.name} color={member.color} photoUrl={member.photoUrl} size={32} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.kicker, { color: tokens.brandSecondary }]}>{away}</Text>
        <Text style={[styles.title, { color: tokens.paperInk }]} numberOfLines={2}>
          {title}
        </Text>
        {line ? (
          <Text style={[styles.line, { color: tokens.textSecondary }]} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.time, { color: tokens.paperInk }]}>{time}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 3,
    transform: [{ rotate: '-0.8deg' }],
    shadowColor: '#1E2D32',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  magnet: { position: 'absolute', top: -17, left: 18 },
  kicker: { fontFamily: FontFamily.extraBold, fontSize: 12, letterSpacing: 0.5 },
  title: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 22, lineHeight: 32 },
  line: { fontFamily: FontFamily.regular, fontSize: 12.5 },
  time: { fontFamily: FontFamily.hand, paddingHorizontal: 3, fontSize: 30, lineHeight: 44 },
});
