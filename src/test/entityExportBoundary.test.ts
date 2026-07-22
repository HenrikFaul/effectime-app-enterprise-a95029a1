import { describe, expect, it, vi } from 'vitest';
import type { EntityConfig } from '@/components/enterprise/import-export/config/entity-registry';
import {
  EntityExportError,
  executeEntityExport,
  type EntityExportDependencies,
  type EntityExportErrorCode,
  type EntityExportRequest,
} from '@/components/enterprise/import-export/utils/entity-export';

const RAW_PROVIDER_DETAIL = '<script>private schema export failure</script>';

const entity = {
  key: 'members',
  label: 'Members',
  exportEnabled: true,
  importEnabled: true,
  fields: [
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      importable: true,
      exportable: true,
    },
    {
      key: 'team',
      label: 'Team',
      type: 'string',
      required: false,
      importable: true,
      exportable: true,
    },
  ],
} as EntityConfig;

function request(overrides: Partial<EntityExportRequest> = {}): EntityExportRequest {
  return {
    entity,
    workspaceId: 'workspace-1',
    userId: 'user-1',
    selectedKeys: ['email', 'team'],
    format: 'csv',
    importCompatible: true,
    statusFilter: 'all',
    ...overrides,
  };
}

function dependencies(
  events: string[] = [],
  auditResult: unknown = { data: null, error: null },
): EntityExportDependencies {
  return {
    auditClient: {
      from: vi.fn(() => ({
        insert: vi.fn(async () => {
          events.push('audit');
          if (auditResult instanceof Error) throw auditResult;
          return auditResult;
        }),
      })),
    },
    fetchRows: vi.fn(async () => {
      events.push('fetch');
      return [{ email: '=private@example.com', team: 'Platform' }];
    }),
    buildGuidanceRow: vi.fn(() => ['user@example.com', 'Platform']),
    generateCsv: vi.fn(() => {
      events.push('artifact');
      return 'csv-artifact';
    }),
    generateExcelXml: vi.fn(() => {
      events.push('artifact');
      return '<Workbook />';
    }),
    download: vi.fn(() => events.push('download')),
    now: vi.fn(() => new Date('2026-07-22T12:00:00.000Z')),
  };
}

async function expectCode(
  operation: Promise<unknown>,
  code: EntityExportErrorCode,
): Promise<void> {
  try {
    await operation;
    throw new Error('Expected entity export to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(EntityExportError);
    expect(error).toMatchObject({
      name: 'EntityExportError',
      message: 'Unable to complete export.',
      code,
    });
    expect(String(error)).not.toContain(RAW_PROVIDER_DETAIL);
  }
}

describe('entity export execution boundary', () => {
  it('builds, audits, then requests the CSV download in exact order', async () => {
    const events: string[] = [];
    const deps = dependencies(events);

    const result = await executeEntityExport(request(), deps);

    expect(events).toEqual(['fetch', 'artifact', 'audit', 'download']);
    expect(result).toEqual({
      artifact: {
        content: 'csv-artifact',
        fileName: 'effectime_members_20260722.csv',
        mimeType: 'text/csv;charset=utf-8',
      },
      fieldCount: 2,
      rowCount: 1,
    });
    expect(deps.auditClient.from).toHaveBeenCalledWith('enterprise_audit_events');
    expect(deps.auditClient.from).toHaveBeenCalledOnce();
    const insert = vi.mocked(deps.auditClient.from).mock.results[0].value.insert;
    expect(insert).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      actor_id: 'user-1',
      action: 'export.created',
      metadata: {
        entity: 'members',
        field_count: 2,
        row_count: 1,
        format: 'csv',
        artifact_format: 'csv',
        import_compatible: true,
        delivery: 'browser_download_pending',
      },
    });
  });

  it('keeps legacy xlsx audit metadata while truthfully identifying the .xls artifact', async () => {
    const events: string[] = [];
    const deps = dependencies(events);

    const result = await executeEntityExport(request({ format: 'xls' }), deps);

    expect(events).toEqual(['fetch', 'artifact', 'audit', 'download']);
    expect(result.artifact).toMatchObject({
      fileName: 'effectime_members_20260722.xls',
      mimeType: 'application/vnd.ms-excel',
    });
    const insert = vi.mocked(deps.auditClient.from).mock.results[0].value.insert;
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        format: 'xlsx',
        artifact_format: 'xls',
      }),
    }));
  });

  it.each([
    ['provider error', { data: null, error: { message: RAW_PROVIDER_DETAIL } }],
    ['null response', null],
    ['empty object', {}],
    ['missing error field', { data: null }],
    ['undefined error field', { data: null, error: undefined }],
    ['false error field', { data: null, error: false }],
    ['empty-string error field', { data: null, error: '' }],
    ['rejected transport', new Error(RAW_PROVIDER_DETAIL)],
  ])('fails closed before download for a malformed audit outcome: %s', async (_name, outcome) => {
    const events: string[] = [];
    const deps = dependencies(events, outcome);

    await expectCode(executeEntityExport(request(), deps), 'AUDIT_QUERY_FAILED');

    expect(events).toEqual(['fetch', 'artifact', 'audit']);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('does not audit or download when artifact generation fails', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.generateCsv).mockImplementation(() => {
      events.push('artifact');
      throw new Error(RAW_PROVIDER_DETAIL);
    });

    await expectCode(executeEntityExport(request(), deps), 'ARTIFACT_GENERATION_FAILED');

    expect(events).toEqual(['fetch', 'artifact']);
    expect(deps.auditClient.from).not.toHaveBeenCalled();
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('reports a stable failure when the browser download request throws after audit', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.download).mockImplementation(() => {
      events.push('download');
      throw new Error(RAW_PROVIDER_DETAIL);
    });

    await expectCode(executeEntityExport(request(), deps), 'DOWNLOAD_FAILED');

    expect(events).toEqual(['fetch', 'artifact', 'audit', 'download']);
  });

  it('invalidates stale scope immediately after the data fetch', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    let checks = 0;

    await expectCode(
      executeEntityExport(request(), deps, () => ++checks < 2),
      'STALE_SCOPE',
    );

    expect(events).toEqual(['fetch']);
    expect(deps.auditClient.from).not.toHaveBeenCalled();
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('does not download when scope becomes stale while the audit is in flight', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    let checks = 0;

    await expectCode(
      executeEntityExport(request(), deps, () => ++checks < 4),
      'STALE_SCOPE',
    );

    expect(events).toEqual(['fetch', 'artifact', 'audit']);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it.each([
    ['empty selection', { selectedKeys: [] }],
    ['duplicate selection', { selectedKeys: ['email', 'email'] }],
    ['unknown field', { selectedKeys: ['email', 'private_field'] }],
    ['missing workspace', { workspaceId: ' ' }],
    ['missing actor', { userId: '' }],
    ['disabled entity', { entity: { ...entity, exportEnabled: false } }],
    ['malformed entity field', { entity: { ...entity, fields: [null] } }],
    ['unknown entity field type', { entity: { ...entity, fields: [{ ...entity.fields[0], type: 'binary' }] } }],
    ['unknown runtime format', { format: 'xlsx' }],
    ['malformed compatibility flag', { importCompatible: 'yes' }],
  ])('rejects an invalid request before any data access: %s', async (_name, overrides) => {
    const deps = dependencies();

    await expectCode(
      executeEntityExport(request(overrides as Partial<EntityExportRequest>), deps),
      'INVALID_EXPORT_REQUEST',
    );

    expect(deps.fetchRows).not.toHaveBeenCalled();
    expect(deps.auditClient.from).not.toHaveBeenCalled();
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('rejects a null runtime request before any data access', async () => {
    const deps = dependencies();

    await expectCode(
      executeEntityExport(null as unknown as EntityExportRequest, deps),
      'INVALID_EXPORT_REQUEST',
    );

    expect(deps.fetchRows).not.toHaveBeenCalled();
    expect(deps.auditClient.from).not.toHaveBeenCalled();
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('rejects an unknown leave status before any data access', async () => {
    const deps = dependencies();

    await expectCode(
      executeEntityExport(request({
        entity: { ...entity, key: 'leave' },
        statusFilter: 'provider-only-status',
      }), deps),
      'INVALID_EXPORT_REQUEST',
    );

    expect(deps.fetchRows).not.toHaveBeenCalled();
    expect(deps.auditClient.from).not.toHaveBeenCalled();
    expect(deps.download).not.toHaveBeenCalled();
  });
});
