import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileRuntimeBridge } from "@/components/mobile/MobileRuntimeBridge";
import { EFFECTIME_MOBILE_AUTH_CALLBACK } from "@/lib/platform/mobile";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (payload: { url?: string; isActive?: boolean }) => void>(),
  listenerRemovers: [] as ReturnType<typeof vi.fn>[],
  getLaunchUrl: vi.fn(),
  getState: vi.fn(),
  addListener: vi.fn(),
  browserClose: vi.fn(),
  navigate: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/platform/nativeBridge", () => ({
  isCapacitorNativeRuntime: () => true,
  getNativeAppPlugin: () => ({
    getLaunchUrl: mocks.getLaunchUrl,
    getState: mocks.getState,
    addListener: mocks.addListener,
  }),
  getNativeBrowserPlugin: () => ({ close: mocks.browserClose }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      startAutoRefresh: mocks.startAutoRefresh,
      stopAutoRefresh: mocks.stopAutoRefresh,
    },
  },
}));

vi.mock("@/lib/platform/mobile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform/mobile")>();
  return { ...actual, isNativeRuntime: () => true };
});

vi.mock("@/i18n/I18nProvider", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

function callback(flow: "signup" | "oauth-google" | "recovery", code: string): string {
  const url = new URL(EFFECTIME_MOBILE_AUTH_CALLBACK);
  url.searchParams.set("flow", flow);
  url.searchParams.set("code", code);
  url.searchParams.set("redirect", flow === "recovery" ? "/reset-password" : "/app");
  return url.toString();
}

async function mountBridge(launchUrl?: string) {
  mocks.getLaunchUrl.mockResolvedValue(launchUrl ? { url: launchUrl } : undefined);
  const rendered = render(<MobileRuntimeBridge />);
  await waitFor(() => expect(mocks.addListener).toHaveBeenCalledTimes(2));
  return rendered;
}

async function emitAppUrl(url: string): Promise<void> {
  await waitFor(() => expect(mocks.listeners.has("appUrlOpen")).toBe(true));
  await act(async () => {
    mocks.listeners.get("appUrlOpen")?.({ url });
    await Promise.resolve();
  });
}

describe("MobileRuntimeBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.listenerRemovers.length = 0;
    mocks.getState.mockResolvedValue({ isActive: true });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.browserClose.mockResolvedValue(undefined);
    mocks.addListener.mockImplementation(
      (event: string, listener: (payload: { url?: string; isActive?: boolean }) => void) => {
        mocks.listeners.set(event, listener);
        const remove = vi.fn().mockResolvedValue(undefined);
        mocks.listenerRemovers.push(remove);
        return { remove };
      },
    );
  });

  it("exchanges a cold-start PKCE callback exactly once", async () => {
    const rendered = await mountBridge(callback("oauth-google", "cold-code"));

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("cold-code"));
    expect(mocks.navigate).toHaveBeenCalledWith("/app", {
      replace: true,
      state: undefined,
    });
    expect(mocks.startAutoRefresh).toHaveBeenCalled();
    rendered.unmount();
  });

  it("preserves recovery intent after a warm-start PKCE exchange", async () => {
    const rendered = await mountBridge();

    await emitAppUrl(callback("recovery", "recovery-code"));

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code"));
    expect(mocks.navigate).toHaveBeenCalledWith("/reset-password", {
      replace: true,
      state: { nativeRecovery: true },
    });
    rendered.unmount();
  });

  it("rejects custom-scheme implicit tokens without creating a session", async () => {
    const rendered = await mountBridge();

    await emitAppUrl(
      `${EFFECTIME_MOBILE_AUTH_CALLBACK}?flow=oauth-google#access_token=access&refresh_token=refresh`,
    );

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it("rejects HTTPS auth links carrying attacker-controlled session tokens", async () => {
    const rendered = await mountBridge();

    await emitAppUrl(
      "https://effectime.app/auth?oauth=google#access_token=attacker&refresh_token=attacker",
    );

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it("deduplicates one code but processes a distinct immediate retry", async () => {
    const rendered = await mountBridge();
    const first = callback("oauth-google", "first-code");

    await emitAppUrl(first);
    await emitAppUrl(first);
    await emitAppUrl(callback("oauth-google", "second-code"));

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(2));
    expect(mocks.exchangeCodeForSession).toHaveBeenNthCalledWith(1, "first-code");
    expect(mocks.exchangeCodeForSession).toHaveBeenNthCalledWith(2, "second-code");
    rendered.unmount();
  });

  it("fails closed and returns to auth when PKCE exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid grant") });
    const rendered = await mountBridge();

    await emitAppUrl(callback("oauth-google", "bad-code"));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/auth", { replace: true }));
    expect(mocks.toastError).toHaveBeenCalledWith("auth_page.toast_google_session_failed");
    expect(mocks.browserClose).toHaveBeenCalled();
    rendered.unmount();
  });

  it("removes native listeners and stops refresh on unmount", async () => {
    const rendered = await mountBridge();

    rendered.unmount();

    await waitFor(() => {
      expect(mocks.listenerRemovers).toHaveLength(2);
      expect(mocks.listenerRemovers.every((remove) => remove.mock.calls.length === 1)).toBe(true);
    });
    expect(mocks.stopAutoRefresh).toHaveBeenCalled();
  });
});
