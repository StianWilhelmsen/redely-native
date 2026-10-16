/**
 * Norwegian (bokmål) and English, from the first line of the new app.
 *
 * Every user-facing string lives in `locales/*.json` - never inline in a component. The
 * Norwegian file is the source of truth; English is written by hand, not machine
 * translated, because Magne's voice is part of the brand.
 *
 * The language is either chosen in Meg › Språk, or follows the phone. A phone set to
 * Norwegian, Nynorsk or "no" gets bokmål; everything else gets English.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import nb from './locales/nb.json';

export type AppLanguage = 'nb' | 'en';
export type LanguageSetting = AppLanguage | 'system';

const LANGUAGE_KEY = 'magneten:language';

/**
 * Read from Hermes' Intl rather than expo-localization: same answer, and no native module,
 * so adding languages never costs an EAS build.
 */
function deviceLanguage(): AppLanguage {
  const code = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0].toLowerCase();
  return code === 'nb' || code === 'nn' || code === 'no' ? 'nb' : 'en';
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: { nb: { translation: nb }, en: { translation: en } },
  lng: deviceLanguage(),
  fallbackLng: 'nb',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Apply a stored choice made in an earlier session. Called once at startup. */
export async function restoreLanguageSetting(): Promise<LanguageSetting> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null);
  const setting: LanguageSetting = stored === 'nb' || stored === 'en' ? stored : 'system';
  await i18n.changeLanguage(setting === 'system' ? deviceLanguage() : setting);
  return setting;
}

export async function setLanguageSetting(setting: LanguageSetting): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, setting).catch(() => {});
  await i18n.changeLanguage(setting === 'system' ? deviceLanguage() : setting);
}

/** The language currently on screen - send this to the backend so pushes match it. */
export function currentLanguage(): AppLanguage {
  return i18n.language === 'en' ? 'en' : 'nb';
}

export default i18n;
