import type { EntityConfig, FieldDefinition } from '../config/entity-registry';

export type ErrorCode =
  | 'REQUIRED_EMPTY'
  | 'INVALID_EMAIL'
  | 'INVALID_DATE'
  | 'INVALID_ENUM'
  | 'INVALID_NUMBER'
  | 'INVALID_BOOLEAN'
  | 'BUSINESS_RULE'
  | 'DUPLICATE_IN_FILE';

export interface RowError {
  rowIndex: number;
  field: string;
  value: string;
  code: ErrorCode;
  message: string;
}

export interface RowValidationResult {
  rowIndex: number;
  status: 'valid' | 'warning' | 'error';
  errors: RowError[];
  cleanedRow: Record<string, any>;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: RowError[];
  perRow: RowValidationResult[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeBoolean(v: string): boolean | null {
  const s = (v || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'igen', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'nem', 'n', ''].includes(s)) return false;
  return null;
}

export function normalizeDate(v: string): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  if (DATE_RE_ISO.test(s)) return s;
  // DD.MM.YYYY
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY/MM/DD
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const [, y, m, d] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function validateField(field: FieldDefinition, rawValue: string): { error: ErrorCode | null; cleaned: any; message?: string } {
  const value = (rawValue ?? '').trim();

  if (field.required && !value) {
    return { error: 'REQUIRED_EMPTY', cleaned: null, message: `Required field is empty: ${field.label}` };
  }
  if (!value) return { error: null, cleaned: null };

  switch (field.type) {
    case 'email':
      if (!EMAIL_RE.test(value)) return { error: 'INVALID_EMAIL', cleaned: null, message: `'${value}' is not a valid email address` };
      return { error: null, cleaned: value.toLowerCase() };
    case 'date': {
      const d = normalizeDate(value);
      if (!d) return { error: 'INVALID_DATE', cleaned: null, message: `'${value}' is not a valid date (expected: YYYY-MM-DD)` };
      return { error: null, cleaned: d };
    }
    case 'boolean': {
      const b = normalizeBoolean(value);
      if (b === null) return { error: 'INVALID_BOOLEAN', cleaned: null, message: `'${value}' is not a valid boolean (expected: true/false or yes/no)` };
      return { error: null, cleaned: b };
    }
    case 'number': {
      const n = Number(value);
      if (Number.isNaN(n)) return { error: 'INVALID_NUMBER', cleaned: null, message: `'${value}' is not a valid number` };
      return { error: null, cleaned: n };
    }
    case 'enum': {
      const allowed = field.enumValues || [];
      // Accept machine value or display label
      let machineValue: string | null = null;
      if (allowed.includes(value)) machineValue = value;
      else if (field.enumLabels) {
        for (const [k, v] of Object.entries(field.enumLabels)) {
          if (v.toLowerCase() === value.toLowerCase()) { machineValue = k; break; }
        }
      }
      if (!machineValue) return { error: 'INVALID_ENUM', cleaned: null, message: `'${value}' is not valid. Allowed values: ${allowed.join(', ')}` };
      return { error: null, cleaned: machineValue };
    }
    case 'uuid':
    case 'string':
    default:
      return { error: null, cleaned: value };
  }
}

export function validateRows(
  entity: EntityConfig,
  rows: Record<string, string>[],
  columnMapping: Record<string, string>
): ValidationSummary {
  const perRow: RowValidationResult[] = [];
  const allErrors: RowError[] = [];
  const seenKeys = new Map<string, number>(); // unique key string → first row index

  rows.forEach((row, rowIndex) => {
    const errors: RowError[] = [];
    const cleanedRow: Record<string, any> = {};

    // Map file columns to field keys
    const fieldValues: Record<string, string> = {};
    for (const [fileHeader, fieldKey] of Object.entries(columnMapping)) {
      if (fieldKey === '__ignore__' || !fieldKey) continue;
      fieldValues[fieldKey] = row[fileHeader] ?? '';
    }

    // Validate each importable field defined in the entity
    for (const field of entity.fields) {
      if (!field.importable) continue;
      const raw = fieldValues[field.key] ?? '';
      const { error, cleaned, message } = validateField(field, raw);
      if (error) {
        const e: RowError = { rowIndex, field: field.key, value: raw, code: error, message: message || error };
        errors.push(e);
        allErrors.push(e);
      } else {
        if (cleaned !== null) cleanedRow[field.key] = cleaned;
      }
    }

    // Cross-field business rules
    if (entity.key === 'leave' && cleanedRow.start_date && cleanedRow.end_date) {
      if (cleanedRow.end_date < cleanedRow.start_date) {
        const e: RowError = { rowIndex, field: 'end_date', value: cleanedRow.end_date, code: 'BUSINESS_RULE', message: 'End date cannot be earlier than start date' };
        errors.push(e);
        allErrors.push(e);
      }
    }

    // Within-file duplicate detection on unique keys
    if (entity.uniqueKeyFields.length > 0) {
      const keyParts = entity.uniqueKeyFields.map(f => String(cleanedRow[f] ?? '').toLowerCase().trim()).filter(p => p);
      if (keyParts.length === entity.uniqueKeyFields.length) {
        const keyStr = keyParts.join('||');
        const prev = seenKeys.get(keyStr);
        if (prev !== undefined) {
          const e: RowError = { rowIndex, field: entity.uniqueKeyFields[0], value: keyParts[0], code: 'DUPLICATE_IN_FILE', message: `Duplicate row in file (other row: ${prev + 1})` };
          errors.push(e);
          allErrors.push(e);
        } else {
          seenKeys.set(keyStr, rowIndex);
        }
      }
    }

    const status: 'valid' | 'warning' | 'error' = errors.length > 0 ? 'error' : 'valid';
    perRow.push({ rowIndex, status, errors, cleanedRow });
  });

  const validRows = perRow.filter(r => r.status === 'valid').length;
  const errorRows = perRow.filter(r => r.status === 'error').length;
  const warningRows = perRow.filter(r => r.status === 'warning').length;

  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    warningRows,
    errors: allErrors,
    perRow,
  };
}

/**
 * Resolve file headers to field keys for column mapping.
 * Tries exact-key, alias, label, lowercased matches.
 */
export function autoMapColumns(entity: EntityConfig, fileHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const fields = entity.fields.filter(f => f.importable);

  for (const header of fileHeaders) {
    const trimmed = header.replace(/\s*\*\s*$/, '').trim(); // strip required asterisk suffix
    const lc = trimmed.toLowerCase();

    // 1. Exact key match
    let found = fields.find(f => f.key === trimmed || f.key === lc);
    // 2. Alias
    if (!found) found = fields.find(f => f.importAlias?.some(a => a === trimmed || a.toLowerCase() === lc));
    // 3. Label match
    if (!found) found = fields.find(f => f.label === trimmed || f.label.toLowerCase() === lc);

    mapping[header] = found ? found.key : '__ignore__';
  }
  return mapping;
}

/**
 * Detect and skip a guidance row.
 * Heuristic: if the second row's values match the templateExample values exactly,
 * or none of its required-field cells contain a valid value (e.g. email format), skip it.
 */
export function detectGuidanceRow(entity: EntityConfig, mapping: Record<string, string>, firstRow: Record<string, string>): boolean {
  // Look up email column or first required field
  const emailField = entity.fields.find(f => f.type === 'email' && f.required);
  if (emailField) {
    const fileHeader = Object.entries(mapping).find(([, k]) => k === emailField.key)?.[0];
    if (fileHeader) {
      const v = (firstRow[fileHeader] || '').trim();
      // Guidance row often contains placeholder like "kovacs.bela@ceg.hu"
      if (v && v.includes('@ceg.hu')) return true;
      if (v && !EMAIL_RE.test(v)) return true; // not a valid email — likely guidance
    }
  }
  return false;
}
