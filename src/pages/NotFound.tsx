import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Keep diagnostics useful without persisting query strings, fragments,
    // referrers or user-agent data. Auth callbacks can carry one-time grants.
    const diagnostics = {
      reason: "ROUTE_NOT_MATCHED",
      router: "BrowserRouter",
      routerPath: location.pathname,
      windowPathname: window.location.pathname,
      timestamp: new Date().toISOString(),
    };
    console.error("[404] Route not found", diagnostics);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-6">
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
