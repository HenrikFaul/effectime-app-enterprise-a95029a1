import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SectionState = 'default' | 'opened' | 'collapsed';

const cache = new Map<string, Map<string, SectionState>>(); // workspaceId -> sectionKey -> state
const listeners = new Set<() => void>();

async function loadFor(workspaceId: string) {
  const { data } = await (supabase as any)
    .from('enterprise_ui_section_states')
    .select('section_key,state')
    .eq('workspace_id', workspaceId);
  const m = new Map<string, SectionState>();
  (data || []).forEach((r: any) => m.set(r.section_key, r.state as SectionState));
  cache.set(workspaceId, m);
  listeners.forEach(l => l());
}

/**
 * Workspace-szintű (cégszintű) UI szekció állapot.
 *
 * @param workspaceId - aktuális munkaterület
 * @param sectionKey - egyedi kulcs (pl. "settings.branding")
 * @param softwareDefault - a szoftver alapértelmezett nyitottsága (true = nyitott)
 * @returns [isOpen, setIsOpen, configuredState]
 */
export function useWorkspaceSectionState(
  workspaceId: string | undefined,
  sectionKey: string,
  softwareDefault: boolean = true,
): [boolean, (open: boolean) => void, SectionState] {
  const [, force] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    if (!cache.has(workspaceId)) loadFor(workspaceId);
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [workspaceId]);

  const configured: SectionState = (workspaceId && cache.get(workspaceId)?.get(sectionKey)) || 'default';
  const isOpen = configured === 'opened' ? true : configured === 'collapsed' ? false : softwareDefault;

  const setIsOpen = useCallback((_open: boolean) => {
    // Per-user toggle is intentionally not persisted — workspace-level only.
    // Local override is in-memory for this session.
    if (!workspaceId) return;
    const m = cache.get(workspaceId) || new Map();
    m.set(sectionKey, _open ? 'opened' : 'collapsed');
    cache.set(workspaceId, m);
    listeners.forEach(l => l());
  }, [workspaceId, sectionKey]);

  return [isOpen, setIsOpen, configured];
}

/**
 * Adminoknak: cégszintű alapérték írása.
 */
export async function setWorkspaceSectionState(
  workspaceId: string,
  sectionKey: string,
  state: SectionState,
  userId: string,
) {
  const { error } = await (supabase as any)
    .from('enterprise_ui_section_states')
    .upsert(
      { workspace_id: workspaceId, section_key: sectionKey, state, updated_by: userId },
      { onConflict: 'workspace_id,section_key' },
    );
  if (!error) {
    const m = cache.get(workspaceId) || new Map();
    m.set(sectionKey, state);
    cache.set(workspaceId, m);
    listeners.forEach(l => l());
  }
  return error;
}

export function getCachedSectionState(workspaceId: string, sectionKey: string): SectionState {
  return cache.get(workspaceId)?.get(sectionKey) || 'default';
}
