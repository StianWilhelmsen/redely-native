import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Palettes, type PaletteId, type PaletteTokens } from '@/constants/theme';

const PALETTE_KEY = 'ryddig-kollektiv:palette';
const MODE_KEY = 'redely:appearance-mode';

const DEFAULT_PALETTE: PaletteId = 'redely';

/** 'system' follows the device; the other two override it for this app only. */
export type AppearanceMode = 'light' | 'dark' | 'system';

type PaletteContextValue = {
  paletteId: PaletteId;
  setPaletteId: (id: PaletteId) => void;
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  tokens: PaletteTokens;
  scheme: 'light' | 'dark';
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [paletteId, setPaletteIdState] = useState<PaletteId>(DEFAULT_PALETTE);
  const [mode, setModeState] = useState<AppearanceMode>('system');

  useEffect(() => {
    AsyncStorage.multiGet([PALETTE_KEY, MODE_KEY]).then((entries) => {
      const stored = Object.fromEntries(entries);
      const palette = stored[PALETTE_KEY];
      if (palette && palette in Palettes) setPaletteIdState(palette as PaletteId);

      const storedMode = stored[MODE_KEY];
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setModeState(storedMode);
      }
    });
  }, []);

  const setPaletteId = (id: PaletteId) => {
    setPaletteIdState(id);
    AsyncStorage.setItem(PALETTE_KEY, id).catch(() => {});
  };

  const setMode = (next: AppearanceMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  // An explicit choice wins over the device's; 'system' defers to it and keeps following
  // it, so a phone that switches at sunset takes the app with it.
  const scheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const tokens = Palettes[paletteId][scheme];

  const value = useMemo<PaletteContextValue>(
    () => ({ paletteId, setPaletteId, mode, setMode, tokens, scheme }),
    [paletteId, mode, tokens, scheme]
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
