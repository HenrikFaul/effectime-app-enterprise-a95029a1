import {
  loadWorkspaceMemberProfileEditSnapshot,
  saveWorkspaceMemberProfile,
  type SaveWorkspaceMemberProfileResult,
  type WorkspaceMemberProfileEditSnapshot,
} from "@/lib/workspaceMemberProfileApi";
import {
  addRoleAllocation,
  normalizeRoleAllocations,
  removeRoleAllocation,
  type RoleAllocationFailureReason,
  type RoleAllocationResult,
} from "@/lib/roleAllocationDraft";

export type WorkspaceBusinessRoleMutation =
  | { type: "assign"; role: string; percentage: number }
  | { type: "remove"; role: string };

export class WorkspaceBusinessRoleDraftError extends Error {
  readonly reason: RoleAllocationFailureReason;

  constructor(reason: RoleAllocationFailureReason) {
    super(`Workspace business-role draft mutation failed: ${reason}`);
    this.name = "WorkspaceBusinessRoleDraftError";
    this.reason = reason;
  }
}

export interface MutateWorkspaceMemberBusinessRoleInput {
  workspaceId: string;
  membershipId: string;
  mutation: WorkspaceBusinessRoleMutation;
}

export interface MutateWorkspaceMemberBusinessRoleResult {
  snapshot: WorkspaceMemberProfileEditSnapshot;
  saveResult: SaveWorkspaceMemberProfileResult;
}

export interface MutateWorkspaceMemberBusinessRoleOptions {
  signal?: AbortSignal;
  load?: typeof loadWorkspaceMemberProfileEditSnapshot;
  save?: typeof saveWorkspaceMemberProfile;
}

function mutateDraft(
  snapshot: WorkspaceMemberProfileEditSnapshot,
  mutation: WorkspaceBusinessRoleMutation,
): RoleAllocationResult {
  const draft = snapshot.roleAllocations.map((allocation) => ({
    business_role: allocation.businessRole,
    percentage: allocation.percentage,
    is_priority: allocation.isPriority,
  }));

  if (mutation.type === "assign") {
    return addRoleAllocation(draft, mutation.role, mutation.percentage);
  }

  const removed = removeRoleAllocation(draft, mutation.role);
  if (removed.ok || removed.reason !== "role_not_found") return removed;

  // A pre-v3.51.6 membership can carry only the legacy primary-role column.
  // Saving the otherwise unchanged normalized snapshot through the atomic RPC
  // deliberately repairs that column from the actual priority allocation (or
  // clears it for an empty snapshot) without any direct-table fallback.
  if (snapshot.businessRole === mutation.role) {
    return normalizeRoleAllocations(draft);
  }

  return removed;
}

/**
 * Applies one member's role change through a fresh authoritative read followed
 * by the revision-checked full-snapshot save RPC. Every other editable profile
 * field is copied from that same snapshot, so this path cannot create a torn
 * allocation/membership update or silently overwrite a concurrent writer.
 */
export async function mutateWorkspaceMemberBusinessRole(
  input: MutateWorkspaceMemberBusinessRoleInput,
  options: MutateWorkspaceMemberBusinessRoleOptions = {},
): Promise<MutateWorkspaceMemberBusinessRoleResult> {
  const load = options.load ?? loadWorkspaceMemberProfileEditSnapshot;
  const save = options.save ?? saveWorkspaceMemberProfile;
  const snapshot = await load(input.workspaceId, input.membershipId, {
    signal: options.signal,
  });
  const mutationResult = mutateDraft(snapshot, input.mutation);
  if (!mutationResult.ok) {
    throw new WorkspaceBusinessRoleDraftError(mutationResult.reason);
  }

  const saveResult = await save({
    workspaceId: snapshot.workspaceId,
    membershipId: snapshot.membershipId,
    expectedProfileRevision: snapshot.profileRevision,
    location: snapshot.location,
    city: snapshot.city,
    officeId: snapshot.officeId,
    baseWorkingHours: snapshot.baseWorkingHours,
    roleAllocations: mutationResult.allocations.map((allocation) => ({
      businessRole: allocation.business_role,
      percentage: allocation.percentage,
      isPriority: allocation.is_priority,
    })),
    displayName: null,
    expectedDisplayName: null,
  }, {
    signal: options.signal,
  });

  return { snapshot, saveResult };
}
