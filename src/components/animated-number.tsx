import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useAnimatedCounter } from '@/lib/use-animated-counter';

type Props = Omit<ThemedTextProps, 'children'> & {
  value: number;
  formatter?: (n: number) => string;
  duration?: number;
};

export function AnimatedNumber({ value, formatter, duration, ...rest }: Props) {
  const display = useAnimatedCounter(value, duration);
  return <ThemedText {...rest}>{formatter ? formatter(display) : display}</ThemedText>;
}
