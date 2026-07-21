import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WORKSPACE_ID = "10000000-0000-4000-8000-000000000001";
const MEMBERSHIP_ID = "20000000-0000-4000-8000-000000000001";
const USER_ID = "30000000-0000-4000-8000-000000000001";
const PROFILE_REVISION = 7;

const mocks = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  loadProfileSnapshot: vi.fn(),
  from: vi.fn(),
  queryResult: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/workspaceMemberProfileApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspaceMemberProfileApi")>();
  return {
    ...actual,
    saveWorkspaceMemberProfile: mocks.saveProfile,
    loadWorkspaceMemberProfileEditSnapshot: mocks.loadProfileSnapshot,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  function createQuery(table: string) {
    const query: Record<string, unknown> = {};
    const filters: Array<readonly [string, unknown]> = [];
    query.select = vi.fn(() => query);
    query.eq = vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    });
    for (const method of ["order", "not", "in"]) {
      query[method] = vi.fn(() => query);
    }
    let signal: AbortSignal | undefined;
    query.abortSignal = vi.fn((nextSignal: AbortSignal) => {
      signal = nextSignal;
      return query;
    });
    query.then = (
      onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(mocks.queryResult(table, [...filters], signal)).then(onFulfilled, onRejected);
    return query;
  }

  mocks.from.mockImplementation((table: string) => createQuery(table));
  return {
    supabase: {
      from: mocks.from,
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    },
  };
});

const MESSAGES: Record<string, string> = {
  "common.name": "Name",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.loading": "Loading…",
  "member_profile.edit_btn": "Edit",
  "member_profile.name_placeholder": "Member name",
  "member_profile.name_self_only_hint": "Only the account owner can change this global profile name.",
  "member_profile.save_error": "The member profile could not be saved.",
  "member_profile.save_conflict": "This profile changed on the server. Reload the latest data and review it before saving again.",
  "member_profile.reload_after_conflict": "Reload latest data",
  "member_profile.save_in_progress": "Saving…",
  "member_profile.save_success": "Member data updated",
  "member_profile.allocation_validation_error": "Role allocations must total 100% and have exactly one primary role.",
  "member_profile.base_hours_validation_error": "Daily working hours must be between 0 and 24 with at most two decimal places.",
  "member_profile.load_error": "Member profile data could not be loaded. Editing is disabled to protect existing data.",
  "member_profile.retry_load": "Try again",
  "member_profile.peers_load_error": "Role peers could not be loaded. Profile editing remains available from the verified member snapshot.",
  "profile.display_name_validation_error": "Enter a display name of 1–200 characters without control characters.",
};

vi.mock("@/i18n/I18nProvider", () => ({
  useT: () => (key: string) => MESSAGES[key] ?? key,
  useI18n: () => ({ t: (key: string) => MESSAGES[key] ?? key }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: PropsWithChildren<{ open: boolean }>) => open ? <>{children}</> : null,
  SheetContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SheetHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SheetTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectValue: () => null,
}));

vi.mock("@/components/enterprise/NotificationPreferences", () => ({
  NotificationPreferences: () => null,
}));

vi.mock("@/components/enterprise/MemberSitePriorityEditor", () => ({
  MemberSitePriorityEditor: () => null,
}));

vi.mock("@/components/enterprise/MemberExtendedDetails", () => ({
  MemberExtendedDetails: () => null,
}));

vi.mock("@/components/enterprise/RoleAllocationEditor", () => ({
  RoleAllocationEditor: ({ onChange }: {
    onChange: (allocations: Array<{
      business_role: string;
      percentage: number;
      is_priority: boolean;
    }>) => void;
  }) => (
    <>
      <button
        type="button"
        onClick={() => onChange([{
          business_role: "Engineering",
          percentage: 80,
          is_priority: true,
        }])}
      >
        Make allocation invalid
      </button>
      <button
        type="button"
        onClick={() => onChange([{
          business_role: "Engineering",
          percentage: 100.001,
          is_priority: true,
        }])}
      >
        Make precision invalid
      </button>
      <button
        type="button"
        onClick={() => onChange([{
          business_role: "Ｅngineering",
          percentage: 100,
          is_priority: true,
        }])}
      >
        Make non-NFKC role
      </button>
      <button
        type="button"
        onClick={() => onChange([
          { business_role: "Ｅngineering", percentage: 50, is_priority: true },
          { business_role: "engineering", percentage: 50, is_priority: false },
        ])}
      >
        Make normalized duplicate
      </button>
      <button
        type="button"
        onClick={() => onChange([{
          business_role: "Engineering",
          percentage: 100,
          is_priority: true,
        }])}
      >
        Repair allocations
      </button>
    </>
  ),
}));

import { MemberProfileSheet } from "@/components/enterprise/MemberProfileSheet";
import { WorkspaceMemberProfileError } from "@/lib/workspaceMemberProfileApi";

const MEMBER = {
  id: MEMBERSHIP_ID,
  user_id: USER_ID,
  role: "member",
  status: "active",
  team: null,
  location: "Remote",
  business_role: "Engineering",
  joined_at: "2025-01-01",
  display_name: "Ada Lovelace",
  city: null,
  office_id: null,
  base_working_hours: 8,
};

const MEMBER_B = {
  ...MEMBER,
  id: "20000000-0000-4000-8000-000000000002",
  user_id: "30000000-0000-4000-8000-000000000002",
  business_role: "Quality",
  display_name: "Grace Hopper",
};

type QueryFilter = readonly [string, unknown];

function editSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    workspaceId: WORKSPACE_ID,
    membershipId: MEMBERSHIP_ID,
    status: "active",
    displayName: "Ada Lovelace",
    businessRole: "Engineering",
    location: "Remote",
    city: null,
    officeId: null,
    baseWorkingHours: 8,
    profileRevision: PROFILE_REVISION,
    roleAllocations: [{
      businessRole: "Engineering",
      percentage: 100,
      isPriority: true,
    }],
    ...overrides,
  };
}

function defaultQueryResult(table: string, _filters: readonly QueryFilter[] = []) {
  if (table === "enterprise_member_role_allocations") {
    return {
      data: [{
        membership_id: MEMBERSHIP_ID,
        business_role: "Engineering",
        percentage: 100,
        is_priority: true,
      }],
      error: null,
    };
  }
  if (table === "enterprise_memberships") {
    return { data: [{ business_role: "Engineering" }, { business_role: "Quality" }], error: null };
  }
  return { data: [], error: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function successfulResult() {
  return {
    ok: true as const,
    workspaceId: WORKSPACE_ID,
    membershipId: MEMBERSHIP_ID,
    profileRevision: PROFILE_REVISION + 1,
    changed: true,
    allocationCount: 1,
    displayNameUpdated: false,
    auditEventId: "40000000-0000-4000-8000-000000000001",
  };
}

function renderSheet(overrides: Partial<ComponentProps<typeof MemberProfileSheet>> = {}) {
  const onOpenChange = vi.fn();
  const onMemberUpdated = vi.fn();
  const props: ComponentProps<typeof MemberProfileSheet> = {
    open: true,
    onOpenChange,
    member: MEMBER,
    workspaceId: WORKSPACE_ID,
    currentUserId: USER_ID,
    allMembers: [MEMBER],
    isAdmin: true,
    canEditMember: true,
    onMemberUpdated,
    ...overrides,
  };
  const view = render(<MemberProfileSheet {...props} />);
  return {
    onOpenChange,
    onMemberUpdated,
    rerenderSheet: (next: Partial<ComponentProps<typeof MemberProfileSheet>>) => {
      view.rerender(<MemberProfileSheet {...props} {...next} />);
    },
  };
}

async function enterEditMode() {
  const editButton = screen.getByRole("button", { name: "Edit" });
  await waitFor(() => expect(editButton).toBeEnabled());
  fireEvent.click(editButton);
  return screen.getByRole("button", { name: "Save" });
}

describe("MemberProfileSheet atomic save", () => {
  beforeEach(() => {
    mocks.saveProfile.mockReset();
    mocks.loadProfileSnapshot.mockReset();
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot());
    mocks.from.mockClear();
    mocks.queryResult.mockReset();
    mocks.queryResult.mockImplementation(defaultQueryResult);
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  afterEach(cleanup);

  it("dispatches one immutable RPC snapshot on double click, then refreshes and closes", async () => {
    const request = deferred<ReturnType<typeof successfulResult>>();
    mocks.saveProfile.mockReturnValue(request.promise);
    const { onOpenChange, onMemberUpdated } = renderSheet();
    const saveButton = await enterEditMode();

    expect(mocks.loadProfileSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.loadProfileSnapshot).toHaveBeenCalledWith(
      WORKSPACE_ID,
      MEMBERSHIP_ID,
      { signal: expect.any(AbortSignal) },
    );

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(mocks.saveProfile).toHaveBeenCalledTimes(1);
    const payload = mocks.saveProfile.mock.calls[0][0];
    expect(payload).toEqual({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      expectedProfileRevision: PROFILE_REVISION,
      location: "Remote",
      city: null,
      officeId: null,
      baseWorkingHours: 8,
      roleAllocations: [{
        businessRole: "Engineering",
        percentage: 100,
        isPriority: true,
      }],
      displayName: null,
      expectedDisplayName: null,
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.roleAllocations)).toBe(true);
    expect(Object.isFrozen(payload.roleAllocations[0])).toBe(true);
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Saving…" })).toBe(saveButton);

    await act(async () => request.resolve(successfulResult()));

    await waitFor(() => expect(onMemberUpdated).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Member data updated");
  });

  it("keeps the editor open and exposes a generic accessible error after an atomic failure", async () => {
    mocks.saveProfile.mockRejectedValue(new Error("sensitive database detail"));
    const { onOpenChange, onMemberUpdated } = renderSheet();
    const saveButton = await enterEditMode();
    fireEvent.change(screen.getByPlaceholderText("Member name"), {
      target: { value: "  Ada Byron  " },
    });

    fireEvent.click(saveButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The member profile could not be saved.");
    expect(screen.queryByText("sensitive database detail")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Member name")).toHaveValue("  Ada Byron  ");
    expect(onMemberUpdated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("The member profile could not be saved.");
    expect(saveButton).toHaveAttribute("aria-describedby", alert.id);
    expect(mocks.saveProfile.mock.calls[0][0].displayName).toBe("Ada Byron");
    expect(mocks.saveProfile.mock.calls[0][0].expectedDisplayName).toBe("Ada Lovelace");
  });

  it("fails closed when the atomic edit snapshot cannot be loaded", async () => {
    mocks.loadProfileSnapshot.mockRejectedValue(
      new Error("sensitive membership and allocation error"),
    );
    renderSheet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Member profile data could not be loaded.");
    expect(screen.queryByText("sensitive membership and allocation error")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("recovers with a clean snapshot after closing and reopening a failed load", async () => {
    mocks.loadProfileSnapshot
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(editSnapshot());
    const { rerenderSheet } = renderSheet();
    expect(await screen.findByRole("alert")).toHaveTextContent("Member profile data could not be loaded.");

    rerenderSheet({ open: false });
    rerenderSheet({ open: true });

    const editButton = await screen.findByRole("button", { name: "Edit" });
    await waitFor(() => expect(editButton).toBeEnabled());
    expect(screen.queryByText("Member profile data could not be loaded.")).not.toBeInTheDocument();
  });

  it("builds the save payload only from the membership-scoped snapshot", async () => {
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({
      roleAllocations: [
        { businessRole: "Engineering", percentage: 60, isPriority: true },
        { businessRole: "Quality", percentage: 40, isPriority: false },
      ],
    }));
    mocks.queryResult.mockImplementation((table: string, filters: readonly QueryFilter[]) => {
      if (table !== "enterprise_member_role_allocations") {
        return defaultQueryResult(table, filters);
      }
      return {
        data: Array.from({ length: 1_000 }, (_, index) => ({
          membership_id: `peer-${index}`,
          business_role: "Peer only",
          percentage: 100,
          is_priority: true,
        })),
        error: null,
      };
    });
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet();
    const saveButton = await enterEditMode();

    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0].roleAllocations).toEqual([
      { businessRole: "Engineering", percentage: 60, isPriority: true },
      { businessRole: "Quality", percentage: 40, isPriority: false },
    ]);
  });

  it("uses fresh membership-scoped metadata instead of stale parent fields", async () => {
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({
      location: "Fresh server location",
      city: "Fresh server city",
      baseWorkingHours: 4,
    }));
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet({
      member: {
        ...MEMBER,
        location: "Stale parent location",
        city: "Stale parent city",
        base_working_hours: 8,
      },
    });
    const saveButton = await enterEditMode();

    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0]).toMatchObject({
      expectedProfileRevision: PROFILE_REVISION,
      location: "Fresh server location",
      city: "Fresh server city",
      baseWorkingHours: 4,
    });
  });

  it("discards the complete draft when edit is cancelled", async () => {
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet();
    await enterEditMode();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Make allocation invalid" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const saveButton = await enterEditMode();

    expect(screen.getByRole("spinbutton")).toHaveValue(8);
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0]).toMatchObject({
      baseWorkingHours: 8,
      roleAllocations: [{ businessRole: "Engineering", percentage: 100, isPriority: true }],
    });
  });

  it("does not invent a primary role when legacy metadata cannot identify one", async () => {
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({
      businessRole: "Unrelated legacy role",
      roleAllocations: [
        { businessRole: "Engineering", percentage: 50, isPriority: false },
        { businessRole: "Quality", percentage: 50, isPriority: false },
      ],
    }));
    renderSheet({ member: { ...MEMBER, business_role: "Engineering" } });
    const saveButton = await enterEditMode();

    expect(saveButton).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Role allocations must total 100% and have exactly one primary role.",
    );
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("ignores an out-of-order atomic snapshot from the previously selected member", async () => {
    const staleTarget = deferred<ReturnType<typeof editSnapshot>>();
    mocks.loadProfileSnapshot.mockImplementation((_workspaceId: string, membershipId: string) => {
      if (membershipId === MEMBERSHIP_ID) return staleTarget.promise;
      return Promise.resolve(editSnapshot({
        membershipId: MEMBER_B.id,
        businessRole: "Quality",
        location: "Office",
        roleAllocations: [{ businessRole: "Quality", percentage: 100, isPriority: true }],
      }));
    });
    mocks.saveProfile.mockResolvedValue(successfulResult());
    const { rerenderSheet } = renderSheet();

    rerenderSheet({
      member: MEMBER_B,
      currentUserId: MEMBER_B.user_id,
      allMembers: [MEMBER_B],
    });
    const editButton = screen.getByRole("button", { name: "Edit" });
    await waitFor(() => expect(editButton).toBeEnabled());
    await act(async () => staleTarget.resolve(editSnapshot({
      businessRole: "Stale role",
      roleAllocations: [{ businessRole: "Stale role", percentage: 100, isPriority: true }],
    })));

    fireEvent.click(editButton);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0]).toMatchObject({
      membershipId: MEMBER_B.id,
      roleAllocations: [{ businessRole: "Quality", percentage: 100, isPriority: true }],
    });
  });

  it("aborts and suppresses a stale save result when the workspace scope changes", async () => {
    const request = deferred<ReturnType<typeof successfulResult>>();
    mocks.saveProfile.mockReturnValue(request.promise);
    const { onOpenChange, onMemberUpdated, rerenderSheet } = renderSheet();
    const saveButton = await enterEditMode();
    fireEvent.click(saveButton);
    const signal = mocks.saveProfile.mock.calls[0][1].signal as AbortSignal;

    rerenderSheet({ workspaceId: "10000000-0000-4000-8000-000000000099" });
    expect(signal.aborted).toBe(true);
    await act(async () => request.resolve(successfulResult()));

    expect(onMemberUpdated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("locks repeated saves after a conflict until a fresh revision is reviewed", async () => {
    let membershipLoads = 0;
    mocks.loadProfileSnapshot.mockImplementation(() => {
      membershipLoads += 1;
      return Promise.resolve(editSnapshot({
        profileRevision: membershipLoads === 1 ? 7 : 9,
      }));
    });
    mocks.saveProfile
      .mockRejectedValueOnce(new WorkspaceMemberProfileError("conflict"))
      .mockResolvedValueOnce({ ...successfulResult(), profileRevision: 10 });
    const { onOpenChange, onMemberUpdated } = renderSheet();
    const firstSaveButton = await enterEditMode();

    fireEvent.click(firstSaveButton);

    const conflictAlert = await screen.findByRole("alert");
    expect(conflictAlert).toHaveTextContent("This profile changed on the server.");
    expect(firstSaveButton).toBeDisabled();
    fireEvent.click(firstSaveButton);
    expect(mocks.saveProfile).toHaveBeenCalledTimes(1);
    expect(onMemberUpdated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reload latest data" }));
    const secondSaveButton = await enterEditMode();
    fireEvent.click(secondSaveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(2));
    expect(mocks.saveProfile.mock.calls[1][0].expectedProfileRevision).toBe(9);
    await waitFor(() => expect(onMemberUpdated).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("detects a concurrent legacy self-name writer and reloads its authoritative name", async () => {
    let snapshotLoads = 0;
    mocks.loadProfileSnapshot.mockImplementation(() => {
      snapshotLoads += 1;
      return Promise.resolve(editSnapshot({
        profileRevision: PROFILE_REVISION,
        displayName: snapshotLoads === 1 ? "Ada Lovelace" : "Server Writer Name",
      }));
    });
    mocks.saveProfile
      .mockRejectedValueOnce(new WorkspaceMemberProfileError("conflict"))
      .mockResolvedValueOnce(successfulResult());
    const { onOpenChange, onMemberUpdated } = renderSheet();
    const firstSaveButton = await enterEditMode();
    fireEvent.change(screen.getByPlaceholderText("Member name"), {
      target: { value: "Local Draft Name" },
    });

    fireEvent.click(firstSaveButton);

    await screen.findByText("This profile changed on the server. Reload the latest data and review it before saving again.");
    expect(mocks.saveProfile.mock.calls[0][0]).toMatchObject({
      expectedProfileRevision: PROFILE_REVISION,
      displayName: "Local Draft Name",
      expectedDisplayName: "Ada Lovelace",
    });
    expect(firstSaveButton).toBeDisabled();
    expect(onMemberUpdated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reload latest data" }));
    await screen.findByText("Server Writer Name");
    const secondSaveButton = await enterEditMode();
    expect(screen.getByPlaceholderText("Member name")).toHaveValue("Server Writer Name");
    fireEvent.change(screen.getByPlaceholderText("Member name"), {
      target: { value: "Reviewed Final Name" },
    });
    fireEvent.click(secondSaveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(2));
    expect(mocks.saveProfile.mock.calls[1][0]).toMatchObject({
      expectedProfileRevision: PROFILE_REVISION,
      displayName: "Reviewed Final Name",
      expectedDisplayName: "Server Writer Name",
    });
    await waitFor(() => expect(onMemberUpdated).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignores an aborted close-cycle name baseline before reopening", async () => {
    const staleMembership = deferred<ReturnType<typeof editSnapshot>>();
    let membershipLoads = 0;
    mocks.loadProfileSnapshot.mockImplementation(() => {
      membershipLoads += 1;
      if (membershipLoads === 1) return staleMembership.promise;
      return Promise.resolve(editSnapshot({
        profileRevision: PROFILE_REVISION,
        displayName: "Fresh Server Name",
      }));
    });
    mocks.saveProfile.mockResolvedValue({ ...successfulResult(), profileRevision: 10 });
    const { rerenderSheet } = renderSheet();
    await waitFor(() => expect(membershipLoads).toBe(1));

    rerenderSheet({ open: false });
    rerenderSheet({ open: true });
    await waitFor(() => expect(membershipLoads).toBe(2));
    await act(async () => staleMembership.resolve(editSnapshot({
      profileRevision: PROFILE_REVISION,
      displayName: "Stale Old Name",
    })));
    const saveButton = await enterEditMode();
    expect(screen.getByPlaceholderText("Member name")).toHaveValue("Fresh Server Name");
    fireEvent.change(screen.getByPlaceholderText("Member name"), {
      target: { value: "User Final Name" },
    });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0]).toMatchObject({
      expectedProfileRevision: PROFILE_REVISION,
      displayName: "User Final Name",
      expectedDisplayName: "Fresh Server Name",
    });
  });

  it("exits edit mode and aborts an in-flight save when permission is revoked", async () => {
    const request = deferred<ReturnType<typeof successfulResult>>();
    mocks.saveProfile.mockReturnValue(request.promise);
    const { onOpenChange, onMemberUpdated, rerenderSheet } = renderSheet();
    const saveButton = await enterEditMode();
    fireEvent.click(saveButton);
    const signal = mocks.saveProfile.mock.calls[0][1].signal as AbortSignal;

    rerenderSheet({ canEditMember: false });
    expect(signal.aborted).toBe(true);
    expect(screen.queryByPlaceholderText("Member name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    await act(async () => request.resolve(successfulResult()));

    expect(onMemberUpdated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("never sends another member's global display name", async () => {
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({ displayName: null }));
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet({ currentUserId: "30000000-0000-4000-8000-000000000099" });
    const saveButton = await enterEditMode();
    expect(screen.getByPlaceholderText("Member name")).toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0].displayName).toBeNull();
    expect(mocks.saveProfile.mock.calls[0][0].expectedDisplayName).toBeNull();
  });

  it.each([
    ["blank", "   "],
    ["control-character", "Ada\u007fLovelace"],
    ["overlong", "x".repeat(201)],
  ])("blocks an invalid %s self-name edit before the RPC", async (_caseName, invalidName) => {
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet();
    const saveButton = await enterEditMode();
    const nameInput = screen.getByPlaceholderText("Member name");

    fireEvent.change(nameInput, { target: { value: invalidName } });

    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a display name of 1–200 characters without control characters.",
    );
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("sends an explicit trim repair against the exact raw legacy name baseline", async () => {
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({ displayName: "  Ada Lovelace  " }));
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet();
    const saveButton = await enterEditMode();
    const nameInput = screen.getByPlaceholderText("Member name");
    expect(nameInput).toHaveValue("  Ada Lovelace  ");

    fireEvent.change(nameInput, { target: { value: "Ada Lovelace" } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0]).toMatchObject({
      displayName: "Ada Lovelace",
      expectedDisplayName: "  Ada Lovelace  ",
    });
  });

  it("does not silently rewrite an untouched raw legacy name baseline", async () => {
    const rawLegacyName = "\u00a0Ada Lovelace\u00a0";
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({ displayName: rawLegacyName }));
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet();
    const saveButton = await enterEditMode();

    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0]).toMatchObject({
      displayName: null,
      expectedDisplayName: null,
    });
  });

  it("blocks an invalid allocation snapshot before the RPC", async () => {
    renderSheet();
    await enterEditMode();

    fireEvent.click(screen.getByRole("button", { name: "Make allocation invalid" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Role allocations must total 100% and have exactly one primary role.",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("loads legacy working-hour precision but blocks save until the value is repaired", async () => {
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({ baseWorkingHours: 8.123 }));
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet();
    const saveButton = await enterEditMode();
    const hoursInput = screen.getByRole("spinbutton", { name: "member_profile.base_hours_label" });

    expect(hoursInput).toHaveValue(8.123);
    expect(hoursInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Daily working hours must be between 0 and 24 with at most two decimal places.",
    );
    expect(saveButton).toBeDisabled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();

    fireEvent.change(hoursInput, { target: { value: "8.12" } });

    expect(hoursInput).toHaveValue(8.12);
    expect(hoursInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(
      "Daily working hours must be between 0 and 24 with at most two decimal places.",
    )).not.toBeInTheDocument();
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0].baseWorkingHours).toBe(8.12);
  });

  it("loads normalized-duplicate legacy roles but blocks save until the user repairs them", async () => {
    mocks.loadProfileSnapshot.mockResolvedValue(editSnapshot({
      roleAllocations: [
        { businessRole: "Engineering", percentage: 50, isPriority: true },
        { businessRole: "Ｅｎｇｉｎｅｅｒｉｎｇ", percentage: 50, isPriority: false },
      ],
    }));
    mocks.saveProfile.mockResolvedValue(successfulResult());
    renderSheet();
    const saveButton = await enterEditMode();

    expect(saveButton).toBeDisabled();
    expect(screen.getByText("Role allocations must total 100% and have exactly one primary role.")).toBeInTheDocument();
    expect(mocks.saveProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Repair allocations" }));
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    expect(mocks.saveProfile.mock.calls[0][0].roleAllocations).toEqual([
      { businessRole: "Engineering", percentage: 100, isPriority: true },
    ]);
  });

  it.each([
    "Make precision invalid",
    "Make non-NFKC role",
    "Make normalized duplicate",
  ])("blocks the adapter-invalid allocation case: %s", async (actionName) => {
    renderSheet();
    await enterEditMode();

    fireEvent.click(screen.getByRole("button", { name: actionName }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Role allocations must total 100% and have exactly one primary role.",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("hides the edit entry point when the combined permission gate is false", async () => {
    renderSheet({ canEditMember: false });
    await waitFor(() => expect(mocks.from).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
