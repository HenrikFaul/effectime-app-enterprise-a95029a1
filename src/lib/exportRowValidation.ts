export type ExportRowValueKind =
  | 'string'
  | 'nonEmptyString'
  | 'nullableString'
  | 'boolean'
  | 'nullableBoolean'
  | 'numberLike'
  | 'nullableNumberLike';

declare const EXPORT_ROW_SCHEMA_TYPE: unique symbol;

export type ExportRowSchemaFor<TRow extends object> = Readonly<{
  [K in keyof TRow]-?: ExportRowValueKind;
}> & {
  /** Compile-time-only brand that preserves the row type through inference. */
  readonly [EXPORT_ROW_SCHEMA_TYPE]?: TRow;
};

export function defineExportRowSchema<TRow extends object>(
  schema: ExportRowSchemaFor<TRow>,
): ExportRowSchemaFor<TRow> {
  return schema;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string'
    && value.trim().length > 0
    && Number.isFinite(Number(value));
}

function matchesKind(value: unknown, kind: ExportRowValueKind): boolean {
  switch (kind) {
    case 'string':
      return typeof value === 'string';
    case 'nonEmptyString':
      return typeof value === 'string' && value.trim().length > 0;
    case 'nullableString':
      return value === null || typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'nullableBoolean':
      return value === null || typeof value === 'boolean';
    case 'numberLike':
      return isNumberLike(value);
    case 'nullableNumberLike':
      return value === null || isNumberLike(value);
  }
}

/**
 * Validates the runtime provider row without rejecting additive response fields.
 * Every projected field must be present as an own property and match its scalar
 * contract; this prevents a partial/malformed row becoming an audited export.
 */
export function matchesExportRowSchema<TRow extends object>(
  value: unknown,
  schema: ExportRowSchemaFor<TRow>,
): value is TRow & Record<string, unknown> {
  if (!isRecord(value)) return false;
  const fields = Object.entries(schema) as Array<[string, ExportRowValueKind]>;
  return fields.every(([field, kind]) => (
    Object.prototype.hasOwnProperty.call(value, field)
    && matchesKind(value[field], kind)
  ));
}
