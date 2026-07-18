import { isSafeInternalPath, resolveInternalPath } from "@/lib/internalPath";
import { isCapacitorNativeRuntime } from "@/lib/platform/nativeBridge";

export const EFFECTIME_APP_ID = "app.effectime";
export const EFFECTIME_MOBILE_SCHEME = EFFECTIME_APP_ID;
export const EFFECTIME_MOBILE_AUTH_CALLBACK = `${EFFECTIME_MOBILE_SCHEME}://auth/callback`;
export const EFFECTIME_PRODUCTION_ORIGIN = "https://effectime.app";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DOT_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;

export type AuthCallbackMode = "signup" | "oauth-google" | "recovery";

export type EffectimeAppLink =
  | {
      type: "auth";
      flow: AuthCallbackMode;
      code: string | null;
      redirectTo: string;
      hasError: boolean;
    }
  | {
      type: "navigate";
      redirectTo: string;
    };

export function isNativeRuntime(): boolean {
  return isCapacitorNativeRuntime();
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

export function normalizePublicAppOrigin(candidate: string, allowLocalHttp = false): string {
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("VITE_PUBLIC_APP_ORIGIN must be an absolute URL.");
  }

  const localHttpAllowed =
    allowLocalHttp && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);

  if (url.protocol !== "https:" && !localHttpAllowed) {
    throw new Error("VITE_PUBLIC_APP_ORIGIN must use HTTPS outside local development.");
  }
  if (url.username || url.password) {
    throw new Error("VITE_PUBLIC_APP_ORIGIN must not contain credentials.");
  }
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) {
    throw new Error("VITE_PUBLIC_APP_ORIGIN must contain only an origin.");
  }

  return url.origin;
}

export function getPublicAppOrigin(): string {
  return normalizePublicAppOrigin(
    import.meta.env.VITE_PUBLIC_APP_ORIGIN || EFFECTIME_PRODUCTION_ORIGIN,
    import.meta.env.DEV,
  );
}

function validatePublicPath(path: string): void {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Public application links must use an absolute internal path.");
  }
  if (path.includes("\\") || containsControlCharacter(path)) {
    throw new Error("Public application link contains unsafe characters.");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    throw new Error("Public application link contains invalid encoding.");
  }

  const decodedPathname = decoded.split(/[?#]/, 1)[0];
  if (
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    containsControlCharacter(decoded) ||
    DOT_SEGMENT.test(decodedPathname)
  ) {
    throw new Error("Public application link contains unsafe URL syntax.");
  }
}

/**
 * Builds links that leave the current web or native runtime. These links must
 * never inherit a Capacitor localhost/custom-scheme origin.
 */
export function buildPublicAppUrl(path: string): string {
  validatePublicPath(path);
  const origin = getPublicAppOrigin();
  const url = new URL(path, `${origin}/`);

  if (url.origin !== origin) {
    throw new Error("Public application link escaped the configured origin.");
  }

  return url.toString();
}

function currentWebOrigin(): string {
  if (typeof window === "undefined") return getPublicAppOrigin();
  // Production-preview and local E2E builds also run over loopback HTTP.
  // normalizePublicAppOrigin still rejects every non-loopback HTTP host.
  return normalizePublicAppOrigin(window.location.origin, true);
}

export function buildAuthCallbackUrl(
  mode: AuthCallbackMode,
  redirectPath: string,
  native = isNativeRuntime(),
): string {
  const fallback = mode === "recovery" ? "/reset-password" : "/app";
  const safeRedirect = resolveInternalPath(redirectPath, fallback);

  if (native) {
    const callback = new URL(EFFECTIME_MOBILE_AUTH_CALLBACK);
    callback.searchParams.set("flow", mode);
    callback.searchParams.set("redirect", safeRedirect);
    return callback.toString();
  }

  const callback = new URL("/", currentWebOrigin());
  if (mode === "recovery") {
    callback.hash = "/reset-password";
    return callback.toString();
  }

  const params = new URLSearchParams({ redirect: safeRedirect });
  if (mode === "oauth-google") params.set("oauth", "google");
  callback.hash = `/auth?${params.toString()}`;
  return callback.toString();
}

export interface ImplicitSessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Legacy web OAuth callbacks can still carry an implicit grant. A native app
 * must never consume one because any installed application can receive an
 * externally opened URL and otherwise force an attacker-controlled session.
 */
export function readWebImplicitSessionTokens(
  hash: string,
  native = isNativeRuntime(),
): ImplicitSessionTokens | null {
  if (native) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

function mergedAuthParams(url: URL): URLSearchParams {
  const params = new URLSearchParams(url.search);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  fragment.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

function parseAuthCallback(url: URL): EffectimeAppLink | null {
  const params = mergedAuthParams(url);
  const flow = params.get("flow");
  if (flow !== "signup" && flow !== "oauth-google" && flow !== "recovery") return null;

  const fallback = flow === "recovery" ? "/reset-password" : "/app";
  const code = params.get("code");
  const hasError =
    params.has("error") || params.has("error_code") || params.has("error_description");

  // Native auth is PKCE-only. Never accept access/refresh tokens from a
  // globally invokable custom scheme because that would allow session swap.
  if (!code && !hasError) return null;

  return {
    type: "auth",
    flow,
    code,
    redirectTo: resolveInternalPath(params.get("redirect"), fallback),
    hasError,
  };
}

function parseCustomSchemeLink(url: URL): EffectimeAppLink | null {
  if (url.protocol !== `${EFFECTIME_MOBILE_SCHEME}:`) return null;
  if (url.username || url.password || url.port) return null;

  if (url.hostname === "auth" && url.pathname === "/callback") {
    return parseAuthCallback(url);
  }

  if (url.hostname === "w") {
    const candidate = `/w${url.pathname}${url.search}`;
    return isSafeInternalPath(candidate) ? { type: "navigate", redirectTo: candidate } : null;
  }

  return null;
}

/** Parses only Effectime-owned custom-scheme or canonical HTTPS app links. */
export function parseEffectimeAppLink(rawUrl: string): EffectimeAppLink | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Defense in depth for every custom-scheme and HTTPS route, including
  // ordinary `/auth` navigation links. Native session creation is PKCE-only.
  const suppliedParams = mergedAuthParams(url);
  if (suppliedParams.has("access_token") || suppliedParams.has("refresh_token")) {
    return null;
  }

  const customSchemeLink = parseCustomSchemeLink(url);
  if (customSchemeLink) return customSchemeLink;

  if (url.protocol !== "https:" || url.origin !== getPublicAppOrigin()) return null;

  if (url.pathname === "/auth/mobile-callback") {
    return parseAuthCallback(url);
  }

  const candidate = `${url.pathname}${url.search}${url.hash}`;
  return isSafeInternalPath(candidate) ? { type: "navigate", redirectTo: candidate } : null;
}

export function isAllowedSupabaseOAuthUrl(candidate: string, supabaseUrl: string): boolean {
  try {
    const target = new URL(candidate);
    const backend = new URL(supabaseUrl);
    return (
      target.protocol === "https:" &&
      target.origin === backend.origin &&
      target.pathname === "/auth/v1/authorize"
    );
  } catch {
    return false;
  }
}
