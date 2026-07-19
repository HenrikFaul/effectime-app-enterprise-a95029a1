import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TIMEOUT_MS = 15_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WorkspaceMemberProfileErrorCode =
  "invalid-input" | "timeout" | "request-failed" | "invalid-response";

export class WorkspaceMemberProfileError extends Error {
  readonly code: WorkspaceMemberProfileErrorCode;

  constructor(code: WorkspaceMemberProfileErrorCode) {
    super(`Workspace member profile update failed: ${code}`);
    this.name = "WorkspaceMemberProfileError";
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

interface UpdateWorkspaceMemberDisplayNameOptions {
  client?: WorkspaceMemberProfileRpcClient;
  timeoutMs?: number;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

function waitForRpc(request: PromiseLike<RpcResponse>, signal: AbortSignal): Promise<RpcResponse> {
  if (signal.aborted) {
    return Promise.reject(new WorkspaceMemberProfileError("timeout"));
  }

  return new Promise<RpcResponse>((resolve, reject) => {
    const onAbort = () => reject(new WorkspaceMemberProfileError("timeout"));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(request)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export async function updateMyWorkspaceProfileDisplayName(
  workspaceId: string,
  membershipId: string,
  displayName: string,
  options: UpdateWorkspaceMemberDisplayNameOptions = {},
): Promise<string> {
  const normalizedDisplayName = displayName.trim();
  if (
    !UUID_PATTERN.test(workspaceId) ||
    !UUID_PATTERN.test(membershipId) ||
    normalizedDisplayName.length === 0 ||
    normalizedDisplayName.length > 200 ||
    hasControlCharacter(normalizedDisplayName)
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
