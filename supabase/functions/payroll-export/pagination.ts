export const PAYROLL_PAGE_SIZE = 500;
export const MAX_PAYROLL_MEMBERS = 20_000;
export const MAX_PAYROLL_ATTENDANCE_ROWS = 100_000;
export const MAX_PAYROLL_LEAVE_ROWS = 100_000;
export const MAX_PAYROLL_RATE_ROWS = 100_000;

interface PageError {
  message?: string;
}

interface PageResult<T> {
  data: T[] | null;
  error: PageError | null;
}

export type PayrollPageFetcher<T> = (
  from: number,
  to: number,
) => PromiseLike<PageResult<T>>;

export interface PayrollPaginationOptions {
  pageSize?: number;
  maxRows?: number;
}

/**
 * Read a complete, deterministically ordered PostgREST result without relying
 * on the server's default row cap. The caller owns the ORDER BY clause; this
 * helper owns the inclusive range windows and a one-row overflow probe.
 */
export async function fetchAllPayrollRows<T>(
  label: string,
  fetchPage: PayrollPageFetcher<T>,
  options: PayrollPaginationOptions = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? PAYROLL_PAGE_SIZE;
  const maxRows = options.maxRows ?? MAX_PAYROLL_ATTENDANCE_ROWS;
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new Error("Payroll page size must be a positive safe integer");
  }
  if (!Number.isSafeInteger(maxRows) || maxRows < 0) {
    throw new Error("Payroll row limit must be a non-negative safe integer");
  }

  const rows: T[] = [];
  while (rows.length < maxRows) {
    const requested = Math.min(pageSize, maxRows - rows.length);
    const from = rows.length;
    const to = from + requested - 1;
    const result = await fetchPage(from, to);
    if (result.error) {
      throw new Error(
        `Failed to load ${label}: ${result.error.message || "Unknown database error"}`,
      );
    }

    const page = result.data || [];
    if (page.length > requested) {
      throw new Error(`Database returned an invalid ${label} page`);
    }
    rows.push(...page);
    if (page.length < requested) return rows;
  }

  // Reaching the exact ceiling is ambiguous. Probe the next deterministic row
  // so a result of maxRows + 1 can never be silently truncated.
  const overflowProbe = await fetchPage(maxRows, maxRows);
  if (overflowProbe.error) {
    throw new Error(
      `Failed to verify ${label} row limit: ${
        overflowProbe.error.message || "Unknown database error"
      }`,
    );
  }
  if ((overflowProbe.data || []).length > 0) {
    throw new Error(`${label} exceeds the safe limit of ${maxRows} rows`);
  }
  return rows;
}
