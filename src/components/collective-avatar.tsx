import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  pictureUrl?: string | null;
  size?: number;
};

/** The collective's own avatar - its picture when it has one, otherwise a plain house
 *  icon. Used anywhere the collective (not a specific member) needs a visual identity:
 *  the Kollektiv header, the group chat header, collective settings. */
export function CollectiveAvatar({ pictureUrl, size = 44 }: Props) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [pictureUrl]);

  if (pictureUrl && !failed) {
    return (
      <Image
        source={{ uri: pictureUrl }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${theme.brand}22` },
      ]}>
      <Ionicons name="home" size={size * 0.45} color={theme.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
