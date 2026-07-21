import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "30000000-0000-4000-8000-000000000001";

const mocks = vi.hoisted(() => ({
  fetchResult: vi.fn(),
  saveResult: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: USER_ID, email: "ada@example.test" } }),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    t: (key: string) => ({
      "profile.display_name_label": "Display name",
      "profile.display_name_validation_error": "Enter a display name of 1–200 characters without control characters.",
      "profile.save": "Save",
      "profile.saving": "Saving...",
      "profile.save_error": "Error saving profile",
      "profile.save_success": "Profile updated!",
      "profile.load_error": "Could not load your profile.",
      "profile.retry_load": "Retry",
      "profile.save_conflict": "Your profile changed elsewhere. Reload before saving again.",
      "profile.reload_after_conflict": "Reload profile",
    }[key] ?? key),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: PropsWithChildren) => <div>{children}</div>,
  },
}));

vi.mock("@/components/ProfileMenu", () => ({ ProfileMenu: () => null }));
vi.mock("@/components/ChangePasswordCard", () => ({ ChangePasswordCard: () => null }));
vi.mock("@/components/DeleteAccountCard", () => ({ DeleteAccountCard: () => null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      let updatePayload: unknown;
      const filters: Array<{ method: "eq" | "is"; column: string; value: unknown }> = [];
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => (
        updatePayload === undefined ? query : mocks.saveResult(updatePayload, filters)
      ));
      query.update = vi.fn((payload: unknown) => {
        updatePayload = payload;
        mocks.update(payload);
        return query;
      });
      query.eq = vi.fn((column: string, value: unknown) => {
        filters.push({ method: "eq", column, value });
        return query;
      });
      query.is = vi.fn((column: string, value: unknown) => {
        filters.push({ method: "is", column, value });
        return query;
      });
      query.single = vi.fn(() => Promise.resolve(mocks.fetchResult()));
      return query;
    }),
  },
}));

import Profile from "@/pages/Profile";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("Profile display-name boundary", () => {
  beforeEach(() => {
    mocks.fetchResult.mockReset();
    mocks.fetchResult.mockReturnValue({ data: { display_name: "Existing Name" }, error: null });
    mocks.saveResult.mockReset();
    mocks.saveResult.mockImplementation((payload: { display_name: string }) => Promise.resolve({
      data: [{ display_name: payload.display_name }],
      error: null,
    }));
    mocks.update.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  afterEach(cleanup);

  it("trims with the shared contract without rewriting Unicode and suppresses duplicate submits", async () => {
    const request = deferred<{ data: Array<{ display_name: string }>; error: null }>();
    mocks.saveResult.mockReturnValue(request.promise);
    render(<Profile />);
    const input = await screen.findByLabelText("Display name");
    fireEvent.change(input, { target: { value: "  Ａｄａ  " } });
    const saveButton = screen.getByRole("button", { name: "Save" });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "Ａｄａ" });
    expect(mocks.saveResult).toHaveBeenCalledWith(
      { display_name: "Ａｄａ" },
      [
        { method: "eq", column: "user_id", value: USER_ID },
        { method: "eq", column: "display_name", value: "Existing Name" },
      ],
    );
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("aria-busy", "true");

    await act(async () => request.resolve({ data: [{ display_name: "Ａｄａ" }], error: null }));
    expect(input).toHaveValue("Ａｄａ");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Profile updated!");
  });

  it.each([
    ["blank", "   "],
    ["control character", "Ada\u007fLovelace"],
    ["oversized", "x".repeat(201)],
  ])("blocks an invalid %s name with an accessible localized error", async (_case, value) => {
    render(<Profile />);
    const input = await screen.findByLabelText("Display name");

    fireEvent.change(input, { target: { value } });

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a display name of 1–200 characters without control characters.",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not publish stale callbacks after unmount", async () => {
    const request = deferred<{ data: Array<{ display_name: string }>; error: null }>();
    mocks.saveResult.mockReturnValue(request.promise);
    const view = render(<Profile />);
    const input = await screen.findByLabelText("Display name");
    fireEvent.change(input, { target: { value: "Final Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.update).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => request.resolve({ data: [{ display_name: "Final Name" }], error: null }));

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("maps a thrown database failure to the bounded localized error", async () => {
    mocks.saveResult.mockRejectedValue(new Error("private database detail"));
    render(<Profile />);
    const input = await screen.findByLabelText("Display name");
    fireEvent.change(input, { target: { value: "Final Name" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Error saving profile"));
    expect(mocks.toastError).not.toHaveBeenCalledWith(expect.stringContaining("private database detail"));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("fails closed when the authoritative profile cannot be loaded and supports retry", async () => {
    mocks.fetchResult
      .mockReturnValueOnce({ data: null, error: { code: "PGRST116" } })
      .mockReturnValueOnce({ data: { display_name: "Recovered Name" }, error: null });
    render(<Profile />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your profile.");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("Display name")).toHaveValue("Recovered Name");
    expect(screen.queryByText("Could not load your profile.")).not.toBeInTheDocument();
  });

  it("treats an optimistic zero-row update as a conflict and requires reload", async () => {
    mocks.saveResult.mockResolvedValue({ data: [], error: null });
    render(<Profile />);
    const input = await screen.findByLabelText("Display name");
    fireEvent.change(input, { target: { value: "Concurrent Name" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your profile changed elsewhere. Reload before saving again.",
    );
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
