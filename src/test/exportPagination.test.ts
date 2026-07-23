import { describe, expect, it, vi } from 'vitest';
import {
  EXPORT_PAGE_SIZE,
  EXPORT_PAGINATION_ERROR_MESSAGE,
  ExportPaginationError,
  MAX_EXPORT_SOURCE_ROWS,
  fetchCompleteExportRows,
  type ExportPaginationErrorCode,
  type FetchCompleteExportRowsOptions,
} from '@/lib/exportPagination';

interface TestRow {
  id: string;
  sequence: number;
}

function isTestRow(value: unknown): value is TestRow {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.sequence === 'number';
}

function acceptAnyRow(_value: unknown): _value is unknown {
  return true;
}

function rowsForRange(from: number, to: number, count: number): TestRow[] {
  const length = Math.max(0, Math.min(to, count - 1) - from + 1);
  return Array.from({ length }, (_, offset) => ({
    id: `row-${from + offset}`,
    sequence: from + offset,
  }));
}

function successfulOptions(count: number) {
  const fetchPage = vi.fn((from: number, to: number, includeExactCount: boolean) =>
    Promise.resolve({
      data: rowsForRange(from, to, count),
      error: null,
      ...(includeExactCount ? { count } : {}),
    })
  );
  const fetchFinalCount = vi.fn(() =>
    Promise.resolve({ data: null, error: null, count })
  );
  return { fetchPage, fetchFinalCount, validateRow: isTestRow };
}

async function expectCode(
  promise: Promise<unknown>,
  code: ExportPaginationErrorCode
): Promise<ExportPaginationError> {
  const error = await promise.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ExportPaginationError);
  expect(error).toMatchObject({
    name: 'ExportPaginationError',
    message: EXPORT_PAGINATION_ERROR_MESSAGE,
    code,
  });
  expect(error).not.toHaveProperty('cause');
  return error as ExportPaginationError;
}

describe('complete export pagination boundary', () => {
  it('publishes the fixed page size, hard row cap, and stable generic error', () => {
    expect(EXPORT_PAGE_SIZE).toBe(500);
    expect(MAX_EXPORT_SOURCE_ROWS).toBe(100_000);
    const error = new ExportPaginationError('QUERY_FAILED');
    expect(error.message).toBe('Unable to load complete export data.');
    expect(error.code).toBe('QUERY_FAILED');
  });

  it.each([0, 1, 499, 500, 501, 1_000, 1_001, 100_000])(
    'returns all %i rows in deterministic page order',
    async (count) => {
      const { fetchPage, fetchFinalCount } = successfulOptions(count);

      const result = await fetchCompleteExportRows<TestRow>({
        fetchPage,
        fetchFinalCount,
        validateRow: isTestRow,
        identity: (row) => row.id,
      });

      expect(result).toHaveLength(count);
      expect(result.every((row, index) => row.sequence === index)).toBe(true);
      expect(fetchPage).toHaveBeenCalledTimes(Math.max(1, Math.ceil(count / 500)));
      expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 499, true);
      if (count > 500) {
        expect(fetchPage).toHaveBeenNthCalledWith(
          2,
          500,
          Math.min(999, count - 1),
          false
        );
        expect(fetchFinalCount).toHaveBeenCalledOnce();
      } else {
        expect(fetchFinalCount).not.toHaveBeenCalled();
      }
      if (count === 1_001) {
        expect(fetchPage).toHaveBeenNthCalledWith(3, 1_000, 1_000, false);
      }
      if (count === 100_000) {
        expect(fetchPage).toHaveBeenNthCalledWith(200, 99_500, 99_999, false);
      }
    }
  );

  it('rejects 100001 rows before requesting another page or a final count', async () => {
    const { fetchPage, fetchFinalCount } = successfulOptions(100_001);

    await expectCode(
      fetchCompleteExportRows({ fetchPage, fetchFinalCount, validateRow: isTestRow }),
      'ROW_LIMIT_EXCEEDED'
    );

    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchFinalCount).not.toHaveBeenCalled();
  });

  it('honors a lower explicit row limit without weakening the hard cap', async () => {
    const { fetchPage, fetchFinalCount } = successfulOptions(501);
    await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount,
        validateRow: isTestRow,
        maxRows: 500,
      }),
      'ROW_LIMIT_EXCEEDED'
    );

    const invalidLimit = successfulOptions(0);
    await expectCode(
      fetchCompleteExportRows({
        ...invalidLimit,
        maxRows: MAX_EXPORT_SOURCE_ROWS + 1,
      }),
      'ROW_LIMIT_EXCEEDED'
    );
    expect(invalidLimit.fetchPage).not.toHaveBeenCalled();
  });

  it.each([
    ['synchronous throw', () => { throw new Error('provider-secret-sync'); }],
    ['rejection', () => Promise.reject(new Error('provider-secret-async'))],
    ['non-null provider error', () => ({ data: [], error: { detail: 'provider-secret-envelope' }, count: 0 })],
  ])('maps a %s to QUERY_FAILED without retaining provider detail', async (_name, fetchPage) => {
    const error = await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount: vi.fn(),
        validateRow: acceptAnyRow,
      }),
      'QUERY_FAILED'
    );

    expect(String(error)).not.toContain('provider-secret');
  });

  it.each([
    ['null response', null],
    ['array response', []],
    ['empty object', {}],
    ['missing error field', { data: [], count: 0 }],
    ['missing data field', { error: null, count: 0 }],
    ['null data', { data: null, error: null, count: 0 }],
  ])('rejects a malformed first-page %s', async (_name, response) => {
    await expectCode(
      fetchCompleteExportRows({
        fetchPage: () => response,
        fetchFinalCount: vi.fn(),
        validateRow: acceptAnyRow,
      }),
      'MALFORMED_RESPONSE'
    );
  });

  it.each([
    ['undefined', undefined],
    ['false', false],
  ])('treats a present non-null %s error field as a failed query', async (_name, providerError) => {
    await expectCode(
      fetchCompleteExportRows({
        fetchPage: () => ({ data: [], error: providerError, count: 0 }),
        fetchFinalCount: vi.fn(),
        validateRow: acceptAnyRow,
      }),
      'QUERY_FAILED'
    );
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['string', '0'],
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects a %s exact count', async (_name, count) => {
    await expectCode(
      fetchCompleteExportRows({
        fetchPage: () => ({ data: [], error: null, ...(count === undefined ? {} : { count }) }),
        fetchFinalCount: vi.fn(),
        validateRow: acceptAnyRow,
      }),
      'INVALID_EXACT_COUNT'
    );
  });

  it.each([
    ['short', []],
    ['long', [{ id: 'a' }, { id: 'b' }]],
  ])('rejects a %s first page', async (_name, data) => {
    await expectCode(
      fetchCompleteExportRows({
        fetchPage: () => ({ data, error: null, count: 1 }),
        fetchFinalCount: vi.fn(),
        validateRow: acceptAnyRow,
      }),
      'INCOMPLETE_PAGE'
    );
  });

  it.each([
    ['short', []],
    ['long', [{ id: 'row-500' }, { id: 'row-501' }]],
  ])('rejects a %s later page', async (_name, finalPage) => {
    const firstPage = rowsForRange(0, 499, 501);
    const fetchPage = vi.fn((from: number) => ({
      data: from === 0 ? firstPage : finalPage,
      error: null,
      ...(from === 0 ? { count: 501 } : {}),
    }));

    await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount: vi.fn(),
        validateRow: acceptAnyRow,
      }),
      'INCOMPLETE_PAGE'
    );
  });

  it.each([
    ['non-string', () => 7],
    ['empty', () => ''],
    ['blank', () => '   '],
    ['throwing', () => { throw new Error('identity-secret'); }],
  ])('rejects a %s row identity without leaking callback detail', async (_name, identity) => {
    const { fetchPage, fetchFinalCount } = successfulOptions(1);
    const error = await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount,
        validateRow: isTestRow,
        identity,
      }),
      'INVALID_ROW_ID'
    );
    expect(String(error)).not.toContain('identity-secret');
  });

  it.each([
    ['false result', (_row: unknown): _row is TestRow => false],
    ['throwing validator', (_row: unknown): _row is TestRow => {
      throw new Error('row-validator-secret');
    }],
  ])('rejects a first-page row on a %s without leaking callback detail', async (_name, validateRow) => {
    const { fetchPage, fetchFinalCount } = successfulOptions(1);
    const error = await expectCode(
      fetchCompleteExportRows({ fetchPage, fetchFinalCount, validateRow }),
      'INVALID_ROW'
    );
    expect(String(error)).not.toContain('row-validator-secret');
  });

  it('validates every later page before returning rows', async () => {
    const { fetchPage, fetchFinalCount } = successfulOptions(501);
    await expectCode(
      fetchCompleteExportRows<TestRow>({
        fetchPage,
        fetchFinalCount,
        validateRow: (row): row is TestRow => isTestRow(row) && row.sequence < 500,
      }),
      'INVALID_ROW'
    );
  });

  it('rejects duplicate identities within one page', async () => {
    await expectCode(
      fetchCompleteExportRows({
        fetchPage: () => ({
          data: [{ id: 'same' }, { id: ' same ' }],
          error: null,
          count: 2,
        }),
        fetchFinalCount: vi.fn(),
        validateRow: (row): row is { id: string } => (
          typeof row === 'object'
          && row !== null
          && typeof (row as Record<string, unknown>).id === 'string'
        ),
        identity: (row: { id: string }) => row.id,
      }),
      'DUPLICATE_ROW_ID'
    );
  });

  it('rejects duplicate identities across page boundaries', async () => {
    const fetchPage = vi.fn((from: number) => ({
      data: from === 0
        ? rowsForRange(0, 499, 501)
        : [{ id: 'row-0', sequence: 500 }],
      error: null,
      ...(from === 0 ? { count: 501 } : {}),
    }));

    await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount: vi.fn(),
        validateRow: isTestRow,
        identity: (row: TestRow) => row.id,
      }),
      'DUPLICATE_ROW_ID'
    );
  });

  it.each([
    ['null response', null, 'MALFORMED_RESPONSE'],
    ['missing error', { count: 501 }, 'MALFORMED_RESPONSE'],
    ['provider error', { error: { detail: 'final-secret' }, count: 501 }, 'QUERY_FAILED'],
    ['missing count', { error: null }, 'INVALID_EXACT_COUNT'],
    ['null count', { error: null, count: null }, 'INVALID_EXACT_COUNT'],
    ['fractional count', { error: null, count: 501.5 }, 'INVALID_EXACT_COUNT'],
  ] as const)('rejects a malformed final-count %s', async (_name, response, code) => {
    const { fetchPage } = successfulOptions(501);
    const error = await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount: () => response,
        validateRow: isTestRow,
      }),
      code
    );
    expect(String(error)).not.toContain('final-secret');
  });

  it('maps final-count rejection to QUERY_FAILED', async () => {
    const { fetchPage } = successfulOptions(501);
    const error = await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount: () => Promise.reject(new Error('final-rejection-secret')),
        validateRow: isTestRow,
      }),
      'QUERY_FAILED'
    );
    expect(String(error)).not.toContain('final-rejection-secret');
  });

  it.each([
    ['decreased', 500],
    ['increased', 502],
  ])('rejects a %s final exact count', async (_name, finalCount) => {
    const { fetchPage } = successfulOptions(501);
    await expectCode(
      fetchCompleteExportRows({
        fetchPage,
        fetchFinalCount: () => ({ data: null, error: null, count: finalCount }),
        validateRow: isTestRow,
      }),
      'COUNT_CHANGED'
    );
  });

  it('preserves the provider order instead of sorting rows by identity', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `row-${499 - index}`,
      sequence: 499 - index,
    }));
    const fetchPage = vi.fn((from: number) => ({
      data: from === 0 ? firstPage : [{ id: 'tail', sequence: -1 }],
      error: null,
      ...(from === 0 ? { count: 501 } : {}),
    }));

    const result = await fetchCompleteExportRows({
      fetchPage,
      fetchFinalCount: () => ({ data: null, error: null, count: 501 }),
      validateRow: isTestRow,
      identity: (row: TestRow) => row.id,
    });

    expect(result.slice(0, 3).map((row) => row.id)).toEqual([
      'row-499',
      'row-498',
      'row-497',
    ]);
    expect(result.at(-1)?.id).toBe('tail');
  });
});
