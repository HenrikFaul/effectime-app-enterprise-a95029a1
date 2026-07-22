import { supabase } from '@/integrations/supabase/client';
import type { EntityConfig } from '../config/entity-registry';

interface ExportQueryResult<TRow> {
  data: TRow[] | null;
  error: unknown;
}

interface ExportQuery<TRow> extends PromiseLike<ExportQueryResult<TRow>> {
  select(columns: string): ExportQuery<TRow>;
  eq(column: string, value: string): ExportQuery<TRow>;
  order(column: string): Promise<ExportQueryResult<TRow>>;
}

interface ExportDataClient {
  rpc<TRow>(name: string, params: Record<string, unknown>): Promise<ExportQueryResult<TRow>>;
  from<TRow>(table: string): ExportQuery<TRow>;
}

interface MemberExportRow {
  email?: string | null;
  display_name?: string | null;
  role?: string | null;
  status?: string | null;
  team?: string | null;
  business_role?: string | null;
  office_name?: string | null;
  org_unit_name?: string | null;
  city?: string | null;
  location?: string | null;
  base_working_hours?: string | number | null;
  weekly_capacity_hours?: string | number | null;
  joined_at?: string | null;
  manager_email?: string | null;
  subordinate_emails?: string | null;
  seniority?: string | null;
  leadership_level?: string | null;
  leadership_category?: string | null;
  contract_type?: string | null;
  employer_rights?: boolean | null;
  skills?: string | null;
  membership_id?: string | null;
  user_id?: string | null;
}

interface LeaveExportRow {
  email?: string | null;
  display_name?: string | null;
  team?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  leave_type?: string | null;
  status?: string | null;
  is_half_day?: boolean | null;
  half_day_period?: string | null;
  comment?: string | null;
}

interface OfficeExportRow {
  id: string;
  name?: string | null;
  city?: string | null;
  address?: string | null;
}

interface WorkCategoryExportRow {
  id: string;
  name?: string | null;
  is_active?: boolean | null;
}

interface JobRoleExportRow {
  id: string;
  name?: string | null;
  is_active?: boolean | null;
  category_id?: string | null;
}

interface JobRoleCategoryExportRow {
  id: string;
  name?: string | null;
}

interface PositionExportRow {
  business_role?: string | null;
}

interface SkillExportRow {
  id: string;
  name?: string | null;
  category?: string | null;
  color?: string | null;
}

const exportDataClient = supabase as unknown as ExportDataClient;

export const ENTITY_DATA_FETCH_ERROR_MESSAGE = 'Unable to load export data.';

export type EntityDataFetchErrorCode =
  | 'MEMBERS_QUERY_FAILED'
  | 'LEAVE_QUERY_FAILED'
  | 'OFFICES_QUERY_FAILED'
  | 'WORK_CATEGORIES_QUERY_FAILED'
  | 'JOB_ROLES_QUERY_FAILED'
  | 'JOB_ROLE_CATEGORIES_QUERY_FAILED'
  | 'POSITIONS_QUERY_FAILED'
  | 'SKILLS_QUERY_FAILED'
  | 'UNSUPPORTED_ENTITY';

/**
 * Stable client boundary for export-data lookup failures.
 *
 * Provider error text is intentionally not retained because it can contain
 * schema details, identifiers, or other data that must not reach the UI.
 */
export class EntityDataFetchError extends Error {
  readonly code: EntityDataFetchErrorCode;

  constructor(code: EntityDataFetchErrorCode) {
    super(ENTITY_DATA_FETCH_ERROR_MESSAGE);
    this.name = 'EntityDataFetchError';
    this.code = code;
  }
}

async function queryRowsOrThrow<TRow>(
  queryFactory: () => PromiseLike<unknown>,
  code: EntityDataFetchErrorCode
): Promise<TRow[]> {
  try {
    const result = await queryFactory();
    if (
      typeof result !== 'object'
      || result === null
      || !('error' in result)
      || result.error !== null
      || !('data' in result)
      || !Array.isArray(result.data)
    ) {
      throw new EntityDataFetchError(code);
    }
    return result.data as TRow[];
  } catch (error) {
    if (error instanceof EntityDataFetchError) throw error;
    throw new EntityDataFetchError(code);
  }
}

export async function fetchEntityRows(
  entity: EntityConfig,
  workspaceId: string,
  filters?: { startDate?: string; endDate?: string; statusFilter?: string }
): Promise<Record<string, string>[]> {
  switch (entity.key) {
    case 'members':
      return fetchMembers(workspaceId);
    case 'leave':
      return fetchLeave(workspaceId, filters);
    case 'offices':
      return fetchOffices(workspaceId);
    case 'work_categories':
      return fetchWorkCategories(workspaceId);
    case 'job_roles':
      return fetchJobRoles(workspaceId);
    case 'positions':
      return fetchPositions(workspaceId);
    case 'skills':
      return fetchSkills(workspaceId);
    default:
      throw new EntityDataFetchError('UNSUPPORTED_ENTITY');
  }
}

async function fetchMembers(workspaceId: string): Promise<Record<string, string>[]> {
  const data = await queryRowsOrThrow<MemberExportRow>(
    () => exportDataClient.rpc<MemberExportRow>('get_workspace_members_for_export', {
      p_workspace_id: workspaceId,
    }),
    'MEMBERS_QUERY_FAILED',
  );
  return data.map((r): Record<string, string> => ({
    email: r.email || '',
    display_name: r.display_name || '',
    role: r.role || 'member',
    status: r.status || 'active',
    team: r.team || '',
    business_role: r.business_role || '',
    office_name: r.office_name || '',
    org_unit_name: r.org_unit_name || '',
    city: r.city || '',
    location: r.location || '',
    base_working_hours: r.base_working_hours != null ? String(r.base_working_hours) : '',
    weekly_capacity_hours: r.weekly_capacity_hours != null ? String(r.weekly_capacity_hours) : '',
    joined_at: r.joined_at ? String(r.joined_at).slice(0, 10) : '',
    manager_email: r.manager_email || '',
    subordinate_emails: r.subordinate_emails || '',
    seniority: r.seniority || '',
    leadership_level: r.leadership_level || '',
    leadership_category: r.leadership_category || '',
    contract_type: r.contract_type || '',
    employer_rights: r.employer_rights ? 'true' : 'false',
    skills: r.skills || '',
    membership_id: r.membership_id || '',
    user_id: r.user_id || '',
  }));
}

async function fetchLeave(workspaceId: string, filters?: { startDate?: string; endDate?: string; statusFilter?: string }): Promise<Record<string, string>[]> {
  const data = await queryRowsOrThrow<LeaveExportRow>(
    () => exportDataClient.rpc<LeaveExportRow>('get_workspace_leave_for_export', {
      p_workspace_id: workspaceId,
      p_start_date: filters?.startDate || null,
      p_end_date: filters?.endDate || null,
      p_status: filters?.statusFilter && filters.statusFilter !== 'all' ? filters.statusFilter : null,
    }),
    'LEAVE_QUERY_FAILED',
  );
  return data.map((r): Record<string, string> => ({
    email: r.email || '',
    display_name: r.display_name || '',
    team: r.team || '',
    start_date: r.start_date || '',
    end_date: r.end_date || '',
    leave_type: r.leave_type || '',
    status: r.status || '',
    is_half_day: r.is_half_day ? 'true' : 'false',
    half_day_period: r.half_day_period || '',
    comment: r.comment || '',
  }));
}

async function fetchOffices(workspaceId: string): Promise<Record<string, string>[]> {
  const data = await queryRowsOrThrow<OfficeExportRow>(
    () => exportDataClient
      .from<OfficeExportRow>('enterprise_offices')
      .select('id, name, city, address')
      .eq('workspace_id', workspaceId)
      .order('name'),
    'OFFICES_QUERY_FAILED',
  );
  return data.map((o) => ({
    name: o.name || '',
    city: o.city || '',
    address: o.address || '',
    office_id: o.id,
  }));
}

async function fetchWorkCategories(workspaceId: string): Promise<Record<string, string>[]> {
  const data = await queryRowsOrThrow<WorkCategoryExportRow>(
    () => exportDataClient
      .from<WorkCategoryExportRow>('enterprise_workspace_role_categories')
      .select('id, name, is_active')
      .eq('workspace_id', workspaceId)
      .order('name'),
    'WORK_CATEGORIES_QUERY_FAILED',
  );
  return data.map((c) => ({
    name: c.name || '',
    is_active: c.is_active ? 'true' : 'false',
    category_id: c.id,
  }));
}

async function fetchJobRoles(workspaceId: string): Promise<Record<string, string>[]> {
  const roles = await queryRowsOrThrow<JobRoleExportRow>(
    () => exportDataClient
      .from<JobRoleExportRow>('enterprise_workspace_roles')
      .select('id, name, is_active, category_id')
      .eq('workspace_id', workspaceId)
      .order('name'),
    'JOB_ROLES_QUERY_FAILED',
  );
  if (!roles || roles.length === 0) return [];
  const cats = await queryRowsOrThrow<JobRoleCategoryExportRow>(
    () => exportDataClient
      .from<JobRoleCategoryExportRow>('enterprise_workspace_role_categories')
      .select('id, name')
      .eq('workspace_id', workspaceId),
    'JOB_ROLE_CATEGORIES_QUERY_FAILED',
  );
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  return roles.map((r) => ({
    name: r.name || '',
    category_name: (catMap.get(r.category_id) as string) || '',
    is_active: r.is_active ? 'true' : 'false',
    role_id: r.id,
  }));
}

async function fetchPositions(workspaceId: string): Promise<Record<string, string>[]> {
  const data = await queryRowsOrThrow<PositionExportRow>(
    () => exportDataClient
      .from<PositionExportRow>('enterprise_memberships')
      .select('business_role')
      .eq('workspace_id', workspaceId),
    'POSITIONS_QUERY_FAILED',
  );
  const counts = new Map<string, number>();
  data.forEach((m) => {
    if (m.business_role) counts.set(m.business_role, (counts.get(m.business_role) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, member_count: String(count) }));
}

async function fetchSkills(workspaceId: string): Promise<Record<string, string>[]> {
  const data = await queryRowsOrThrow<SkillExportRow>(
    () => exportDataClient
      .from<SkillExportRow>('enterprise_skills')
      .select('id, name, category, color')
      .eq('workspace_id', workspaceId)
      .order('name'),
    'SKILLS_QUERY_FAILED',
  );
  return data.map((s) => ({
    name: s.name || '',
    category: s.category || '',
    color: s.color || '',
    skill_id: s.id,
  }));
}
