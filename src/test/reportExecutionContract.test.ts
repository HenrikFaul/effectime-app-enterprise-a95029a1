import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getReportTemplates, normalizeReportConfig } from '@/components/enterprise/reports/reportTemplates';
import {
  SQL_MODE_ALLOWED_TABLES,
  SQL_MODE_EXAMPLE,
} from '@/components/enterprise/reports/sqlModeContract';
import {
  ALLOWED_TABLES,
  createVisualReportFieldPlan,
  createVisualReportExecutionPlan,
  DATA_SOURCE_TABLE,
  parseReportSql,
  permitsReportAccess,
  projectRequestedReportFields,
  RAW_REPORT_SCAN_CAP,
  sortAndLimitReportRows,
} from '../../supabase/functions/run-report/contract';
import {
  loadProfileNamesByUserId,
  PROFILE_LOOKUP_BATCH_SIZE,
  type ProfileLookupClient,
} from '../../supabase/functions/payroll-export/profile-lookup';

const root = join(__dirname, '..', '..');
const seedSource = readFileSync(
  join(root, 'supabase', 'functions', 'seed-demo-workspace', 'index.ts'),
  'utf8',
);
const reportingStart = seedSource.indexOf('// G. REPORTING');
const reportingEnd = seedSource.indexOf('// H. ONBOARDING & ACCESS');
const seededReportBlock = seedSource.slice(reportingStart, reportingEnd);
const seededDataSources = [...seededReportBlock.matchAll(/data_source:\s*'([^']+)'/g)]
  .map((match) => match[1]);
const templates = getReportTemplates((key) => key);

describe('seeded report and backend data-source contract', () => {
  it('finds all four demo report definitions in the reporting seed block', () => {
    expect(reportingStart).toBeGreaterThan(-1);
    expect(reportingEnd).toBeGreaterThan(reportingStart);
    expect(seededDataSources).toHaveLength(4);
  });

  it.each(seededDataSources)('supports seeded data_source %s in run-report', (dataSource) => {
    expect(DATA_SOURCE_TABLE[dataSource]).toBeTruthy();
  });

  it('keeps the weekly schedule attached to the renamed, executable leave report', () => {
    expect(seededReportBlock).toContain("data_source: 'leave_requests'");
    expect(seededReportBlock).toContain('reportByName.get(scheduledReportName)');
  });
});

describe('visual report execution plan', () => {
  it('allows only readonly and edit report permission levels', () => {
    expect(permitsReportAccess('readonly')).toBe(true);
    expect(permitsReportAccess('edit')).toBe(true);
    expect(permitsReportAccess('none')).toBe(false);
    expect(permitsReportAccess(undefined)).toBe(false);
    expect(permitsReportAccess(null)).toBe(false);
  });

  it.each(templates.map((template) => [template.id, template] as const))(
    'accepts every built-in template: %s',
    (_id, template) => {
      expect(DATA_SOURCE_TABLE[template.data_source]).toBeTruthy();
      const plan = createVisualReportExecutionPlan(template.config);
      expect(plan.outputLimit).toBe(template.config.limit ?? 1000);
      if (plan.isAggregated) {
        expect(plan.rawScanLimit).toBe(RAW_REPORT_SCAN_CAP);
        const outputFields = new Set([
          ...plan.groupBy,
          ...plan.aggregations.map((aggregation) => aggregation.alias),
        ]);
        for (const directive of plan.sort) expect(outputFields.has(directive.field)).toBe(true);
      }
    },
  );

  it('sorts aggregate aliases stably before applying the leaderboard output limit', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      decided_by: `user-${String(index).padStart(2, '0')}`,
      decisions: index % 5,
    }));
    const output = sortAndLimitReportRows(rows, [{ field: 'decisions', dir: 'desc' }], 20);

    expect(output).toHaveLength(20);
    expect(output.slice(0, 5).every((row) => row.decisions === 4)).toBe(true);
    expect(output.slice(0, 5).map((row) => row.decided_by)).toEqual([
      'user-04', 'user-09', 'user-14', 'user-19', 'user-24',
    ]);
  });

  it('does not let a leaderboard output limit truncate the raw aggregation scan', () => {
    const approvalTemplate = templates.find((template) => template.id === 'tpl_approval_bottleneck');
    expect(approvalTemplate).toBeTruthy();
    const plan = createVisualReportExecutionPlan(approvalTemplate?.config);
    expect(plan.outputLimit).toBe(20);
    expect(plan.rawScanLimit).toBe(RAW_REPORT_SCAN_CAP);
  });

  it('loads memberships display_name through user_id enrichment and projects only requested fields', () => {
    const config = {
      fields: ['display_name'],
      filters: [],
      group_by: [],
      aggregations: [],
      sort: [],
      limit: 100,
    };
    const executionPlan = createVisualReportExecutionPlan(config);
    const fieldPlan = createVisualReportFieldPlan('memberships', config, executionPlan);

    expect(fieldPlan).toEqual({
      requestedFields: ['display_name'],
      selectFields: 'user_id',
      enrichMembershipProfiles: true,
    });
    expect(projectRequestedReportFields([
      { user_id: 'user-1', display_name: 'Ada Lovelace' },
    ], fieldPlan.requestedFields)).toEqual([{ display_name: 'Ada Lovelace' }]);
  });

  it.each([
    { filters: [{ field: 'display_name', operator: 'like', value: 'Ada' }] },
    { group_by: ['display_name'] },
    { aggregations: [{ field: 'display_name', fn: 'count', alias: 'names' }] },
    { sort: [{ field: 'display_name', dir: 'asc' }] },
  ])('rejects unsupported database operations on the virtual display_name field: $filters$group_by$aggregations$sort', (override) => {
    const config = {
      fields: ['display_name'],
      filters: [],
      group_by: [],
      aggregations: [],
      sort: [],
      ...override,
    };
    const executionPlan = createVisualReportExecutionPlan(config);
    expect(() => createVisualReportFieldPlan('memberships', config, executionPlan))
      .toThrow(/virtuális mező/);
  });
});

describe('SQL mode UI/backend contract', () => {
  it('keeps the UI table allowlist equal to the backend allowlist', () => {
    expect([...SQL_MODE_ALLOWED_TABLES].sort()).toEqual([...ALLOWED_TABLES].sort());
  });

  it('accepts the exact example displayed by SqlMode', () => {
    expect(parseReportSql(SQL_MODE_EXAMPLE)).toEqual({
      selectFields: 'business_role,percentage',
      table: 'enterprise_member_role_allocations',
      orderBy: { field: 'business_role', dir: 'asc' },
      limit: 100,
    });
  });

  it('persists the displayed example and restores existing SQL reports in SQL mode', () => {
    const builderSource = readFileSync(
      join(root, 'src', 'components', 'enterprise', 'reports', 'ReportBuilder.tsx'),
      'utf8',
    );
    expect(builderSource).toContain("existing?.config.sql ? 'sql' : 'visual'");
    expect(builderSource).toContain('existing?.config.sql || SQL_MODE_EXAMPLE');
    expect(builderSource).toContain('normalizeReportConfig(existing?.config)');
  });

  it('normalizes a saved SQL-only config before switching back to the visual editor', () => {
    expect(normalizeReportConfig({ sql: SQL_MODE_EXAMPLE })).toEqual({
      sql: SQL_MODE_EXAMPLE,
      fields: [],
      filters: [],
      group_by: [],
      aggregations: [],
      sort: [],
    });
  });

  it('keeps an intentionally cleared SQL editor empty', () => {
    const sqlModeSource = readFileSync(
      join(root, 'src', 'components', 'enterprise', 'reports', 'SqlMode.tsx'),
      'utf8',
    );
    expect(sqlModeSource).toContain('value={value}');
    expect(sqlModeSource).not.toContain('value={value || SQL_MODE_EXAMPLE}');
  });

  it.each([
    '-- comment\nSELECT * FROM enterprise_memberships',
    'SELECT COUNT(*) AS people FROM enterprise_memberships',
    'SELECT role FROM enterprise_memberships GROUP BY role',
    'SELECT role FROM enterprise_memberships WHERE status = active',
  ])('rejects syntax the constrained UI no longer advertises: %s', (sql) => {
    expect(() => parseReportSql(sql)).toThrow();
  });
});

describe('payroll profile lookup contract', () => {
  it('loads profiles through bounded, deduplicated user_id batches', async () => {
    const batches: string[][] = [];
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(async (_column: string, values: string[]) => {
            batches.push(values);
            return {
              data: values.map((userId) => ({ user_id: userId, display_name: `Name ${userId}` })),
              error: null,
            };
          }),
        })),
      })),
    } as unknown as ProfileLookupClient;
    const userIds = Array.from({ length: PROFILE_LOOKUP_BATCH_SIZE + 5 }, (_, index) => `user-${index}`);
    userIds.push('user-0');

    const names = await loadProfileNamesByUserId(client, userIds);

    expect(batches.map((batch) => batch.length)).toEqual([PROFILE_LOOKUP_BATCH_SIZE, 5]);
    expect(names.size).toBe(PROFILE_LOOKUP_BATCH_SIZE + 5);
    expect(names.get('user-204')).toBe('Name user-204');
  });

  it('fails closed when any profile batch cannot be loaded', async () => {
    const client = {
      from: () => ({
        select: () => ({
          in: async () => ({ data: null, error: { message: 'profile lookup failed' } }),
        }),
      }),
    } as ProfileLookupClient;

    await expect(loadProfileNamesByUserId(client, ['user-1']))
      .rejects.toThrow('Failed to load member profiles: profile lookup failed');
  });

  it('uses profile lookup only for live calculation and stored snapshots for CSV export', () => {
    const payrollSource = readFileSync(
      join(root, 'supabase', 'functions', 'payroll-export', 'index.ts'),
      'utf8',
    );
    expect(payrollSource).not.toContain('profiles:user_id');
    expect(payrollSource).toContain('await loadProfileNamesByUserId(');
    expect(payrollSource).toContain("if (action === 'calculate-period')");
    expect(payrollSource).toContain("if (action === 'export-csv')");

    const exportStart = payrollSource.indexOf("if (action === 'export-csv')");
    const exportEnd = payrollSource.indexOf("if (action === 'export-api')", exportStart);
    const exportBranch = payrollSource.slice(exportStart, exportEnd);
    expect(payrollSource.match(/await calculatePeriod\(admin, workspaceId, periodId\)/g)).toHaveLength(1);
    expect(exportBranch).toContain('await storedCalculation(period)');
    expect(exportBranch).not.toContain('calculateOpenPeriod');
    expect(exportBranch).not.toContain('loadProfileNamesByUserId');
  });
});
