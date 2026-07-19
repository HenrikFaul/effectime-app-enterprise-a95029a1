import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

interface OwnProfileLocaleRpcClient {
  rpc: (name: 'get_my_profile_locale_v1') => PromiseLike<{
    data: string | null;
    error: unknown;
  }>;
}

// Generated database types cannot represent this additive RPC until the
// reconciled schema is regenerated. Keep the temporary contract exact and
// isolated instead of widening the application client to `any`.
const ownProfileLocaleRpcClient = supabase as unknown as OwnProfileLocaleRpcClient;

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
  let stored: Locale | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
  } catch {
    // Storage can be unavailable in hardened browsers and native WebViews.
  }
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

function persistLocaleLocally(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale state remains usable when persistent storage is unavailable.
  }
}

function createEmptyWorkspaceOverrides(): Record<string, Map<string, string>> {
  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, new Map<string, string>()]),
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());
  const localeRevisionRef = useRef(0);
  const authenticatedUserIdRef = useRef<string | null>(null);
  const pendingLocaleSelectionRef = useRef<Locale | null>(null);
  const localePersistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceOverrideGenerationRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [overridesByLocale, setOverridesByLocale] = useState<Record<string, Map<string, string>>>(
    createEmptyWorkspaceOverrides,
  );

  const queueLocalePersistence = useCallback((userId: string, next: Locale) => {
    // Serialize writes so a slower earlier request cannot overwrite a newer
    // locale selection. The account is captured at interaction/hydration time.
    localePersistenceQueueRef.current = localePersistenceQueueRef.current.then(async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ preferred_locale: next })
          .eq('user_id', userId);
        if (error) {
          console.warn('[i18n] profile locale persistence failed');
        }
      } catch {
        console.warn('[i18n] profile locale persistence failed');
      }
    });
  }, []);

  const loadWorkspaceOverrides = useCallback(async (workspaceId: string | null) => {
    const generation = ++workspaceOverrideGenerationRef.current;
    setActiveWorkspaceId(workspaceId);
    // Never display the previous tenant's overrides while the next tenant is
    // loading or after its request fails.
    setOverridesByLocale(createEmptyWorkspaceOverrides());
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('enterprise_translation_overrides')
        .select('locale, key, value')
        .eq('workspace_id', workspaceId);
      if (generation !== workspaceOverrideGenerationRef.current) return;
      if (error) {
        console.warn('[i18n] workspace overrides load failed');
        return;
      }
      const next = createEmptyWorkspaceOverrides();
      (data || []).forEach((row) => {
        const l = row.locale as string;
        if (l in next) next[l].set(row.key, row.value);
      });
      setOverridesByLocale(next);
    } catch {
      if (generation === workspaceOverrideGenerationRef.current) {
        console.warn('[i18n] workspace overrides load failed');
      }
    }
  }, []);

  // Hydrate the own-profile locale on initial auth and account changes. A
  // locale chosen while an RPC is in flight always wins over the stale reply.
  useEffect(() => {
    let disposed = false;
    let authEventGeneration = 0;
    let hydrationGeneration = 0;
    let activeUserId: string | null | undefined;

    const hydrateForUser = async (userId: string | null) => {
      authenticatedUserIdRef.current = userId;
      if (activeUserId === userId) return;
      activeUserId = userId;
      const generation = ++hydrationGeneration;
      const localeRevision = localeRevisionRef.current;

      if (!userId) {
        if (!disposed) setReady(true);
        return;
      }

      setReady(false);
      const pendingLocale = pendingLocaleSelectionRef.current;
      if (pendingLocale) {
        pendingLocaleSelectionRef.current = null;
        queueLocalePersistence(userId, pendingLocale);
        if (!disposed) setReady(true);
        return;
      }
      try {
        const { data, error } = await ownProfileLocaleRpcClient.rpc('get_my_profile_locale_v1');
        if (
          disposed
          || generation !== hydrationGeneration
          || localeRevision !== localeRevisionRef.current
        ) {
          return;
        }
        if (error) {
          activeUserId = undefined;
          console.warn('[i18n] profile locale hydration failed');
          return;
        }
        const remote = data as Locale | null;
        if (remote && SUPPORTED_LOCALES.includes(remote)) {
          setLocaleState(remote);
          persistLocaleLocally(remote);
        }
      } catch {
        if (!disposed && generation === hydrationGeneration) {
          activeUserId = undefined;
          console.warn('[i18n] profile locale hydration failed');
        }
      } finally {
        if (!disposed && generation === hydrationGeneration) setReady(true);
      }
    };

    const initialAuthGeneration = authEventGeneration;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!disposed && authEventGeneration === initialAuthGeneration) {
        void hydrateForUser(user?.id ?? null);
      }
    }).catch(() => {
      if (!disposed && authEventGeneration === initialAuthGeneration) {
        console.warn('[i18n] authenticated user lookup failed');
        setReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventGeneration += 1;
      void hydrateForUser(session?.user?.id ?? null);
    });

    return () => {
      disposed = true;
      hydrationGeneration += 1;
      authenticatedUserIdRef.current = null;
      subscription.unsubscribe();
    };
  }, [queueLocalePersistence]);

  // Update <html lang>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!SUPPORTED_LOCALES.includes(next)) return;
    localeRevisionRef.current += 1;
    setLocaleState(next);
    persistLocaleLocally(next);
    // Capture the account at interaction time. If the initial auth lookup is
    // still pending, retain the explicit choice and bind it once to the user
    // that lookup resolves for instead of letting remote hydration overwrite it.
    const userId = authenticatedUserIdRef.current;
    if (!userId) {
      pendingLocaleSelectionRef.current = next;
      return;
    }
    pendingLocaleSelectionRef.current = null;
    queueLocalePersistence(userId, next);
  }, [queueLocalePersistence]);

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
