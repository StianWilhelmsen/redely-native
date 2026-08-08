/**
 * The story shell: a paged horizontal scroller where the background morphs between panes
 * while their content slides with a touch of parallax.
 *
 * Panes are advanced by tapping — the right two thirds go forward, the left third back —
 * or by swiping, which is why the content sits in a real ScrollView rather than a
 * hand-rolled gesture. Tap targets live *under* the pane content, so every pane renders its
 * body with `pointerEvents="none"` and passes anything interactive through `footer`.
 */

import * as Haptics from 'expo-haptics';
import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import {
  PaneBackdrop,
  STAGE_DURATION_MS,
  StageProvider,
} from '@/components/weekly-summary/story-atoms';
import { Ink, type PaneSkin } from '@/components/weekly-summary/story-theme';

export type StoryPaneDefinition = {
  key: string;
  skin: PaneSkin;
  /** Non-interactive pane body. Taps fall through it to the navigation zones. */
  content: ReactNode;
  /** Interactive row pinned to the bottom, above the tap zones. */
  footer?: ReactNode;
};

/** A pane starts revealing while it is still sliding in, not once it has settled. */
const REVEAL_DISTANCE = 0.85;

export function StoryPager({
  panes,
  header,
  onIndexChange,
}: {
  panes: StoryPaneDefinition[];
  /** Rendered above every pane — the week label and close button. */
  header?: ReactNode;
  onIndexChange?: (index: number) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView> | null>(null);
  const offset = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = width > 0 ? event.contentOffset.x / width : 0;
    },
  });

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= panes.length || next === index) return;
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      setIndex(next);
      onIndexChange?.(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    },
    [index, onIndexChange, panes.length, width]
  );

  const settle = useCallback(
    (contentOffsetX: number) => {
      const next = width > 0 ? Math.round(contentOffsetX / width) : 0;
      if (next === index) return;
      setIndex(next);
      onIndexChange?.(next);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    [index, onIndexChange, width]
  );

  return (
    <View style={styles.root}>
      {/* Backgrounds cross-fade in place while the content pages sideways. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {panes.map((pane, paneIndex) => (
          <BackdropLayer
            key={pane.key}
            skin={pane.skin}
            index={paneIndex}
            offset={offset}
            width={width}
            height={height}
          />
        ))}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
        decelerationRate="fast"
        style={styles.scroller}>
        {panes.map((pane, paneIndex) => (
          <StoryPane
            key={pane.key}
            pane={pane}
            index={paneIndex}
            offset={offset}
            width={width}
            isFirst={paneIndex === 0}
            isLast={paneIndex === panes.length - 1}
            bottomInset={insets.bottom}
            onNext={() => goTo(paneIndex + 1)}
            onPrevious={() => goTo(paneIndex - 1)}
          />
        ))}
      </Animated.ScrollView>

      <View style={[styles.chrome, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.progressRow} pointerEvents="none">
          {panes.map((pane, paneIndex) => (
            <ProgressSegment key={pane.key} index={paneIndex} offset={offset} />
          ))}
        </View>
        <View pointerEvents="box-none">{header}</View>
      </View>
    </View>
  );
}

function BackdropLayer({
  skin,
  index,
  offset,
  width,
  height,
}: {
  skin: PaneSkin;
  index: number;
  offset: SharedValue<number>;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [index - 1, index, index + 1], [0, 1, 0], 'clamp'),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <PaneBackdrop skin={skin} width={width} height={height} />
    </Animated.View>
  );
}

function ProgressSegment({ index, offset }: { index: number; offset: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { scaleX: Math.max(0, Math.min(1, offset.value - index + 1)) },
    ],
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]} />
    </View>
  );
}

function StoryPane({
  pane,
  index,
  offset,
  width,
  isFirst,
  isLast,
  bottomInset,
  onNext,
  onPrevious,
}: {
  pane: StoryPaneDefinition;
  index: number;
  offset: SharedValue<number>;
  width: number;
  isFirst: boolean;
  isLast: boolean;
  bottomInset: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const stage = useSharedValue(0);

  useAnimatedReaction(
    () => Math.abs(offset.value - index) < REVEAL_DISTANCE,
    (isNear, wasNear) => {
      if (isNear === wasNear) return;
      stage.value = isNear
        ? withTiming(1, { duration: STAGE_DURATION_MS, easing: Easing.linear })
        : 0;
    }
  );

  // The page has already moved a full width by the time it is centred; this adds a slower
  // counter-drift on top, so content trails the swipe instead of moving locked to it.
  const contentStyle = useAnimatedStyle(() => {
    const distance = offset.value - index;
    return {
      opacity: interpolate(Math.abs(distance), [0, 1], [1, 0.15], 'clamp'),
      transform: [
        { translateX: interpolate(distance, [-1, 0, 1], [width * 0.22, 0, -width * 0.22], 'clamp') },
        { scale: interpolate(Math.abs(distance), [0, 1], [1, 0.92], 'clamp') },
      ],
    };
  });

  return (
    <View style={[styles.pane, { width }]}>
      <StageProvider stage={stage}>
        <Animated.View style={[styles.paneBody, contentStyle]} pointerEvents="none">
          {pane.content}
        </Animated.View>

        {/* Navigation zones sit above the (inert) body but below the footer, so a footer
            button keeps its own taps while everything else advances the story. */}
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forrige"
            disabled={isFirst}
            onPress={onPrevious}
            style={styles.zoneBack}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Neste"
            disabled={isLast}
            onPress={onNext}
            style={styles.zoneForward}
          />
        </View>

        {pane.footer ? (
          <Animated.View
            style={[styles.paneFooter, { paddingBottom: bottomInset + Spacing.four }, contentStyle]}>
            {pane.footer}
          </Animated.View>
        ) : null}
      </StageProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0C0F0D',
  },
  scroller: {
    flex: 1,
  },
  pane: {
    flex: 1,
  },
  paneBody: {
    flex: 1,
  },
  paneFooter: {
    paddingHorizontal: Spacing.four,
  },
  zoneBack: {
    ...StyleSheet.absoluteFillObject,
    right: '65%',
  },
  zoneForward: {
    ...StyleSheet.absoluteFillObject,
    left: '35%',
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  progressRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Ink.track,
    overflow: 'hidden',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Ink.primary,
    borderRadius: 2,
    transformOrigin: 'left',
  },
});
