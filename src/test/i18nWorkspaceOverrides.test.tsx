import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface OverrideRow {
  locale: string;
  key: string;
  value: string;
}

interface OverrideResult {
  data: OverrideRow[] | null;
  error: unknown;
}

const mocks = vi.hoisted(() => ({
  queryByWorkspace: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: mocks.unsubscribe } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: mocks.queryByWorkspace })),
    })),
  },
}));

import { I18nProvider, useI18n } from "@/i18n/I18nProvider";

const WORKSPACE_A = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_B = "22222222-2222-4222-8222-222222222222";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function OverrideProbe() {
  const { activeWorkspaceId, loadWorkspaceOverrides, t } = useI18n();
  return (
    <>
      <output>{`${activeWorkspaceId ?? "none"}:${t("contract.workspace_label")}`}</output>
      <button type="button" onClick={() => void loadWorkspaceOverrides(WORKSPACE_A)}>
        load-a
      </button>
      <button type="button" onClick={() => void loadWorkspaceOverrides(WORKSPACE_B)}>
        load-b
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <I18nProvider>
      <OverrideProbe />
    </I18nProvider>,
  );
}

describe("I18nProvider workspace override tenant lifecycle", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.queryByWorkspace.mockReset();
    mocks.unsubscribe.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("ignores an older tenant response that resolves after the active tenant", async () => {
    const requestA = deferred<OverrideResult>();
    const requestB = deferred<OverrideResult>();
    mocks.queryByWorkspace
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise);
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "load-a" }));
    fireEvent.click(screen.getByRole("button", { name: "load-b" }));
    expect(screen.getByText(`${WORKSPACE_B}:contract.workspace_label`)).toBeVisible();

    await act(async () => {
      requestB.resolve({
        data: [{ locale: "en", key: "contract.workspace_label", value: "Tenant B" }],
        error: null,
      });
    });
    expect(screen.getByText(`${WORKSPACE_B}:Tenant B`)).toBeVisible();

    await act(async () => {
      requestA.resolve({
        data: [{ locale: "en", key: "contract.workspace_label", value: "Tenant A" }],
        error: null,
      });
    });
    expect(screen.getByText(`${WORKSPACE_B}:Tenant B`)).toBeVisible();
  });

  it("clears the previous tenant overrides before a failed switch", async () => {
    mocks.queryByWorkspace
      .mockResolvedValueOnce({
        data: [{ locale: "en", key: "contract.workspace_label", value: "Tenant A" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: "permission-denied" } });
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "load-a" }));
    expect(await screen.findByText(`${WORKSPACE_A}:Tenant A`)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "load-b" }));
    expect(screen.getByText(`${WORKSPACE_B}:contract.workspace_label`)).toBeVisible();
    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith("[i18n] workspace overrides load failed"),
    );
    expect(screen.queryByText(/Tenant A/)).not.toBeInTheDocument();
  });
});
