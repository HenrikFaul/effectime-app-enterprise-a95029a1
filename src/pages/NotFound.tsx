import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Rich diagnostic logging — helps trace random "Not Found" reports
    const diagnostics = {
      reason: "ROUTE_NOT_MATCHED",
      router: "HashRouter",
      // Path the router tried to match (inside the hash fragment)
      routerPath: location.pathname,
      routerSearch: location.search,
      routerHash: location.hash,
      routerState: location.state ?? null,
      // Raw browser-level context
      windowHref: window.location.href,
      windowPathname: window.location.pathname,
      windowHash: window.location.hash,
      windowSearch: window.location.search,
      referrer: document.referrer || "(none)",
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
    // eslint-disable-next-line no-console
    console.error("[404] Route not found", diagnostics);

    // Surface to window for quick copy/paste during bug reports
    (window as unknown as { __lastNotFound?: unknown }).__lastNotFound = diagnostics;
  }, [location.pathname, location.search, location.hash, location.state]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-6">
      <div className="w-full max-w-md rounded-2xl border bg-card/80 p-8 text-center shadow-xl backdrop-blur">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-5xl font-bold tracking-tight">404</h1>
        <p className="mb-1 text-lg font-medium">Az oldal nem található</p>
        <p className="mb-6 text-sm text-muted-foreground">
          A keresett útvonal nem létezik vagy átkerült máshová.
        </p>
        <div className="mb-6 rounded-lg bg-muted/60 p-3 text-left font-mono text-xs text-muted-foreground break-all">
          {location.pathname}
          {location.search}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Vissza
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" /> Főoldalra
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
