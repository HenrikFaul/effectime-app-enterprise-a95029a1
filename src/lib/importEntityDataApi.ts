export const IMPORT_ENTITY_DATA_FUNCTION_NAME = 'import-entity-data' as const;

export const IMPORT_ENTITY_DATA_MAX_HTTP_ERROR_BODY_BYTES = 16_384;
export const IMPORT_ENTITY_DATA_HTTP_ERROR_READ_TIMEOUT_MS = 2_000;

const IMPORT_ENTITY_DATA_MAX_ROWS = 2_000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const IMPORT_ENTITY_DATA_ENTITIES = [
  'members',
  'leave',
  'offices',
  'work_categories',
  'job_roles',
  'skills',
] as const;

const IMPORT_ENTITY_DATA_SERVER_CODE_STATUS = {
  INVALID_REQUEST: 400,
  MISSING_REQUIRED_FIELDS: 400,
  INVALID_IMPORT_MODE: 400,
  UNSUPPORTED_ENTITY: 400,
  INVALID_IMPORT_ROWS: 400,
  INVALID_DRY_RUN: 400,
  INVALID_JSON: 400,
  AUTH_REQUIRED: 401,
  UNAUTHORIZED: 401,
  ADMIN_ROLE_REQUIRED: 403,
  FEATURE_DISABLED: 403,
  METHOD_NOT_ALLOWED: 405,
  IMPORT_ROW_LIMIT_EXCEEDED: 413,
  INTERNAL_ERROR: 500,
  AUTHENTICATION_UNAVAILABLE: 503,
  AUTHORIZATION_UNAVAILABLE: 503,
  ENTITLEMENT_UNAVAILABLE: 503,
  IMPORT_DEPENDENCY_UNAVAILABLE: 503,
} as const;

const ROW_ERROR_STRING_LIMITS = {
  field: 128,
  value: 256,
  code: 128,
  reason_code: 128,
  message: 1_024,
} as const;

export type ImportEntityDataEntity = (typeof IMPORT_ENTITY_DATA_ENTITIES)[number];
export type ImportEntityDataMode = 'create' | 'upsert';
export type ImportEntityDataServerCode = keyof typeof IMPORT_ENTITY_DATA_SERVER_CODE_STATUS;

export interface ImportEntityDataSourceRow {
  sourceRowIndex: number;
  data: Readonly<Record<string, unknown>>;
}

export interface ImportEntityDataRequest {
  workspaceId: string;
  entity: ImportEntityDataEntity;
  mode: ImportEntityDataMode;
  rows: readonly ImportEntityDataSourceRow[];
  dryRun?: boolean;
}

export interface ImportEntityDataWireRequest {
  workspace_id: string;
  entity: ImportEntityDataEntity;
  mode: ImportEntityDataMode;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  dry_run?: boolean;
}

export interface ImportEntityDataSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ImportEntityDataRowError {
  /** Original CSV/source row index, not the compact submitted-array index. */
  row_index: number;
  field: string;
  value: string;
  code: string;
  reason_code?: string;
  message: string;
}

export interface ImportEntityDataInvokeResult {
  data: unknown;
  error: unknown;
}

export type ImportEntityDataInvoke = (
  functionName: typeof IMPORT_ENTITY_DATA_FUNCTION_NAME,
  options: { body: ImportEntityDataWireRequest },
) => PromiseLike<ImportEntityDataInvokeResult>;

export interface ImportEntityDataCompleted {
  kind: 'completed';
  serverCode: null;
  requestId: null;
  outcomeUnknown: false;
  summary: ImportEntityDataSummary;
  errors: ImportEntityDataRowError[];
}

export type ImportEntityDataFailureKind =
  | 'client_validation'
  | 'http'
  | 'network'
  | 'malformed_response';

export interface ImportEntityDataFailure {
  kind: 'failure';
  failureKind: ImportEntityDataFailureKind;
  serverCode: ImportEntityDataServerCode | null;
  requestId: string | null;
  httpStatus: number | null;
  outcomeUnknown: boolean;
}

export type ImportEntityDataOutcome = ImportEntityDataCompleted | ImportEntityDataFailure;

export interface ParsedImportEntityDataHttpError {
  status: number;
  serverCode: ImportEntityDataServerCode | null;
  requestId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBoundedString(value: unknown, maximumCodePoints: number): value is string {
  if (typeof value !== 'string') return false;

  let codePoints = 0;
  for (const _character of value) {
    codePoints += 1;
    if (codePoints > maximumCodePoints) return false;
  }
  return true;
}

function validRequestId(value: unknown): string | null {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : null;
}

function selectCorrelatedRequestId(
  headerRequestId: string | null,
  bodyRequestId: string | null,
): string | null {
  if (headerRequestId && bodyRequestId) {
    return headerRequestId === bodyRequestId ? headerRequestId : null;
  }
  return headerRequestId ?? bodyRequestId;
}

function buildWireRequest(request: ImportEntityDataRequest): ImportEntityDataWireRequest | null {
  if (
    !isRecord(request)
    || typeof request.workspaceId !== 'string'
    || request.workspaceId.trim().length === 0
    || !IMPORT_ENTITY_DATA_ENTITIES.includes(request.entity as ImportEntityDataEntity)
    || (request.mode !== 'create' && request.mode !== 'upsert')
    || !Array.isArray(request.rows)
    || request.rows.length > IMPORT_ENTITY_DATA_MAX_ROWS
    || (request.dryRun !== undefined && typeof request.dryRun !== 'boolean')
  ) {
    return null;
  }

  for (const row of request.rows) {
    if (
      !isRecord(row)
      || !isNonNegativeSafeInteger(row.sourceRowIndex)
      || !isRecord(row.data)
    ) {
      return null;
    }
  }

  return {
    workspace_id: request.workspaceId,
    entity: request.entity,
    mode: request.mode,
    rows: request.rows.map((row) => row.data),
    ...(request.dryRun === undefined ? {} : { dry_run: request.dryRun }),
  };
}

function parseSummary(value: unknown, submittedRowCount: number): ImportEntityDataSummary | null {
  if (!isRecord(value)) return null;

  const counts = [
    value.total,
    value.created,
    value.updated,
    value.skipped,
    value.failed,
  ];
  if (!counts.every(isNonNegativeSafeInteger)) return null;

  const [total, created, updated, skipped, failed] = counts as number[];
  if (total !== submittedRowCount) return null;
  if (created > total || updated > total || skipped > total || failed > total) return null;

  const accountedFor = created + updated + skipped + failed;
  if (!Number.isSafeInteger(accountedFor) || accountedFor !== total) return null;

  return { total, created, updated, skipped, failed };
}

function parseRowError(
  value: unknown,
  sourceRows: readonly ImportEntityDataSourceRow[],
): ImportEntityDataRowError | null {
  if (!isRecord(value) || !isNonNegativeSafeInteger(value.row_index)) return null;
  if (value.row_index >= sourceRows.length) return null;
  if (!isBoundedString(value.field, ROW_ERROR_STRING_LIMITS.field)) return null;
  if (!isBoundedString(value.value, ROW_ERROR_STRING_LIMITS.value)) return null;
  if (!isBoundedString(value.code, ROW_ERROR_STRING_LIMITS.code)) return null;
  if (!isBoundedString(value.message, ROW_ERROR_STRING_LIMITS.message)) return null;
  const reasonCode = value.reason_code;
  let parsedReasonCode: string | undefined;
  if (reasonCode !== undefined) {
    if (!isBoundedString(reasonCode, ROW_ERROR_STRING_LIMITS.reason_code)) return null;
    parsedReasonCode = reasonCode;
  }

  return {
    row_index: sourceRows[value.row_index].sourceRowIndex,
    field: value.field,
    value: value.value,
    code: value.code,
    ...(parsedReasonCode === undefined ? {} : { reason_code: parsedReasonCode }),
    message: value.message,
  };
}

/**
 * Treats an import response as authoritative only when its accounting and row
 * references are internally consistent with the exact submitted batch.
 */
export function parseImportEntityDataSuccess(
  value: unknown,
  sourceRows: readonly ImportEntityDataSourceRow[],
): Pick<ImportEntityDataCompleted, 'summary' | 'errors'> | null {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.errors)) return null;
  // The Edge contract emits at most one terminal error for each submitted row.
  // Reject a larger collection before iterating so a malformed success payload
  // cannot turn a bounded import into unbounded client-side work.
  if (value.errors.length > sourceRows.length) return null;
  if (!sourceRows.every((row) => (
    isRecord(row)
    && isNonNegativeSafeInteger(row.sourceRowIndex)
    && isRecord(row.data)
  ))) {
    return null;
  }

  const summary = parseSummary(value.summary, sourceRows.length);
  if (!summary) return null;
  if (value.errors.length !== summary.failed) return null;

  const errors: ImportEntityDataRowError[] = [];
  const failedSourceRows = new Set<number>();
  for (const candidate of value.errors) {
    const parsed = parseRowError(candidate, sourceRows);
    if (!parsed) return null;
    if (failedSourceRows.has(parsed.row_index)) return null;
    failedSourceRows.add(parsed.row_index);
    errors.push(parsed);
  }

  return { summary, errors };
}

async function readBoundedResponseText(response: Response): Promise<string | null> {
  let clone: Response;
  try {
    clone = response.clone();
  } catch {
    return null;
  }

  const declaredLength = clone.headers.get('content-length');
  if (/^\d+$/.test(declaredLength ?? '')) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length > IMPORT_ENTITY_DATA_MAX_HTTP_ERROR_BODY_BYTES) {
      return null;
    }
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const readBody = async (): Promise<string | null> => {
    try {
      if (!clone.body) {
        const text = await clone.text();
        return new TextEncoder().encode(text).byteLength <= IMPORT_ENTITY_DATA_MAX_HTTP_ERROR_BODY_BYTES
          ? text
          : null;
      }

      reader = clone.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > IMPORT_ENTITY_DATA_MAX_HTTP_ERROR_BODY_BYTES) {
          // A cloned/teed Fetch body may wait for its untouched sibling before
          // resolving cancellation. Cancellation is best-effort; never let that
          // transport detail stall the safe error boundary.
          void reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }

      const body = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new TextDecoder().decode(body);
    } catch {
      return null;
    }
  };

  const timedOut = Symbol('import-http-error-read-timeout');
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race<string | null | typeof timedOut>([
    readBody(),
    new Promise<typeof timedOut>((resolve) => {
      timeoutId = setTimeout(
        () => resolve(timedOut),
        IMPORT_ENTITY_DATA_HTTP_ERROR_READ_TIMEOUT_MS,
      );
    }),
  ]);
  if (timeoutId !== undefined) clearTimeout(timeoutId);

  if (result === timedOut) {
    if (reader) void reader.cancel().catch(() => undefined);
    return null;
  }

  return result;
}

function responseFromFunctionsHttpError(error: unknown): Response | null {
  if (!isRecord(error)) return null;
  const context = error.context;
  return typeof Response !== 'undefined' && context instanceof Response ? context : null;
}

/**
 * Extracts only allowlisted, correlation-safe metadata from a Supabase
 * FunctionsHttpError-shaped object. Provider/body messages remain opaque.
 */
export async function parseImportEntityDataHttpError(
  error: unknown,
): Promise<ParsedImportEntityDataHttpError | null> {
  const response = responseFromFunctionsHttpError(error);
  if (!response) return null;

  const headerRequestId = validRequestId(response.headers.get('X-Request-Id'));
  const bodyText = await readBoundedResponseText(response);

  let body: Record<string, unknown> | null = null;
  if (bodyText !== null) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      body = isRecord(parsed) ? parsed : null;
    } catch {
      body = null;
    }
  }

  const bodyRequestId = validRequestId(body?.request_id);
  const codeCandidate = body?.code;
  const serverCode = (
    typeof codeCandidate === 'string'
    && Object.prototype.hasOwnProperty.call(IMPORT_ENTITY_DATA_SERVER_CODE_STATUS, codeCandidate)
    && IMPORT_ENTITY_DATA_SERVER_CODE_STATUS[
      codeCandidate as ImportEntityDataServerCode
    ] === response.status
  )
    ? codeCandidate as ImportEntityDataServerCode
    : null;

  return {
    status: response.status,
    serverCode,
    requestId: selectCorrelatedRequestId(headerRequestId, bodyRequestId),
  };
}

function failure(input: Omit<ImportEntityDataFailure, 'kind'>): ImportEntityDataFailure {
  return { kind: 'failure', ...input };
}

/**
 * Executes exactly one import request. Unknown outcomes are deliberately not
 * retried because the current server implementation is not transactionally
 * idempotent across every supported entity.
 */
export async function invokeImportEntityData(
  invoke: ImportEntityDataInvoke,
  request: ImportEntityDataRequest,
): Promise<ImportEntityDataOutcome> {
  const wireRequest = buildWireRequest(request);
  if (!wireRequest) {
    return failure({
      failureKind: 'client_validation',
      serverCode: null,
      requestId: null,
      httpStatus: null,
      outcomeUnknown: false,
    });
  }

  let invocation: ImportEntityDataInvokeResult;
  try {
    invocation = await invoke(IMPORT_ENTITY_DATA_FUNCTION_NAME, { body: wireRequest });
  } catch {
    return failure({
      failureKind: 'network',
      serverCode: null,
      requestId: null,
      httpStatus: null,
      outcomeUnknown: true,
    });
  }

  if (invocation.error) {
    const httpError = await parseImportEntityDataHttpError(invocation.error);
    if (!httpError) {
      return failure({
        failureKind: 'network',
        serverCode: null,
        requestId: null,
        httpStatus: null,
        outcomeUnknown: true,
      });
    }

    const definitivePreflightFailure = (
      httpError.status >= 400
      && httpError.status < 500
      && httpError.serverCode !== null
    );
    return failure({
      failureKind: 'http',
      serverCode: httpError.serverCode,
      requestId: httpError.requestId,
      httpStatus: httpError.status,
      outcomeUnknown: !definitivePreflightFailure,
    });
  }

  const parsed = parseImportEntityDataSuccess(invocation.data, request.rows);
  if (!parsed) {
    return failure({
      failureKind: 'malformed_response',
      serverCode: null,
      requestId: null,
      httpStatus: 200,
      outcomeUnknown: true,
    });
  }

  return {
    kind: 'completed',
    serverCode: null,
    requestId: null,
    outcomeUnknown: false,
    summary: parsed.summary,
    errors: parsed.errors,
  };
}
