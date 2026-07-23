export const EXPORT_PAGE_SIZE = 500;
export const MAX_EXPORT_SOURCE_ROWS = 100_000;
export const EXPORT_PAGINATION_ERROR_MESSAGE =
  'Unable to load complete export data.';

export type ExportPaginationErrorCode =
  | 'QUERY_FAILED'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_EXACT_COUNT'
  | 'ROW_LIMIT_EXCEEDED'
  | 'INCOMPLETE_PAGE'
  | 'INVALID_ROW'
  | 'INVALID_ROW_ID'
  | 'DUPLICATE_ROW_ID'
  | 'COUNT_CHANGED';

export class ExportPaginationError extends Error {
  readonly code: ExportPaginationErrorCode;

  constructor(code: ExportPaginationErrorCode) {
    super(EXPORT_PAGINATION_ERROR_MESSAGE);
    this.name = 'ExportPaginationError';
    this.code = code;
  }
}

export interface FetchCompleteExportRowsOptions<TRow> {
  fetchPage: (
    from: number,
    to: number,
    includeExactCount: boolean
  ) => unknown | PromiseLike<unknown>;
  fetchFinalCount: () => unknown | PromiseLike<unknown>;
  identity?: (row: TRow) => unknown;
  validateRow: (row: unknown) => row is TRow;
  maxRows?: number;
}

interface ProviderEnvelope extends Record<string, unknown> {
  error: null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

async function resolveProviderCall(
  call: () => unknown | PromiseLike<unknown>
): Promise<ProviderEnvelope> {
  let result: unknown;
  try {
    result = await call();
  } catch {
    throw new ExportPaginationError('QUERY_FAILED');
  }

  if (!isRecord(result) || !hasOwn(result, 'error')) {
    throw new ExportPaginationError('MALFORMED_RESPONSE');
  }
  if (result.error !== null) {
    throw new ExportPaginationError('QUERY_FAILED');
  }
  return result as ProviderEnvelope;
}

function readExactCount(result: ProviderEnvelope): number {
  if (
    !hasOwn(result, 'count')
    || !Number.isSafeInteger(result.count)
    || (result.count as number) < 0
  ) {
    throw new ExportPaginationError('INVALID_EXACT_COUNT');
  }
  return result.count as number;
}

function resolveRowLimit(maxRows: number | undefined): number {
  if (maxRows === undefined) return MAX_EXPORT_SOURCE_ROWS;
  if (
    !Number.isSafeInteger(maxRows)
    || maxRows < 0
    || maxRows > MAX_EXPORT_SOURCE_ROWS
  ) {
    throw new ExportPaginationError('ROW_LIMIT_EXCEEDED');
  }
  return maxRows;
}

function validatePageIdentity<TRow>(
  rows: TRow[],
  identity: ((row: TRow) => unknown) | undefined,
  seenIdentities: Set<string>
): void {
  if (!identity) return;

  for (const row of rows) {
    let value: unknown;
    try {
      value = identity(row);
    } catch {
      throw new ExportPaginationError('INVALID_ROW_ID');
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ExportPaginationError('INVALID_ROW_ID');
    }
    const normalizedIdentity = value.trim();
    if (seenIdentities.has(normalizedIdentity)) {
      throw new ExportPaginationError('DUPLICATE_ROW_ID');
    }
    seenIdentities.add(normalizedIdentity);
  }
}

function validatePageRows<TRow>(
  rows: unknown[],
  validateRow: (row: unknown) => row is TRow,
): void {
  for (const row of rows) {
    let valid = false;
    try {
      valid = validateRow(row);
    } catch {
      throw new ExportPaginationError('INVALID_ROW');
    }
    if (!valid) throw new ExportPaginationError('INVALID_ROW');
  }
}

export async function fetchCompleteExportRows<TRow>({
  fetchPage,
  fetchFinalCount,
  identity,
  validateRow,
  maxRows,
}: FetchCompleteExportRowsOptions<TRow>): Promise<TRow[]> {
  const rowLimit = resolveRowLimit(maxRows);
  const firstResult = await resolveProviderCall(() =>
    fetchPage(0, EXPORT_PAGE_SIZE - 1, true)
  );
  if (!hasOwn(firstResult, 'data') || !Array.isArray(firstResult.data)) {
    throw new ExportPaginationError('MALFORMED_RESPONSE');
  }

  const exactCount = readExactCount(firstResult);
  if (exactCount > rowLimit) {
    throw new ExportPaginationError('ROW_LIMIT_EXCEEDED');
  }

  const firstRows = firstResult.data as TRow[];
  const expectedFirstPageLength = Math.min(exactCount, EXPORT_PAGE_SIZE);
  if (firstRows.length !== expectedFirstPageLength) {
    throw new ExportPaginationError('INCOMPLETE_PAGE');
  }

  const rows = [...firstRows];
  const seenIdentities = new Set<string>();
  validatePageRows(firstRows, validateRow);
  validatePageIdentity(firstRows, identity, seenIdentities);

  for (let from = EXPORT_PAGE_SIZE; from < exactCount; from += EXPORT_PAGE_SIZE) {
    const to = Math.min(from + EXPORT_PAGE_SIZE - 1, exactCount - 1);
    const result = await resolveProviderCall(() => fetchPage(from, to, false));
    if (!hasOwn(result, 'data') || !Array.isArray(result.data)) {
      throw new ExportPaginationError('MALFORMED_RESPONSE');
    }
    const pageRows = result.data as TRow[];
    const expectedPageLength = to - from + 1;
    if (pageRows.length !== expectedPageLength) {
      throw new ExportPaginationError('INCOMPLETE_PAGE');
    }
    validatePageRows(pageRows, validateRow);
    validatePageIdentity(pageRows, identity, seenIdentities);
    rows.push(...pageRows);
  }

  if (exactCount > EXPORT_PAGE_SIZE) {
    const finalResult = await resolveProviderCall(fetchFinalCount);
    const finalCount = readExactCount(finalResult);
    if (finalCount !== exactCount) {
      throw new ExportPaginationError('COUNT_CHANGED');
    }
  }

  return rows;
}
