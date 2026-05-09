import { useCallback, useEffect, useState } from 'react';

export type WorkspaceNavigationLayout = 'sidebar' | 'menubar';

const GLOBAL_KEY = 'effectime.nav-layout';
const workspaceKey = (workspaceId: string) => `effectime.nav-layout.ws.${workspaceId}`;
const EVENT_NAME = 'effectime:nav-layout-change';

const isNavigationLayout = (value: string | null): value is WorkspaceNavigationLayout =>
  value === 'sidebar' || value === 'menubar';

function readNavigationLayout(workspaceId?: string | null): WorkspaceNavigationLayout {
  if (typeof window === 'undefined') return 'sidebar';

  if (workspaceId) {
    const storedWorkspaceLayout = localStorage.getItem(workspaceKey(workspaceId));
    if (isNavigationLayout(storedWorkspaceLayout)) return storedWorkspaceLayout;
  }

  const storedGlobalLayout = localStorage.getItem(GLOBAL_KEY);
  if (isNavigationLayout(storedGlobalLayout)) return storedGlobalLayout;

  return 'sidebar';
}

export function useWorkspaceNavLayout(workspaceId?: string | null) {
  const [layout, setLayoutState] = useState<WorkspaceNavigationLayout>(() => readNavigationLayout(workspaceId));

  useEffect(() => {
    setLayoutState(readNavigationLayout(workspaceId));
  }, [workspaceId]);

  // Subscribe to in-app and cross-tab changes so every consumer updates instantly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setLayoutState(readNavigationLayout(workspaceId));
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ workspaceId?: string | null }>).detail;
      const targetWs = detail?.workspaceId ?? null;
      // Update if the change concerns this workspace, or affects the global default.
      if (!targetWs || targetWs === (workspaceId ?? null)) refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === GLOBAL_KEY || (workspaceId && e.key === workspaceKey(workspaceId))) refresh();
    };
    window.addEventListener(EVENT_NAME, onCustom as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onCustom as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [workspaceId]);

  const setLayout = useCallback((nextLayout: WorkspaceNavigationLayout) => {
    setLayoutState(nextLayout);

    try {
      if (workspaceId) localStorage.setItem(workspaceKey(workspaceId), nextLayout);
      else localStorage.setItem(GLOBAL_KEY, nextLayout);
    } catch {
      /* ignore storage failures */
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { workspaceId: workspaceId ?? null } }),
      );
    }
  }, [workspaceId]);

  return { layout, setLayout };
}
