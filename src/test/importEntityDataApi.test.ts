import { describe, expect, it, vi } from 'vitest';

import {
  IMPORT_ENTITY_DATA_FUNCTION_NAME,
  IMPORT_ENTITY_DATA_HTTP_ERROR_READ_TIMEOUT_MS,
  IMPORT_ENTITY_DATA_MAX_HTTP_ERROR_BODY_BYTES,
  invokeImportEntityData,
  parseImportEntityDataHttpError,
  parseImportEntityDataSuccess,
  type ImportEntityDataInvoke,
  type ImportEntityDataRequest,
} from '@/lib/importEntityDataApi';

const sourceRows = [
  { sourceRowIndex: 0, data: { name: 'Alpha' } },
  { sourceRowIndex: 2, data: { name: 'Beta' } },
  { sourceRowIndex: 5, data: { name: 'Gamma' } },
] as const;

function request(overrides: Partial<ImportEntityDataRequest> = {}): ImportEntityDataRequest {
  return {
    workspaceId: 'workspace-1',
    entity: 'skills',
    mode: 'upsert',
    rows: sourceRows,
    dryRun: false,
    ...overrides,
  };
}

function successPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    summary: { total: 3, created: 1, updated: 1, skipped: 0, failed: 1 },
    errors: [{
      row_index: 2,
      field: 'name',
      value: 'Gamma',
      code: 'DB_ERROR',
      reason_code: 'ROW_WRITE_FAILED',
      message: 'A sor mentése sikertelen',
      future_error_metadata: true,
    }],
    future_top_level_metadata: { accepted: true },
    ...overrides,
  };
}

function functionsHttpError(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): unknown {
  return {
    name: 'FunctionsHttpError',
    message: 'hostile transport detail that must never escape',
    context: new Response(body, { status, headers }),
  };
}

describe('import-entity-data success contract', () => {
  it('accepts additive fields and optional reason_code, then remaps compact row indexes', async () => {
    const invoke = vi.fn<ImportEntityDataInvoke>().mockResolvedValue({
      data: successPayload(),
      error: null,
    });

    const outcome = await invokeImportEntityData(invoke, request());

    expect(outcome).toEqual({
      kind: 'completed',
      serverCode: null,
      requestId: null,
      outcomeUnknown: false,
      summary: { total: 3, created: 1, updated: 1, skipped: 0, failed: 1 },
      errors: [{
        row_index: 5,
        field: 'name',
        value: 'Gamma',
        code: 'DB_ERROR',
        reason_code: 'ROW_WRITE_FAILED',
        message: 'A sor mentése sikertelen',
      }],
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(IMPORT_ENTITY_DATA_FUNCTION_NAME, {
      body: {
        workspace_id: 'workspace-1',
        entity: 'skills',
        mode: 'upsert',
        rows: [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }],
        dry_run: false,
      },
    });
  });

  it('accepts a valid response without reason_code', () => {
    const parsed = parseImportEntityDataSuccess({
      ...successPayload(),
      errors: [{
        row_index: 1,
        field: 'name',
        value: 'Beta',
        code: 'REQUIRED_EMPTY',
        message: 'Név kötelező',
      }],
    }, sourceRows);

    expect(parsed?.errors).toEqual([{
      row_index: 2,
      field: 'name',
      value: 'Beta',
      code: 'REQUIRED_EMPTY',
      message: 'Név kötelező',
    }]);
  });

  it.each([
    { label: 'success flag', patch: { success: false } },
    { label: 'missing summary', patch: { summary: undefined } },
    { label: 'negative count', patch: { summary: { total: 3, created: -1, updated: 1, skipped: 1, failed: 2 } } },
    { label: 'fractional count', patch: { summary: { total: 3, created: 0.5, updated: 1, skipped: 0.5, failed: 1 } } },
    { label: 'unsafe count', patch: { summary: { total: 3, created: Number.MAX_SAFE_INTEGER + 1, updated: 0, skipped: 0, failed: 0 } } },
    { label: 'submitted total mismatch', patch: { summary: { total: 2, created: 1, updated: 0, skipped: 0, failed: 1 } } },
    { label: 'accounting mismatch', patch: { summary: { total: 3, created: 1, updated: 1, skipped: 0, failed: 0 } } },
    { label: 'errors not an array', patch: { errors: {} } },
    { label: 'failed/error count mismatch', patch: { errors: [] } },
  ])('rejects malformed payload accounting: $label', ({ patch }) => {
    expect(parseImportEntityDataSuccess(successPayload(patch), sourceRows)).toBeNull();
  });

  it.each([-1, 3, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an out-of-range or non-integer compact row index: %s',
    (rowIndex) => {
      expect(parseImportEntityDataSuccess(successPayload({
        errors: [{
          row_index: rowIndex,
          field: 'name',
          value: '',
          code: 'DB_ERROR',
          message: 'A sor mentése sikertelen',
        }],
      }), sourceRows)).toBeNull();
    },
  );

  it('rejects non-string and unbounded row error fields', () => {
    expect(parseImportEntityDataSuccess(successPayload({
      errors: [{
        row_index: 0,
        field: 'name',
        value: { provider: 'secret' },
        code: 'DB_ERROR',
        message: 'A sor mentése sikertelen',
      }],
    }), sourceRows)).toBeNull();

    expect(parseImportEntityDataSuccess(successPayload({
      errors: [{
        row_index: 0,
        field: 'name',
        value: 'x'.repeat(257),
        code: 'DB_ERROR',
        message: 'A sor mentése sikertelen',
      }],
    }), sourceRows)).toBeNull();
  });

  it('rejects more row errors than submitted rows before parsing the collection', () => {
    const repeatedError = {
      row_index: 0,
      field: 'name',
      value: 'Alpha',
      code: 'DB_ERROR',
      message: 'A sor mentése sikertelen',
    };

    expect(parseImportEntityDataSuccess(successPayload({
      errors: Array.from({ length: sourceRows.length + 1 }, () => repeatedError),
    }), sourceRows)).toBeNull();
  });

  it('rejects duplicate terminal errors for the same source row', () => {
    const duplicateError = {
      row_index: 0,
      field: 'name',
      value: 'Alpha',
      code: 'DB_ERROR',
      message: 'A sor mentése sikertelen',
    };

    expect(parseImportEntityDataSuccess(successPayload({
      summary: { total: 3, created: 1, updated: 0, skipped: 0, failed: 2 },
      errors: [duplicateError, duplicateError],
    }), sourceRows)).toBeNull();
  });
});

describe('import-entity-data FunctionsHttpError boundary', () => {
  it.each([
    [400, 'INVALID_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FEATURE_DISABLED'],
    [413, 'IMPORT_ROW_LIMIT_EXCEEDED'],
    [500, 'INTERNAL_ERROR'],
    [503, 'IMPORT_DEPENDENCY_UNAVAILABLE'],
  ] as const)('accepts the stable %s/%s status-code pair', async (status, code) => {
    const parsed = await parseImportEntityDataHttpError(functionsHttpError(
      status,
      JSON.stringify({ code, error: 'provider secret' }),
    ));

    expect(parsed).toEqual({ status, serverCode: code, requestId: null });
  });

  it('rejects a known code paired with the wrong status', async () => {
    const parsed = await parseImportEntityDataHttpError(functionsHttpError(
      500,
      JSON.stringify({ code: 'FEATURE_DISABLED' }),
    ));

    expect(parsed).toEqual({ status: 500, serverCode: null, requestId: null });
  });

  it('uses a matching body/header request id and rejects a mismatch', async () => {
    const matching = await parseImportEntityDataHttpError(functionsHttpError(
      503,
      JSON.stringify({ code: 'ENTITLEMENT_UNAVAILABLE', request_id: 'request_A1' }),
      { 'X-Request-Id': 'request_A1' },
    ));
    const mismatch = await parseImportEntityDataHttpError(functionsHttpError(
      503,
      JSON.stringify({ code: 'ENTITLEMENT_UNAVAILABLE', request_id: 'request_A1' }),
      { 'X-Request-Id': 'request_B2' },
    ));

    expect(matching?.requestId).toBe('request_A1');
    expect(mismatch?.requestId).toBeNull();
  });

  it('accepts one valid request-id source and ignores invalid values', async () => {
    const headerOnly = await parseImportEntityDataHttpError(functionsHttpError(
      503,
      JSON.stringify({ code: 'ENTITLEMENT_UNAVAILABLE', request_id: 'bad id' }),
      { 'X-Request-Id': 'header_id_123' },
    ));
    const bodyOnly = await parseImportEntityDataHttpError(functionsHttpError(
      503,
      JSON.stringify({ code: 'ENTITLEMENT_UNAVAILABLE', request_id: 'body_id_123' }),
      { 'X-Request-Id': 'short' },
    ));

    expect(headerOnly?.requestId).toBe('header_id_123');
    expect(bodyOnly?.requestId).toBe('body_id_123');
  });

  it('bounds hostile bodies and ignores non-JSON content without exposing it', async () => {
    const oversizedSecret = 'provider-token-'.repeat(
      Math.ceil(IMPORT_ENTITY_DATA_MAX_HTTP_ERROR_BODY_BYTES / 10),
    );
    const oversized = await parseImportEntityDataHttpError(functionsHttpError(
      503,
      JSON.stringify({ code: 'ENTITLEMENT_UNAVAILABLE', error: oversizedSecret }),
      { 'X-Request-Id': 'safe_header_123' },
    ));
    const nonJson = await parseImportEntityDataHttpError(functionsHttpError(
      503,
      '<html>provider stack trace and token</html>',
    ));

    expect(oversized).toEqual({
      status: 503,
      serverCode: null,
      requestId: 'safe_header_123',
    });
    expect(nonJson).toEqual({ status: 503, serverCode: null, requestId: null });
    expect(JSON.stringify([oversized, nonJson])).not.toContain('provider');
    expect(JSON.stringify([oversized, nonJson])).not.toContain('token');
  });

  it('stops reading a never-ending HTTP error body and retains only safe header metadata', async () => {
    vi.useFakeTimers();
    try {
      const neverEndingBody = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"code":"ENTITLEMENT_UNAVAILABLE"'));
        },
      });
      const pending = parseImportEntityDataHttpError({
        name: 'FunctionsHttpError',
        context: new Response(neverEndingBody, {
          status: 503,
          headers: { 'X-Request-Id': 'safe_header_123' },
        }),
      });

      await vi.advanceTimersByTimeAsync(IMPORT_ENTITY_DATA_HTTP_ERROR_READ_TIMEOUT_MS + 1);

      await expect(pending).resolves.toEqual({
        status: 503,
        serverCode: null,
        requestId: 'safe_header_123',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('import-entity-data outcome certainty', () => {
  it('marks a 4xx preflight as definitive and a 5xx as unknown', async () => {
    const preflight = await invokeImportEntityData(
      vi.fn<ImportEntityDataInvoke>().mockResolvedValue({
        data: null,
        error: functionsHttpError(403, JSON.stringify({ code: 'FEATURE_DISABLED' })),
      }),
      request(),
    );
    const serverFailure = await invokeImportEntityData(
      vi.fn<ImportEntityDataInvoke>().mockResolvedValue({
        data: null,
        error: functionsHttpError(503, JSON.stringify({ code: 'IMPORT_DEPENDENCY_UNAVAILABLE' })),
      }),
      request(),
    );

    expect(preflight).toMatchObject({
      kind: 'failure',
      failureKind: 'http',
      serverCode: 'FEATURE_DISABLED',
      httpStatus: 403,
      outcomeUnknown: false,
    });
    expect(serverFailure).toMatchObject({
      kind: 'failure',
      failureKind: 'http',
      serverCode: 'IMPORT_DEPENDENCY_UNAVAILABLE',
      httpStatus: 503,
      outcomeUnknown: true,
    });
  });

  it('keeps an unrecognized 4xx outcome unknown because a proxy rejection is not a proven preflight', async () => {
    const unknownRateLimit = await invokeImportEntityData(
      vi.fn<ImportEntityDataInvoke>().mockResolvedValue({
        data: null,
        error: functionsHttpError(429, JSON.stringify({ code: 'RATE_LIMITED' })),
      }),
      request(),
    );
    const mismatchedKnownCode = await invokeImportEntityData(
      vi.fn<ImportEntityDataInvoke>().mockResolvedValue({
        data: null,
        error: functionsHttpError(409, JSON.stringify({ code: 'FEATURE_DISABLED' })),
      }),
      request(),
    );

    expect(unknownRateLimit).toMatchObject({
      kind: 'failure',
      failureKind: 'http',
      serverCode: null,
      httpStatus: 429,
      outcomeUnknown: true,
    });
    expect(mismatchedKnownCode).toMatchObject({
      kind: 'failure',
      failureKind: 'http',
      serverCode: null,
      httpStatus: 409,
      outcomeUnknown: true,
    });
  });

  it('does not leak or retry a raw transport error', async () => {
    const invoke = vi.fn<ImportEntityDataInvoke>().mockRejectedValue(
      new Error('postgres password and provider stack'),
    );

    const outcome = await invokeImportEntityData(invoke, request());

    expect(outcome).toEqual({
      kind: 'failure',
      failureKind: 'network',
      serverCode: null,
      requestId: null,
      httpStatus: null,
      outcomeUnknown: true,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(outcome)).not.toContain('postgres');
    expect(JSON.stringify(outcome)).not.toContain('password');
  });

  it('treats a malformed 200 response as an unknown outcome', async () => {
    const outcome = await invokeImportEntityData(
      vi.fn<ImportEntityDataInvoke>().mockResolvedValue({
        data: { success: true, summary: { total: 3 } },
        error: null,
      }),
      request(),
    );

    expect(outcome).toEqual({
      kind: 'failure',
      failureKind: 'malformed_response',
      serverCode: null,
      requestId: null,
      httpStatus: 200,
      outcomeUnknown: true,
    });
  });

  it('rejects invalid source metadata without calling the server', async () => {
    const invoke = vi.fn<ImportEntityDataInvoke>();
    const outcome = await invokeImportEntityData(invoke, request({
      rows: [{ sourceRowIndex: -1, data: { name: 'Alpha' } }],
    }));

    expect(outcome).toMatchObject({
      kind: 'failure',
      failureKind: 'client_validation',
      outcomeUnknown: false,
    });
    expect(invoke).not.toHaveBeenCalled();
  });
});
