import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const mocks = vi.hoisted(() => {
  class MockNativeAuthStorageError extends Error {
    readonly code: string;
    readonly isAcquireTimeout: boolean;

    constructor(code: string) {
      super("Safe native auth storage error");
      this.name = "NativeAuthStorageError";
      this.code = code;
      this.isAcquireTimeout = code === "lock-timeout";
    }
  }

  return {
    MockNativeAuthStorageError,
    ensureReady: vi.fn(),
    clearLocalSession: vi.fn(),
    reset: vi.fn(),
    subscribe: vi.fn(),
    onAuthStateChange: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
    toastWarning: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/lib/platform/nativeAuthStorage", () => ({
  NativeAuthStorageError: mocks.MockNativeAuthStorageError,
  clearSupabaseLocalAuthSession: mocks.clearLocalSession,
  ensureSupabaseAuthStorageReady: mocks.ensureReady,
  resetSupabaseNativeAuthStorage: mocks.reset,
  subscribeToNativeAuthStorageFailures: mocks.subscribe,
}));

vi.mock("@/lib/platform/mobile", () => ({
  isNativeRuntime: () => true,
  buildAuthCallbackUrl: () => "https://effectime.app/auth/callback",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: mocks.onAuthStateChange,
      getSession: mocks.getSession,
      signOut: mocks.signOut,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { warning: mocks.toastWarning, error: mocks.toastError },
}));

function SignOutProbe() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>Sign out probe</button>;
}

describe("AuthProvider native storage recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscribe.mockReturnValue(() => undefined);
    mocks.clearLocalSession.mockResolvedValue(undefined);
    mocks.reset.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("blocks auth without an insecure fallback and requires reset confirmation", async () => {
    mocks.ensureReady.mockRejectedValue(
      new mocks.MockNativeAuthStorageError("secure-store-unavailable"),
    );

    render(
      <AuthProvider>
        <div>Protected application</div>
      </AuthProvider>,
    );

    const recovery = await screen.findByRole("region", {
      name: "A helyi bejelentkezési adatok nem érhetők el",
    });
    expect(recovery).toHaveAttribute(
      "data-auth-storage-error-code",
      "secure-store-unavailable",
    );
    expect(screen.queryByText("Protected application")).not.toBeInTheDocument();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Helyi munkamenet törlése" }));
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Megerősítés: törlés és kijelentkezés" }),
    ).toBeVisible();
  });

  it("initializes Supabase only after secure storage is ready", async () => {
    mocks.ensureReady.mockResolvedValue(undefined);
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <div>Protected application</div>
      </AuthProvider>,
    );

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalledTimes(1));
    expect(mocks.ensureReady).toHaveBeenCalledTimes(1);
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Protected application")).toBeVisible();
  });

  it("purges local credentials and warns when remote sign-out fails", async () => {
    mocks.ensureReady.mockResolvedValue(undefined);
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signOut.mockResolvedValue({ error: new Error("simulated 503") });

    render(
      <AuthProvider>
        <SignOutProbe />
      </AuthProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sign out probe" }));

    await waitFor(() => expect(mocks.clearLocalSession).toHaveBeenCalledTimes(1));
    expect(mocks.toastWarning).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("reports a safe error when neither remote nor local sign-out can complete", async () => {
    mocks.ensureReady.mockResolvedValue(undefined);
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signOut.mockResolvedValue({ error: new Error("simulated 503") });
    mocks.clearLocalSession.mockRejectedValue(new Error("sensitive storage failure"));

    render(
      <AuthProvider>
        <SignOutProbe />
      </AuthProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sign out probe" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(mocks.toastWarning).not.toHaveBeenCalled();
  });
});
