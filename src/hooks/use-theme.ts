/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { usePalette } from '@/theme/palette-context';

export function useTheme() {
  return usePalette().tokens;
}
