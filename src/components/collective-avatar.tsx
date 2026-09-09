import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  pictureUrl?: string | null;
  size?: number;
};

/**
 * The collective's own avatar - its picture when it has one, otherwise the app's own
 * mark on a soft tile. A household without a photo is the common case, not an error, so
 * the empty state is something with a face rather than the grey hatched slot that used to
 * sit here. A rounded square, deliberately unlike the circles used for people, so a
 * glance tells you whether you are looking at a household or a housemate.
 */
export function CollectiveAvatar({ pictureUrl, size = 44 }: Props) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const borderRadius = size * 0.32;

  useEffect(() => {
    setFailed(false);
  }, [pictureUrl]);

  if (pictureUrl && !failed) {
    return (
      <Image
        source={{ uri: pictureUrl }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius, backgroundColor: theme.backgroundElement },
      ]}>
      <Image
        source={require('@/assets/logo.png')}
        contentFit="contain"
        style={{ width: size * 0.72, height: size * 0.72 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
