import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authCallback: undefined as
    ((event: string, session: { user: { id: string } } | null) => void) | undefined,
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  rpc: vi.fn(),
  unsubscribe: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: vi.fn(() => ({
      update: mocks.update,
    })),
    rpc: mocks.rpc,
  },
}));

import { I18nProvider, useI18n } from "@/i18n/I18nProvider";

const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function Probe() {
  const { locale, ready, setLocale } = useI18n();
  return (
    <>
      <output>{"locale:" + locale + ";ready:" + String(ready)}</output>
      <button type="button" onClick={() => setLocale("pl")}>
        choose-pl
      </button>
      <button type="button" onClick={() => setLocale("ro")}>
        choose-ro
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <I18nProvider>
      <Probe />
    </I18nProvider>,
  );
}

describe("I18nProvider own-profile locale lifecycle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.authCallback = undefined;
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: USER_A } } });
    mocks.rpc.mockReset().mockResolvedValue({ data: "hu", error: null });
    mocks.unsubscribe.mockReset();
    mocks.update.mockReset().mockImplementation(() => ({ eq: mocks.updateEq }));
    mocks.updateEq.mockReset().mockResolvedValue({ error: null });
    mocks.onAuthStateChange.mockReset().mockImplementation((callback) => {
      mocks.authCallback = callback;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
  });

  it("hydrates only through the self-locale RPC", async () => {
    renderProvider();

    expect(await screen.findByText("locale:hu;ready:true")).toBeVisible();
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_profile_locale_v1");
  });

  it("keeps an explicit locale selected while remote hydration is in flight", async () => {
    const request = deferred<{ data: string; error: null }>();
    mocks.rpc.mockReturnValueOnce(request.promise);
    renderProvider();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "choose-pl" }));
    expect(screen.getByText("locale:pl;ready:false")).toBeVisible();

    await act(async () => {
      request.resolve({ data: "hu", error: null });
    });
    expect(screen.getByText("locale:pl;ready:true")).toBeVisible();
  });

  it("preserves and persists a locale selected before the initial user lookup resolves", async () => {
    const userLookup = deferred<{ data: { user: { id: string } } }>();
    mocks.getUser.mockReturnValueOnce(userLookup.promise);
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "choose-pl" }));
    expect(screen.getByText("locale:pl;ready:false")).toBeVisible();

    await act(async () => {
      userLookup.resolve({ data: { user: { id: USER_A } } });
    });

    expect(await screen.findByText("locale:pl;ready:true")).toBeVisible();
    await waitFor(() => expect(mocks.updateEq).toHaveBeenCalledWith("user_id", USER_A));
    expect(mocks.update).toHaveBeenCalledWith({ preferred_locale: "pl" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps locale state usable when browser storage access is denied", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    try {
      renderProvider();
      expect(await screen.findByText("locale:hu;ready:true")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "choose-ro" }));
      expect(screen.getByText("locale:ro;ready:true")).toBeVisible();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("rehydrates when the authenticated account changes without a provider remount", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: "hu", error: null })
      .mockResolvedValueOnce({ data: "ro", error: null });
    renderProvider();
    expect(await screen.findByText("locale:hu;ready:true")).toBeVisible();

    await act(async () => {
      mocks.authCallback?.("SIGNED_IN", { user: { id: USER_B } });
    });

    expect(await screen.findByText("locale:ro;ready:true")).toBeVisible();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("persists against the account captured when the locale is selected", async () => {
    renderProvider();
    expect(await screen.findByText("locale:hu;ready:true")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "choose-pl" }));
    await act(async () => {
      mocks.authCallback?.("SIGNED_IN", { user: { id: USER_B } });
    });

    await waitFor(() => expect(mocks.updateEq).toHaveBeenCalledWith("user_id", USER_A));
    expect(mocks.update).toHaveBeenCalledWith({ preferred_locale: "pl" });
  });

  it("serializes rapid locale writes in interaction order", async () => {
    const firstWrite = deferred<{ error: null }>();
    mocks.updateEq.mockReturnValueOnce(firstWrite.promise).mockResolvedValueOnce({ error: null });
    renderProvider();
    expect(await screen.findByText("locale:hu;ready:true")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "choose-pl" }));
    fireEvent.click(screen.getByRole("button", { name: "choose-ro" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenNthCalledWith(1, { preferred_locale: "pl" });

    await act(async () => {
      firstWrite.resolve({ error: null });
    });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update).toHaveBeenNthCalledWith(2, { preferred_locale: "ro" });
    expect(mocks.updateEq).toHaveBeenNthCalledWith(1, "user_id", USER_A);
    expect(mocks.updateEq).toHaveBeenNthCalledWith(2, "user_id", USER_A);
  });
});
