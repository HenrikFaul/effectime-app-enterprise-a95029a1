/**
 * <FeatureGate> — Declarative gate. Renders children only when the feature
 * is enabled for the active workspace's tenant. Optionally shows a fallback
 * (e.g. an upgrade prompt).
 */
import type { ReactNode } from "react";
import { useFeature } from "@/hooks/useFeature";

interface FeatureGateProps {
  workspaceId: string | null | undefined;
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  /** When true, renders fallback while loading instead of nothing. */
  showFallbackWhileLoading?: boolean;
}

export function FeatureGate({
  workspaceId,
  feature,
  children,
  fallback = null,
  showFallbackWhileLoading = false,
}: FeatureGateProps) {
  const { enabled, isLoading } = useFeature(workspaceId, feature);
  if (isLoading) return showFallbackWhileLoading ? <>{fallback}</> : null;
  return <>{enabled ? children : fallback}</>;
}
