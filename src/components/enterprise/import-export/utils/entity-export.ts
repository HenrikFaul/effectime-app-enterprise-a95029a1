import type { EntityConfig, FieldDefinition } from '../config/entity-registry';
import { maxExportArtifactDataRows } from '@/lib/exportArtifactLimits';

export type EntityExportFormat = 'csv' | 'xls';

export type EntityExportErrorCode =
  | 'INVALID_EXPORT_REQUEST'
  | 'AUDIT_QUERY_FAILED'
  | 'ARTIFACT_ROW_LIMIT_EXCEEDED'
  | 'ARTIFACT_GENERATION_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'STALE_SCOPE';

export class EntityExportError extends Error {
  readonly code: EntityExportErrorCode;

  constructor(code: EntityExportErrorCode) {
    super('Unable to complete export.');
    this.name = 'EntityExportError';
    this.code = code;
  }
}

interface AuditQueryResult {
  error: unknown;
}

export interface EntityExportAuditClient {
  from(table: 'enterprise_audit_events'): {
    insert(values: Record<string, unknown>): PromiseLike<unknown>;
  };
}

export interface EntityExportArtifact {
  content: string;
  fileName: string;
  mimeType: string;
}

export interface EntityExportRequest {
  entity: EntityConfig;
  workspaceId: string;
  userId: string;
  selectedKeys: readonly string[];
  format: EntityExportFormat;
  importCompatible: boolean;
  statusFilter: string;
}

export interface EntityExportDependencies {
  auditClient: EntityExportAuditClient;
  fetchRows(
    entity: EntityConfig,
    workspaceId: string,
    filters?: { statusFilter?: string },
  ): Promise<Record<string, string>[]>;
  buildGuidanceRow(fields: FieldDefinition[]): string[];
  generateCsv(headers: string[], rows: string[][]): string;
  generateExcelXml(
    headers: string[],
    rows: string[][],
    options: {
      requiredFlags: boolean[];
      guidanceRow?: string[];
      sheetName: string;
    },
  ): string;
  download(artifact: EntityExportArtifact): void;
  now(): Date;
}

export interface EntityExportResult {
  artifact: EntityExportArtifact;
  fieldCount: number;
  rowCount: number;
}

const LEAVE_STATUS_FILTERS = new Set(['all', 'approved', 'pending', 'rejected']);
const FIELD_TYPES = new Set<FieldDefinition['type']>([
  'string',
  'email',
  'date',
  'boolean',
  'enum',
  'uuid',
  'number',
]);

function throwIfStale(isCurrent: () => boolean): void {
  if (!isCurrent()) throw new EntityExportError('STALE_SCOPE');
}

function isFieldDefinition(value: unknown): value is FieldDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const field = value as Record<string, unknown>;
  return (
    typeof field.key === 'string'
    && field.key.trim().length > 0
    && typeof field.label === 'string'
    && field.label.trim().length > 0
    && FIELD_TYPES.has(field.type as FieldDefinition['type'])
    && typeof field.required === 'boolean'
    && typeof field.importable === 'boolean'
    && typeof field.exportable === 'boolean'
    && (field.computed === undefined || typeof field.computed === 'boolean')
  );
}

function resolveSelectedFields(request: EntityExportRequest): FieldDefinition[] {
  if (
    typeof request !== 'object'
    || request === null
    || typeof request.workspaceId !== 'string'
    || typeof request.userId !== 'string'
    || typeof request.entity !== 'object'
    || request.entity === null
    || typeof request.entity.key !== 'string'
    || request.entity.key.trim().length === 0
    || typeof request.entity.label !== 'string'
    || request.entity.label.trim().length === 0
    || !Array.isArray(request.entity.fields)
    || !request.entity.fields.every(isFieldDefinition)
    || !Array.isArray(request.selectedKeys)
    || !request.selectedKeys.every(
      (selectedKey) => typeof selectedKey === 'string' && selectedKey.trim().length > 0,
    )
  ) {
    throw new EntityExportError('INVALID_EXPORT_REQUEST');
  }

  const selectedKeys = new Set(request.selectedKeys);
  if (
    request.workspaceId.trim().length === 0
    || request.userId.trim().length === 0
    || request.entity.exportEnabled !== true
    || (request.format !== 'csv' && request.format !== 'xls')
    || typeof request.importCompatible !== 'boolean'
    || typeof request.statusFilter !== 'string'
    || (
      request.entity.key === 'leave'
      && !LEAVE_STATUS_FILTERS.has(request.statusFilter)
    )
    || selectedKeys.size === 0
    || selectedKeys.size !== request.selectedKeys.length
  ) {
    throw new EntityExportError('INVALID_EXPORT_REQUEST');
  }

  const fields = request.entity.fields.filter(
    (field) => field.exportable && selectedKeys.has(field.key),
  );
  if (fields.length !== selectedKeys.size) {
    throw new EntityExportError('INVALID_EXPORT_REQUEST');
  }
  return fields;
}

function assertAuditSucceeded(result: unknown): asserts result is AuditQueryResult {
  if (
    typeof result !== 'object'
    || result === null
    || !('error' in result)
    || result.error !== null
  ) {
    throw new EntityExportError('AUDIT_QUERY_FAILED');
  }
}

async function writeAuditOrThrow(
  dependencies: EntityExportDependencies,
  values: Record<string, unknown>,
): Promise<void> {
  try {
    const result = await dependencies.auditClient
      .from('enterprise_audit_events')
      .insert(values);
    assertAuditSucceeded(result);
  } catch (error) {
    if (error instanceof EntityExportError) throw error;
    throw new EntityExportError('AUDIT_QUERY_FAILED');
  }
}

function buildArtifact(
  request: EntityExportRequest,
  dependencies: EntityExportDependencies,
  fields: FieldDefinition[],
  rows: Record<string, string>[],
): { artifact: EntityExportArtifact; dataRows: string[][] } {
  try {
    const headers = fields.map((field) => (
      request.importCompatible && field.required ? `${field.key} *` : field.key
    ));
    const guidanceRow = request.importCompatible
      ? dependencies.buildGuidanceRow(fields)
      : undefined;
    if (
      rows.length > maxExportArtifactDataRows(request.format, guidanceRow !== undefined)
    ) {
      throw new EntityExportError('ARTIFACT_ROW_LIMIT_EXCEEDED');
    }
    const dataRows = rows.map((row) => fields.map((field) => row[field.key] ?? ''));
    const date = dependencies.now();
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid export clock.');
    }
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    const baseName = `effectime_${request.entity.key}_${dateStamp}`;

    if (request.format === 'csv') {
      const exportRows = guidanceRow ? [guidanceRow, ...dataRows] : dataRows;
      return {
        artifact: {
          content: dependencies.generateCsv(headers, exportRows),
          fileName: `${baseName}.csv`,
          mimeType: 'text/csv;charset=utf-8',
        },
        dataRows,
      };
    }

    if (request.format === 'xls') {
      return {
        artifact: {
          content: dependencies.generateExcelXml(headers, dataRows, {
            requiredFlags: fields.map((field) => field.required && field.importable),
            guidanceRow,
            sheetName: request.entity.label,
          }),
          fileName: `${baseName}.xls`,
          mimeType: 'application/vnd.ms-excel',
        },
        dataRows,
      };
    }

    throw new EntityExportError('INVALID_EXPORT_REQUEST');
  } catch (error) {
    if (error instanceof EntityExportError) throw error;
    throw new EntityExportError('ARTIFACT_GENERATION_FAILED');
  }
}

export async function executeEntityExport(
  request: EntityExportRequest,
  dependencies: EntityExportDependencies,
  isCurrent: () => boolean = () => true,
): Promise<EntityExportResult> {
  const fields = resolveSelectedFields(request);
  throwIfStale(isCurrent);

  const filters = request.entity.key === 'leave'
    ? { statusFilter: request.statusFilter }
    : undefined;
  const rows = await dependencies.fetchRows(request.entity, request.workspaceId, filters);
  throwIfStale(isCurrent);

  const { artifact, dataRows } = buildArtifact(request, dependencies, fields, rows);
  throwIfStale(isCurrent);

  await writeAuditOrThrow(dependencies, {
    workspace_id: request.workspaceId,
    actor_id: request.userId,
    action: 'export.created',
    metadata: {
      entity: request.entity.key,
      field_count: fields.length,
      row_count: dataRows.length,
      // Preserve the legacy logical format value for audit consumers while
      // recording the truthful browser artifact separately.
      format: request.format === 'xls' ? 'xlsx' : 'csv',
      artifact_format: request.format,
      import_compatible: request.importCompatible,
      delivery: 'browser_download_pending',
    },
  });
  throwIfStale(isCurrent);

  try {
    dependencies.download(artifact);
  } catch {
    throw new EntityExportError('DOWNLOAD_FAILED');
  }

  return {
    artifact,
    fieldCount: fields.length,
    rowCount: dataRows.length,
  };
}
