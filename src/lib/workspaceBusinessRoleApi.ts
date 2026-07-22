import { supabase } from '@/integrations/supabase/client';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROLE_LENGTH = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_KEYS = [
  'affected_membership_count',
  'audit_event_id',
  'business_role',
  'changed',
  'deleted_allocation_count',
  'ok',
  'workspace_id',
] as const;

export type WorkspaceBusinessRoleDeleteErrorCode =
  | 'invalid-input'
  | 'aborted'
  | 'timeout'
  | 'conflict'
  | 'request-failed'
  | 'invalid-response';

export class WorkspaceBusinessRoleDeleteError extends Error {
  readonly code: WorkspaceBusinessRoleDeleteErrorCode;

  constructor(code: WorkspaceBusinessRoleDeleteErrorCode) {
    super(`Workspace business-role deletion failed: ${code}`);
    this.name = 'WorkspaceBusinessRoleDeleteError';
    this.code = code;
  }
}

export interface WorkspaceBusinessRoleDeleteResult {
  ok: true;
  workspaceId: string;
  businessRole: string;
  changed: boolean;
  affectedMembershipCount: number;
  deletedAllocationCount: number;
  auditEventId: string | null;
}

interface RpcResponse {
  data: unknown;
  error: unknown;
}

interface AbortableRpcRequest extends PromiseLike<RpcResponse> {
  abortSignal?: (signal: AbortSignal) => PromiseLike<RpcResponse>;
}

export interface WorkspaceBusinessRoleDeleteRpcClient {
  rpc: (
    name: 'delete_workspace_business_role_v1',
    args: { p_workspace_id: string; p_business_role: string },
  ) => AbortableRpcRequest;
}

export interface DeleteWorkspaceBusinessRoleOptions {
  client?: WorkspaceBusinessRoleDeleteRpcClient;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === RESPONSE_KEYS.length
    && RESPONSE_KEYS.every((key, index) => key === keys[index]);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseAuditEventId(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' && UUID_PATTERN.test(value)
    ? value.toLowerCase()
    : undefined;
}

function parseResult(
  value: unknown,
  workspaceId: string,
  businessRole: string,
): WorkspaceBusinessRoleDeleteResult | null {
  if (!isPlainRecord(value) || !hasExactKeys(value)) return null;
  const auditEventId = parseAuditEventId(value.audit_event_id);
  if (
    value.ok !== true
    || value.workspace_id !== workspaceId
    || value.business_role !== businessRole
    || typeof value.changed !== 'boolean'
    || !isNonNegativeSafeInteger(value.affected_membership_count)
    || !isNonNegativeSafeInteger(value.deleted_allocation_count)
    || auditEventId === undefined
    || value.changed !== (value.affected_membership_count > 0)
    || (value.changed ? auditEventId === null : auditEventId !== null)
    || (!value.changed && value.deleted_allocation_count !== 0)
  ) {
    return null;
  }

  return {
    ok: true,
    workspaceId,
    businessRole,
    changed: value.changed,
    affectedMembershipCount: value.affected_membership_count,
    deletedAllocationCount: value.deleted_allocation_count,
    auditEventId,
  };
}

function waitForRpc(
  request: PromiseLike<RpcResponse>,
  signal: AbortSignal,
): Promise<RpcResponse> {
  if (signal.aborted) {
    return Promise.reject(new WorkspaceBusinessRoleDeleteError('aborted'));
  }

  return new Promise<RpcResponse>((resolve, reject) => {
    const onAbort = () => reject(new WorkspaceBusinessRoleDeleteError('aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(request)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Deletes one role across the complete tenant membership set in a single
 * server transaction. The browser deliberately supplies no membership IDs:
 * suspended, removed and otherwise non-visible memberships remain the RPC's
 * authorization-scoped responsibility.
 */
export async function deleteWorkspaceBusinessRole(
  workspaceIdInput: string,
  businessRoleInput: string,
  options: DeleteWorkspaceBusinessRoleOptions = {},
): Promise<WorkspaceBusinessRoleDeleteResult> {
  const workspaceId = typeof workspaceIdInput === 'string'
    && UUID_PATTERN.test(workspaceIdInput)
    ? workspaceIdInput.toLowerCase()
    : null;
  const businessRole = typeof businessRoleInput === 'string' ? businessRoleInput : '';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (
    workspaceId === null
    || businessRole.length === 0
    || Array.from(businessRole).length > MAX_ROLE_LENGTH
    || businessRole.normalize('NFKC').trim() !== businessRole
    || hasControlCharacter(businessRole)
    || !Number.isSafeInteger(timeoutMs)
    || timeoutMs <= 0
  ) {
    throw new WorkspaceBusinessRoleDeleteError('invalid-input');
  }
  if (options.signal?.aborted) {
    throw new WorkspaceBusinessRoleDeleteError('aborted');
  }

  const controller = new AbortController();
  let abortReason: 'caller' | 'timeout' | null = null;
  const abortFromCaller = () => {
    if (abortReason === null) abortReason = 'caller';
    controller.abort();
  };
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    if (abortReason === null) abortReason = 'timeout';
    controller.abort();
  }, timeoutMs);

  try {
    const client = options.client
      ?? (supabase as unknown as WorkspaceBusinessRoleDeleteRpcClient);
    const baseRequest = client.rpc('delete_workspace_business_role_v1', {
      p_workspace_id: workspaceId,
      p_business_role: businessRole,
    });
    const request = typeof baseRequest.abortSignal === 'function'
      ? baseRequest.abortSignal(controller.signal)
      : baseRequest;
    const response = await waitForRpc(request, controller.signal);
    if (!isPlainRecord(response)) {
      throw new WorkspaceBusinessRoleDeleteError('invalid-response');
    }
    if (response.error) {
      if (
        isPlainRecord(response.error)
        && (
          response.error.code === '40001'
          || response.error.code === '40P01'
          || response.error.code === '55P03'
        )
      ) {
        throw new WorkspaceBusinessRoleDeleteError('conflict');
      }
      throw new WorkspaceBusinessRoleDeleteError('request-failed');
    }

    const result = parseResult(response.data, workspaceId, businessRole);
    if (!result) throw new WorkspaceBusinessRoleDeleteError('invalid-response');
    return result;
  } catch (error) {
    if (error instanceof WorkspaceBusinessRoleDeleteError) {
      if (error.code === 'aborted' && abortReason === 'timeout') {
        throw new WorkspaceBusinessRoleDeleteError('timeout');
      }
      throw error;
    }
    if (controller.signal.aborted) {
      throw new WorkspaceBusinessRoleDeleteError(
        abortReason === 'timeout' ? 'timeout' : 'aborted',
      );
    }
    throw new WorkspaceBusinessRoleDeleteError('request-failed');
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
