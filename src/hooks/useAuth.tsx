import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isTemporary: boolean;
  linkedEventId: string | null;
  tempAccessToken: string | null;
  signUp: (email: string, password: string, displayName: string, redirectTo?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setSessionFromTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  refreshTempStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    if (window.location.hash.includes('access_token=') && window.location.hash.includes('refresh_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).finally(() => {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        });
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getAppUrl = (path = '/app') => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${window.location.origin}/#${normalized}`;
  };

  const signUp = async (email: string, password: string, displayName: string, redirectTo = '/app') => {
    const signupRedirectUrl = new URL('/', window.location.origin);
    signupRedirectUrl.hash = `/auth?redirect=${encodeURIComponent(redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`)}`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: signupRedirectUrl.toString(),
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setLoading(false);
    await supabase.auth.signOut({ scope: 'local' });
  };

  const setSessionFromTokens = async (accessToken: string, refreshToken: string) => {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  };

  const refreshTempStatus = async () => {
    // No-op in enterprise-only build; temp users do not exist here.
  };

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
