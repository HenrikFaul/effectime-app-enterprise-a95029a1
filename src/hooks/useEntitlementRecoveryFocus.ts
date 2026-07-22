import { useCallback, useEffect, useRef, type RefObject } from 'react';

export interface EntitlementSurfaceState {
  featureAccessAvailable: boolean;
  showRecovery: boolean;
}

/** Keeps authoritative business content and the recovery surface exclusive. */
export function resolveEntitlementSurfaceState(
  featuresSuccess: boolean,
  featuresError: boolean,
  entitlementRetrying: boolean,
): EntitlementSurfaceState {
  const featureAccessAvailable = featuresSuccess && !featuresError && !entitlementRetrying;
  return {
    featureAccessAvailable,
    showRecovery: !featureAccessAvailable && (featuresError || entitlementRetrying),
  };
}

/**
 * Restores keyboard focus after a manual entitlement retry makes the workspace
 * content authoritative again. A tenant/actor switch invalidates the request,
 * and the scheduled focus is cancelled if the context changes before paint.
 */
export function useEntitlementRecoveryFocus<T extends HTMLElement>(
  contextKey: string,
  featureAccessAvailable: boolean,
  showRecovery: boolean,
  targetRef: RefObject<T | null>,
) {
  const requestedContextRef = useRef<string | null>(null);

  useEffect(() => {
    if (requestedContextRef.current !== contextKey) {
      requestedContextRef.current = null;
    }
  }, [contextKey]);

  const requestFocusRestore = useCallback(() => {
    requestedContextRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    if (
      showRecovery
      || !featureAccessAvailable
      || requestedContextRef.current !== contextKey
    ) return;

    requestedContextRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      targetRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [contextKey, featureAccessAvailable, showRecovery, targetRef]);

  return requestFocusRestore;
}
