import { differenceInCalendarDays, eachDayOfInterval, format, isValid } from 'date-fns';
import {
  escapeXmlText,
  generateCSV,
  generateExcelXML,
} from '@/components/enterprise/import-export/utils/file-parser';
import {
  fetchCompleteExportRows,
  MAX_EXPORT_SOURCE_ROWS,
} from '@/lib/exportPagination';
import { maxExportArtifactDataRows } from '@/lib/exportArtifactLimits';
import {
  defineExportRowSchema,
  matchesExportRowSchema,
} from '@/lib/exportRowValidation';

export type LegacyLeaveExportFormat = 'csv' | 'xls' | 'xml' | 'html';

export type LegacyLeaveExportErrorCode =
  | 'INVALID_DATE_RANGE'
  | 'UNSUPPORTED_FORMAT'
  | 'FILTER_OPTIONS_QUERY_FAILED'
  | 'LEAVE_QUERY_FAILED'
  | 'PROFILE_QUERY_FAILED'
  | 'MEMBERSHIP_QUERY_FAILED'
  | 'HOLIDAY_QUERY_FAILED'
  | 'COMPANY_DAY_QUERY_FAILED'
  | 'AUDIT_QUERY_FAILED'
  | 'ARTIFACT_ROW_LIMIT_EXCEEDED'
  | 'ARTIFACT_GENERATION_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'STALE_SCOPE';

export class LegacyLeaveExportError extends Error {
  readonly code: LegacyLeaveExportErrorCode;

  constructor(code: LegacyLeaveExportErrorCode) {
    super('Unable to create leave export.');
    this.name = 'LegacyLeaveExportError';
    this.code = code;
  }
}

interface QueryResult<TRow> {
  data: TRow[] | null;
  error: unknown;
  count?: number | null;
}

interface LegacyExportQuery<TRow> extends PromiseLike<QueryResult<TRow>> {
  select(
    columns: string,
    options?: { count?: 'exact'; head?: boolean }
  ): LegacyExportQuery<TRow>;
  eq(column: string, value: string): LegacyExportQuery<TRow>;
  gte(column: string, value: string): LegacyExportQuery<TRow>;
  lte(column: string, value: string): LegacyExportQuery<TRow>;
  in(column: string, values: string[]): LegacyExportQuery<TRow>;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): LegacyExportQuery<TRow>;
  range(from: number, to: number): LegacyExportQuery<TRow>;
  insert(values: Record<string, unknown>): PromiseLike<QueryResult<TRow>>;
}

export interface LegacyLeaveExportClient {
  from<TRow>(table: string): LegacyExportQuery<TRow>;
}

interface LeaveRequestRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  is_half_day: boolean;
  half_day_period: string | null;
  comment: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

interface MembershipRow {
  id: string;
  user_id: string;
  team: string | null;
  business_role: string | null;
}

interface HolidayRow {
  id: string;
  holiday_date: string;
  name: string;
}

interface CompanyDayRow {
  id: string;
  leave_date: string;
  name: string;
}

const LEAVE_REQUEST_ROW_SCHEMA = defineExportRowSchema<LeaveRequestRow>({
  id: 'nonEmptyString',
  user_id: 'nonEmptyString',
  start_date: 'nonEmptyString',
  end_date: 'nonEmptyString',
  leave_type: 'nonEmptyString',
  status: 'nonEmptyString',
  is_half_day: 'boolean',
  half_day_period: 'nullableString',
  comment: 'nullableString',
});

const PROFILE_ROW_SCHEMA = defineExportRowSchema<ProfileRow>({
  user_id: 'nonEmptyString',
  display_name: 'nullableString',
});

const MEMBERSHIP_ROW_SCHEMA = defineExportRowSchema<MembershipRow>({
  id: 'nonEmptyString',
  user_id: 'nonEmptyString',
  team: 'nullableString',
  business_role: 'nullableString',
});

const HOLIDAY_ROW_SCHEMA = defineExportRowSchema<HolidayRow>({
  id: 'nonEmptyString',
  holiday_date: 'nonEmptyString',
  name: 'string',
});

const COMPANY_DAY_ROW_SCHEMA = defineExportRowSchema<CompanyDayRow>({
  id: 'nonEmptyString',
  leave_date: 'nonEmptyString',
  name: 'string',
});

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

function isLeaveRequestRow(value: unknown): value is LeaveRequestRow {
  if (!matchesExportRowSchema(value, LEAVE_REQUEST_ROW_SCHEMA)) return false;
  const row = value as Record<string, unknown>;
  // Existing writes do not enforce the boolean/period cross-field invariant.
  // Accept persisted enum/null shapes and render only an exact period below;
  // a future DB cleanup + CHECK can safely tighten the relationship.
  const halfDayPeriodIsValid = row.half_day_period === null
    || row.half_day_period === ''
    || row.half_day_period === 'morning'
    || row.half_day_period === 'afternoon';
  return halfDayPeriodIsValid
    && isIsoDate(row.start_date)
    && isIsoDate(row.end_date)
    && row.start_date <= row.end_date;
}

function isHolidayRow(value: unknown): value is HolidayRow {
  return matchesExportRowSchema(value, HOLIDAY_ROW_SCHEMA)
    && isIsoDate((value as Record<string, unknown>).holiday_date);
}

function isCompanyDayRow(value: unknown): value is CompanyDayRow {
  return matchesExportRowSchema(value, COMPANY_DAY_ROW_SCHEMA)
    && isIsoDate((value as Record<string, unknown>).leave_date);
}

interface AuditInsertRow {
  id?: string;
}

export interface LegacyLeaveExportLabels {
  dayNames: string[];
  headers: string[];
  unknownPerson: string;
  leaveType: Record<string, string>;
  leaveStatus: Record<string, string>;
  halfDayMorning: string;
  halfDayAfternoon: string;
  htmlTitle: string;
  htmlDateRows: (start: string, end: string, rowCount: number) => string;
}

export interface LegacyLeaveExportRequest {
  workspaceId: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  statusFilter: string;
  teamFilter: string;
  roleFilter: string;
  format: LegacyLeaveExportFormat;
}

export interface LegacyLeaveExportArtifact {
  content: string;
  fileName: string;
  mimeType: string;
}

export interface LegacyLeaveExportResult {
  rowCount: number;
  artifact: LegacyLeaveExportArtifact;
}

export type LegacyLeaveExportDownload = (artifact: LegacyLeaveExportArtifact) => void;

const ENRICHMENT_USER_BATCH_SIZE = 200;

async function fetchRowsOrThrow<TRow>(
  fetchPage: (
    from: number,
    to: number,
    includeExactCount: boolean
  ) => unknown | PromiseLike<unknown>,
  fetchFinalCount: () => unknown | PromiseLike<unknown>,
  identity: (row: TRow) => unknown,
  validateRow: (row: unknown) => row is TRow,
  code: LegacyLeaveExportErrorCode
): Promise<TRow[]> {
  try {
    return await fetchCompleteExportRows<TRow>({
      fetchPage,
      fetchFinalCount,
      identity,
      validateRow,
    });
  } catch {
    throw new LegacyLeaveExportError(code);
  }
}

async function fetchBatchedRowsOrThrow<TRow>(
  userIds: string[],
  fetchBatch: (userIdBatch: string[]) => Promise<TRow[]>,
  identity: (row: TRow) => unknown,
  code: LegacyLeaveExportErrorCode
): Promise<TRow[]> {
  const rows: TRow[] = [];
  const seenIds = new Set<string>();
  for (let offset = 0; offset < userIds.length; offset += ENRICHMENT_USER_BATCH_SIZE) {
    const batchRows = await fetchBatch(
      userIds.slice(offset, offset + ENRICHMENT_USER_BATCH_SIZE)
    );
    for (const row of batchRows) {
      let value: unknown;
      try {
        value = identity(row);
      } catch {
        throw new LegacyLeaveExportError(code);
      }
      const id = typeof value === 'string' ? value.trim() : '';
      if (id.length === 0 || seenIds.has(id)) {
        throw new LegacyLeaveExportError(code);
      }
      if (rows.length >= MAX_EXPORT_SOURCE_ROWS) {
        throw new LegacyLeaveExportError(code);
      }
      seenIds.add(id);
      rows.push(row);
    }
  }
  return rows;
}

async function querySuccessOrThrow<TRow>(
  query: PromiseLike<QueryResult<TRow>>,
  code: LegacyLeaveExportErrorCode
): Promise<void> {
  try {
    const result = await query;
    if (
      typeof result !== 'object'
      || result === null
      || !('error' in result)
      || result.error !== null
    ) {
      throw new LegacyLeaveExportError(code);
    }
  } catch (error) {
    if (error instanceof LegacyLeaveExportError) throw error;
    throw new LegacyLeaveExportError(code);
  }
}

function fetchMembershipRows(
  client: LegacyLeaveExportClient,
  workspaceId: string,
  code: LegacyLeaveExportErrorCode,
  options: { userIds?: string[]; activeOnly?: boolean } = {}
): Promise<MembershipRow[]> {
  const applyFilters = (source: LegacyExportQuery<MembershipRow>) => {
    let query = source.eq('workspace_id', workspaceId);
    if (options.activeOnly) query = query.eq('status', 'active');
    if (options.userIds) query = query.in('user_id', options.userIds);
    return query;
  };

  return fetchRowsOrThrow<MembershipRow>(
    (from, to, includeExactCount) => applyFilters(
      client
        .from<MembershipRow>('enterprise_memberships')
        .select(
          'id, user_id, team, business_role',
          includeExactCount ? { count: 'exact', head: false } : undefined
        )
    )
      .order('id', { ascending: true })
      .range(from, to),
    () => applyFilters(
      client
        .from<MembershipRow>('enterprise_memberships')
        .select('id', { count: 'exact', head: true })
    ),
    (row) => row.id,
    (row) => matchesExportRowSchema(row, MEMBERSHIP_ROW_SCHEMA),
    code
  );
}

function fetchProfileRows(
  client: LegacyLeaveExportClient,
  userIds: string[]
): Promise<ProfileRow[]> {
  const applyFilters = (source: LegacyExportQuery<ProfileRow>) =>
    source.in('user_id', userIds);

  return fetchRowsOrThrow<ProfileRow>(
    (from, to, includeExactCount) => applyFilters(
      client
        .from<ProfileRow>('profiles')
        .select(
          'user_id, display_name',
          includeExactCount ? { count: 'exact', head: false } : undefined
        )
    )
      .order('user_id', { ascending: true })
      .range(from, to),
    () => applyFilters(
      client
        .from<ProfileRow>('profiles')
        .select('user_id', { count: 'exact', head: true })
    ),
    (row) => row.user_id,
    (row) => matchesExportRowSchema(row, PROFILE_ROW_SCHEMA),
    'PROFILE_QUERY_FAILED'
  );
}

function fetchLeaveRequestRows(
  client: LegacyLeaveExportClient,
  request: LegacyLeaveExportRequest,
  startDate: string,
  endDate: string
): Promise<LeaveRequestRow[]> {
  const applyFilters = (source: LegacyExportQuery<LeaveRequestRow>) => {
    let query = source
      .eq('workspace_id', request.workspaceId)
      .lte('start_date', endDate)
      .gte('end_date', startDate);
    if (request.statusFilter !== 'all') {
      query = query.eq('status', request.statusFilter);
    }
    return query;
  };

  return fetchRowsOrThrow<LeaveRequestRow>(
    (from, to, includeExactCount) => applyFilters(
      client
        .from<LeaveRequestRow>('leave_requests')
        .select(
          'id, user_id, start_date, end_date, leave_type, status, is_half_day, half_day_period, comment',
          includeExactCount ? { count: 'exact', head: false } : undefined
        )
    )
      .order('start_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    () => applyFilters(
      client
        .from<LeaveRequestRow>('leave_requests')
        .select('id', { count: 'exact', head: true })
    ),
    (row) => row.id,
    isLeaveRequestRow,
    'LEAVE_QUERY_FAILED'
  );
}

function fetchHolidayRows(
  client: LegacyLeaveExportClient,
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<HolidayRow[]> {
  const applyFilters = (source: LegacyExportQuery<HolidayRow>) => source
    .eq('workspace_id', workspaceId)
    .gte('holiday_date', startDate)
    .lte('holiday_date', endDate);

  return fetchRowsOrThrow<HolidayRow>(
    (from, to, includeExactCount) => applyFilters(
      client
        .from<HolidayRow>('enterprise_holidays')
        .select(
          'id, holiday_date, name',
          includeExactCount ? { count: 'exact', head: false } : undefined
        )
    )
      .order('holiday_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    () => applyFilters(
      client
        .from<HolidayRow>('enterprise_holidays')
        .select('id', { count: 'exact', head: true })
    ),
    (row) => row.id,
    isHolidayRow,
    'HOLIDAY_QUERY_FAILED'
  );
}

function fetchCompanyDayRows(
  client: LegacyLeaveExportClient,
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<CompanyDayRow[]> {
  const applyFilters = (source: LegacyExportQuery<CompanyDayRow>) => source
    .eq('workspace_id', workspaceId)
    .gte('leave_date', startDate)
    .lte('leave_date', endDate);

  return fetchRowsOrThrow<CompanyDayRow>(
    (from, to, includeExactCount) => applyFilters(
      client
        .from<CompanyDayRow>('enterprise_company_leave_days')
        .select(
          'id, leave_date, name',
          includeExactCount ? { count: 'exact', head: false } : undefined
        )
    )
      .order('leave_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    () => applyFilters(
      client
        .from<CompanyDayRow>('enterprise_company_leave_days')
        .select('id', { count: 'exact', head: true })
    ),
    (row) => row.id,
    isCompanyDayRow,
    'COMPANY_DAY_QUERY_FAILED'
  );
}

function buildXml(headers: string[], rows: string[][]): string {
  const tagName = (header: string) =>
    header
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';

  return `<?xml version="1.0" encoding="UTF-8"?>
<export>
${rows.map((row) => `  <record>\n${headers.map((header, index) => `    <${tagName(header)}>${escapeXmlText(row[index] ?? '')}</${tagName(header)}>`).join('\n')}\n  </record>`).join('\n')}
</export>`;
}

function buildHtml(
  headers: string[],
  rows: string[][],
  title: string,
  dateRowsLabel: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeXmlText(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 2rem; color: #1a1a2e; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th { background: #e2efda; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #ccc; }
  td { padding: 6px 10px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #f9f9f9; }
  @media print { body { padding: 0; } }
</style></head>
<body>
<h1>${escapeXmlText(title)}</h1>
<p class="meta">${escapeXmlText(dateRowsLabel)}</p>
<table>
<thead><tr>${headers.map((header) => `<th>${escapeXmlText(header)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeXmlText(cell)}</td>`).join('')}</tr>`).join('\n')}</tbody>
</table>
</body></html>`;
}

function buildArtifact(
  request: LegacyLeaveExportRequest,
  labels: LegacyLeaveExportLabels,
  rows: string[][]
): LegacyLeaveExportArtifact {
  const start = format(request.startDate, 'yyyyMMdd');
  const end = format(request.endDate, 'yyyyMMdd');
  const baseName = `effectime_export_${start}_${end}`;

  switch (request.format) {
    case 'csv':
      return {
        content: generateCSV(labels.headers, rows),
        fileName: `${baseName}.csv`,
        mimeType: 'text/csv;charset=utf-8',
      };
    case 'xls':
      return {
        content: generateExcelXML(labels.headers, rows, { sheetName: 'Leave_export' }),
        fileName: `${baseName}.xls`,
        mimeType: 'application/vnd.ms-excel',
      };
    case 'xml':
      return {
        content: buildXml(labels.headers, rows),
        fileName: `${baseName}.xml`,
        mimeType: 'application/xml',
      };
    case 'html':
      return {
        content: buildHtml(
          labels.headers,
          rows,
          labels.htmlTitle,
          labels.htmlDateRows(
            format(request.startDate, 'yyyy.MM.dd'),
            format(request.endDate, 'yyyy.MM.dd'),
            rows.length
          )
        ),
        fileName: `${baseName}.html`,
        mimeType: 'text/html;charset=utf-8',
      };
    default:
      throw new LegacyLeaveExportError('UNSUPPORTED_FORMAT');
  }
}

export async function loadLegacyLeaveExportFilterOptions(
  client: LegacyLeaveExportClient,
  workspaceId: string
): Promise<{ teams: string[]; roles: string[] }> {
  const rows = await fetchMembershipRows(
    client,
    workspaceId,
    'FILTER_OPTIONS_QUERY_FAILED',
    { activeOnly: true }
  );
  const teams = new Set<string>();
  const roles = new Set<string>();
  for (const row of rows) {
    if (row.team) teams.add(row.team);
    if (row.business_role) roles.add(row.business_role);
  }
  return {
    teams: [...teams].sort((a, b) => a.localeCompare(b)),
    roles: [...roles].sort((a, b) => a.localeCompare(b)),
  };
}

export async function executeLegacyLeaveExport(
  client: LegacyLeaveExportClient,
  request: LegacyLeaveExportRequest,
  labels: LegacyLeaveExportLabels,
  download: LegacyLeaveExportDownload,
  isCurrent: () => boolean = () => true
): Promise<LegacyLeaveExportResult> {
  if (
    !isValid(request.startDate)
    || !isValid(request.endDate)
    || request.startDate.getTime() > request.endDate.getTime()
  ) {
    throw new LegacyLeaveExportError('INVALID_DATE_RANGE');
  }
  if (!['csv', 'xls', 'xml', 'html'].includes(request.format)) {
    throw new LegacyLeaveExportError('UNSUPPORTED_FORMAT');
  }
  if (labels.dayNames.length !== 7 || labels.headers.length !== 11) {
    throw new LegacyLeaveExportError('UNSUPPORTED_FORMAT');
  }

  const maxArtifactRows = maxExportArtifactDataRows(request.format);
  const calendarDayCount = differenceInCalendarDays(
    request.endDate,
    request.startDate
  ) + 1;
  if (
    !Number.isSafeInteger(calendarDayCount)
    || calendarDayCount < 1
    || calendarDayCount > maxArtifactRows
  ) {
    throw new LegacyLeaveExportError('ARTIFACT_ROW_LIMIT_EXCEEDED');
  }

  const startDate = format(request.startDate, 'yyyy-MM-dd');
  const endDate = format(request.endDate, 'yyyy-MM-dd');
  const requests = (await fetchLeaveRequestRows(
    client,
    request,
    startDate,
    endDate
  )).sort((left, right) => (
    left.start_date.localeCompare(right.start_date)
    || left.id.localeCompare(right.id)
  ));

  const userIds = [...new Set(requests.map((row) => row.user_id))];
  let profiles: ProfileRow[] = [];
  let memberships: MembershipRow[] = [];
  if (userIds.length > 0) {
    [profiles, memberships] = await Promise.all([
      fetchBatchedRowsOrThrow(
        userIds,
        (userIdBatch) => fetchProfileRows(client, userIdBatch),
        (row) => row.user_id,
        'PROFILE_QUERY_FAILED'
      ),
      fetchBatchedRowsOrThrow(
        userIds,
        (userIdBatch) => fetchMembershipRows(
          client,
          request.workspaceId,
          'MEMBERSHIP_QUERY_FAILED',
          { userIds: userIdBatch }
        ),
        (row) => row.id,
        'MEMBERSHIP_QUERY_FAILED'
      ),
    ]);
  }

  const [holidays, companyDays] = await Promise.all([
    fetchHolidayRows(client, request.workspaceId, startDate, endDate),
    fetchCompanyDayRows(client, request.workspaceId, startDate, endDate),
  ]);

  const profileByUser = new Map(profiles.map((row) => [row.user_id, row.display_name || labels.unknownPerson]));
  const membershipByUser = new Map(memberships.map((row) => [row.user_id, row]));
  const holidayByDate = new Map(holidays.map((row) => [row.holiday_date, row.name || '']));
  const companyDayByDate = new Map(companyDays.map((row) => [row.leave_date, row.name || '']));

  const filteredRequests = requests.filter((row) => {
    const membership = membershipByUser.get(row.user_id);
    if (request.teamFilter !== 'all' && membership?.team !== request.teamFilter) return false;
    if (request.roleFilter !== 'all' && membership?.business_role !== request.roleFilter) return false;
    return true;
  });

  if (!isCurrent()) throw new LegacyLeaveExportError('STALE_SCOPE');

  const rows: string[][] = [];
  let nextRequestIndex = 0;
  let activeRequests: LeaveRequestRow[] = [];
  for (const day of eachDayOfInterval({ start: request.startDate, end: request.endDate })) {
    const date = format(day, 'yyyy-MM-dd');
    activeRequests = activeRequests.filter((row) => row.end_date >= date);
    while (
      nextRequestIndex < filteredRequests.length
      && filteredRequests[nextRequestIndex].start_date <= date
    ) {
      const candidate = filteredRequests[nextRequestIndex];
      if (candidate.end_date >= date) activeRequests.push(candidate);
      nextRequestIndex += 1;
    }

    const nextRowCount = Math.max(1, activeRequests.length);
    if (rows.length > maxArtifactRows - nextRowCount) {
      throw new LegacyLeaveExportError('ARTIFACT_ROW_LIMIT_EXCEEDED');
    }
    const holiday = holidayByDate.get(date) || '';
    const companyDay = companyDayByDate.get(date) || '';
    if (activeRequests.length === 0) {
      rows.push([date, labels.dayNames[day.getDay()], '', '', '', '', '', '', holiday, companyDay, '']);
      continue;
    }
    for (const leave of activeRequests) {
      const membership = membershipByUser.get(leave.user_id);
      const halfDay = leave.is_half_day
        ? leave.half_day_period === 'morning'
          ? labels.halfDayMorning
          : leave.half_day_period === 'afternoon'
            ? labels.halfDayAfternoon
            : ''
        : '';
      rows.push([
        date,
        labels.dayNames[day.getDay()],
        profileByUser.get(leave.user_id) || labels.unknownPerson,
        membership?.team || '',
        membership?.business_role || '',
        labels.leaveType[leave.leave_type] || leave.leave_type,
        labels.leaveStatus[leave.status] || leave.status,
        halfDay,
        holiday,
        companyDay,
        leave.comment || '',
      ]);
    }
  }

  let artifact: LegacyLeaveExportArtifact;
  try {
    artifact = buildArtifact(request, labels, rows);
  } catch (error) {
    if (error instanceof LegacyLeaveExportError) throw error;
    throw new LegacyLeaveExportError('ARTIFACT_GENERATION_FAILED');
  }
  if (!isCurrent()) throw new LegacyLeaveExportError('STALE_SCOPE');
  await querySuccessOrThrow(
    client
      .from<AuditInsertRow>('enterprise_audit_events')
      .insert({
        workspace_id: request.workspaceId,
        actor_id: request.userId,
        action: 'export.created',
        metadata: {
          start_date: startDate,
          end_date: endDate,
          row_count: rows.length,
          format: request.format,
          delivery: 'browser_download_pending',
        },
      }),
    'AUDIT_QUERY_FAILED'
  );

  if (!isCurrent()) throw new LegacyLeaveExportError('STALE_SCOPE');
  try {
    download(artifact);
  } catch {
    throw new LegacyLeaveExportError('DOWNLOAD_FAILED');
  }
  return { rowCount: rows.length, artifact };
}
