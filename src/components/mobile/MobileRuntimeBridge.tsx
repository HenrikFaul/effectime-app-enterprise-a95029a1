import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/I18nProvider";
import {
  isNativeRuntime,
  parseEffectimeAppLink,
  type EffectimeAppLink,
} from "@/lib/platform/mobile";
import {
  getNativeAppPlugin,
  getNativeBrowserPlugin,
  type NativePluginListenerHandle,
} from "@/lib/platform/nativeBridge";

const CALLBACK_DEDUPLICATION_WINDOW_MS = 10_000;

function reportBridgeFailure(operation: string): void {
  // Do not include plugin error objects or callback URLs: they may carry an
  // authorization code. The operation name is sufficient for diagnostics.
  console.warn(`[Effectime mobile] ${operation} could not be completed.`);
}

async function closeAuthBrowser(): Promise<void> {
  try {
    const browser = getNativeBrowserPlugin();
    if (!browser) throw new Error("Native Browser plugin is unavailable.");
    await browser.close();
  } catch {
    reportBridgeFailure("Auth browser close");
  }
}

function ephemeralGrantHash(value: string): string {
  // Non-cryptographic is sufficient for an in-memory dedupe key. The grant is
  // never logged or persisted; including it distinguishes legitimate retries.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${value.length}:${(hash >>> 0).toString(16)}`;
}

function callbackFingerprint(link: EffectimeAppLink): string {
  if (link.type === "navigate") return `navigate:${link.redirectTo}`;
  const grant = link.code ? ephemeralGrantHash(link.code) : "none";
  return `auth:pkce:${link.flow}:${grant}:${link.redirectTo}:${link.hasError ? "error" : "ok"}`;
}

export function MobileRuntimeBridge() {
  const navigate = useNavigate();
  const t = useT();
  const lastCallback = useRef<{ fingerprint: string; handledAt: number } | null>(null);
  const processing = useRef(Promise.resolve());

  const processAppUrl = useCallback(
    (rawUrl: string) => {
      let link: EffectimeAppLink | null;
      try {
        link = parseEffectimeAppLink(rawUrl);
      } catch {
        reportBridgeFailure("App-link validation");
        return;
      }
      if (!link) return;

      const fingerprint = callbackFingerprint(link);
      const now = Date.now();
      if (
        lastCallback.current?.fingerprint === fingerprint &&
        now - lastCallback.current.handledAt < CALLBACK_DEDUPLICATION_WINDOW_MS
      ) {
        return;
      }
      lastCallback.current = { fingerprint, handledAt: now };

      processing.current = processing.current.then(async () => {
        if (link.type === "navigate") {
          navigate(link.redirectTo, { replace: true });
          return;
        }

        try {
          if (link.hasError) throw new Error("Native authentication callback reported an error.");

          if (!link.code) {
            throw new Error("Native authentication callback did not contain a supported grant.");
          }
          const { error } = await supabase.auth.exchangeCodeForSession(link.code);
          if (error) throw error;

          await closeAuthBrowser();
          navigate(link.redirectTo, {
            replace: true,
            state: link.flow === "recovery" ? { nativeRecovery: true } : undefined,
          });
        } catch {
          await closeAuthBrowser();
          toast.error(t("auth_page.toast_google_session_failed"));
          navigate("/auth", { replace: true });
        }
      });
    },
    [navigate, t],
  );

  useEffect(() => {
    if (!isNativeRuntime()) return;

    const nativeApp = getNativeAppPlugin();
    if (!nativeApp) {
      reportBridgeFailure("Native App plugin lookup");
      return;
    }

    let disposed = false;
    let urlListener: NativePluginListenerHandle | undefined;
    let stateListener: NativePluginListenerHandle | undefined;

    void nativeApp
      .getLaunchUrl()
      .then((launch) => {
        if (!disposed && launch?.url) processAppUrl(launch.url);
      })
      .catch(() => reportBridgeFailure("Cold-start URL lookup"));

    void Promise.resolve(nativeApp.addListener("appUrlOpen", ({ url }) => processAppUrl(url)))
      .then((handle) => {
        if (disposed) void handle.remove();
        else urlListener = handle;
      })
      .catch(() => reportBridgeFailure("App-link listener registration"));

    void nativeApp
      .getState()
      .then(({ isActive }) => {
        if (disposed) return;
        if (isActive) supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      })
      .catch(() => {
        reportBridgeFailure("Initial app-state lookup");
        if (!disposed) supabase.auth.startAutoRefresh();
      });

    void Promise.resolve(
      nativeApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }),
    )
      .then((handle) => {
        if (disposed) void handle.remove();
        else stateListener = handle;
      })
      .catch(() => reportBridgeFailure("App-state listener registration"));

    return () => {
      disposed = true;
      void urlListener?.remove().catch(() => reportBridgeFailure("App-link listener removal"));
      void stateListener?.remove().catch(() => reportBridgeFailure("App-state listener removal"));
      supabase.auth.stopAutoRefresh();
    };
  }, [processAppUrl]);

  return null;
}
