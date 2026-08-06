import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { memberColor, Radii } from '@/constants/theme';

type Props = {
  userId: number;
  name: string;
  pictureUrl?: string | null;
  size?: number;
  shape?: 'square' | 'circle';
};

/** Person avatar: shows their photo if they have one, otherwise a colored initial badge. */
export function AvatarBadge({ userId, name, pictureUrl, size = 32, shape = 'square' }: Props) {
  const radius = shape === 'circle' ? size / 2 : size * (Radii.card / 40);
  const [failed, setFailed] = useState(false);

  // Reset the failure flag whenever the URL itself changes (e.g. after a new upload).
  useEffect(() => {
    setFailed(false);
  }, [pictureUrl]);

  if (pictureUrl && !failed) {
    return (
      <Image
        source={{ uri: pictureUrl }}
        style={[styles.badge, { width: size, height: size, borderRadius: radius }]}
        onError={() => setFailed(true)}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const color = memberColor(userId);

  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: radius, backgroundColor: color },
      ]}>
      <ThemedText style={[styles.initial, { fontSize: size * 0.42, color: '#FFFFFF' }]}>
        {initial}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: 'Poppins_700Bold',
  },
});
