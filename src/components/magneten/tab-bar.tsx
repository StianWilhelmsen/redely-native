import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { usePalette } from '@/theme/palette-context';

const ICONS: Record<string, (color: string) => React.ReactNode> = {
  index: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={5} y={3} width={14} height={18} rx={2} fill="none" stroke={c} strokeWidth={2} />
      <Circle cx={12} cy={8} r={2} fill={c} />
    </Svg>
  ),
  week: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={3.5} y={5} width={17} height={15} rx={2} fill="none" stroke={c} strokeWidth={2} />
      <Path d="M3.5 10h17" stroke={c} strokeWidth={2} />
    </Svg>
  ),
  lists: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M10 8h4M10 12h4" stroke={c} strokeWidth={2} />
    </Svg>
  ),
  family: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={8} cy={9} r={3} fill="none" stroke={c} strokeWidth={2} />
      <Circle cx={16.5} cy={10} r={2.5} fill="none" stroke={c} strokeWidth={2} />
      <Path
        d="M3 19c.8-3 2.8-4.5 5-4.5s4.2 1.5 5 4.5M13.5 18.5c.6-2 1.7-3 3-3s2.6 1 3.2 3"
        fill="none"
        stroke={c}
        strokeWidth={2}
      />
    </Svg>
  ),
};

const LABEL_KEYS: Record<string, string> = {
  index: 'tabs.door',
  week: 'tabs.week',
  lists: 'tabs.lists',
  family: 'tabs.family',
};

/** Height the floating bar takes from the bottom of the screen - pad scroll content by this. */
export const TAB_BAR_SPACE = 96;

/**
 * The dark pill tab bar floating over the door. Matches the canvas: the active tab gets
 * a lighter pill behind it.
 */
export function MagnetenTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { tokens } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { backgroundColor: tokens.ink, bottom: Math.max(insets.bottom, 12) + 6 }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? tokens.onInk : '#A7B4B8';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                Feel.tick();
                navigation.navigate(route.name);
              }
            }}
            style={[styles.tab, focused && styles.tabActive]}>
            {ICONS[route.name]?.(color)}
            <Text style={[styles.label, { color, fontFamily: focused ? FontFamily.bold : FontFamily.semiBold }]}>
              {t(LABEL_KEYS[route.name] ?? route.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 22,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: '#2F3B3F',
  },
  label: {
    fontSize: 11,
  },
});
