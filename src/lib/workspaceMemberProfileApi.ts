import { supabase } from "@/integrations/supabase/client";
import { canonicalizeWorkspaceProfileDisplayName } from "@/lib/profileDisplayName";

export { canonicalizeWorkspaceProfileDisplayName } from "@/lib/profileDisplayName";

const DEFAULT_TIMEOUT_MS = 15_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 200;
const MAX_ROLE_ALLOCATIONS = 20;
const MAX_READ_TEXT_LENGTH = 10_000;
const MAX_READ_ROLE_ALLOCATIONS = 20;
const READ_RESPONSE_KEYS = [
  "base_working_hours",
  "business_role",
  "city",
  "display_name",
  "location",
  "membership_id",
  "office_id",
  "ok",
  "profile_revision",
  "role_allocations",
  "status",
  "workspace_id",
] as const;
const READ_ALLOCATION_KEYS = ["business_role", "is_priority", "percentage"] as const;
const SAVE_RESPONSE_KEYS = [
  "allocation_count",
  "audit_event_id",
  "changed",
  "display_name_updated",
  "membership_id",
  "ok",
  "profile_revision",
  "workspace_id",
] as const;

export type WorkspaceMemberProfileErrorCode =
  "invalid-input" | "aborted" | "timeout" | "conflict" | "request-failed" | "invalid-response";

export class WorkspaceMemberProfileError extends Error {
  readonly code: WorkspaceMemberProfileErrorCode;

  constructor(code: WorkspaceMemberProfileErrorCode) {
    super(`Workspace member profile update failed: ${code}`);
    this.name = "WorkspaceMemberProfileError";
    this.code = code;
  }
}

export type WorkspaceMemberProfileReadErrorCode =
  "invalid-input" | "aborted" | "timeout" | "request-failed" | "invalid-response";

export class WorkspaceMemberProfileReadError extends Error {
  readonly code: WorkspaceMemberProfileReadErrorCode;

  constructor(code: WorkspaceMemberProfileReadErrorCode) {
    super(`Workspace member profile load failed: ${code}`);
    this.name = "WorkspaceMemberProfileReadError";
    this.code = code;
  }
}

interface RpcResponse {
  data: unknown;
  error: unknown;
}

interface AbortableRpcRequest extends PromiseLike<RpcResponse> {
  abortSignal?: (signal: AbortSignal) => PromiseLike<RpcResponse>;
}

export interface WorkspaceMemberProfileRpcClient {
  rpc: (
    name: "update_my_workspace_profile_display_name_v1",
    args: {
      p_workspace_id: string;
      p_membership_id: string;
      p_display_name: string;
    },
  ) => AbortableRpcRequest;
}

export interface WorkspaceMemberRoleAllocationInput {
  businessRole: string;
  percentage: number;
  isPriority: boolean;
}

export interface WorkspaceMemberProfileEditSnapshot {
  ok: true;
  workspaceId: string;
  membershipId: string;
  status: string;
  displayName: string | null;
  businessRole: string | null;
  location: string | null;
  city: string | null;
  officeId: string | null;
  baseWorkingHours: number;
  profileRevision: number;
  roleAllocations: readonly WorkspaceMemberRoleAllocationInput[];
}

export interface WorkspaceMemberProfileReadRpcClient {
  rpc: (
    name: "get_workspace_member_profile_edit_snapshot_v1",
    args: { p_workspace_id: string; p_membership_id: string },
  ) => AbortableRpcRequest;
}

export interface WorkspaceMemberProfileReadOptions {
  client?: WorkspaceMemberProfileReadRpcClient;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface SaveWorkspaceMemberProfileInput {
  workspaceId: string;
  membershipId: string;
  expectedProfileRevision: number;
  location: string | null;
  city: string | null;
  officeId: string | null;
  baseWorkingHours: number;
  roleAllocations: readonly WorkspaceMemberRoleAllocationInput[];
  /** Null means that the caller is not requesting a global display-name change. */
  displayName: string | null;
  /** Exact authoritative self-name baseline; only evaluated when displayName is non-null. */
  expectedDisplayName: string | null;
}

export interface SaveWorkspaceMemberProfileResult {
  ok: true;
  workspaceId: string;
  membershipId: string;
  profileRevision: number;
  changed: boolean;
  allocationCount: number;
  displayNameUpdated: boolean;
  auditEventId: string | null;
}

interface WorkspaceMemberRoleAllocationPayload {
  business_role: string;
  percentage: number;
  is_priority: boolean;
}

interface SaveWorkspaceMemberProfileRpcPayload {
  p_workspace_id: string;
  p_membership_id: string;
  p_expected_profile_revision: number;
  p_location: string | null;
  p_city: string | null;
  p_office_id: string | null;
  p_base_working_hours: number;
  p_role_allocations: WorkspaceMemberRoleAllocationPayload[];
  p_display_name: string | null;
  p_expected_display_name: string | null;
}

export interface SaveWorkspaceMemberProfileRpcClient {
  rpc: (
    name: "save_workspace_member_profile_v1",
    args: SaveWorkspaceMemberProfileRpcPayload,
  ) => AbortableRpcRequest;
}

interface UpdateWorkspaceMemberDisplayNameOptions {
  client?: WorkspaceMemberProfileRpcClient;
  timeoutMs?: number;
}

export interface SaveWorkspaceMemberProfileOptions {
  client?: SaveWorkspaceMemberProfileRpcClient;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

function canonicalizeUuid(value: unknown): string | undefined {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value.toLowerCase()
    : undefined;
}

function canonicalizeProfileRevision(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => actualKeys[index] === key)
  );
}

function canonicalizeNullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (Array.from(normalized).length > MAX_TEXT_LENGTH || hasControlCharacter(normalized)) {
    return undefined;
  }
  return normalized;
}

function validateReadNullableTextPreservingValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (
    typeof value !== "string"
    || Array.from(value).length > MAX_READ_TEXT_LENGTH
    || value.includes("\u0000")
  ) {
    return undefined;
  }
  return value;
}

function canonicalizeRequiredText(value: unknown): string | undefined {
  const normalized = canonicalizeNullableText(value);
  return normalized === null ? undefined : normalized;
}

function toHundredths(value: unknown, maximum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    return null;
  }

  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-8) return null;
  return rounded;
}

function canonicalizeRoleAllocations(
  value: unknown,
): WorkspaceMemberRoleAllocationPayload[] | null {
  if (!Array.isArray(value) || value.length > MAX_ROLE_ALLOCATIONS) return null;

  const canonical: WorkspaceMemberRoleAllocationPayload[] = [];
  const roleKeys = new Set<string>();
  let totalHundredths = 0;
  let priorityCount = 0;

  for (const candidate of value) {
    if (
      !isPlainRecord(candidate) ||
      !hasExactKeys(candidate, ["businessRole", "isPriority", "percentage"])
    ) {
      return null;
    }

    const businessRole = canonicalizeRequiredText(candidate.businessRole);
    const percentageHundredths = toHundredths(candidate.percentage, 100);
    if (
      businessRole === undefined ||
      percentageHundredths === null ||
      typeof candidate.isPriority !== "boolean"
    ) {
      return null;
    }

    const normalizedBusinessRole = businessRole.normalize("NFKC");
    if (businessRole !== normalizedBusinessRole) return null;
    const roleKey = normalizedBusinessRole.toLowerCase();
    if (roleKeys.has(roleKey)) return null;
    roleKeys.add(roleKey);
    totalHundredths += percentageHundredths;
    if (candidate.isPriority) priorityCount += 1;
    canonical.push({
      business_role: businessRole,
      percentage: percentageHundredths / 100,
      is_priority: candidate.isPriority,
    });
  }

  if (canonical.length > 0 && (totalHundredths !== 10_000 || priorityCount !== 1)) {
    return null;
  }
  return canonical;
}

function parseReadRoleAllocations(
  value: unknown,
): WorkspaceMemberRoleAllocationInput[] | null {
  if (!Array.isArray(value) || value.length > MAX_READ_ROLE_ALLOCATIONS) return null;
  const allocations: WorkspaceMemberRoleAllocationInput[] = [];
  for (const candidate of value) {
    if (!isPlainRecord(candidate) || !hasExactKeys(candidate, READ_ALLOCATION_KEYS)) {
      return null;
    }
    const businessRole = validateReadNullableTextPreservingValue(candidate.business_role);
    const percentageHundredths = toHundredths(candidate.percentage, 100);
    if (
      businessRole === undefined
      || businessRole === null
      || percentageHundredths === null
      || typeof candidate.is_priority !== "boolean"
    ) {
      return null;
    }
    allocations.push({
      businessRole,
      percentage: percentageHundredths / 100,
      isPriority: candidate.is_priority,
    });
  }
  return allocations;
}

function parseEditSnapshot(
  value: unknown,
  expectedWorkspaceId: string,
  expectedMembershipId: string,
): WorkspaceMemberProfileEditSnapshot | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, READ_RESPONSE_KEYS)) return null;
  const workspaceId = canonicalizeUuid(value.workspace_id);
  const membershipId = canonicalizeUuid(value.membership_id);
  const status = canonicalizeRequiredText(value.status);
  const displayName = validateReadNullableTextPreservingValue(value.display_name);
  const businessRole = validateReadNullableTextPreservingValue(value.business_role);
  const location = validateReadNullableTextPreservingValue(value.location);
  const city = validateReadNullableTextPreservingValue(value.city);
  const officeId = value.office_id === null ? null : canonicalizeUuid(value.office_id);
  const baseWorkingHours =
    typeof value.base_working_hours === "number"
    && Number.isFinite(value.base_working_hours)
    && value.base_working_hours >= 0
    && value.base_working_hours <= 24
      ? value.base_working_hours
      : undefined;
  const profileRevision = canonicalizeProfileRevision(value.profile_revision);
  const roleAllocations = parseReadRoleAllocations(value.role_allocations);
  if (
    value.ok !== true
    || workspaceId !== expectedWorkspaceId
    || membershipId !== expectedMembershipId
    || status === undefined
    || displayName === undefined
    || businessRole === undefined
    || location === undefined
    || city === undefined
    || officeId === undefined
    || baseWorkingHours === undefined
    || profileRevision === undefined
    || roleAllocations === null
  ) {
    return null;
  }
  return {
    ok: true,
    workspaceId,
    membershipId,
    status,
    displayName,
    businessRole,
    location,
    city,
    officeId,
    baseWorkingHours,
    profileRevision,
    roleAllocations,
  };
}

/**
 * Side-effect-free UI/API boundary check backed by the exact canonicalizer used
 * by saveWorkspaceMemberProfile. Keeping this shared prevents the Save gate
 * from accepting a snapshot that the adapter would reject.
 */
export function isWorkspaceMemberRoleAllocationSnapshotValid(
  value: unknown,
): value is readonly WorkspaceMemberRoleAllocationInput[] {
  return canonicalizeRoleAllocations(value) !== null;
}

/**
 * Mirrors the atomic save boundary for daily working hours. Read snapshots are
 * intentionally more permissive so schema-valid legacy precision can be shown
 * and repaired without making the complete profile unreadable.
 */
export function isWorkspaceMemberBaseWorkingHoursValid(value: unknown): value is number {
  return toHundredths(value, 24) !== null;
}

function parseSaveResult(
  value: unknown,
  expected: Pick<SaveWorkspaceMemberProfileInput, "workspaceId" | "membershipId" | "expectedProfileRevision" | "displayName">,
  allocationCount: number,
): SaveWorkspaceMemberProfileResult | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, SAVE_RESPONSE_KEYS)) return null;
  const workspaceId = canonicalizeUuid(value.workspace_id);
  const membershipId = canonicalizeUuid(value.membership_id);
  const profileRevision = canonicalizeProfileRevision(value.profile_revision);
  const auditEventId = value.changed === true
    ? canonicalizeUuid(value.audit_event_id)
    : value.audit_event_id === null
      ? null
      : undefined;
  if (
    value.ok !== true ||
    workspaceId === undefined ||
    workspaceId !== expected.workspaceId ||
    membershipId === undefined ||
    membershipId !== expected.membershipId ||
    profileRevision === undefined ||
    typeof value.changed !== "boolean" ||
    (value.changed
      ? profileRevision <= expected.expectedProfileRevision
      : profileRevision !== expected.expectedProfileRevision) ||
    typeof value.allocation_count !== "number" ||
    !Number.isInteger(value.allocation_count) ||
    value.allocation_count < 0 ||
    value.allocation_count > MAX_ROLE_ALLOCATIONS ||
    value.allocation_count !== allocationCount ||
    typeof value.display_name_updated !== "boolean" ||
    (expected.displayName === null && value.display_name_updated) ||
    (!value.changed && value.display_name_updated) ||
    auditEventId === undefined
  ) {
    return null;
  }

  return {
    ok: true,
    workspaceId,
    membershipId,
    profileRevision,
    changed: value.changed,
    allocationCount: value.allocation_count,
    displayNameUpdated: value.display_name_updated,
    auditEventId,
  };
}

function waitForRpc(
  request: PromiseLike<RpcResponse>,
  signal: AbortSignal,
  abortCode: "aborted" | "timeout" = "timeout",
): Promise<RpcResponse> {
  if (signal.aborted) {
    return Promise.reject(new WorkspaceMemberProfileError(abortCode));
  }

  return new Promise<RpcResponse>((resolve, reject) => {
    const onAbort = () => reject(new WorkspaceMemberProfileError(abortCode));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(request)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function waitForReadRpc(
  request: PromiseLike<RpcResponse>,
  signal: AbortSignal,
): Promise<RpcResponse> {
  if (signal.aborted) {
    return Promise.reject(new WorkspaceMemberProfileReadError("aborted"));
  }
  return new Promise<RpcResponse>((resolve, reject) => {
    const onAbort = () => reject(new WorkspaceMemberProfileReadError("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(request)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * Loads editable membership metadata, role allocations, and their optimistic
 * concurrency revision from one database snapshot. There is intentionally no
 * multi-request direct-table fallback because that could create a torn read.
 */
export async function loadWorkspaceMemberProfileEditSnapshot(
  workspaceIdInput: string,
  membershipIdInput: string,
  options: WorkspaceMemberProfileReadOptions = {},
): Promise<WorkspaceMemberProfileEditSnapshot> {
  const workspaceId = canonicalizeUuid(workspaceIdInput);
  const membershipId = canonicalizeUuid(membershipIdInput);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (
    workspaceId === undefined
    || membershipId === undefined
    || !Number.isSafeInteger(timeoutMs)
    || timeoutMs <= 0
  ) {
    throw new WorkspaceMemberProfileReadError("invalid-input");
  }
  if (options.signal?.aborted) {
    throw new WorkspaceMemberProfileReadError("aborted");
  }

  const controller = new AbortController();
  let abortReason: "caller" | "timeout" | null = null;
  const abortFromCaller = () => {
    if (abortReason === null) abortReason = "caller";
    controller.abort();
  };
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    if (abortReason === null) abortReason = "timeout";
    controller.abort();
  }, timeoutMs);

  try {
    const client = options.client ?? (supabase as unknown as WorkspaceMemberProfileReadRpcClient);
    const baseRequest = client.rpc("get_workspace_member_profile_edit_snapshot_v1", {
      p_workspace_id: workspaceId,
      p_membership_id: membershipId,
    });
    const request = typeof baseRequest.abortSignal === "function"
      ? baseRequest.abortSignal(controller.signal)
      : baseRequest;
    const response = await waitForReadRpc(request, controller.signal);
    if (!isPlainRecord(response)) {
      throw new WorkspaceMemberProfileReadError("invalid-response");
    }
    if (response.error) {
      throw new WorkspaceMemberProfileReadError("request-failed");
    }
    const snapshot = parseEditSnapshot(response.data, workspaceId, membershipId);
    if (!snapshot) {
      throw new WorkspaceMemberProfileReadError("invalid-response");
    }
    return snapshot;
  } catch (error) {
    if (error instanceof WorkspaceMemberProfileReadError) {
      if (error.code === "aborted" && abortReason === "timeout") {
        throw new WorkspaceMemberProfileReadError("timeout");
      }
      throw error;
    }
    if (controller.signal.aborted) {
      throw new WorkspaceMemberProfileReadError(
        abortReason === "timeout" ? "timeout" : "aborted",
      );
    }
    throw new WorkspaceMemberProfileReadError("request-failed");
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function updateMyWorkspaceProfileDisplayName(
  workspaceId: string,
  membershipId: string,
  displayName: string,
  options: UpdateWorkspaceMemberDisplayNameOptions = {},
): Promise<string> {
  const normalizedDisplayName = canonicalizeWorkspaceProfileDisplayName(displayName);
  if (
    !UUID_PATTERN.test(workspaceId) ||
    !UUID_PATTERN.test(membershipId) ||
    normalizedDisplayName === undefined
  ) {
    throw new WorkspaceMemberProfileError("invalid-input");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new WorkspaceMemberProfileError("invalid-input");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const client = options.client ?? (supabase as unknown as WorkspaceMemberProfileRpcClient);
    const baseRequest = client.rpc("update_my_workspace_profile_display_name_v1", {
      p_workspace_id: workspaceId,
      p_membership_id: membershipId,
      p_display_name: normalizedDisplayName,
    });
    const request =
      typeof baseRequest.abortSignal === "function"
        ? baseRequest.abortSignal(controller.signal)
        : baseRequest;
    const response = await waitForRpc(request, controller.signal);

    if (response.error) {
      throw new WorkspaceMemberProfileError("request-failed");
    }
    if (typeof response.data !== "string" || response.data !== normalizedDisplayName) {
      throw new WorkspaceMemberProfileError("invalid-response");
    }
    return response.data;
  } catch (error) {
    if (error instanceof WorkspaceMemberProfileError) throw error;
    if (controller.signal.aborted && timedOut) {
      throw new WorkspaceMemberProfileError("timeout");
    }
    throw new WorkspaceMemberProfileError("request-failed");
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

/**
 * Persists the complete editable workspace-member snapshot through the atomic,
 * tenant-authorized RPC. There is intentionally no direct-table fallback.
 */
export async function saveWorkspaceMemberProfile(
  input: SaveWorkspaceMemberProfileInput,
  options: SaveWorkspaceMemberProfileOptions = {},
): Promise<SaveWorkspaceMemberProfileResult> {
  const location = canonicalizeNullableText(input?.location);
  const city = canonicalizeNullableText(input?.city);
  const workspaceId = canonicalizeUuid(input?.workspaceId);
  const membershipId = canonicalizeUuid(input?.membershipId);
  const expectedProfileRevision = canonicalizeProfileRevision(input?.expectedProfileRevision);
  const officeId = input?.officeId === null ? null : canonicalizeUuid(input?.officeId);
  const displayName =
    input?.displayName === null ? null : canonicalizeWorkspaceProfileDisplayName(input?.displayName);
  const requestedExpectedDisplayName = validateReadNullableTextPreservingValue(input?.expectedDisplayName);
  const baseWorkingHoursHundredths = toHundredths(input?.baseWorkingHours, 24);
  const roleAllocations = canonicalizeRoleAllocations(input?.roleAllocations);
  if (
    !isPlainRecord(input) ||
    workspaceId === undefined ||
    membershipId === undefined ||
    expectedProfileRevision === undefined ||
    location === undefined ||
    city === undefined ||
    officeId === undefined ||
    baseWorkingHoursHundredths === null ||
    roleAllocations === null ||
    displayName === undefined ||
    requestedExpectedDisplayName === undefined
  ) {
    throw new WorkspaceMemberProfileError("invalid-input");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new WorkspaceMemberProfileError("invalid-input");
  }
  if (options.signal?.aborted) {
    throw new WorkspaceMemberProfileError("aborted");
  }

  const controller = new AbortController();
  let abortReason: "caller" | "timeout" | null = null;
  const abortFromCaller = () => {
    if (abortReason === null) abortReason = "caller";
    controller.abort();
  };
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    if (abortReason === null) abortReason = "timeout";
    controller.abort();
  }, timeoutMs);

  try {
    const expectedDisplayName = displayName === null ? null : requestedExpectedDisplayName;
    const client = options.client ?? (supabase as unknown as SaveWorkspaceMemberProfileRpcClient);
    const baseRequest = client.rpc("save_workspace_member_profile_v1", {
      p_workspace_id: workspaceId,
      p_membership_id: membershipId,
      p_expected_profile_revision: expectedProfileRevision,
      p_location: location,
      p_city: city,
      p_office_id: officeId,
      p_base_working_hours: baseWorkingHoursHundredths / 100,
      p_role_allocations: roleAllocations,
      p_display_name: displayName,
      p_expected_display_name: expectedDisplayName,
    });
    const request =
      typeof baseRequest.abortSignal === "function"
        ? baseRequest.abortSignal(controller.signal)
        : baseRequest;
    const response = await waitForRpc(request, controller.signal, "aborted");

    if (!isPlainRecord(response)) {
      throw new WorkspaceMemberProfileError("invalid-response");
    }
    if (response.error) {
      if (
        isPlainRecord(response.error)
        && (
          response.error.code === "40001"
          || response.error.code === "40P01"
          || response.error.code === "55P03"
        )
      ) {
        throw new WorkspaceMemberProfileError("conflict");
      }
      throw new WorkspaceMemberProfileError("request-failed");
    }

    const result = parseSaveResult(response.data, {
      workspaceId,
      membershipId,
      expectedProfileRevision,
      displayName,
    }, roleAllocations.length);
    if (!result) {
      throw new WorkspaceMemberProfileError("invalid-response");
    }
    return result;
  } catch (error) {
    if (error instanceof WorkspaceMemberProfileError) {
      if (error.code === "aborted" && abortReason === "timeout") {
        throw new WorkspaceMemberProfileError("timeout");
      }
      throw error;
    }
    if (controller.signal.aborted) {
      throw new WorkspaceMemberProfileError(abortReason === "timeout" ? "timeout" : "aborted");
    }
    throw new WorkspaceMemberProfileError("request-failed");
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
