/**
 * useFeature() — Frontend feature gating hook for the tier/addon system.
 *
 * Phase 7 + 9 of the feature-tiering rollout. Resolves the enabled feature_keys
 * for a given workspace by:
 *   1. mapping workspace -> tenant via `tenant_id_for_workspace(uuid)`
 *   2. fetching enabled features via `tenant_enabled_features(uuid)` which
 *      unions tier features + addon features + positive overrides, minus
 *      negative overrides.
 *
 * Cached for 5 minutes per workspace. Use the FeatureService helpers
 * (`isEnabled`, `requireEnabled`) for imperative checks; use the React hook
 * for component-level guards.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureSource = "tier" | "addon" | "override";

export interface EnabledFeature {
  feature_key: string;
  source: FeatureSource;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchEnabledFeatures(workspaceId: string): Promise<EnabledFeature[]> {
  // Resolve tenant for the workspace
  const { data: tenantId, error: tenantErr } = await supabase
    .rpc("tenant_id_for_workspace", { _workspace_id: workspaceId });
  if (tenantErr) throw tenantErr;
  if (!tenantId) return [];

  const { data, error } = await supabase
    .rpc("tenant_enabled_features", { _tenant_id: tenantId as string });
  if (error) throw error;
  return (data ?? []) as EnabledFeature[];
}

/** React hook — returns the enabled feature set + helper `isEnabled`. */
export function useEnabledFeatures(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["enabled-features", workspaceId],
    queryFn: () => fetchEnabledFeatures(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS * 2,
  });

  const set = new Set((query.data ?? []).map((f) => f.feature_key));

  return {
    ...query,
    features: query.data ?? [],
    isEnabled: (key: string) => set.has(key),
  };
}

/**
 * Convenience hook: returns boolean for a single feature key.
 * While loading, returns `false` (fail-closed) — wrap in `isLoading` UI if needed.
 */
export function useFeature(workspaceId: string | null | undefined, featureKey: string) {
  const { isEnabled, isLoading } = useEnabledFeatures(workspaceId);
  return { enabled: isEnabled(featureKey), isLoading };
}
