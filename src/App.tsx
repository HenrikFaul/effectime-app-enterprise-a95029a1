import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { DensityProvider } from "@/hooks/useDensity";
import { I18nProvider } from "@/i18n/I18nProvider";
import { HelpRegistryProvider } from "@/lib/help/registry";
import { HelpDrawer } from "@/components/help/HelpDrawer";
import { resolveInternalPath } from "@/lib/internalPath";

// Landing is loaded eagerly — it is the only public, SEO-critical page
import Landing from "./pages/Landing";
import { InstallPwaPrompt } from "@/components/pwa/InstallPwaPrompt";
import { MobileRuntimeBridge } from '@/components/mobile/MobileRuntimeBridge';

// All other pages are lazy-loaded to keep the initial JS bundle small
const Auth         = lazy(() => import("./pages/Auth"));
const Profile      = lazy(() => import("./pages/Profile"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin        = lazy(() => import("./pages/Admin"));
const Superadmin   = lazy(() => import("./pages/Superadmin"));
const Enterprise   = lazy(() => import("./pages/Enterprise"));
const Unsubscribe  = lazy(() => import("./pages/Unsubscribe"));
const Reseller     = lazy(() => import("./pages/Reseller"));
const CandidateBook = lazy(() => import("./pages/CandidateBook"));
const EmbedPage    = lazy(() => import("./pages/EmbedPage"));
const NotFound     = lazy(() => import("./pages/NotFound"));

// SEO pillar pages (kategóriaoldalak) — eager imports keep them prerender-friendly
// for crawlers and avoid Suspense flash on first paint.
const Muszakbeosztas    = lazy(() => import("./pages/pillars/Muszakbeosztas"));
const Szabadsagkezeles  = lazy(() => import("./pages/pillars/Szabadsagkezeles"));
const Kapacitastervezes = lazy(() => import("./pages/pillars/Kapacitastervezes"));

function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

const queryClient = new QueryClient();


/**
 * Legacy hash-route bridge.
 * v3.49.5: switched HashRouter → BrowserRouter for SEO (pillar pages need
 * crawlable clean URLs). Old bookmarks of the form `/#/auth?ws=…` must still
 * land on `/auth?ws=…`. We DO NOT touch Supabase OAuth fragments
 * (`#access_token=…` / `#refresh_token=…`) — those carry no leading slash.
 */
function HashRouteBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) return;

    // hash looks like "#/auth?ws=123" — strip the leading "#" and merge
    // any existing search params from the path-side onto the rewrite.
    const rest = hash.slice(1); // "/auth?ws=123"
    const { search, origin } = window.location;
    const existingSearch = search ? search.slice(1) : '';
    const [pathPart, hashSearchPart = ''] = rest.split('?');

    const merged = new URLSearchParams();
    if (existingSearch) new URLSearchParams(existingSearch).forEach((v, k) => merged.set(k, v));
    if (hashSearchPart) new URLSearchParams(hashSearchPart).forEach((v, k) => merged.set(k, v));
    const mergedSearch = merged.toString();

    const targetPath = resolveInternalPath(
      `${pathPart}${mergedSearch ? `?${mergedSearch}` : ''}`,
      '/',
    );
    const nextUrl = `${origin}${targetPath}`;
    window.location.replace(nextUrl);
  }, []);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    const params = new URLSearchParams(location.search);
    const redirect = resolveInternalPath(params.get('redirect'), '/app');
    const oauthProvider = params.get('oauth');
    const emailActivationToken = params.get('email_activation_token');

    if (oauthProvider === 'google' || emailActivationToken) {
      return <>{children}</>;
    }

    return <Navigate to={redirect} replace />;
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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

const SpaRedirectHandler = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const restore = (path: unknown) => {
      if (typeof path !== 'string' || !path) return false;
      const candidate = path.startsWith('/') ? path : `/${path}`;
      navigate(resolveInternalPath(candidate, '/'), { replace: true });
      return true;
    };

    const stored = sessionStorage.getItem('spa_redirect');
    if (stored) {
      sessionStorage.removeItem('spa_redirect');
      try {
        const { path } = JSON.parse(stored) as { path?: unknown };
        if (restore(path)) return;
      } catch { /* ignore */ }
    }
    const r = new URLSearchParams(window.location.search).get('r');
    restore(r);
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
                <InstallPwaPrompt />
                <HashRouteBridge />
                <OAuthCallbackGuard>
                  <BrowserRouter>
                    <SpaRedirectHandler />
                    <MobileRuntimeBridge />
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Landing />} />
                        {/* SEO pillar pages (kategóriaoldalak) */}
                        <Route path="/muszakbeosztas" element={<Muszakbeosztas />} />
                        <Route path="/szabadsagkezeles" element={<Szabadsagkezeles />} />
                        <Route path="/kapacitastervezes" element={<Kapacitastervezes />} />
                        <Route path="/app" element={<ProtectedRoute><Enterprise /></ProtectedRoute>} />
                        <Route path="/w/:workspaceId" element={<ProtectedRoute><Enterprise /></ProtectedRoute>} />
                        <Route path="/enterprise" element={<ProtectedRoute><Navigate to="/app" replace /></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                        <Route path="/superadmin" element={<ProtectedRoute><Superadmin /></ProtectedRoute>} />
                        <Route path="/unsubscribe" element={<Unsubscribe />} />
                        <Route path="/reseller" element={<ProtectedRoute><Reseller /></ProtectedRoute>} />
                        <Route path="/book/:token" element={<CandidateBook />} />
                        <Route path="/embed/:view" element={<EmbedPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </BrowserRouter>
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
