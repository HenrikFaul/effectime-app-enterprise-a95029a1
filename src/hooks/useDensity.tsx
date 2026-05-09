import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type Density = 'compact' | 'comfortable' | 'expansive' | 'auto';

interface DensityContextValue {
  density: Density;
  /** The resolved density actually applied to the document (never 'auto'). */
  resolved: Exclude<Density, 'auto'>;
  setDensity: (d: Density, scope?: { workspaceId?: string | null }) => void;
}

const DensityContext = createContext<DensityContextValue | undefined>(undefined);

const GLOBAL_KEY = 'effectime.density';
const wsKey = (workspaceId: string) => `effectime.density.ws.${workspaceId}`;

const isDensity = (v: string | null): v is Density =>
  v === 'compact' || v === 'comfortable' || v === 'expansive' || v === 'auto';

function readInitial(workspaceId: string | null | undefined): Density {
  if (typeof window === 'undefined') return 'auto';
  if (workspaceId) {
    const ws = localStorage.getItem(wsKey(workspaceId));
    if (isDensity(ws)) return ws;
  }
  const g = localStorage.getItem(GLOBAL_KEY);
  if (isDensity(g)) return g;
  return 'auto';
}

function autoResolve(): Exclude<Density, 'auto'> {
  if (typeof window === 'undefined') return 'comfortable';
  const w = window.innerWidth;
  if (w < 1024) return 'compact';
  if (w >= 1536) return 'expansive';
  return 'comfortable';
}

export function DensityProvider({
  children,
  workspaceId,
}: {
  children: ReactNode;
  workspaceId?: string | null;
}) {
  const [density, setDensityState] = useState<Density>(() => readInitial(workspaceId));
  const [autoTier, setAutoTier] = useState<Exclude<Density, 'auto'>>(() => autoResolve());

  // Re-read preference whenever the active workspace changes
  useEffect(() => {
    setDensityState(readInitial(workspaceId));
  }, [workspaceId]);

  // Track viewport changes for auto mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setAutoTier(autoResolve());
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resolved: Exclude<Density, 'auto'> = density === 'auto' ? autoTier : density;

  // Apply to <html data-density="...">
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.density = resolved;
  }, [resolved]);

  const setDensity = useCallback<DensityContextValue['setDensity']>(
    (d, scope) => {
      setDensityState(d);
      try {
        const ws = scope?.workspaceId ?? workspaceId ?? null;
        if (ws) localStorage.setItem(wsKey(ws), d);
        else localStorage.setItem(GLOBAL_KEY, d);
      } catch {
        /* ignore */
      }
    },
    [workspaceId]
  );

  const value = useMemo(() => ({ density, resolved, setDensity }), [density, resolved, setDensity]);
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    // Safe fallback so components don't crash if used outside a provider
    return {
      density: 'auto' as Density,
      resolved: 'comfortable' as Exclude<Density, 'auto'>,
      setDensity: () => {},
    } satisfies DensityContextValue;
  }
  return ctx;
}
