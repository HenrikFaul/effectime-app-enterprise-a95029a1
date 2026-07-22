import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  memberResponse: { data: [] as unknown[], error: null as unknown },
  allocationResponse: { data: [] as unknown[], error: null as unknown },
  profileResponse: { data: [] as unknown[], error: null as unknown },
  fromCalls: [] as string[],
  mutate: vi.fn(),
  deleteRole: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
  translate: (key: string) => key,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      mocks.fromCalls.push(table);
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = chain;
      builder.in = chain;
      builder.abortSignal = () => Promise.resolve(
        table === "enterprise_memberships"
          ? mocks.memberResponse
          : table === "enterprise_member_role_allocations"
            ? mocks.allocationResponse
            : mocks.profileResponse,
      );
      return builder;
    },
  },
}));

vi.mock("@/lib/businessRoleAllocationApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/businessRoleAllocationApi")>();
  return { ...actual, mutateWorkspaceMemberBusinessRole: mocks.mutate };
});

vi.mock("@/lib/workspaceBusinessRoleApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspaceBusinessRoleApi")>();
  return { ...actual, deleteWorkspaceBusinessRole: mocks.deleteRole };
});

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({ t: mocks.translate }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.successToast,
    error: mocks.errorToast,
    message: vi.fn(),
  },
}));

vi.mock("@/components/enterprise/positions/PositionPickerDialog", () => ({
  PositionPickerDialog: () => null,
}));

import { BusinessRoleManager } from "@/components/enterprise/BusinessRoleManager";
import { WorkspaceMemberProfileError } from "@/lib/workspaceMemberProfileApi";
import { WorkspaceBusinessRoleDeleteError } from "@/lib/workspaceBusinessRoleApi";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_MEMBERSHIP_ID = "55555555-5555-4555-8555-555555555555";

function setSuccessfulRead() {
  mocks.memberResponse = {
    data: [{
      id: MEMBERSHIP_ID,
      user_id: "33333333-3333-4333-8333-333333333333",
      business_role: "Developer",
      base_working_hours: 8,
    }],
    error: null,
  };
  mocks.allocationResponse = {
    data: [{
      id: "44444444-4444-4444-8444-444444444444",
      membership_id: MEMBERSHIP_ID,
      business_role: "Developer",
      percentage: 100,
      is_priority: true,
    }],
    error: null,
  };
  mocks.profileResponse = {
    data: [{
      user_id: "33333333-3333-4333-8333-333333333333",
      display_name: "Anna",
    }],
    error: null,
  };
}

function setTwoMemberRead() {
  setSuccessfulRead();
  mocks.memberResponse.data.push({
    id: SECOND_MEMBERSHIP_ID,
    user_id: "66666666-6666-4666-8666-666666666666",
    business_role: "Developer",
    base_working_hours: 8,
  });
  mocks.allocationResponse.data.push({
    id: "77777777-7777-4777-8777-777777777777",
    membership_id: SECOND_MEMBERSHIP_ID,
    business_role: "Developer",
    percentage: 100,
    is_priority: true,
  });
  mocks.profileResponse.data.push({
    user_id: "66666666-6666-4666-8666-666666666666",
    display_name: "Bela",
  });
}

describe("BusinessRoleManager atomic writer integration", () => {
  beforeEach(() => {
    mocks.fromCalls.length = 0;
    mocks.mutate.mockReset();
    mocks.mutate.mockResolvedValue({});
    mocks.deleteRole.mockReset();
    mocks.deleteRole.mockResolvedValue({});
    mocks.successToast.mockReset();
    mocks.errorToast.mockReset();
    setSuccessfulRead();
  });

  it("renders mutation controls only for members:edit capability", async () => {
    const { rerender } = render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles={false}
      />,
    );

    expect(await screen.findByText("business_role_mgr.readonly_hint")).toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "business_role_mgr.remove_allocation_action",
    })).not.toBeInTheDocument();

    rerender(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );
    expect(await screen.findByRole("button", {
      name: "business_role_mgr.remove_allocation_action",
    })).toBeInTheDocument();
  });

  it("fails visibly on authoritative list errors and offers retry", async () => {
    mocks.memberResponse = { data: null as unknown as unknown[], error: { code: "42501" } };
    render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "business_role_mgr.load_failed",
    );
    setSuccessfulRead();
    fireEvent.click(screen.getByRole("button", { name: "business_role_mgr.retry" }));
    expect(await screen.findByText("Anna")).toBeInTheDocument();
  });

  it("keeps roles discoverable when allocations only belong to hidden-status members", async () => {
    mocks.allocationResponse.data.push({
      id: "88888888-8888-4888-8888-888888888888",
      membership_id: "99999999-9999-4999-8999-999999999999",
      business_role: "Suspended-only role",
      percentage: 100,
      is_priority: true,
    });

    render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );

    expect(await screen.findByText("Suspended-only role")).toBeInTheDocument();
    expect(screen.queryByText("99999999-9999-4999-8999-999999999999"))
      .not.toBeInTheDocument();
  });

  it("routes allocation removal through one atomic mutation and blocks double submit", async () => {
    let finishMutation: (() => void) | undefined;
    mocks.mutate.mockImplementation(() => new Promise<void>((resolve) => {
      finishMutation = resolve;
    }));
    render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );

    const removeButton = await screen.findByRole("button", {
      name: "business_role_mgr.remove_allocation_action",
    });
    fireEvent.click(removeButton);
    fireEvent.click(removeButton);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      mutation: { type: "remove", role: "Developer" },
    }, { signal: expect.any(AbortSignal) });

    finishMutation?.();
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(
      "business_role_mgr.allocation_deleted",
    ));
  });

  it("does not show success after a revision conflict", async () => {
    mocks.mutate.mockRejectedValue(new WorkspaceMemberProfileError("conflict"));
    render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );
    fireEvent.click(await screen.findByRole("button", {
      name: "business_role_mgr.remove_allocation_action",
    }));

    await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledWith(
      "business_role_mgr.save_conflict",
    ));
    expect(mocks.successToast).not.toHaveBeenCalled();
  });

  it("aborts and clears the busy guard when the workspace changes", async () => {
    let finishFirstMutation: (() => void) | undefined;
    mocks.mutate
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishFirstMutation = resolve;
      }))
      .mockResolvedValueOnce({});
    const { rerender } = render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "business_role_mgr.remove_allocation_action",
    }));
    const firstSignal = mocks.mutate.mock.calls[0][1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    const nextWorkspaceId = "88888888-8888-4888-8888-888888888888";
    rerender(
      <BusinessRoleManager
        workspaceId={nextWorkspaceId}
        canEditMemberProfiles
      />,
    );

    await waitFor(() => expect(firstSignal.aborted).toBe(true));
    const nextRemoveButton = await screen.findByRole("button", {
      name: "business_role_mgr.remove_allocation_action",
    });
    await waitFor(() => expect(nextRemoveButton).toBeEnabled());
    fireEvent.click(nextRemoveButton);

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    expect(mocks.mutate.mock.calls[1][0]).toMatchObject({
      workspaceId: nextWorkspaceId,
      membershipId: MEMBERSHIP_ID,
    });
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));

    finishFirstMutation?.();
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
  });

  it("confirms then delegates the complete status set to one tenant-wide RPC", async () => {
    setTwoMemberRead();
    render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "business_role_mgr.delete_role_action",
    }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.deleteRole).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "business_role_mgr.delete_role_confirm_description",
    );

    fireEvent.click(screen.getByRole("button", { name: "business_role_mgr.btn_delete" }));
    await waitFor(() => expect(mocks.deleteRole).toHaveBeenCalledTimes(1));
    expect(mocks.deleteRole).toHaveBeenCalledWith(
      WORKSPACE_ID,
      "Developer",
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.mutate).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(
      "business_role_mgr.role_deleted",
    ));
  });

  it.each([
    ["conflict", "business_role_mgr.save_conflict"],
    ["invalid-response", "business_role_mgr.save_failed"],
  ] as const)("shows a tenant-wide %s failure without reporting success", async (code, message) => {
    mocks.deleteRole.mockRejectedValue(new WorkspaceBusinessRoleDeleteError(code));
    render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "business_role_mgr.delete_role_action",
    }));
    fireEvent.click(screen.getByRole("button", { name: "business_role_mgr.btn_delete" }));

    await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledWith(
      message,
    ));
    expect(mocks.successToast).not.toHaveBeenCalled();
  });

  it("aborts a stale tenant-wide delete when the workspace changes", async () => {
    const never = new Promise<never>(() => undefined);
    mocks.deleteRole.mockReturnValue(never);
    const { rerender } = render(
      <BusinessRoleManager
        workspaceId={WORKSPACE_ID}
        canEditMemberProfiles
      />,
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "business_role_mgr.delete_role_action",
    }));
    fireEvent.click(screen.getByRole("button", { name: "business_role_mgr.btn_delete" }));
    await waitFor(() => expect(mocks.deleteRole).toHaveBeenCalledTimes(1));
    const deleteSignal = mocks.deleteRole.mock.calls[0][2].signal as AbortSignal;

    rerender(
      <BusinessRoleManager
        workspaceId="88888888-8888-4888-8888-888888888888"
        canEditMemberProfiles
      />,
    );

    await waitFor(() => expect(deleteSignal.aborted).toBe(true));
    expect(mocks.successToast).not.toHaveBeenCalled();
    expect(mocks.errorToast).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", {
      name: "business_role_mgr.remove_allocation_action",
    })).toBeEnabled());
  });

  it("contains no browser direct allocation or membership mutation fallback", () => {
    const source = readFileSync(join(
      process.cwd(),
      "src/components/enterprise/BusinessRoleManager.tsx",
    ), "utf8");

    expect(source).toContain("mutateWorkspaceMemberBusinessRole");
    expect(source).toContain("deleteWorkspaceBusinessRole");
    expect(source).not.toContain("affectedMembershipIds");
    expect(source).not.toContain("runMutationBatch");
    expect(source).not.toMatch(
      /from\(['"]enterprise_member_role_allocations['"]\)[\s\S]{0,120}\.(?:insert|update|delete|upsert)\(/,
    );
    expect(source).not.toMatch(
      /from\(['"]enterprise_memberships['"]\)[\s\S]{0,120}\.(?:insert|update|delete|upsert)\(/,
    );
  });
});
