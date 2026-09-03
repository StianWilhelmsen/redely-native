import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Palettes, type PaletteId, type PaletteTokens } from '@/constants/theme';

const STORAGE_KEY = 'ryddig-kollektiv:palette';
const DEFAULT_PALETTE: PaletteId = 'redely';

type PaletteContextValue = {
  paletteId: PaletteId;
  setPaletteId: (id: PaletteId) => void;
  tokens: PaletteTokens;
  scheme: 'light' | 'dark';
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const scheme: 'light' | 'dark' = systemScheme === 'dark' ? 'dark' : 'light';
  const [paletteId, setPaletteIdState] = useState<PaletteId>(DEFAULT_PALETTE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && stored in Palettes) {
        setPaletteIdState(stored as PaletteId);
      }
    });
  }, []);

  const setPaletteId = (id: PaletteId) => {
    setPaletteIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  };

  const tokens = Palettes[paletteId][scheme];

  const value = useMemo<PaletteContextValue>(
    () => ({ paletteId, setPaletteId, tokens, scheme }),
    [paletteId, tokens, scheme]
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
