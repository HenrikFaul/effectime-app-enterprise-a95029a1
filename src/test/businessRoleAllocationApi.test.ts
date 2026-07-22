import { describe, expect, it, vi } from "vitest";
import {
  mutateWorkspaceMemberBusinessRole,
  WorkspaceBusinessRoleDraftError,
} from "@/lib/businessRoleAllocationApi";
import {
  WorkspaceMemberProfileError,
  type SaveWorkspaceMemberProfileInput,
  type WorkspaceMemberProfileEditSnapshot,
} from "@/lib/workspaceMemberProfileApi";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "22222222-2222-4222-8222-222222222222";

function snapshot(
  overrides: Partial<WorkspaceMemberProfileEditSnapshot> = {},
): WorkspaceMemberProfileEditSnapshot {
  return {
    ok: true,
    workspaceId: WORKSPACE_ID,
    membershipId: MEMBERSHIP_ID,
    status: "active",
    displayName: "Anna",
    businessRole: "Developer",
    location: "HQ",
    city: "Budapest",
    officeId: "33333333-3333-4333-8333-333333333333",
    baseWorkingHours: 7.5,
    profileRevision: 9,
    roleAllocations: [
      { businessRole: "Developer", percentage: 100, isPriority: true },
    ],
    ...overrides,
  };
}

function successfulSave(input: SaveWorkspaceMemberProfileInput) {
  return Promise.resolve({
    ok: true as const,
    workspaceId: input.workspaceId,
    membershipId: input.membershipId,
    profileRevision: input.expectedProfileRevision + 1,
    changed: true,
    allocationCount: input.roleAllocations.length,
    displayNameUpdated: false,
    auditEventId: "44444444-4444-4444-8444-444444444444",
  });
}

describe("business-role atomic member mutation adapter", () => {
  it("loads one authoritative snapshot and saves one complete revision-checked draft", async () => {
    const controller = new AbortController();
    const load = vi.fn().mockResolvedValue(snapshot());
    const save = vi.fn(successfulSave);

    await mutateWorkspaceMemberBusinessRole({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      mutation: { type: "assign", role: "QA", percentage: 40 },
    }, { load, save, signal: controller.signal });

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(
      WORKSPACE_ID,
      MEMBERSHIP_ID,
      { signal: controller.signal },
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      expectedProfileRevision: 9,
      location: "HQ",
      city: "Budapest",
      officeId: "33333333-3333-4333-8333-333333333333",
      baseWorkingHours: 7.5,
      roleAllocations: [
        { businessRole: "Developer", percentage: 60, isPriority: true },
        { businessRole: "QA", percentage: 40, isPriority: false },
      ],
      displayName: null,
      expectedDisplayName: null,
    }, { signal: controller.signal });
  });

  it("repairs a legacy primary-only membership through the same empty atomic snapshot", async () => {
    const load = vi.fn().mockResolvedValue(snapshot({
      roleAllocations: [],
      businessRole: "Legacy",
    }));
    const save = vi.fn(successfulSave);

    await mutateWorkspaceMemberBusinessRole({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      mutation: { type: "remove", role: "Legacy" },
    }, { load, save });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ roleAllocations: [] }),
      { signal: undefined },
    );
  });

  it("fails before save for duplicate assignments", async () => {
    const load = vi.fn().mockResolvedValue(snapshot());
    const save = vi.fn(successfulSave);

    await expect(mutateWorkspaceMemberBusinessRole({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      mutation: { type: "assign", role: " developer ", percentage: 50 },
    }, { load, save })).rejects.toMatchObject({
      name: "WorkspaceBusinessRoleDraftError",
    } satisfies Partial<WorkspaceBusinessRoleDraftError>);
    expect(save).not.toHaveBeenCalled();
  });

  it("preserves a save conflict without retrying or reporting success", async () => {
    const load = vi.fn().mockResolvedValue(snapshot());
    const conflict = new WorkspaceMemberProfileError("conflict");
    const save = vi.fn().mockRejectedValue(conflict);

    await expect(mutateWorkspaceMemberBusinessRole({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      mutation: { type: "remove", role: "Developer" },
    }, { load, save })).rejects.toBe(conflict);
    expect(load).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not start a save when the authoritative load fails", async () => {
    const loadError = new Error("load failed");
    const load = vi.fn().mockRejectedValue(loadError);
    const save = vi.fn(successfulSave);

    await expect(mutateWorkspaceMemberBusinessRole({
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      mutation: { type: "remove", role: "Developer" },
    }, { load, save })).rejects.toBe(loadError);
    expect(save).not.toHaveBeenCalled();
  });
});
