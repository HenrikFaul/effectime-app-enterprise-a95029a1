import { eachDayOfInterval, format, isValid } from 'date-fns';
import {
  escapeXmlText,
  generateCSV,
  generateExcelXML,
} from '@/components/enterprise/import-export/utils/file-parser';

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
}

interface LegacyExportQuery<TRow> extends PromiseLike<QueryResult<TRow>> {
  select(columns: string): LegacyExportQuery<TRow>;
  eq(column: string, value: string): LegacyExportQuery<TRow>;
  gte(column: string, value: string): LegacyExportQuery<TRow>;
  lte(column: string, value: string): LegacyExportQuery<TRow>;
  in(column: string, values: string[]): LegacyExportQuery<TRow>;
  order(column: string): LegacyExportQuery<TRow>;
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
  is_half_day?: boolean | null;
  half_day_period?: string | null;
  comment?: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name?: string | null;
}

interface MembershipRow {
  user_id: string;
  team?: string | null;
  business_role?: string | null;
}

interface HolidayRow {
  holiday_date: string;
  name?: string | null;
}

interface CompanyDayRow {
  leave_date: string;
  name?: string | null;
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

async function queryRowsOrThrow<TRow>(
  query: PromiseLike<QueryResult<TRow>>,
  code: LegacyLeaveExportErrorCode
): Promise<TRow[]> {
  try {
    const result = await query;
    if (result.error || !Array.isArray(result.data)) {
      throw new LegacyLeaveExportError(code);
    }
    return result.data;
  } catch (error) {
    if (error instanceof LegacyLeaveExportError) throw error;
    throw new LegacyLeaveExportError(code);
  }
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
      || result.error
    ) {
      throw new LegacyLeaveExportError(code);
    }
  } catch (error) {
    if (error instanceof LegacyLeaveExportError) throw error;
    throw new LegacyLeaveExportError(code);
  }
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
  const rows = await queryRowsOrThrow(
    client
      .from<MembershipRow>('enterprise_memberships')
      .select('user_id, team, business_role')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('user_id'),
    'FILTER_OPTIONS_QUERY_FAILED'
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
  if (labels.dayNames.length !== 7 || labels.headers.length !== 11) {
    throw new LegacyLeaveExportError('UNSUPPORTED_FORMAT');
  }

  const startDate = format(request.startDate, 'yyyy-MM-dd');
  const endDate = format(request.endDate, 'yyyy-MM-dd');
  let leaveQuery = client
    .from<LeaveRequestRow>('leave_requests')
    .select('id, user_id, start_date, end_date, leave_type, status, is_half_day, half_day_period, comment')
    .eq('workspace_id', request.workspaceId)
    .lte('start_date', endDate)
    .gte('end_date', startDate);
  if (request.statusFilter !== 'all') {
    leaveQuery = leaveQuery.eq('status', request.statusFilter);
  }
  const requests = await queryRowsOrThrow(
    leaveQuery.order('start_date').order('id'),
    'LEAVE_QUERY_FAILED'
  );

  const userIds = [...new Set(requests.map((row) => row.user_id))];
  let profiles: ProfileRow[] = [];
  let memberships: MembershipRow[] = [];
  if (userIds.length > 0) {
    [profiles, memberships] = await Promise.all([
      queryRowsOrThrow(
        client.from<ProfileRow>('profiles').select('user_id, display_name').in('user_id', userIds).order('user_id'),
        'PROFILE_QUERY_FAILED'
      ),
      queryRowsOrThrow(
        client
          .from<MembershipRow>('enterprise_memberships')
          .select('user_id, team, business_role')
          .eq('workspace_id', request.workspaceId)
          .in('user_id', userIds)
          .order('user_id'),
        'MEMBERSHIP_QUERY_FAILED'
      ),
    ]);
  }

  const [holidays, companyDays] = await Promise.all([
    queryRowsOrThrow(
      client
        .from<HolidayRow>('enterprise_holidays')
        .select('holiday_date, name')
        .eq('workspace_id', request.workspaceId)
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate)
        .order('holiday_date'),
      'HOLIDAY_QUERY_FAILED'
    ),
    queryRowsOrThrow(
      client
        .from<CompanyDayRow>('enterprise_company_leave_days')
        .select('leave_date, name')
        .eq('workspace_id', request.workspaceId)
        .gte('leave_date', startDate)
        .lte('leave_date', endDate)
        .order('leave_date'),
      'COMPANY_DAY_QUERY_FAILED'
    ),
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
  for (const day of eachDayOfInterval({ start: request.startDate, end: request.endDate })) {
    const date = format(day, 'yyyy-MM-dd');
    const dayRequests = filteredRequests.filter(
      (row) => row.start_date <= date && row.end_date >= date
    );
    const holiday = holidayByDate.get(date) || '';
    const companyDay = companyDayByDate.get(date) || '';
    if (dayRequests.length === 0) {
      rows.push([date, labels.dayNames[day.getDay()], '', '', '', '', '', '', holiday, companyDay, '']);
      continue;
    }
    for (const leave of dayRequests) {
      const membership = membershipByUser.get(leave.user_id);
      const halfDay = leave.is_half_day
        ? leave.half_day_period === 'morning'
          ? labels.halfDayMorning
          : labels.halfDayAfternoon
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
          delivery: 'browser_download_requested',
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
