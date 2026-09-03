import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Control, FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  /** 'large' is the full-width call to action at the end of a form. */
  size?: 'medium' | 'large';
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'medium',
}: Props) {
  const theme = useTheme();

  const backgroundColor =
    variant === 'primary' ? theme.brand : variant === 'danger' ? theme.danger : theme.backgroundSelected;
  const textColor =
    variant === 'primary' ? theme.onBrand : variant === 'danger' ? '#FFFFFF' : theme.text;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        size === 'large' && styles.buttonLarge,
        { backgroundColor },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText style={[styles.label, { color: textColor }]}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // One radius, one label size, two heights - the same control the auth and onboarding
  // screens build inline, so a button is the same object wherever it appears.
  button: {
    minHeight: 44,
    paddingHorizontal: Spacing.four,
    borderRadius: Control.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: {
    minHeight: Control.height,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
