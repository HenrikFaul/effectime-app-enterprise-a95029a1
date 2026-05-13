/**
 * <FeatureGate> — Declarative gate. Renders children only when the feature
 * is enabled for the active workspace's tenant. Optionally shows a fallback
 * (e.g. an upgrade prompt).
 *
 * Fail-open default: if the workspace returns *zero* enabled features
 * (legacy workspace with no tenant/tier binding), the gate stays open so
 * pre-tiering workspaces keep working. Once any feature is enabled, the
 * gate enforces strictly. Override with `strictWhenEmpty` to disable this.
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
  /** When true, the gate is strict even when no features are returned. */
  strictWhenEmpty?: boolean;
}

export function FeatureGate({
  workspaceId,
  feature,
  children,
  fallback = null,
  showFallbackWhileLoading = false,
  strictWhenEmpty = false,
}: FeatureGateProps) {
  const { isEnabled, isLoading, features } = useEnabledFeatures(workspaceId);
  if (isLoading) return showFallbackWhileLoading ? <>{fallback}</> : null;
  const tierActive = features.length > 0 || strictWhenEmpty;
  const allow = !tierActive || isEnabled(feature);
  return <>{allow ? children : fallback}</>;
}
