import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TIMEOUT_MS = 15_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESPONSE_KEYS = [
  "display_name",
  "membership_id",
  "milestone_day",
  "milestone_month",
  "milestone_type",
] as const;

export interface WorkspaceMemberMilestone {
  membershipId: string;
  displayName: string | null;
  type: "birthday" | "anniversary";
  month: number;
  day: number;
}

export type WorkspaceMilestonesErrorCode =
  "invalid-workspace-id" | "aborted" | "timeout" | "request-failed" | "invalid-response";

export class WorkspaceMilestonesError extends Error {
  readonly code: WorkspaceMilestonesErrorCode;

  constructor(code: WorkspaceMilestonesErrorCode) {
    super(`Workspace milestones request failed: ${code}`);
    this.name = "WorkspaceMilestonesError";
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

export interface WorkspaceMilestonesRpcClient {
  rpc: (
    name: "get_workspace_member_milestones_v1",
    args: { p_workspace_id: string },
  ) => AbortableRpcRequest;
}

interface LoadWorkspaceMilestonesOptions {
  client?: WorkspaceMilestonesRpcClient;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactResponseKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === RESPONSE_KEYS.length && RESPONSE_KEYS.every((key, index) => key === keys[index])
  );
}

function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) {
    return false;
  }

  // A leap year validates every legitimate month/day pair, including February 29.
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function decodeRow(value: unknown): WorkspaceMemberMilestone | null {
  if (!isPlainRecord(value) || !hasExactResponseKeys(value)) return null;
  if (
    typeof value.membership_id !== "string" ||
    !UUID_PATTERN.test(value.membership_id) ||
    (value.display_name !== null && typeof value.display_name !== "string") ||
    (value.milestone_type !== "birthday" && value.milestone_type !== "anniversary") ||
    typeof value.milestone_month !== "number" ||
    typeof value.milestone_day !== "number" ||
    !isValidMonthDay(value.milestone_month, value.milestone_day)
  ) {
    return null;
  }

  const displayName =
    typeof value.display_name === "string" ? value.display_name.trim() || null : null;

  return {
    membershipId: value.membership_id,
    displayName,
    type: value.milestone_type,
    month: value.milestone_month,
    day: value.milestone_day,
  };
}

function waitForRpc(request: PromiseLike<RpcResponse>, signal: AbortSignal): Promise<RpcResponse> {
  if (signal.aborted) {
    return Promise.reject(new WorkspaceMilestonesError("aborted"));
  }

  return new Promise<RpcResponse>((resolve, reject) => {
    const onAbort = () => reject(new WorkspaceMilestonesError("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });

    Promise.resolve(request)
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener("abort", onAbort);
      });
  });
}

/**
 * Loads the privacy-minimized, tenant-authorized milestone projection shared by
 * the web, Android and iOS shells. Raw profile preferences are intentionally
 * not part of this contract and there is no direct-table fallback.
 */
export async function loadWorkspaceMemberMilestones(
  workspaceId: string,
  options: LoadWorkspaceMilestonesOptions = {},
): Promise<WorkspaceMemberMilestone[]> {
  if (!UUID_PATTERN.test(workspaceId)) {
    throw new WorkspaceMilestonesError("invalid-workspace-id");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new WorkspaceMilestonesError("request-failed");
  }
  if (options.signal?.aborted) {
    throw new WorkspaceMilestonesError("aborted");
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const client = options.client ?? (supabase as unknown as WorkspaceMilestonesRpcClient);
    const baseRequest = client.rpc("get_workspace_member_milestones_v1", {
      p_workspace_id: workspaceId,
    });
    const request =
      typeof baseRequest.abortSignal === "function"
        ? baseRequest.abortSignal(controller.signal)
        : baseRequest;
    const response = await waitForRpc(request, controller.signal);

    if (response.error) {
      throw new WorkspaceMilestonesError("request-failed");
    }
    if (!Array.isArray(response.data)) {
      throw new WorkspaceMilestonesError("invalid-response");
    }

    const decoded: WorkspaceMemberMilestone[] = [];
    const milestoneIds = new Set<string>();
    for (const row of response.data) {
      const milestone = decodeRow(row);
      if (!milestone) {
        throw new WorkspaceMilestonesError("invalid-response");
      }
      const milestoneId = `${milestone.membershipId}:${milestone.type}`;
      if (milestoneIds.has(milestoneId)) {
        throw new WorkspaceMilestonesError("invalid-response");
      }
      milestoneIds.add(milestoneId);
      decoded.push(milestone);
    }

    return decoded;
  } catch (error) {
    if (error instanceof WorkspaceMilestonesError) {
      if (error.code === "aborted" && timedOut) {
        throw new WorkspaceMilestonesError("timeout");
      }
      throw error;
    }
    if (controller.signal.aborted) {
      throw new WorkspaceMilestonesError(timedOut ? "timeout" : "aborted");
    }
    throw new WorkspaceMilestonesError("request-failed");
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
