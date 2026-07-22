/** Maximum number of Unicode code points retained in a row-error value. */
export const IMPORT_ROW_ERROR_VALUE_MAX_CODE_POINTS = 256;

export const IMPORT_PROVIDER_FAILURE_CODE = "DB_ERROR";
export const IMPORT_ROW_WRITE_FAILURE_CODE = "ROW_WRITE_FAILED";
export const IMPORT_ROW_WRITE_FAILURE_MESSAGE = "Import row could not be saved";

export interface SanitizedImportRowError {
  row_index: number;
  field: string;
  value: string;
  code: typeof IMPORT_PROVIDER_FAILURE_CODE;
  reason_code: typeof IMPORT_ROW_WRITE_FAILURE_CODE;
  message: typeof IMPORT_ROW_WRITE_FAILURE_MESSAGE;
}

export type ImportWriteFailureField = "general" | "email";

const SAFE_PROVIDER_CODE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const UNKNOWN_PROVIDER_CODE = "UNKNOWN";

/**
 * Bound an import value without splitting surrogate pairs. Import rows arrive
 * from JSON, but non-primitive values are deliberately not serialized into an
 * error response because they may contain unrelated or sensitive fields.
 */
export function boundedImportRowValue(value: unknown): string {
  let text: string;
  switch (typeof value) {
    case "string":
      text = value;
      break;
    case "number":
    case "boolean":
    case "bigint":
      text = String(value);
      break;
    default:
      return "";
  }

  return [...text].slice(0, IMPORT_ROW_ERROR_VALUE_MAX_CODE_POINTS).join("");
}

/**
 * Create the only client-visible row error used for provider write failures.
 * Provider messages and codes are intentionally not accepted as input.
 */
export function rowWriteFailure(input: {
  rowIndex: number;
  field?: ImportWriteFailureField;
  value: unknown;
}): SanitizedImportRowError {
  return {
    row_index: input.rowIndex,
    field: input.field === "email" ? "email" : "general",
    value: boundedImportRowValue(input.value),
    code: IMPORT_PROVIDER_FAILURE_CODE,
    reason_code: IMPORT_ROW_WRITE_FAILURE_CODE,
    message: IMPORT_ROW_WRITE_FAILURE_MESSAGE,
  };
}

/**
 * Reduce an untrusted provider code to a bounded token suitable only for
 * structured log context. Never use this value in a client response.
 */
export function safeProviderCode(value: unknown): string {
  return typeof value === "string" && SAFE_PROVIDER_CODE_PATTERN.test(value)
    ? value
    : UNKNOWN_PROVIDER_CODE;
}

/** Prevent call sites from accidentally logging the original provider value. */
export function providerCodeLogContext(
  value: unknown,
): Readonly<{ provider_code: string }> {
  return { provider_code: safeProviderCode(value) };
}
