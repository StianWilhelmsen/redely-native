import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { FontFamily } from '@/constants/theme';
import { Feel, Landing } from '@/design/motion';

export type MagnePose = 'hei' | 'glad' | 'jubler' | 'sover' | 'trekker' | 'lurer' | 'smack';

type Props = {
  pose: MagnePose;
  /** Width in points. Height is always 1.25 × width. */
  size: number;
  /**
   * Bump this to replay a one-shot pose (smack). Looping poses ignore it.
   */
  playKey?: number;
  style?: StyleProp<ViewStyle>;
};

const RED = '#E8402A';
const INK = '#1B2326';
const METAL = '#CBD4D8';
const METAL_DARK = '#A3AFB4';

/** The body: a horseshoe magnet, drawn in a 120 × 150 box with the feet at y 132. */
const BODY = 'M14 112 V62 A46 46 0 0 1 106 62 V112 H78 V62 A18 18 0 0 0 42 62 V112 Z';

/**
 * Magne, the fridge magnet that holds the family's notes. Drawn once in SVG; each pose is
 * a face plus a movement. The movement runs on the wrapping views (so Reanimated drives
 * plain transforms) and the parts that move on their own - an arm, the field lines, the
 * z's - are separate layers on top of the same 120 × 150 grid.
 *
 * Mirrors Magne.dc.html on the design canvas.
 */
export function Magne({ pose, size, playKey = 0, style }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const s = size / 120;
  const height = size * 1.25;

  const y = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const tilt = useSharedValue(0);
  const wave = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Blink: open most of the time, shut for a moment every few seconds.
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (reduceMotion || (pose !== 'hei' && pose !== 'trekker')) return;
    let closeTimer: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setBlink(true);
      closeTimer = setTimeout(() => setBlink(false), 140);
    }, 3800);
    return () => {
      clearInterval(interval);
      clearTimeout(closeTimer);
    };
  }, [pose, reduceMotion]);

  useEffect(() => {
    [y, scaleX, scaleY, tilt, wave, pulse].forEach((v) => cancelAnimation(v));
    y.value = 0;
    scaleX.value = 1;
    scaleY.value = 1;
    tilt.value = 0;
    wave.value = 0;
    pulse.value = 0;
    if (reduceMotion) return;

    const loop = (to: number, half: number) =>
      withRepeat(
        withSequence(
          withTiming(to, { duration: half, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      );

    switch (pose) {
      case 'hei':
        y.value = loop(-3 * s, 1200);
        wave.value = loop(-28, 275);
        break;
      case 'glad':
        y.value = loop(-3 * s, 1200);
        break;
      case 'trekker':
        y.value = loop(-3 * s, 1200);
        pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1);
        break;
      case 'lurer':
        tilt.value = loop(-6, 1300);
        break;
      case 'sover':
        scaleY.value = loop(0.98, 1700);
        pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1);
        break;
      case 'jubler':
        y.value = withRepeat(
          withSequence(
            withTiming(-18 * s, { duration: 320, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 260 })
          ),
          -1
        );
        scaleY.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 640 }),
            withTiming(0.92, { duration: 120 }),
            withTiming(1, { duration: 140 })
          ),
          -1
        );
        break;
      case 'smack': {
        // Drop in from above, squash on impact, wobble, stand still.
        y.value = -80 * s;
        y.value = withTiming(0, { duration: 540, easing: Easing.in(Easing.quad) });
        scaleY.value = withDelay(
          540,
          withSequence(
            withTiming(0.76, { duration: 90 }),
            withTiming(1.08, { duration: 160, easing: Landing }),
            withTiming(1, { duration: 200 })
          )
        );
        scaleX.value = withDelay(
          540,
          withSequence(
            withTiming(1.2, { duration: 90 }),
            withTiming(0.94, { duration: 160, easing: Landing }),
            withTiming(1, { duration: 200 })
          )
        );
        const timer = setTimeout(Feel.smack, 540);
        return () => clearTimeout(timer);
      }
    }
    // playKey replays smack; s only changes with size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, playKey, reduceMotion, s]);

  // Squash and stretch around the feet, not the middle.
  const feetY = 132 * s;
  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { rotate: `${tilt.value}deg` },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));
  const arm = useAnimatedStyle(() => ({ transform: [{ rotate: `${wave.value}deg` }] }));
  const fieldA = useAnimatedStyle(() => ({ opacity: Math.sin(pulse.value * Math.PI) }));
  const fieldB = useAnimatedStyle(() => ({ opacity: Math.sin(((pulse.value + 0.33) % 1) * Math.PI) }));
  const fieldC = useAnimatedStyle(() => ({ opacity: Math.sin(((pulse.value + 0.66) % 1) * Math.PI) }));
  const shadow = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + y.value / (120 * s) }],
  }));

  const eyesOpen = (pose === 'hei' || pose === 'trekker') && !blink;
  const eyesClosed = pose === 'sover' || ((pose === 'hei' || pose === 'trekker') && blink);
  const eyesHappy = pose === 'glad' || pose === 'jubler';
  const armsUp = pose === 'jubler';
  const waving = pose === 'hei';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('magne.label')}
      style={[{ width: size, height }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shadow]}>
        <Svg width={size} height={height} viewBox="0 0 120 150">
          <Ellipse cx={60} cy={142} rx={38} ry={5} fill={INK} fillOpacity={0.14} />
        </Svg>
      </Animated.View>

      {pose === 'trekker' ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, fieldA]}>
            <Field d="M30 136 Q60 156 90 136" size={size} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, fieldB]}>
            <Field d="M24 138 Q60 168 96 138" size={size} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, fieldC]}>
            <Field d="M18 140 Q60 180 102 140" size={size} />
          </Animated.View>
        </>
      ) : null}

      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [size / 2, feetY, 0] }, body]}>
        {armsUp ? (
          <Svg width={size} height={height} viewBox="0 0 120 150" style={StyleSheet.absoluteFill}>
            <Line x1={16} y1={76} x2={4} y2={56} stroke={RED} strokeWidth={7} strokeLinecap="round" />
            <Circle cx={4} cy={55} r={5} fill={RED} />
            <Line x1={104} y1={76} x2={116} y2={56} stroke={RED} strokeWidth={7} strokeLinecap="round" />
            <Circle cx={116} cy={55} r={5} fill={RED} />
          </Svg>
        ) : null}
        {waving ? (
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [104 * s, 76 * s, 0] }, arm]}>
            <Svg width={size} height={height} viewBox="0 0 120 150">
              <Line x1={104} y1={76} x2={116} y2={56} stroke={RED} strokeWidth={7} strokeLinecap="round" />
              <Circle cx={116} cy={55} r={5} fill={RED} />
            </Svg>
          </Animated.View>
        ) : null}

        <Svg width={size} height={height} viewBox="0 0 120 150" style={StyleSheet.absoluteFill}>
          <Rect x={14} y={110} width={28} height={22} rx={2} fill={METAL} />
          <Rect x={78} y={110} width={28} height={22} rx={2} fill={METAL} />
          <Rect x={14} y={110} width={28} height={5} fill={METAL_DARK} />
          <Rect x={78} y={110} width={28} height={5} fill={METAL_DARK} />
          <Rect x={18} y={119} width={6} height={10} rx={2} fill="#FFFFFF" fillOpacity={0.7} />
          <Rect x={82} y={119} width={6} height={10} rx={2} fill="#FFFFFF" fillOpacity={0.7} />

          <Path d={BODY} fill={RED} />
          <Path d={BODY} fill="none" stroke="#B92C1A" strokeWidth={2} strokeOpacity={0.35} />
          <Path d="M23 64 A37 37 0 0 1 46 27" fill="none" stroke="#FF8A74" strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
          <Circle cx={41} cy={36} r={3.4} fill="#FF9C8C" opacity={0.9} />
          <Circle cx={79} cy={36} r={3.4} fill="#FF9C8C" opacity={0.9} />

          {eyesOpen ? (
            <G>
              <Ellipse cx={50} cy={28} rx={3.8} ry={4.6} fill={INK} />
              <Ellipse cx={70} cy={28} rx={3.8} ry={4.6} fill={INK} />
              <Circle cx={51.2} cy={26.4} r={1.3} fill="#FFFFFF" />
              <Circle cx={71.2} cy={26.4} r={1.3} fill="#FFFFFF" />
            </G>
          ) : null}
          {pose === 'lurer' ? (
            <G>
              <Ellipse cx={50} cy={28} rx={3.8} ry={4.6} fill={INK} />
              <Ellipse cx={70} cy={28} rx={3.8} ry={4.6} fill={INK} />
              <Circle cx={51.6} cy={25.6} r={1.6} fill="#FFFFFF" />
              <Circle cx={71.6} cy={25.6} r={1.6} fill="#FFFFFF" />
            </G>
          ) : null}
          {eyesHappy ? (
            <G fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M46 30 L50 25.5 L54 30" />
              <Path d="M66 30 L70 25.5 L74 30" />
            </G>
          ) : null}
          {eyesClosed ? (
            <G fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round">
              <Path d="M46 28 Q50 31.5 54 28" />
              <Path d="M66 28 Q70 31.5 74 28" />
            </G>
          ) : null}
          {pose === 'smack' ? (
            <G fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M46 25 L53 28.5 L46 32" />
              <Path d="M74 25 L67 28.5 L74 32" />
            </G>
          ) : null}

          {pose === 'hei' || pose === 'glad' || pose === 'trekker' ? (
            <Path d="M53 35.5 Q60 41.5 67 35.5" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          ) : null}
          {pose === 'jubler' || pose === 'smack' ? (
            <Path d="M52.5 34.5 Q60 45 67.5 34.5 Z" fill={INK} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          ) : null}
          {pose === 'sover' ? <Ellipse cx={60} cy={37} rx={2.4} ry={2.8} fill={INK} /> : null}
          {pose === 'lurer' ? (
            <Path d="M54 37 Q59 35.5 66 36.5" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          ) : null}
        </Svg>
      </Animated.View>

      {pose === 'sover' ? (
        <Animated.View style={[StyleSheet.absoluteFill, fieldA]}>
          <Svg width={size} height={height} viewBox="0 0 120 150">
            <SvgText x={96} y={20} fontSize={14} fontFamily={FontFamily.hand} fill="#55666B">z</SvgText>
            <SvgText x={104} y={8} fontSize={18} fontFamily={FontFamily.hand} fill="#55666B">Z</SvgText>
          </Svg>
        </Animated.View>
      ) : null}
      {pose === 'lurer' ? (
        <Svg width={size} height={height} viewBox="0 0 120 150" style={StyleSheet.absoluteFill}>
          <SvgText x={100} y={18} fontSize={24} fontFamily={FontFamily.hand} fill={RED}>?</SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

function Field({ d, size }: { d: string; size: number }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 120 150">
      <Path d={d} fill="none" stroke={RED} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="3 5" />
    </Svg>
  );
}
