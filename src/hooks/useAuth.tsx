import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { resolveInternalPath } from '@/lib/internalPath';
import { buildAuthCallbackUrl, isNativeRuntime } from '@/lib/platform/mobile';
import { canonicalizeWorkspaceProfileDisplayName } from '@/lib/profileDisplayName';
import {
  NativeAuthStorageError,
  type NativeAuthStorageErrorCode,
  clearSupabaseLocalAuthSession,
  ensureSupabaseAuthStorageReady,
  resetSupabaseNativeAuthStorage,
  subscribeToNativeAuthStorageFailures,
} from '@/lib/platform/nativeAuthStorage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isTemporary: boolean;
  linkedEventId: string | null;
  tempAccessToken: string | null;
  signUp: (email: string, password: string, displayName: string, redirectTo?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  setSessionFromTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  refreshTempStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthStorageRecovery({
  nativeRuntime,
  errorCode,
}: {
  nativeRuntime: boolean;
  errorCode: NativeAuthStorageErrorCode | 'unknown';
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);

  const resetLocalSession = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    setResetting(true);
    setResetFailed(false);
    try {
      await resetSupabaseNativeAuthStorage();
      window.location.reload();
    } catch {
      setResetFailed(true);
      setResetting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <section
        aria-labelledby="auth-storage-error-title"
        data-auth-storage-error-code={errorCode}
        className="w-full max-w-lg rounded-2xl border bg-card p-6 text-card-foreground shadow-lg"
      >
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-destructive">
          Biztonságos munkamenet szükséges
        </p>
        <h1 id="auth-storage-error-title" className="text-2xl font-semibold">
          A helyi bejelentkezési adatok nem érhetők el
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Az Effectime biztonsági okból nem vált gyengébb tárolásra. Próbáld újra az alkalmazás
          újraindításával. / Effectime will not fall back to insecure session storage.
        </p>

        {resetFailed && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            A helyi munkamenet nem törölhető. Indítsd újra az eszközt, majd próbáld újra.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => window.location.reload()}
          >
            Újrapróbálás
          </button>
          {nativeRuntime && (
            <button
              type="button"
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={resetting}
              onClick={() => void resetLocalSession()}
            >
              {resetting
                ? 'Törlés…'
                : confirmReset
                  ? 'Megerősítés: törlés és kijelentkezés'
                  : 'Helyi munkamenet törlése'}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStorageFailure, setAuthStorageFailure] = useState<
    NativeAuthStorageErrorCode | 'unknown' | null
  >(null);

  useEffect(() => {

    let disposed = false;
    let subscription: { unsubscribe(): void } | undefined;
    const blockForStorageFailure = (error?: unknown) => {
      if (disposed) return;
      // Error details can contain OS/plugin metadata; the fixed event is the
      // only diagnostic emitted from this browser boundary.
      console.warn('[Effectime auth] Secure session storage is unavailable.');
      setSession(null);
      setUser(null);
      setLoading(false);
      setAuthStorageFailure(
        error instanceof NativeAuthStorageError ? error.code : 'unknown',
      );
    };
    const unsubscribeStorageFailure = subscribeToNativeAuthStorageFailures(
      blockForStorageFailure,
    );
    const handleUnhandledStorageFailure = (event: PromiseRejectionEvent) => {
      if (!(event.reason instanceof NativeAuthStorageError)) return;
      event.preventDefault();
      blockForStorageFailure(event.reason);
    };
    window.addEventListener('unhandledrejection', handleUnhandledStorageFailure);

    if (!isNativeRuntime() && window.location.hash.includes('access_token=') && window.location.hash.includes('refresh_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            if (!error) {
              window.location.replace(`${window.location.origin}/#/app`);
            } else {
              window.location.replace(`${window.location.origin}/#/auth`);
            }
          });
      }
    }

    void (async () => {
      try {
        await ensureSupabaseAuthStorageReady();
        if (disposed) return;

        const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (disposed) return;
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setLoading(false);
        });
        subscription = authListener.data.subscription;

        const { data } = await supabase.auth.getSession();
        if (disposed) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      } catch (error) {
        blockForStorageFailure(error);
      }
    })();

    return () => {
      disposed = true;
      subscription?.unsubscribe();
      unsubscribeStorageFailure();
      window.removeEventListener('unhandledrejection', handleUnhandledStorageFailure);
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string, redirectTo = '/app') => {
    const normalizedDisplayName = canonicalizeWorkspaceProfileDisplayName(displayName);
    if (normalizedDisplayName === undefined) {
      return { error: new Error('Invalid display name') };
    }
    const safeRedirectTo = resolveInternalPath(redirectTo, '/app');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: normalizedDisplayName },
        emailRedirectTo: buildAuthCallbackUrl('signup', safeRedirectTo),
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    let remoteError: unknown = null;
    try {
      const result = await supabase.auth.signOut({ scope: 'local' });
      remoteError = result.error;
    } catch (error) {
      remoteError = error;
    }

    if (!remoteError) {
      setLoading(false);
      return { error: null };
    }

    // Supabase performs a server revocation call before local deletion, even
    // for `scope: local`. A network/5xx failure must not leave a user who
    // explicitly signed out with reusable credentials on this device.
    try {
      await clearSupabaseLocalAuthSession();
      setSession(null);
      setUser(null);
      setLoading(false);
      const warning = new Error(
        'Remote session revocation failed; the local session was cleared.',
      );
      toast.warning(
        'Helyben kijelentkeztél, de a távoli munkamenet visszavonása nem sikerült. / Signed out locally; remote revocation failed.',
      );
      return { error: warning };
    } catch {
      setLoading(false);
      const failure = new Error('The local session could not be cleared safely.');
      toast.error(
        'A kijelentkezés nem fejezhető be biztonságosan. Próbáld újra. / Sign-out could not complete safely. Please retry.',
      );
      return { error: failure };
    }
  };

  const setSessionFromTokens = async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  };

  const refreshTempStatus = async () => {
    // No-op in enterprise-only build; temp users do not exist here.
  };

  if (authStorageFailure) {
    return (
      <AuthStorageRecovery
        nativeRuntime={isNativeRuntime()}
        errorCode={authStorageFailure}
      />
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isTemporary: false,
      linkedEventId: null,
      tempAccessToken: null,
      signUp,
      signIn,
      signOut,
      setSessionFromTokens,
      refreshTempStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
