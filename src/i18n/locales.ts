// Locale identifiers follow BCP 47 short tags (2-letter ISO 639-1).
// To add a new locale: (1) create src/i18n/resources/<tag>.ts,
// (2) add the tag to SUPPORTED_LOCALES, (3) add a LOCALE_LABEL entry.
// The Locale type uses a base union for type-safety on the core pair
// but allows any string so new locales can be added without a type change.
export type Locale = 'en' | 'hu' | 'cs' | 'sk' | 'pl' | 'de' | 'at' | 'ro' | (string & {});

// v3.28.0 (Top-20 Rank 16): added DACH/CEE locales. de/at/ro start as
// English-equivalent scaffolds; professional translation is a content
// task tracked outside the repo. Runtime falls back to English for any
// untranslated key.
export const SUPPORTED_LOCALES: Locale[] = ['en', 'hu', 'cs', 'sk', 'pl', 'de', 'at', 'ro'];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABEL: Record<string, { native: string; english: string; flag: string }> = {
  en: { native: 'English', english: 'English', flag: '🇬🇧' },
  hu: { native: 'Magyar', english: 'Hungarian', flag: '🇭🇺' },
  cs: { native: 'Čeština', english: 'Czech', flag: '🇨🇿' },
  sk: { native: 'Slovenčina', english: 'Slovak', flag: '🇸🇰' },
  pl: { native: 'Polski', english: 'Polish', flag: '🇵🇱' },
  de: { native: 'Deutsch', english: 'German', flag: '🇩🇪' },
  at: { native: 'Österreichisches Deutsch', english: 'Austrian German', flag: '🇦🇹' },
  ro: { native: 'Română', english: 'Romanian', flag: '🇷🇴' },
};

export const LOCALE_STORAGE_KEY = 'effectime.locale';
