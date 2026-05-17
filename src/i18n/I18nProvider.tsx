import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type Locale,
} from './locales';
import en from './resources/en';
import hu from './resources/hu';
import cs from './resources/cs';
import sk from './resources/sk';
import pl from './resources/pl';
import de from './resources/de';
import at from './resources/at';
import ro from './resources/ro';
import {
  enUS as dfEnUS,
  hu as dfHu,
  cs as dfCs,
  sk as dfSk,
  pl as dfPl,
  de as dfDe,
  ro as dfRo,
} from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';

type Bundle = typeof en;

// Indexed by locale tag; all non-English bundles are cast so missing keys
// silently fall back to English at runtime via the lookup chain.
const BUNDLES: Record<string, Bundle> = {
  en,
  hu: hu as unknown as Bundle,
  cs: cs as unknown as Bundle,
  sk: sk as unknown as Bundle,
  pl: pl as unknown as Bundle,
  // v3.28.0 DACH/CEE scaffolds — currently fall back to English string
  // values; replace with professional translations to activate.
  de: de as unknown as Bundle,
  at: at as unknown as Bundle,
  ro: ro as unknown as Bundle,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
  /** Load persistent translation overrides for a workspace (admin-managed). */
  loadWorkspaceOverrides: (workspaceId: string | null) => Promise<void>;
  /** Currently-active workspace whose overrides are merged in. */
  activeWorkspaceId: string | null;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  const browser = (navigator.language || '').toLowerCase().split('-')[0] as Locale;
  if (SUPPORTED_LOCALES.includes(browser)) return browser;
  return DEFAULT_LOCALE;
}

function lookup(bundle: Bundle, key: string): string | undefined {
  const parts = key.split('.');
  let cur: any = bundle;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(value: string, vars?: Record<string, string | number>): string {
  if (!vars) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : `{{${k}}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());
  const [ready, setReady] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [overridesByLocale, setOverridesByLocale] = useState<Record<string, Map<string, string>>>(
    () => Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, new Map<string, string>()])),
  );

  const loadWorkspaceOverrides = useCallback(async (workspaceId: string | null) => {
    setActiveWorkspaceId(workspaceId);
    if (!workspaceId) {
      setOverridesByLocale(
        Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, new Map<string, string>()])),
      );
      return;
    }
    try {
      const { data } = await (supabase as any)
        .from('enterprise_translation_overrides')
        .select('locale, key, value')
        .eq('workspace_id', workspaceId);
      const next: Record<string, Map<string, string>> = Object.fromEntries(
        SUPPORTED_LOCALES.map((l) => [l, new Map<string, string>()]),
      );
      ((data as any[]) || []).forEach((row: any) => {
        const l = row.locale as string;
        if (l in next) next[l].set(row.key, row.value);
      });
      setOverridesByLocale(next);
    } catch {
      // table may not exist yet in dev — degrade silently
    }
  }, []);

  // Hydrate from profiles.preferred_locale once, when a user is signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          const { data } = await (supabase as any)
            .from('profiles')
            .select('preferred_locale')
            .eq('id', user.id)
            .maybeSingle();
          if (cancelled) return;
          const remote = data?.preferred_locale as Locale | null;
          if (remote && SUPPORTED_LOCALES.includes(remote) && remote !== locale) {
            setLocaleState(remote);
            window.localStorage.setItem(LOCALE_STORAGE_KEY, remote);
          }
        }
      } catch {
        // Silent: profile or column may not exist in dev/local
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run only on first mount; locale changes do their own persistence below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update <html lang>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!SUPPORTED_LOCALES.includes(next)) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
    // Best-effort persist on profile
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await (supabase as any)
          .from('profiles')
          .update({ preferred_locale: next })
          .eq('id', user.id);
      } catch {
        // Silent: column may not exist yet
      }
    })();
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Resolution order: workspace override (active locale) → bundle (active locale)
      // → workspace override (default locale) → bundle (default locale) → key.
      const overrideActive = overridesByLocale[locale]?.get(key);
      if (overrideActive != null) return interpolate(overrideActive, vars);

      const bundle = BUNDLES[locale];
      const fallback = BUNDLES[DEFAULT_LOCALE];
      const overrideFallback = overridesByLocale[DEFAULT_LOCALE]?.get(key);
      const value = lookup(bundle, key) ?? overrideFallback ?? lookup(fallback, key);
      if (!value) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key: "${key}" (locale: ${locale})`);
        }
        return key;
      }
      return interpolate(value, vars);
    },
    [locale, overridesByLocale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, ready, loadWorkspaceOverrides, activeWorkspaceId }),
    [locale, setLocale, t, ready, loadWorkspaceOverrides, activeWorkspaceId],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Soft fallback: provider missing should not crash the app.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (k) => k,
      ready: true,
      loadWorkspaceOverrides: async () => undefined,
      activeWorkspaceId: null,
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}

const DATE_FNS_LOCALE_MAP: Record<string, DateFnsLocale> = {
  en: dfEnUS,
  hu: dfHu,
  cs: dfCs,
  sk: dfSk,
  pl: dfPl,
  de: dfDe,
  at: dfDe,
  ro: dfRo,
};

/** Returns the date-fns Locale object matching the current app locale. */
export function useDateLocale(): DateFnsLocale {
  const { locale } = useI18n();
  return DATE_FNS_LOCALE_MAP[locale] ?? dfEnUS;
}
