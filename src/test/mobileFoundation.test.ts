import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  EFFECTIME_MOBILE_AUTH_CALLBACK,
  buildAuthCallbackUrl,
  buildPublicAppUrl,
  isAllowedSupabaseOAuthUrl,
  normalizePublicAppOrigin,
  parseEffectimeAppLink,
  readWebImplicitSessionTokens,
} from "@/lib/platform/mobile";
import {
  getNativeAppPlugin,
  getNativeBrowserPlugin,
  isCapacitorNativeRuntime,
} from "@/lib/platform/nativeBridge";

const ROOT = process.cwd();
const WORKSPACE_ID = "6f8f5771-8df1-4f6d-9b95-8f6f3c8a6b0e";

describe("mobile runtime foundation", () => {
  it("stays fail-closed once Capacitor bridge injection starts and validates plugins", () => {
    const runtime = globalThis as typeof globalThis & { Capacitor?: unknown };
    const previous = runtime.Capacitor;
    const app = {
      getLaunchUrl: vi.fn(),
      getState: vi.fn(),
      addListener: vi.fn(),
    };
    const browser = { open: vi.fn(), close: vi.fn() };

    try {
      runtime.Capacitor = undefined;
      expect(isCapacitorNativeRuntime()).toBe(false);
      expect(getNativeAppPlugin()).toBeNull();
      expect(getNativeBrowserPlugin()).toBeNull();

      runtime.Capacitor = { Plugins: {} };
      expect(isCapacitorNativeRuntime()).toBe(true);
      runtime.Capacitor = {
        isNativePlatform: () => {
          throw new Error("bridge initialization failed");
        },
        Plugins: {},
      };
      expect(isCapacitorNativeRuntime()).toBe(true);

      runtime.Capacitor = {
        isNativePlatform: () => true,
        Plugins: { App: app, Browser: browser },
      };
      expect(isCapacitorNativeRuntime()).toBe(true);
      expect(getNativeAppPlugin()).toBe(app);
      expect(getNativeBrowserPlugin()).toBe(browser);

      runtime.Capacitor = {
        isNativePlatform: () => true,
        Plugins: { App: { getLaunchUrl: vi.fn() }, Browser: { open: vi.fn() } },
      };
      expect(getNativeAppPlugin()).toBeNull();
      expect(getNativeBrowserPlugin()).toBeNull();
    } finally {
      runtime.Capacitor = previous;
    }
  });

  it("normalizes only secure public origins and explicit local development origins", () => {
    expect(normalizePublicAppOrigin("https://effectime.app/")).toBe("https://effectime.app");
    expect(normalizePublicAppOrigin("http://localhost:8080", true)).toBe("http://localhost:8080");
    expect(normalizePublicAppOrigin("http://127.0.0.1:4173", true)).toBe("http://127.0.0.1:4173");

    expect(() => normalizePublicAppOrigin("http://effectime.app")).toThrow(/HTTPS/);
    expect(() => normalizePublicAppOrigin("http://evil.example", true)).toThrow(/HTTPS/);
    expect(() => normalizePublicAppOrigin("https://user:pass@effectime.app")).toThrow(
      /credentials/,
    );
    expect(() => normalizePublicAppOrigin("https://effectime.app/app")).toThrow(/origin/);
    expect(() => normalizePublicAppOrigin("capacitor://localhost")).toThrow(/HTTPS/);
  });

  it("never builds externally shared links from a native-local origin", () => {
    expect(buildPublicAppUrl(`/book/${WORKSPACE_ID}`)).toBe(
      `https://effectime.app/book/${WORKSPACE_ID}`,
    );
    expect(() => buildPublicAppUrl("//evil.example/app")).toThrow(/internal path/);
    expect(() => buildPublicAppUrl("/../admin")).toThrow(/unsafe URL syntax/);
    expect(() => buildPublicAppUrl("/%2e%2e/admin")).toThrow(/unsafe URL syntax/);
  });

  it("builds a fixed custom-scheme callback with an allowlisted return path", () => {
    const callback = buildAuthCallbackUrl("oauth-google", `/w/${WORKSPACE_ID}?tab=calendar`, true);
    const url = new URL(callback);

    expect(`${url.protocol}//${url.host}${url.pathname}`).toBe(EFFECTIME_MOBILE_AUTH_CALLBACK);
    expect(url.searchParams.get("flow")).toBe("oauth-google");
    expect(url.searchParams.get("redirect")).toBe(`/w/${WORKSPACE_ID}?tab=calendar`);

    const unsafe = new URL(buildAuthCallbackUrl("oauth-google", "//evil.example", true));
    expect(unsafe.searchParams.get("redirect")).toBe("/app");
  });

  it("parses PKCE callbacks and rejects implicit grants or arbitrary routes", () => {
    expect(
      parseEffectimeAppLink(
        `${EFFECTIME_MOBILE_AUTH_CALLBACK}?flow=oauth-google&redirect=%2Fapp&code=one-time-code`,
      ),
    ).toEqual({
      type: "auth",
      flow: "oauth-google",
      code: "one-time-code",
      redirectTo: "/app",
      hasError: false,
    });

    expect(
      parseEffectimeAppLink(
        `${EFFECTIME_MOBILE_AUTH_CALLBACK}?flow=recovery&redirect=%2Freset-password&code=recovery-code`,
      ),
    ).toEqual({
      type: "auth",
      flow: "recovery",
      code: "recovery-code",
      redirectTo: "/reset-password",
      hasError: false,
    });

    expect(
      parseEffectimeAppLink(
        `${EFFECTIME_MOBILE_AUTH_CALLBACK}?flow=oauth-google&error=access_denied`,
      ),
    ).toMatchObject({ type: "auth", flow: "oauth-google", hasError: true });
    expect(
      parseEffectimeAppLink(
        `${EFFECTIME_MOBILE_AUTH_CALLBACK}?flow=oauth-google#access_token=access&refresh_token=refresh`,
      ),
    ).toBeNull();
    expect(
      parseEffectimeAppLink(
        "https://effectime.app/auth?oauth=google#access_token=attacker&refresh_token=attacker",
      ),
    ).toBeNull();
    expect(parseEffectimeAppLink(`${EFFECTIME_MOBILE_AUTH_CALLBACK}?code=missing-flow`)).toBeNull();
    expect(parseEffectimeAppLink("effectime://auth/callback?code=wrong-scheme")).toBeNull();
    expect(parseEffectimeAppLink("app.effectime://w/not-a-uuid")).toBeNull();
  });

  it("restores implicit session tokens only in the legacy web runtime", () => {
    const hash = "#access_token=web-access&refresh_token=web-refresh";
    expect(readWebImplicitSessionTokens(hash, true)).toBeNull();
    expect(readWebImplicitSessionTokens(hash, false)).toEqual({
      accessToken: "web-access",
      refreshToken: "web-refresh",
    });
  });

  it("accepts only canonical app links and existing application routes", () => {
    expect(parseEffectimeAppLink(`app.effectime://w/${WORKSPACE_ID}?tab=calendar`)).toEqual({
      type: "navigate",
      redirectTo: `/w/${WORKSPACE_ID}?tab=calendar`,
    });
    expect(parseEffectimeAppLink(`https://effectime.app/w/${WORKSPACE_ID}?tab=calendar`)).toEqual({
      type: "navigate",
      redirectTo: `/w/${WORKSPACE_ID}?tab=calendar`,
    });
    expect(parseEffectimeAppLink("https://evil.example/app")).toBeNull();
    expect(parseEffectimeAppLink("https://effectime.app/unknown")).toBeNull();
  });

  it("opens OAuth only through the configured Supabase authorization endpoint", () => {
    const backend = "https://project.supabase.co";
    expect(
      isAllowedSupabaseOAuthUrl(
        "https://project.supabase.co/auth/v1/authorize?provider=google",
        backend,
      ),
    ).toBe(true);
    expect(isAllowedSupabaseOAuthUrl("https://google.com/auth/v1/authorize", backend)).toBe(false);
    expect(isAllowedSupabaseOAuthUrl("http://project.supabase.co/auth/v1/authorize", backend)).toBe(
      false,
    );
    expect(isAllowedSupabaseOAuthUrl("https://project.supabase.co/rest/v1/users", backend)).toBe(
      false,
    );
    expect(
      isAllowedSupabaseOAuthUrl("https://project.supabase.co/auth/v1/authorize/extra", backend),
    ).toBe(false);
  });
});

describe("mobile release security contracts", () => {
  const capacitorConfig = readFileSync(join(ROOT, "capacitor.config.ts"), "utf8");
  const supabaseClient = readFileSync(join(ROOT, "src/integrations/supabase/client.ts"), "utf8");
  const serviceWorkerRegistration = readFileSync(join(ROOT, "src/lib/pwa/registerSW.ts"), "utf8");
  const notFound = readFileSync(join(ROOT, "src/pages/NotFound.tsx"), "utf8");
  const resetPassword = readFileSync(join(ROOT, "src/pages/ResetPassword.tsx"), "utf8");
  const authPage = readFileSync(join(ROOT, "src/pages/Auth.tsx"), "utf8");
  const m365Panel = readFileSync(
    join(ROOT, "src/components/enterprise/settings/M365IntegrationPanel.tsx"),
    "utf8",
  );
  const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");

  it("uses bundled Effectime assets without a remote or cleartext server", () => {
    expect(capacitorConfig).toContain("appId: 'app.effectime'");
    expect(capacitorConfig).toContain("appName: 'Effectime'");
    expect(capacitorConfig).toContain("webDir: 'dist-mobile'");
    expect(capacitorConfig).not.toContain("server:");
    expect(capacitorConfig).not.toContain("cleartext");
    expect(capacitorConfig).not.toContain("lovableproject.com");
  });

  it("uses PKCE/manual callbacks on native and does not start the PWA cache there", () => {
    expect(supabaseClient).toContain("flowType: nativeRuntime ? 'pkce' : 'implicit'");
    expect(supabaseClient).toContain("detectSessionInUrl: !nativeRuntime");
    expect(serviceWorkerRegistration.match(/if \(isNativeRuntime\(\)\) return;/g)).toHaveLength(2);
    expect(authPage).toContain("readWebImplicitSessionTokens(window.location.hash)");
    expect(m365Panel).toContain("disabled={connecting || nativeRuntime}");
    expect(m365Panel).toContain("m365.native_oauth_unavailable");
  });

  it("does not retain auth-bearing URLs in 404 diagnostics or navigation caches", () => {
    expect(notFound).not.toContain("window.location.href");
    expect(notFound).not.toContain("window.location.search");
    expect(notFound).not.toContain("window.location.hash");
    expect(notFound).not.toContain("__lastNotFound");
    const navigationCacheBranch = sw.slice(
      sw.indexOf("// Same-origin navigation requests"),
      sw.indexOf("// Static assets"),
    );
    expect(navigationCacheBranch).not.toMatch(/\.put\(req,/);
    expect(navigationCacheBranch).not.toContain("caches.match(req)");
    expect(sw).toContain("const CACHE_VERSION = 'effectime-v3.51.3'");
  });

  it("requires an exchanged native session before showing password recovery", () => {
    expect(resetPassword).toContain("nativeRecovery");
    expect(resetPassword).toContain("supabase.auth.getSession()");
    expect(resetPassword).toContain("Boolean(data.session)");
  });
});
