/**
 * Shared building blocks for the weekly story.
 *
 * Every pane animates off a single shared value — `stage` — that ramps 0 → 1 once the pane
 * comes into view. Elements pick a slice of that ramp based on their `order`, which is what
 * produces the staggered entrance without a timer or a chain of `withDelay` calls per element,
 * and lets the whole reveal replay by simply resetting one number.
 */

import { Image } from 'expo-image';
import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { FontFamily, memberColor, Radii, Spacing } from '@/constants/theme';
import { Ink, type PaneSkin } from '@/components/weekly-summary/story-theme';

/** How long the full staged reveal of one pane takes, end to end. */
export const STAGE_DURATION_MS = 1500;

const StageContext = createContext<SharedValue<number> | null>(null);

export function StageProvider({ stage, children }: { stage: SharedValue<number>; children: ReactNode }) {
  return <StageContext.Provider value={stage}>{children}</StageContext.Provider>;
}

export function useStage(): SharedValue<number> {
  const stage = useContext(StageContext);
  if (!stage) throw new Error('Story elements must be rendered inside a StoryPane');
  return stage;
}

/**
 * Element `order`'s own 0 → 1 progress within the pane's ramp, eased. Later elements start
 * later, but the start is capped so a long list still finishes inside the ramp.
 */
export function revealAt(stage: number, order: number): number {
  'worklet';
  const start = Math.min(0.6, order * 0.075);
  const raw = interpolate(stage, [start, start + 0.35], [0, 1], Extrapolation.CLAMP);
  return 1 - Math.pow(1 - raw, 3);
}

type RevealProps = {
  order?: number;
  /** How far below its resting place the element starts, in px. */
  from?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Fades and lifts its children into place when their turn in the stagger comes up. */
export function Reveal({ order = 0, from = 18, style, children }: RevealProps) {
  const stage = useStage();
  const animatedStyle = useAnimatedStyle(() => {
    const progress = revealAt(stage.value, order);
    return {
      opacity: progress,
      transform: [{ translateY: (1 - progress) * from }],
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Same entrance, but scaling up from a point — for the donut, the MVP avatar and medals. */
export function RevealPop({ order = 0, style, children }: Omit<RevealProps, 'from'>) {
  const stage = useStage();
  const animatedStyle = useAnimatedStyle(() => {
    const progress = revealAt(stage.value, order);
    return {
      opacity: progress,
      transform: [{ scale: 0.82 + progress * 0.18 }],
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Counts up to `value` as its slice of the stage plays out. */
export function StoryNumber({
  value,
  order = 0,
  style,
  suffix = '',
}: {
  value: number;
  order?: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
}) {
  const stage = useStage();
  const [display, setDisplay] = useState(0);

  useAnimatedReaction(
    () => Math.round(revealAt(stage.value, order) * value),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setDisplay, current);
    },
    [value]
  );

  return <Text style={style}>{`${display}${suffix}`}</Text>;
}

/** The pane's gradient ground, plus its optional radial glow. */
export function PaneBackdrop({
  skin,
  width,
  height,
}: {
  skin: PaneSkin;
  width: number;
  height: number;
}) {
  // SVG references gradients by id, and useId's output contains characters that aren't
  // valid there — strip them so `url(#...)` resolves.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`base${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={skin.gradient[0]} />
          <Stop offset="1" stopColor={skin.gradient[1]} />
        </LinearGradient>
        {skin.glow && (
          <RadialGradient
            id={`glow${id}`}
            cx={`${skin.glow.cx * 100}%`}
            cy={`${skin.glow.cy * 100}%`}
            r={`${skin.glow.radius * 100}%`}>
            <Stop offset="0" stopColor={skin.glow.color} stopOpacity={skin.glow.opacity} />
            <Stop offset="1" stopColor={skin.glow.color} stopOpacity="0" />
          </RadialGradient>
        )}
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#base${id})`} />
      {skin.glow && <Rect x="0" y="0" width={width} height={height} fill={`url(#glow${id})`} />}
    </Svg>
  );
}

/** Height of the progress bar + week header the panes have to clear at the top. */
export const STORY_CHROME_HEIGHT = 64;

/**
 * Shared pane padding. Panes with a footer stop short of the bottom inset, because the
 * pager owns that space for the interactive row.
 */
export function PaneLayout({
  children,
  hasFooter = false,
  style,
}: {
  children: ReactNode;
  hasFooter?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        storyStyles.paneLayout,
        {
          paddingTop: insets.top + STORY_CHROME_HEIGHT,
          paddingBottom: hasFooter ? Spacing.three : insets.bottom + Spacing.four,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={storyText.eyebrow}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={storyText.title}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[storyText.body, muted && { color: Ink.muted }]}>{children}</Text>;
}

/** Rounded label used for the MVP badges and the "+3 poeng" pill. */
export function Chip({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <View style={[storyStyles.chip, { backgroundColor: strong ? Ink.surfaceStrong : Ink.surface }]}>
      <Text style={storyText.chip}>{children}</Text>
    </View>
  );
}

/** A big number over a small caption — the recap grid and the goal pane's footer. */
export function StatTile({
  value,
  label,
  order,
  style,
}: {
  value: ReactNode;
  label: string;
  order: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Reveal order={order} style={[storyStyles.tile, style]}>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={storyText.tileValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      ) : (
        value
      )}
      <Text style={storyText.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Reveal>
  );
}

/**
 * Member avatar on a colored ground: their photo when they have one, otherwise their
 * initial. `solid` is the spotlight treatment used for the MVP.
 */
export function StoryAvatar({
  userId,
  name,
  pictureUrl,
  size = 34,
  variant = 'ghost',
  solidTextColor = '#2A1233',
}: {
  userId: number;
  name: string;
  pictureUrl?: string | null;
  size?: number;
  variant?: 'ghost' | 'solid';
  solidTextColor?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (pictureUrl && !failed) {
    return (
      <Image
        source={{ uri: pictureUrl }}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: variant === 'solid' ? 0 : StyleSheet.hairlineWidth,
          borderColor: Ink.hairline,
        }}
      />
    );
  }

  const solid = variant === 'solid';
  return (
    <View
      style={[
        storyStyles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: solid ? '#FFFFFF' : Ink.surfaceStrong,
          borderWidth: solid ? 0 : StyleSheet.hairlineWidth,
          borderColor: Ink.hairline,
        },
      ]}>
      {/* A wash of the member's own color under the initial, so people stay
          distinguishable at a glance without breaking the white-on-color scheme. */}
      {!solid && (
        <View
          style={[
            storyStyles.avatarTint,
            { borderRadius: size / 2, backgroundColor: `${memberColor(userId)}55` },
          ]}
        />
      )}
      <Text
        style={{
          fontFamily: FontFamily.bold,
          fontSize: size * 0.4,
          color: solid ? solidTextColor : Ink.primary,
        }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

/** Horizontal meter that fills as the pane reveals. */
export function StoryBar({
  percent,
  order,
  color,
  height = 6,
}: {
  percent: number;
  order: number;
  color: string;
  height?: number;
}) {
  const stage = useStage();
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: revealAt(stage.value, order) * Math.max(0, Math.min(1, percent / 100)) }],
  }));

  return (
    <View style={[storyStyles.barTrack, { height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          storyStyles.barFill,
          { backgroundColor: color, borderRadius: height / 2 },
          fillStyle,
        ]}
      />
    </View>
  );
}

export const storyText = StyleSheet.create({
  eyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Ink.muted,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.6,
    color: Ink.primary,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Ink.secondary,
  },
  chip: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    lineHeight: 16,
    color: Ink.primary,
  },
  tileValue: {
    fontFamily: FontFamily.bold,
    fontSize: 23,
    lineHeight: 30,
    color: Ink.primary,
  },
  tileLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    lineHeight: 16,
    color: Ink.muted,
  },
  rowTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    color: Ink.primary,
  },
  rowMeta: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    lineHeight: 17,
    color: Ink.secondary,
  },
});

export const storyStyles = StyleSheet.create({
  paneLayout: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  chip: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two - 1,
  },
  tile: {
    flex: 1,
    gap: 2,
    borderRadius: Radii.card,
    backgroundColor: Ink.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarTint: {
    ...StyleSheet.absoluteFillObject,
  },
  barTrack: {
    width: '100%',
    backgroundColor: Ink.track,
    overflow: 'hidden',
  },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: 'left',
  },
});
