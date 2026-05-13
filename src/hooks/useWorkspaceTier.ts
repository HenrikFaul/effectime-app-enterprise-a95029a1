import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkspaceTier {
  tier_key: string;
  tier_name: string;
  tier_id: string;
  subscription_id: string;
  seats: number | null;
  started_at: string;
}

const STALE_MS = 60 * 1000;

async function fetchWorkspaceTier(workspaceId: string): Promise<WorkspaceTier | null> {
  const { data, error } = await supabase
    .from('workspace_active_tier')
    .select('tier_id, tier_key, tier_name, subscription_id, seats, started_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data as WorkspaceTier | null) ?? null;
}

/**
 * Reads the current active tier for a workspace from the
 * `workspace_active_tier` view (security_invoker so member RLS applies).
 *
 * The tier is set ONCE at workspace creation and only changed by a platform
 * admin via the `superadmin_change_workspace_tier` RPC. See
 * `.governance/ui_ux_rules.md` § "Core principle: Workspace tier persistence".
 */
export function useWorkspaceTier(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['workspace-tier', workspaceId],
    queryFn: () => fetchWorkspaceTier(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: STALE_MS,
  });
}

/**
 * Reads tiers for a batch of workspaces (e.g. the picker grid). Single
 * round-trip instead of N hook calls.
 */
export async function fetchWorkspaceTiers(workspaceIds: string[]): Promise<Map<string, WorkspaceTier>> {
  if (workspaceIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('workspace_active_tier')
    .select('workspace_id, tier_id, tier_key, tier_name, subscription_id, seats, started_at')
    .in('workspace_id', workspaceIds);
  if (error) throw error;
  const map = new Map<string, WorkspaceTier>();
  for (const row of (data ?? []) as (WorkspaceTier & { workspace_id: string })[]) {
    map.set(row.workspace_id, row);
  }
  return map;
}
