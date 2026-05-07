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
  i18nKey?: string;
  crumbs?: string[];
}

interface HelpRegistryContextValue {
  current: HelpAnchorContent | null;
  setCurrent: Dispatch<SetStateAction<HelpAnchorContent | null>>;
  /** Anchor explicitly selected via drag-target (overrides `current` in the drawer). */
  selectedAnchorId: string | null;
  setSelectedAnchorId: Dispatch<SetStateAction<string | null>>;
  drawerOpen: boolean;
  setDrawerOpen: Dispatch<SetStateAction<boolean>>;
  highlight: boolean;
  setHighlight: Dispatch<SetStateAction<boolean>>;
  /** True while user is dragging from the ? icon. */
  dragging: boolean;
  setDragging: Dispatch<SetStateAction<boolean>>;
}

const HelpRegistryContext = createContext<HelpRegistryContextValue | null>(null);

export function HelpRegistryProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<HelpAnchorContent | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [dragging, setDragging] = useState(false);

  const value = useMemo<HelpRegistryContextValue>(
    () => ({
      current,
      setCurrent,
      selectedAnchorId,
      setSelectedAnchorId,
      drawerOpen,
      setDrawerOpen,
      highlight,
      setHighlight,
      dragging,
      setDragging,
    }),
    [current, selectedAnchorId, drawerOpen, highlight, dragging],
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
      selectedAnchorId: null,
      setSelectedAnchorId: () => undefined,
      drawerOpen: false,
      setDrawerOpen: () => undefined,
      highlight: false,
      setHighlight: () => undefined,
      dragging: false,
      setDragging: () => undefined,
    };
  }
  return ctx;
}

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
      setCurrent((prev) => (prev?.id === stableId ? null : prev));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableId, stableI18n, stableCrumbs.join('|')]);
}

export function useHelpControls() {
  const { setDrawerOpen, setHighlight, setSelectedAnchorId } = useHelpRegistry();
  const openHelp = useCallback(() => {
    setSelectedAnchorId(null); // reset to current page anchor
    setDrawerOpen(true);
    setHighlight(true);
    window.setTimeout(() => setHighlight(false), 1200);
  }, [setDrawerOpen, setHighlight, setSelectedAnchorId]);
  return { openHelp };
}
