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

type Bundle = typeof en;

const BUNDLES: Record<Locale, Bundle> = {
  en,
  // Hungarian intentionally typed as English structure; missing keys fall back.
  hu: hu as unknown as Bundle,
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
  const [overridesByLocale, setOverridesByLocale] = useState<Record<Locale, Map<string, string>>>({
    en: new Map(),
    hu: new Map(),
  });

  const loadWorkspaceOverrides = useCallback(async (workspaceId: string | null) => {
    setActiveWorkspaceId(workspaceId);
    if (!workspaceId) {
      setOverridesByLocale({ en: new Map(), hu: new Map() });
      return;
    }
    try {
      const { data } = await (supabase as any)
        .from('enterprise_translation_overrides')
        .select('locale, key, value')
        .eq('workspace_id', workspaceId);
      const next: Record<Locale, Map<string, string>> = { en: new Map(), hu: new Map() };
      ((data as any[]) || []).forEach((row: any) => {
        const l = row.locale as Locale;
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
