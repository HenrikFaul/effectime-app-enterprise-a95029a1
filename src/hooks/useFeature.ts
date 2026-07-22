/**
 * useFeature() — Frontend feature gating hook for the tier/addon system.
 *
 * Phase 7 + 9 of the feature-tiering rollout. Resolves the enabled feature_keys
 * for a given workspace by:
 *   1. authorizing workspace membership in `workspace_enabled_features(uuid)`
 *   2. resolving the tenant's tier + add-on + override union server-side.
 *
 * Cached for 5 minutes per workspace. Use the FeatureService helpers
 * (`isEnabled`, `requireEnabled`) for imperative checks; use the React hook
 * for component-level guards.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FeatureSource = "tier" | "addon" | "override";

export interface EnabledFeature {
  feature_key: string;
  source: FeatureSource;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FEATURE_SOURCES = new Set<FeatureSource>(["tier", "addon", "override"]);
const INVALID_ENTITLEMENT_RESPONSE = "Feature entitlement lookup returned an invalid response";

function parseEnabledFeatures(data: unknown): EnabledFeature[] {
  if (!Array.isArray(data)) throw new Error(INVALID_ENTITLEMENT_RESPONSE);

  return data.map((row) => {
    if (typeof row !== "object" || row === null) {
      throw new Error(INVALID_ENTITLEMENT_RESPONSE);
    }

    const featureKey = "feature_key" in row ? row.feature_key : undefined;
    const source = "source" in row ? row.source : undefined;
    if (
      typeof featureKey !== "string"
      || featureKey.trim().length === 0
      || typeof source !== "string"
      || !FEATURE_SOURCES.has(source as FeatureSource)
    ) {
      throw new Error(INVALID_ENTITLEMENT_RESPONSE);
    }

    return { feature_key: featureKey, source: source as FeatureSource };
  });
}

async function fetchEnabledFeatures(workspaceId: string): Promise<EnabledFeature[]> {
  const { data, error } = await supabase
    .rpc("workspace_enabled_features" as never, { _workspace_id: workspaceId } as never);
  if (error) throw error;
  return parseEnabledFeatures(data);
}

/** React hook — returns the enabled feature set + helper `isEnabled`. */
export function useEnabledFeatures(workspaceId: string | null | undefined) {
  const { user, loading: authLoading } = useAuth();
  const actorId = user?.id ?? null;
  const query = useQuery({
    // Entitlements are authorized for the current actor, not just the tenant.
    // Keeping the actor in the cache identity prevents a later account on the
    // same device from observing the previous account's cached feature set.
    queryKey: ["enabled-features", actorId, workspaceId],
    queryFn: () => fetchEnabledFeatures(workspaceId as string),
    enabled: !!workspaceId && !!actorId && !authLoading,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS * 2,
  });

  // TanStack Query deliberately retains the last successful `data` when a
  // refetch fails. That is useful for ordinary content, but unsafe for access
  // decisions: stale paid entitlements must never survive a lookup error.
  const hasAuthoritativeResult = !!workspaceId && !!actorId && query.isSuccess && !query.isError;
  const authoritativeFeatures = hasAuthoritativeResult ? (query.data ?? []) : [];
  const set = new Set(authoritativeFeatures.map((feature) => feature.feature_key));

  return {
    ...query,
    data: authoritativeFeatures,
    features: authoritativeFeatures,
    isEnabled: (key: string) => hasAuthoritativeResult && set.has(key),
  };
}

/**
 * Convenience hook: returns boolean for a single feature key.
 * While loading, returns `false` (fail-closed) — wrap in `isLoading` UI if needed.
 */
export function useFeature(workspaceId: string | null | undefined, featureKey: string) {
  const { isEnabled, isLoading, isError } = useEnabledFeatures(workspaceId);
  return { enabled: isEnabled(featureKey), isLoading, isError };
}
