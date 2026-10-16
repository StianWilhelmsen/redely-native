import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { usePalette } from '@/theme/palette-context';

const TORN =
  'M0 0 H342 V4 L330 9 L318 3 L304 8 L292 2 L278 9 L266 4 L252 8 L240 3 L226 9 L214 4 L200 8 L188 2 L174 9 L162 4 L148 8 L136 3 L122 9 L110 4 L96 8 L84 2 L70 9 L58 4 L44 8 L32 3 L18 9 L0 4 Z';

/**
 * A sheet off a lined notepad: blue lines (drawn by the rows themselves), a red margin,
 * a torn bottom edge, held up by one photo magnet.
 */
export function Notepad({
  children,
  magnet,
  style,
}: {
  children: ReactNode;
  magnet?: { name: string; color: string; photoUrl?: string | null };
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
}) {
  const { tokens } = usePalette();
  return (
    <Animated.View style={[styles.wrap, style]}>
      <View style={[styles.paper, { backgroundColor: tokens.paper }]}>
        <View style={[styles.margin, { backgroundColor: tokens.magne + '70' }]} />
        {children}
      </View>
      <Svg width="100%" height={10} viewBox="0 0 342 10" preserveAspectRatio="none">
        <Path d={TORN} fill={tokens.paper} />
      </Svg>
      {magnet ? (
        <View style={styles.magnet} pointerEvents="none">
          <PhotoMagnet name={magnet.name} color={magnet.color} photoUrl={magnet.photoUrl} size={30} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 6,
    marginTop: 10,
    shadowColor: '#1E2D32',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 10 },
  },
  paper: { paddingTop: 24, paddingBottom: 10, paddingLeft: 44, paddingRight: 16, elevation: 4 },
  margin: { position: 'absolute', top: 0, bottom: 0, left: 32, width: 1.5 },
  magnet: { position: 'absolute', top: -15, left: 0, right: 0, alignItems: 'center' },
});
