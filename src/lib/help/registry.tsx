import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

export interface HelpAnchorContent {
  id: string;
  /** i18n key under `help.anchors.<id>` for title; if missing, falls back to id. */
  i18nKey?: string;
  /** Optional crumbs to display in the drawer header. */
  crumbs?: string[];
}

interface HelpRegistryContextValue {
  current: HelpAnchorContent | null;
  setCurrent: Dispatch<SetStateAction<HelpAnchorContent | null>>;
  drawerOpen: boolean;
  setDrawerOpen: Dispatch<SetStateAction<boolean>>;
  highlight: boolean;
  setHighlight: Dispatch<SetStateAction<boolean>>;
}

const HelpRegistryContext = createContext<HelpRegistryContextValue | null>(null);

export function HelpRegistryProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<HelpAnchorContent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);

  const value = useMemo<HelpRegistryContextValue>(
    () => ({ current, setCurrent, drawerOpen, setDrawerOpen, highlight, setHighlight }),
    [current, drawerOpen, highlight],
  );

  return <HelpRegistryContext.Provider value={value}>{children}</HelpRegistryContext.Provider>;
}

function useHelpContextOrNull() {
  return useContext(HelpRegistryContext);
}

export function useHelpRegistry(): HelpRegistryContextValue {
  const ctx = useHelpContextOrNull();
  if (!ctx) {
    return {
      current: null,
      setCurrent: () => undefined,
      drawerOpen: false,
      setDrawerOpen: () => undefined,
      highlight: false,
      setHighlight: () => undefined,
    };
  }
  return ctx;
}

/**
 * Register the active help anchor for the current page. Pass null to clear.
 * The drawer uses this to render context-aware content and to drive the highlight ring.
 */
export function useHelpAnchor(anchor: HelpAnchorContent | null) {
  const ctx = useHelpContextOrNull();
  const setCurrent = ctx?.setCurrent;
  const stableId = anchor?.id ?? null;
  const stableI18n = anchor?.i18nKey ?? null;
  const stableCrumbs = useMemo(() => anchor?.crumbs ?? [], [anchor?.crumbs?.join('|')]);

  useEffect(() => {
    if (!setCurrent) return;
    if (!stableId) {
      setCurrent(null);
      return;
    }
    setCurrent({ id: stableId, i18nKey: stableI18n ?? undefined, crumbs: stableCrumbs });
    return () => {
      // Only clear if we are the current owner — avoid race during fast nav
      setCurrent((prev) => (prev?.id === stableId ? null : prev));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableId, stableI18n, stableCrumbs.join('|')]);
}

/** Simple imperative helper if a non-component path needs to flag the highlight. */
export function useHelpControls() {
  const { setDrawerOpen, setHighlight } = useHelpRegistry();
  const openHelp = useCallback(() => {
    setDrawerOpen(true);
    setHighlight(true);
    // soft pulse off after 1.2s
    window.setTimeout(() => setHighlight(false), 1200);
  }, [setDrawerOpen, setHighlight]);
  return { openHelp };
}
