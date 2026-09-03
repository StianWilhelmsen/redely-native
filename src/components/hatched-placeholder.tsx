import { StyleSheet } from 'react-native';
import { Line, Svg } from 'react-native-svg';

type Props = {
  /** Side length of the square the hatching fills. */
  size: number;
  color: string;
};

/**
 * Diagonal hatching for an empty image slot - a collective without a photo, or the
 * picker before one is chosen. Decorative, so it stays out of the accessibility tree
 * and never intercepts the tap that opens the picker underneath it.
 *
 * React Native has no pattern fill, so the stripes are drawn as SVG lines. Stroke and
 * gap scale with the box, which keeps the texture looking the same at 44pt and 140pt.
 */
export function Hatching({ size, color }: Props) {
  const spacing = Math.max(6, size * 0.13);
  const strokeWidth = Math.max(2, size * 0.05);
  const count = Math.ceil((size * 2) / spacing);

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <Line
          key={i}
          x1={i * spacing - size}
          y1={size}
          x2={i * spacing}
          y2={0}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={0.45}
        />
      ))}
    </Svg>
  );
}
