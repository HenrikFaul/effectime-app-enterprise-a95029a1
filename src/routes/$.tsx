import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Catch-all splat route: delegates every non-index URL (/auth, /app, /admin,
// /profile, /reset-password, /unsubscribe, ...) to the existing react-router-dom
// App shell so deep links and refreshes work in production.
const App = lazy(() => import("@/App"));

export const Route = createFileRoute("/$")({
  component: SplatComponent,
});

function SplatComponent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <App />
    </Suspense>
  );
}
