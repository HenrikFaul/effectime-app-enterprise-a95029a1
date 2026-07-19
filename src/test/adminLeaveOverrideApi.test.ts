import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdminLeaveOverrideApiError,
  canonicalizeAdminLeaveOverrideCommand,
  createAdminLeaveOverride,
  createSecureAdminLeaveOverrideKey,
  fingerprintAdminLeaveOverrideCommand,
  getOrCreateAdminLeaveOverrideAttempt,
  type AdminLeaveOverrideApiErrorCode,
  type AdminLeaveOverrideCommand,
} from '@/lib/adminLeaveOverrideApi';

const command: AdminLeaveOverrideCommand = {
  workspaceId: 'workspace-a',
  userId: 'member-a',
  leaveType: 'vacation',
  startDate: '2026-07-21',
  endDate: '2026-07-21',
  justification: '  documented exception  ',
  autoApprove: true,
  isHalfDay: true,
  halfDayPeriod: 'morning',
  comment: '  coverage arranged  ',
};

const firstKey = '11111111-1111-4111-8111-111111111111';
const secondKey = '22222222-2222-4222-8222-222222222222';

function expectApiError(
  error: unknown,
  code: AdminLeaveOverrideApiErrorCode,
  outcomeUnknown: boolean,
  forbiddenDetails: string[] = [],
): boolean {
  expect(error).toBeInstanceOf(AdminLeaveOverrideApiError);
  const apiError = error as AdminLeaveOverrideApiError;
  expect(apiError.code).toBe(code);
  expect(apiError.outcomeUnknown).toBe(outcomeUnknown);
  for (const detail of forbiddenDetails) {
    expect(apiError.message).not.toContain(detail);
  }
  return true;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin leave override API adapter', () => {
  it('canonicalizes text and hidden half-day state before fingerprinting', () => {
    expect(canonicalizeAdminLeaveOverrideCommand(command)).toMatchObject({
      justification: 'documented exception',
      halfDayPeriod: 'morning',
      comment: 'coverage arranged',
    });

    const fullDay = { ...command, isHalfDay: false, halfDayPeriod: 'afternoon' as const };
    expect(canonicalizeAdminLeaveOverrideCommand(fullDay).halfDayPeriod).toBeNull();
    expect(fingerprintAdminLeaveOverrideCommand(fullDay)).toBe(
      fingerprintAdminLeaveOverrideCommand({ ...fullDay, halfDayPeriod: null }),
    );
  });

  it('reuses an attempt only for the same canonical payload', () => {
    const uuidFactory = vi.fn()
      .mockReturnValueOnce(firstKey)
      .mockReturnValueOnce(secondKey);
    const first = getOrCreateAdminLeaveOverrideAttempt(null, command, uuidFactory);
    const whitespaceOnly = getOrCreateAdminLeaveOverrideAttempt(
      first,
      { ...command, justification: 'documented exception', comment: 'coverage arranged' },
      uuidFactory,
    );
    const changed = getOrCreateAdminLeaveOverrideAttempt(
      whitespaceOnly,
      { ...command, comment: 'different coverage' },
      uuidFactory,
    );

    expect(whitespaceOnly).toBe(first);
    expect(changed.key).toBe(secondKey);
    expect(uuidFactory).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['workspaceId', 'workspace-b'],
    ['userId', 'member-b'],
    ['leaveType', 'other'],
    ['startDate', '2026-07-22'],
    ['endDate', '2026-07-22'],
    ['justification', 'different reason'],
    ['autoApprove', false],
    ['isHalfDay', false],
    ['halfDayPeriod', 'afternoon'],
    ['comment', 'different note'],
  ] as const)('rotates the key when %s changes effectively', (field, value) => {
    const first = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
    const changed = getOrCreateAdminLeaveOverrideAttempt(
      first,
      { ...command, [field]: value },
      () => secondKey,
    );
    expect(changed.key).toBe(secondKey);
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => firstKey),
      getRandomValues: vi.fn(),
    });
    expect(createSecureAdminLeaveOverrideKey()).toBe(firstKey);
  });

  it('uses only CSPRNG bytes for the RFC 4122 fallback', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      }),
    });
    expect(createSecureAdminLeaveOverrideKey()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });

  it('fails closed when secure Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => createSecureAdminLeaveOverrideKey()).toThrow('Secure Web Crypto is unavailable');
  });

  it('maps the exact v2 wire contract and parses a valid receipt', async () => {
    const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        status: 'approved',
      },
      error: null,
    });

    await expect(createAdminLeaveOverride(command, attempt, { rpc })).resolves.toEqual({
      ok: true,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'approved',
    });
    expect(rpc).toHaveBeenCalledWith('create_admin_leave_override_v2', {
      _workspace_id: 'workspace-a',
      _user_id: 'member-a',
      _leave_type: 'vacation',
      _start_date: '2026-07-21',
      _end_date: '2026-07-21',
      _justification: 'documented exception',
      _idempotency_key: firstKey,
      _auto_approve: true,
      _is_half_day: true,
      _half_day_period: 'morning',
      _comment: 'coverage arranged',
    });
  });

  it.each([400, 422])(
    'treats an HTTP %i response as a definitive rejection without leaking backend details',
    async (status) => {
      const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
      const privateBackendDetail = 'private database policy and tenant detail';
      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: privateBackendDetail,
          details: privateBackendDetail,
        },
        status,
      });

      await expect(createAdminLeaveOverride(command, attempt, { rpc }))
        .rejects.toSatisfy(error => expectApiError(
          error,
          'server-rejected',
          false,
          [privateBackendDetail, '42501'],
        ));
    },
  );

  it.each([
    ['missing status', undefined],
    ['status zero', 0],
    ['HTTP 408', 408],
    ['HTTP 499', 499],
    ['HTTP 500', 500],
    ['HTTP 503', 503],
    ['HTTP 599', 599],
  ] as const)(
    'treats a Supabase error with %s as transport-ambiguous even if the server may have committed',
    async (_label, status) => {
      const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
      const privateBackendDetail = 'network or gateway private detail';
      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'NETWORK_ERROR', message: privateBackendDetail },
        ...(status === undefined ? {} : { status }),
      });

      await expect(createAdminLeaveOverride(command, attempt, { rpc }))
        .rejects.toSatisfy(error => expectApiError(
          error,
          'transport-ambiguous',
          true,
          [privateBackendDetail, 'NETWORK_ERROR'],
        ));
    },
  );

  it('treats rejected transport and malformed success receipts as unknown outcomes', async () => {
    const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
    const privateTransportDetail = 'private upstream transport detail';
    const rejectedTransport = vi.fn().mockRejectedValue(new Error(privateTransportDetail));
    const malformed = vi.fn().mockResolvedValue({
      data: { ok: true, private_detail: 'private malformed response detail' },
      error: null,
      status: 200,
    });

    await expect(createAdminLeaveOverride(command, attempt, { rpc: rejectedTransport }))
      .rejects.toSatisfy(error => expectApiError(
        error,
        'transport-ambiguous',
        true,
        [privateTransportDetail],
      ));
    await expect(createAdminLeaveOverride(command, attempt, { rpc: malformed }))
      .rejects.toSatisfy(error => expectApiError(
        error,
        'invalid-response',
        true,
        ['private malformed response detail'],
      ));
  });

  it('treats a missing RPC result object as an unknown outcome', async () => {
    const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
    const rpc = vi.fn().mockResolvedValue(null);

    await expect(createAdminLeaveOverride(command, attempt, { rpc }))
      .rejects.toSatisfy(error => expectApiError(
        error,
        'invalid-response',
        true,
      ));
  });

  it('rejects stale attempts before calling the RPC', async () => {
    const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    await expect(createAdminLeaveOverride(
      { ...command, comment: 'changed' },
      attempt,
      { rpc },
    )).rejects.toThrow('does not match');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed attempts and invalid timeouts before constructing an RPC request', async () => {
    const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    await expect(createAdminLeaveOverride(
      command,
      { ...attempt, key: 'not-a-uuid' },
      { rpc },
    )).rejects.toThrow('idempotency key must be a UUID');
    await expect(createAdminLeaveOverride(command, attempt, { rpc }, 0))
      .rejects.toThrow('timeout is invalid');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('bounds stalled transport and aborts an abort-capable RPC without exposing details', async () => {
    vi.useFakeTimers();
    try {
      const attempt = getOrCreateAdminLeaveOverrideAttempt(null, command, () => firstKey);
      const pending = new Promise<{ data: unknown; error: unknown; status?: number }>(
        () => undefined,
      );
      let capturedSignal: AbortSignal | undefined;
      const request = Object.assign(pending, {
        abortSignal: vi.fn((signal: AbortSignal) => {
          capturedSignal = signal;
          return pending;
        }),
      });
      const rpc = vi.fn(() => request);

      const result = createAdminLeaveOverride(command, attempt, { rpc }, 25);
      const rejection = expect(result).rejects.toSatisfy(error => expectApiError(
        error,
        'transport-ambiguous',
        true,
        ['timed out'],
      ));
      await vi.advanceTimersByTimeAsync(25);

      await rejection;
      expect(request.abortSignal).toHaveBeenCalledOnce();
      expect(capturedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
