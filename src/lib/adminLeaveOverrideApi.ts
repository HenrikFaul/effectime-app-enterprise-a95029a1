import { supabase } from '@/integrations/supabase/client';

export type AdminLeaveOverrideLeaveType =
  | 'vacation'
  | 'sick_leave'
  | 'unpaid_leave'
  | 'other';

export type AdminLeaveOverrideHalfDayPeriod = 'morning' | 'afternoon' | null;

export interface AdminLeaveOverrideCommand {
  workspaceId: string;
  userId: string;
  leaveType: AdminLeaveOverrideLeaveType;
  startDate: string;
  endDate: string;
  justification: string;
  autoApprove: boolean;
  isHalfDay: boolean;
  halfDayPeriod: AdminLeaveOverrideHalfDayPeriod;
  comment: string | null;
}

export interface AdminLeaveOverrideAttempt {
  key: string;
  fingerprint: string;
}

export interface AdminLeaveOverrideReceipt {
  ok: true;
  requestId: string;
  status: 'pending' | 'approved';
}

interface AdminLeaveOverrideRpcPayload {
  _workspace_id: string;
  _user_id: string;
  _leave_type: AdminLeaveOverrideLeaveType;
  _start_date: string;
  _end_date: string;
  _justification: string;
  _idempotency_key: string;
  _auto_approve: boolean;
  _is_half_day: boolean;
  _half_day_period: AdminLeaveOverrideHalfDayPeriod;
  _comment: string | null;
}

interface AdminLeaveOverrideRpcResult {
  data: unknown;
  error: unknown;
  status?: number;
}

type AdminLeaveOverrideRpcRequest = PromiseLike<AdminLeaveOverrideRpcResult> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<AdminLeaveOverrideRpcResult>;
};

interface AdminLeaveOverrideRpcClient {
  rpc: (
    functionName: 'create_admin_leave_override_v2',
    payload: AdminLeaveOverrideRpcPayload,
  ) => AdminLeaveOverrideRpcRequest;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ADMIN_LEAVE_OVERRIDE_RPC_TIMEOUT_MS = 30_000;

export type AdminLeaveOverrideApiErrorCode =
  | 'transport-ambiguous'
  | 'server-rejected'
  | 'invalid-response';

export class AdminLeaveOverrideApiError extends Error {
  readonly code: AdminLeaveOverrideApiErrorCode;
  readonly outcomeUnknown: boolean;

  constructor(code: AdminLeaveOverrideApiErrorCode) {
    super(code === 'server-rejected'
      ? 'Admin leave override RPC was rejected'
      : 'Admin leave override RPC outcome is unknown');
    this.name = 'AdminLeaveOverrideApiError';
    this.code = code;
    this.outcomeUnknown = code !== 'server-rejected';
  }
}

export function canonicalizeAdminLeaveOverrideCommand(
  command: AdminLeaveOverrideCommand,
): AdminLeaveOverrideCommand {
  return {
    ...command,
    justification: command.justification.trim(),
    halfDayPeriod: command.isHalfDay ? command.halfDayPeriod : null,
    comment: command.comment?.trim() || null,
  };
}

export function fingerprintAdminLeaveOverrideCommand(
  command: AdminLeaveOverrideCommand,
): string {
  const canonical = canonicalizeAdminLeaveOverrideCommand(command);
  return JSON.stringify([
    canonical.workspaceId,
    canonical.userId,
    canonical.leaveType,
    canonical.startDate,
    canonical.endDate,
    canonical.justification,
    canonical.autoApprove,
    canonical.isHalfDay,
    canonical.halfDayPeriod,
    canonical.comment,
  ]);
}

export function createSecureAdminLeaveOverrideKey(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (!cryptoApi) {
    throw new Error('Secure Web Crypto is unavailable');
  }

  if (typeof cryptoApi.randomUUID === 'function') {
    const key = cryptoApi.randomUUID();
    if (!UUID_PATTERN.test(key)) {
      throw new Error('Secure Web Crypto returned an invalid UUID');
    }
    return key;
  }

  if (typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure Web Crypto UUID generation is unavailable');
  }

  // Safari versions near the supported iOS deployment floor predate
  // crypto.randomUUID(), but provide CSPRNG-backed getRandomValues(). Build an
  // RFC 4122 v4 UUID from those secure bytes; never fall back to Math.random.
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function getOrCreateAdminLeaveOverrideAttempt(
  previous: AdminLeaveOverrideAttempt | null,
  command: AdminLeaveOverrideCommand,
  uuidFactory: () => string = createSecureAdminLeaveOverrideKey,
): AdminLeaveOverrideAttempt {
  const fingerprint = fingerprintAdminLeaveOverrideCommand(command);
  if (previous?.fingerprint === fingerprint) return previous;

  const key = uuidFactory();
  if (!UUID_PATTERN.test(key)) {
    throw new Error('Admin leave override idempotency key must be a UUID');
  }
  return { key, fingerprint };
}

function parseReceipt(value: unknown): AdminLeaveOverrideReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (
    response.ok !== true
    || typeof response.request_id !== 'string'
    || !UUID_PATTERN.test(response.request_id)
    || (response.status !== 'pending' && response.status !== 'approved')
  ) {
    return null;
  }
  return {
    ok: true,
    requestId: response.request_id,
    status: response.status,
  };
}

async function awaitBoundedRpc(
  request: AdminLeaveOverrideRpcRequest,
  timeoutMs: number,
): Promise<AdminLeaveOverrideRpcResult> {
  const controller = new AbortController();
  const operation = request.abortSignal
    ? request.abortSignal(controller.signal)
    : request;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Admin leave override RPC timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function createAdminLeaveOverride(
  command: AdminLeaveOverrideCommand,
  attempt: AdminLeaveOverrideAttempt,
  client: AdminLeaveOverrideRpcClient = supabase as unknown as AdminLeaveOverrideRpcClient,
  timeoutMs = ADMIN_LEAVE_OVERRIDE_RPC_TIMEOUT_MS,
): Promise<AdminLeaveOverrideReceipt> {
  const canonical = canonicalizeAdminLeaveOverrideCommand(command);
  if (attempt.fingerprint !== fingerprintAdminLeaveOverrideCommand(canonical)) {
    throw new Error('Admin leave override attempt does not match the command');
  }
  if (!UUID_PATTERN.test(attempt.key)) {
    throw new Error('Admin leave override idempotency key must be a UUID');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Admin leave override RPC timeout is invalid');
  }

  let result: AdminLeaveOverrideRpcResult;
  try {
    result = await awaitBoundedRpc(
      client.rpc('create_admin_leave_override_v2', {
        _workspace_id: canonical.workspaceId,
        _user_id: canonical.userId,
        _leave_type: canonical.leaveType,
        _start_date: canonical.startDate,
        _end_date: canonical.endDate,
        _justification: canonical.justification,
        _idempotency_key: attempt.key,
        _auto_approve: canonical.autoApprove,
        _is_half_day: canonical.isHalfDay,
        _half_day_period: canonical.halfDayPeriod,
        _comment: canonical.comment,
      }),
      timeoutMs,
    );
  } catch {
    throw new AdminLeaveOverrideApiError('transport-ambiguous');
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new AdminLeaveOverrideApiError('invalid-response');
  }

  if (result.error) {
    const status = Number.isInteger(result.status) ? result.status as number : null;
    const receivedDefinitiveRejection = status !== null
      && status >= 400
      && status < 500
      && status !== 408
      && status !== 499;
    throw new AdminLeaveOverrideApiError(
      receivedDefinitiveRejection ? 'server-rejected' : 'transport-ambiguous',
    );
  }
  const receipt = parseReceipt(result.data);
  if (!receipt) {
    throw new AdminLeaveOverrideApiError('invalid-response');
  }
  return receipt;
}
