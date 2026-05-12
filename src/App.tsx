import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { DensityProvider } from "@/hooks/useDensity";
import { I18nProvider } from "@/i18n/I18nProvider";
import { HelpRegistryProvider } from "@/lib/help/registry";
import { HelpDrawer } from "@/components/help/HelpDrawer";

import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import Superadmin from "./pages/Superadmin";
import Enterprise from "./pages/Enterprise";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const HASH_ROUTE_QUERY_KEYS = new Set(['redirect', 'oauth', 'email_activation_token', 'select', 'tab', 'ws', 'invite']);

function HashRouteBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash) return;

    const { pathname, search } = window.location;
    const incomingParams = new URLSearchParams(search);
    const globalParams = new URLSearchParams();
    const routeParams = new URLSearchParams();

    incomingParams.forEach((value, key) => {
      if (HASH_ROUTE_QUERY_KEYS.has(key)) routeParams.set(key, value);
      else globalParams.set(key, value);
    });

    const needsBridge = pathname !== '/' || routeParams.size > 0;
    if (!needsBridge) return;

    const globalSearch = globalParams.toString();
    const routeSearch = routeParams.toString();
    const hashPath = `${pathname}${routeSearch ? `?${routeSearch}` : ''}`;
    const nextUrl = `${window.location.origin}/${globalSearch ? `?${globalSearch}` : ''}#${hashPath}`;

    window.location.replace(nextUrl);
  }, []);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    const oauthProvider = params.get('oauth');
    const emailActivationToken = params.get('email_activation_token');

    if (oauthProvider === 'google' || emailActivationToken) {
      return <>{children}</>;
    }

    return <Navigate to={redirect || "/app"} replace />;
  }
  return <>{children}</>;
}

function OAuthCallbackGuard({ children }: { children: React.ReactNode }) {
  const [isOAuthCallback, setIsOAuthCallback] = useState(() =>
    typeof window !== 'undefined' &&
    window.location.hash.includes('access_token=') &&
    window.location.hash.includes('refresh_token=')
  );

  useEffect(() => {
    if (!isOAuthCallback) return;
    const onHashChange = () => {
      if (!window.location.hash.includes('access_token=')) {
        setIsOAuthCallback(false);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [isOAuthCallback]);

  if (isOAuthCallback) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

const SpaRedirectHandler = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const stored = sessionStorage.getItem('spa_redirect');
    if (stored) {
      sessionStorage.removeItem('spa_redirect');
      try {
        const { path } = JSON.parse(stored) as { path: string };
        if (path) { navigate('/' + path, { replace: true }); return; }
      } catch { /* ignore */ }
    }
    const r = new URLSearchParams(window.location.search).get('r');
    if (r) navigate('/' + r, { replace: true });
  }, [navigate]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <DensityProvider>
        <AuthProvider>
          <I18nProvider>
            <HelpRegistryProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <HelpDrawer />
                <HashRouteBridge />
                <OAuthCallbackGuard>
                  <HashRouter>
                    <SpaRedirectHandler />
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/app" element={<ProtectedRoute><Enterprise /></ProtectedRoute>} />
                      <Route path="/enterprise" element={<ProtectedRoute><Navigate to="/app" replace /></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                      <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                      <Route path="/superadmin" element={<ProtectedRoute><Superadmin /></ProtectedRoute>} />
                      <Route path="/unsubscribe" element={<Unsubscribe />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </HashRouter>
                </OAuthCallbackGuard>
              </TooltipProvider>
            </HelpRegistryProvider>
          </I18nProvider>
        </AuthProvider>
      </DensityProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
