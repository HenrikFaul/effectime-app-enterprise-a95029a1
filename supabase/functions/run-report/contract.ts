export const ALLOWED_TABLES = new Set([
  'enterprise_memberships',
  'enterprise_member_role_allocations',
  'enterprise_teams',
  'enterprise_team_roles',
  'enterprise_offices',
  'enterprise_holidays',
  'enterprise_company_leave_days',
  'enterprise_blocked_dates',
  'enterprise_daily_rules',
  'leave_requests',
  'approval_decisions',
  'enterprise_audit_events',
  'enterprise_role_definitions',
]);

export const DATA_SOURCE_TABLE: Record<string, string> = {
  memberships: 'enterprise_memberships',
  leave_requests: 'leave_requests',
  approval_decisions: 'approval_decisions',
  role_allocations: 'enterprise_member_role_allocations',
  audit_events: 'enterprise_audit_events',
  holidays: 'enterprise_holidays',
  company_leave_days: 'enterprise_company_leave_days',
};

export const RAW_REPORT_SCAN_CAP = 5000;
export const DEFAULT_REPORT_OUTPUT_LIMIT = 1000;

export function permitsReportAccess(accessLevel: unknown): boolean {
  return accessLevel === 'readonly' || accessLevel === 'edit';
}

const SIMPLE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
const AGGREGATION_FUNCTIONS = new Set(['count', 'sum', 'avg', 'min', 'max']);

export interface ReportSort {
  field: string;
  dir: 'asc' | 'desc';
}

export interface ReportAggregation {
  field: string;
  fn: 'count' | 'sum' | 'avg' | 'min' | 'max';
  alias: string;
}

export interface VisualReportExecutionPlan {
  groupBy: string[];
  aggregations: ReportAggregation[];
  sort: ReportSort[];
  isAggregated: boolean;
  outputLimit: number;
  rawScanLimit: number;
}

export interface VisualReportFieldPlan {
  requestedFields: string[];
  selectFields: string;
  enrichMembershipProfiles: boolean;
}

export interface ParsedReportSql {
  selectFields: string;
  table: string;
  orderBy?: ReportSort;
  limit?: number;
}

export function validateIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SIMPLE_IDENTIFIER.test(value)) {
    throw new Error(`Érvénytelen ${label}.`);
  }
  return value;
}

export function referencedTables(sqlRaw: string): string[] {
  const lower = sqlRaw.toLowerCase();
  return (lower.match(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/g) || [])
    .map((entry) => entry.replace(/\b(?:from|join)\s+/, '').trim());
}

function normalizedOutputLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REPORT_OUTPUT_LIMIT;
  return Math.min(Math.floor(parsed), RAW_REPORT_SCAN_CAP);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Érvénytelen ${label}.`);
  }
  return value as Record<string, unknown>;
}

export function createVisualReportExecutionPlan(config: unknown): VisualReportExecutionPlan {
  const record = typeof config === 'object' && config !== null
    ? config as Record<string, unknown>
    : {};
  const rawGroupBy = Array.isArray(record.group_by) ? record.group_by : [];
  const groupBy = rawGroupBy.map((field) => validateIdentifier(field, 'csoportosítási mező'));

  const rawAggregations = Array.isArray(record.aggregations) ? record.aggregations : [];
  const aggregations = rawAggregations.map((item): ReportAggregation => {
    const aggregation = asRecord(item, 'aggregáció');
    const field = validateIdentifier(aggregation.field, 'aggregációs mező');
    if (typeof aggregation.fn !== 'string' || !AGGREGATION_FUNCTIONS.has(aggregation.fn)) {
      throw new Error('Érvénytelen aggregációs függvény.');
    }
    const alias = validateIdentifier(
      aggregation.alias ?? `${aggregation.fn}_${field}`,
      'aggregációs alias',
    );
    return {
      field,
      fn: aggregation.fn as ReportAggregation['fn'],
      alias,
    };
  });

  const isAggregated = groupBy.length > 0 || aggregations.length > 0;
  const aggregateOutputFields = new Set([
    ...groupBy,
    ...aggregations.map((aggregation) => aggregation.alias),
  ]);
  const rawSort = Array.isArray(record.sort) ? record.sort : [];
  const sort = rawSort.map((item): ReportSort => {
    const directive = asRecord(item, 'rendezés');
    const field = validateIdentifier(directive.field, 'rendezési mező');
    const dir = directive.dir === 'desc' ? 'desc' : 'asc';
    if (isAggregated && !aggregateOutputFields.has(field)) {
      throw new Error(`Az aggregált riport nem rendezhető erre a mezőre: "${field}".`);
    }
    return { field, dir };
  });

  const outputLimit = normalizedOutputLimit(record.limit);
  return {
    groupBy,
    aggregations,
    sort,
    isAggregated,
    outputLimit,
    rawScanLimit: isAggregated ? RAW_REPORT_SCAN_CAP : outputLimit,
  };
}

/**
 * Translate visual-builder fields into real database columns. `display_name`
 * is a memberships-only virtual field populated from profiles after the
 * workspace-scoped membership query has completed.
 */
export function createVisualReportFieldPlan(
  dataSource: string,
  config: unknown,
  executionPlan: VisualReportExecutionPlan,
): VisualReportFieldPlan {
  const record = typeof config === 'object' && config !== null
    ? config as Record<string, unknown>
    : {};
  const rawFields = Array.isArray(record.fields) ? record.fields : [];
  const requestedFields = rawFields.map((field) => validateIdentifier(field, 'mezőnév'));
  const virtualFields = dataSource === 'memberships'
    ? new Set(['display_name'])
    : new Set<string>();

  const rejectVirtualOperation = (field: string, operation: string) => {
    if (virtualFields.has(field)) {
      throw new Error(
        `A(z) "${field}" virtuális mező jelenleg nem használható ${operation}.`,
      );
    }
  };

  const filters = Array.isArray(record.filters) ? record.filters : [];
  for (const rawFilter of filters) {
    const filter = asRecord(rawFilter, 'szűrő');
    if (filter.field === undefined || filter.field === '') continue;
    const field = validateIdentifier(filter.field, 'szűrőmező');
    rejectVirtualOperation(field, 'adatbázis-szűrésre');
  }
  executionPlan.groupBy.forEach((field) => rejectVirtualOperation(field, 'csoportosításra'));
  executionPlan.aggregations.forEach((item) =>
    rejectVirtualOperation(item.field, 'aggregációra'));
  executionPlan.sort.forEach((item) => rejectVirtualOperation(item.field, 'rendezésre'));

  const scanFields = new Set(requestedFields.filter((field) => !virtualFields.has(field)));
  executionPlan.groupBy.forEach((field) => scanFields.add(field));
  executionPlan.aggregations
    .filter((aggregation) => aggregation.fn !== 'count')
    .forEach((aggregation) => scanFields.add(aggregation.field));

  const enrichMembershipProfiles = dataSource === 'memberships'
    && (requestedFields.length === 0 || requestedFields.includes('display_name'));
  if (enrichMembershipProfiles && requestedFields.length > 0) scanFields.add('user_id');

  return {
    requestedFields,
    selectFields: requestedFields.length > 0 ? [...scanFields].join(',') : '*',
    enrichMembershipProfiles,
  };
}

export function projectRequestedReportFields(
  rows: Record<string, unknown>[],
  requestedFields: string[],
): Record<string, unknown>[] {
  if (requestedFields.length === 0) return rows;
  return rows.map((row) => Object.fromEntries(
    requestedFields.map((field) => [field, row[field] ?? null]),
  ));
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' });
}

export function sortAndLimitReportRows(
  rows: Record<string, unknown>[],
  sort: ReportSort[],
  limit: number,
): Record<string, unknown>[] {
  const decorated = rows.map((row, index) => ({ row, index }));
  if (sort.length > 0) {
    decorated.sort((left, right) => {
      for (const directive of sort) {
        const leftValue = left.row[directive.field];
        const rightValue = right.row[directive.field];
        if (leftValue === null || leftValue === undefined) {
          if (rightValue === null || rightValue === undefined) continue;
          return 1;
        }
        if (rightValue === null || rightValue === undefined) return -1;
        const compared = compareValues(leftValue, rightValue);
        if (compared !== 0) return directive.dir === 'desc' ? -compared : compared;
      }
      return left.index - right.index;
    });
  }
  return decorated.slice(0, limit).map(({ row }) => row);
}

/** Parse the intentionally small SQL-like report DSL. No SQL is executed. */
export function parseReportSql(sqlRaw: string): ParsedReportSql {
  const trimmed = sqlRaw.trim();
  const sql = (trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed).trim();
  const lower = sql.toLowerCase();

  if (!lower.startsWith('select')) throw new Error('Csak SELECT lekérdezések engedélyezettek.');
  const forbidden = [
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
    'grant', 'revoke', '--', '/*', '*/', ';', 'pg_', 'auth.', 'storage.',
    'information_schema',
  ];
  for (const word of forbidden) {
    if (lower.includes(word)) throw new Error(`Nem engedélyezett kulcsszó: "${word}"`);
  }
  if (/\bjoin\b/i.test(sql)) throw new Error('A SQL mód nem támogat JOIN műveletet.');

  const directMatch = sql.match(/^select\s+(.+?)\s+from\s+([a-z_][a-z0-9_]*)([\s\S]*)$/i);
  if (!directMatch) {
    throw new Error('Egyszerű "SELECT mezők FROM tábla [ORDER BY mező] [LIMIT szám]" alak támogatott.');
  }
  const [, fieldsPartRaw, table, restRaw] = directMatch;
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Nem engedélyezett tábla: "${table}"`);

  const fieldsPart = fieldsPartRaw.trim();
  const selectFields = fieldsPart === '*'
    ? '*'
    : fieldsPart.split(',').map((field) => validateIdentifier(field.trim(), 'SELECT mező')).join(',');

  const rest = restRaw.trim();
  const restMatch = rest.match(
    /^(?:order\s+by\s+([a-z_][a-z0-9_]*)(?:\s+(asc|desc))?)?(?:\s*limit\s+(\d+))?$/i,
  );
  if (!restMatch) {
    throw new Error('A SQL mód csak opcionális, egyszerű ORDER BY és LIMIT záradékot támogat.');
  }
  const orderBy = restMatch[1]
    ? {
      field: validateIdentifier(restMatch[1], 'rendezési mező'),
      dir: restMatch[2]?.toLowerCase() === 'desc' ? 'desc' as const : 'asc' as const,
    }
    : undefined;
  const limit = restMatch[3]
    ? Math.min(Number.parseInt(restMatch[3], 10), RAW_REPORT_SCAN_CAP)
    : undefined;

  return { selectFields, table, orderBy, limit };
}
