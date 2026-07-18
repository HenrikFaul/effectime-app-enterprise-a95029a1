/**
 * <FeatureGate> — Declarative gate. Renders children only when the feature
 * is enabled for the active workspace's tenant. Optionally shows a fallback
 * (e.g. an upgrade prompt).
 *
 * The gate is deliberately fail-closed: a missing workspace binding, an
 * empty entitlement result, or an entitlement lookup error must never expose
 * gated content. Loading also renders no children, preventing a brief flash
 * of unavailable functionality while the query resolves.
 */
import type { ReactNode } from "react";
import { useEnabledFeatures } from "@/hooks/useFeature";

interface FeatureGateProps {
  workspaceId: string | null | undefined;
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  /** When true, renders fallback while loading instead of nothing. */
  showFallbackWhileLoading?: boolean;
  /** @deprecated Gates are now always strict when the entitlement result is empty. */
  strictWhenEmpty?: boolean;
}

export function FeatureGate({
  workspaceId,
  feature,
  children,
  fallback = null,
  showFallbackWhileLoading = false,
}: FeatureGateProps) {
  const { isEnabled, isLoading, isError } = useEnabledFeatures(workspaceId);
  if (isLoading) return showFallbackWhileLoading ? <>{fallback}</> : null;
  return <>{workspaceId && !isError && isEnabled(feature) ? children : fallback}</>;
}
