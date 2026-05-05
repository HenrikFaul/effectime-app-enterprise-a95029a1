export type Locale = 'en' | 'hu';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'hu'];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABEL: Record<Locale, { native: string; english: string; flag: string }> = {
  en: { native: 'English', english: 'English', flag: '🇬🇧' },
  hu: { native: 'Magyar', english: 'Hungarian', flag: '🇭🇺' },
};

export const LOCALE_STORAGE_KEY = 'effectime.locale';
