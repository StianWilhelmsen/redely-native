import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Theme, type PaletteTokens } from '@/constants/theme';

const MODE_KEY = 'redely:appearance-mode';

/** 'system' follows the device; the other two override it for this app only. */
export type AppearanceMode = 'light' | 'dark' | 'system';

type PaletteContextValue = {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  tokens: PaletteTokens;
  scheme: 'light' | 'dark';
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    });
    // The four selectable palettes are gone, but a choice made before they were removed
    // would still be sitting in storage. Nothing reads it any more; clearing it keeps a
    // reinstall-free device from carrying a dead setting around forever.
    AsyncStorage.removeItem('ryddig-kollektiv:palette').catch(() => {});
  }, []);

  const setMode = (next: AppearanceMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  // An explicit choice wins over the device's; 'system' defers to it and keeps following
  // it, so a phone that switches at sunset takes the app with it.
  const scheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const tokens = Theme[scheme];

  const value = useMemo<PaletteContextValue>(
    () => ({ mode, setMode, tokens, scheme }),
    [mode, tokens, scheme]
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) {
    throw new Error('usePalette must be used within a PaletteProvider');
  }
  return ctx;
}
