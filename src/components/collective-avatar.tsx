import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Hatching } from '@/components/hatched-placeholder';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  pictureUrl?: string | null;
  size?: number;
};

/**
 * The collective's own avatar - its picture when it has one, otherwise the hatched
 * placeholder that stands in for an unset photo everywhere else in the app. A rounded
 * square, deliberately unlike the circles used for people, so a glance tells you whether
 * you are looking at a household or a housemate.
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
      <Hatching size={size} color={theme.border} />
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
