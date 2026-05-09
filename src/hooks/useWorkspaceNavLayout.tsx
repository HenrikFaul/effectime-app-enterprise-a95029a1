import { useCallback, useEffect, useState } from 'react';

export type WorkspaceNavigationLayout = 'sidebar' | 'menubar';

const GLOBAL_KEY = 'effectime.nav-layout';
const workspaceKey = (workspaceId: string) => `effectime.nav-layout.ws.${workspaceId}`;

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

  const setLayout = useCallback((nextLayout: WorkspaceNavigationLayout) => {
    setLayoutState(nextLayout);

    try {
      if (workspaceId) localStorage.setItem(workspaceKey(workspaceId), nextLayout);
      else localStorage.setItem(GLOBAL_KEY, nextLayout);
    } catch {
      /* ignore storage failures */
    }
  }, [workspaceId]);

  return { layout, setLayout };
}