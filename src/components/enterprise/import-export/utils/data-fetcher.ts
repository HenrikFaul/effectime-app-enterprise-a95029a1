import { supabase } from '@/integrations/supabase/client';
import { fetchCompleteExportRows } from '@/lib/exportPagination';
import {
  defineExportRowSchema,
  matchesExportRowSchema,
} from '@/lib/exportRowValidation';
import type { EntityConfig } from '../config/entity-registry';

interface ExportQueryResult<TRow> {
  data: TRow[] | null;
  error: unknown;
  count?: number | null;
}

interface ExportQuery<TRow> extends PromiseLike<ExportQueryResult<TRow>> {
  select(
    columns: string,
    options?: { count?: 'exact'; head?: boolean },
  ): ExportQuery<TRow>;
  eq(column: string, value: string): ExportQuery<TRow>;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): ExportQuery<TRow>;
  range(from: number, to: number): ExportQuery<TRow>;
}

interface ExportDataClient {
  rpc<TRow>(
    name: string,
    params: Record<string, unknown>,
    options?: { count?: 'exact'; head?: boolean },
  ): ExportQuery<TRow>;
  from<TRow>(table: string): ExportQuery<TRow>;
}

interface ExportOrder {
  column: string;
  nullsFirst?: boolean;
}

interface MemberExportRow {
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
  team: string | null;
  business_role: string | null;
  office_name: string | null;
  org_unit_name: string | null;
  city: string | null;
  location: string | null;
  base_working_hours: string | number | null;
  weekly_capacity_hours: string | number | null;
  joined_at: string | null;
  manager_email: string | null;
  subordinate_emails: string | null;
  seniority: string | null;
  leadership_level: string | null;
  leadership_category: string | null;
  contract_type: string | null;
  employer_rights: boolean;
  skills: string | null;
  membership_id: string;
  user_id: string;
}

interface LeaveExportRow {
  email: string | null;
  display_name: string | null;
  team: string | null;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  is_half_day: boolean;
  half_day_period: string | null;
  comment: string | null;
}

interface OfficeExportRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
}

interface WorkCategoryExportRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface JobRoleExportRow {
  id: string;
  name: string;
  is_active: boolean;
  category_id: string;
}

interface JobRoleCategoryExportRow {
  id: string;
  name: string;
}

interface PositionExportRow {
  id: string;
  business_role: string | null;
}

interface SkillExportRow {
  id: string;
  name: string;
  category: string | null;
  color: string;
}

const MEMBER_ROW_SCHEMA = defineExportRowSchema<MemberExportRow>({
  membership_id: 'nonEmptyString',
  user_id: 'nonEmptyString',
  email: 'nullableString',
  display_name: 'nullableString',
  role: 'string',
  status: 'string',
  team: 'nullableString',
  business_role: 'nullableString',
  office_name: 'nullableString',
  org_unit_name: 'nullableString',
  city: 'nullableString',
  location: 'nullableString',
  base_working_hours: 'nullableNumberLike',
  weekly_capacity_hours: 'nullableNumberLike',
  joined_at: 'nullableString',
  manager_email: 'nullableString',
  subordinate_emails: 'nullableString',
  seniority: 'nullableString',
  leadership_level: 'nullableString',
  leadership_category: 'nullableString',
  contract_type: 'nullableString',
  employer_rights: 'boolean',
  skills: 'nullableString',
});

const LEAVE_ROW_SCHEMA = defineExportRowSchema<LeaveExportRow>({
  email: 'nullableString',
  display_name: 'nullableString',
  team: 'nullableString',
  start_date: 'string',
  end_date: 'string',
  leave_type: 'string',
  status: 'string',
  is_half_day: 'boolean',
  half_day_period: 'nullableString',
  comment: 'nullableString',
});

const OFFICE_ROW_SCHEMA = defineExportRowSchema<OfficeExportRow>({
  id: 'nonEmptyString',
  name: 'string',
  city: 'nullableString',
  address: 'nullableString',
});

const WORK_CATEGORY_ROW_SCHEMA = defineExportRowSchema<WorkCategoryExportRow>({
  id: 'nonEmptyString',
  name: 'string',
  is_active: 'boolean',
});

const JOB_ROLE_ROW_SCHEMA = defineExportRowSchema<JobRoleExportRow>({
  id: 'nonEmptyString',
  name: 'string',
  is_active: 'boolean',
  category_id: 'nonEmptyString',
});

const JOB_ROLE_CATEGORY_ROW_SCHEMA = defineExportRowSchema<JobRoleCategoryExportRow>({
  id: 'nonEmptyString',
  name: 'string',
});

const POSITION_ROW_SCHEMA = defineExportRowSchema<PositionExportRow>({
  id: 'nonEmptyString',
  business_role: 'nullableString',
});

const SKILL_ROW_SCHEMA = defineExportRowSchema<SkillExportRow>({
  id: 'nonEmptyString',
  name: 'string',
  category: 'nullableString',
  color: 'string',
});

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

function isLeaveExportRow(value: unknown): value is LeaveExportRow {
  if (!matchesExportRowSchema(value, LEAVE_ROW_SCHEMA)) return false;
  const row = value as Record<string, unknown>;
  // Existing writes do not enforce the boolean/period cross-field invariant.
  // Accept the persisted enum/null shapes without fabricating a relationship;
  // a future DB cleanup + CHECK can safely tighten this contract.
  const halfDayPeriodIsValid = row.half_day_period === null
    || row.half_day_period === ''
    || row.half_day_period === 'morning'
    || row.half_day_period === 'afternoon';
  return halfDayPeriodIsValid
    && isIsoDate(row.start_date)
    && isIsoDate(row.end_date)
    && row.start_date <= row.end_date;
}

function isMemberExportRow(value: unknown): value is MemberExportRow {
  if (!matchesExportRowSchema(value, MEMBER_ROW_SCHEMA)) return false;
  const joinedAt = (value as Record<string, unknown>).joined_at;
  if (joinedAt === null) return true;
  if (
    typeof joinedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}[T ]/u.test(joinedAt)
    || !isIsoDate(joinedAt.slice(0, 10))
  ) {
    return false;
  }
  return !Number.isNaN(Date.parse(joinedAt));
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

function applyStableOrder<TRow>(
  query: ExportQuery<TRow>,
  orders: readonly ExportOrder[],
): ExportQuery<TRow> {
  return orders.reduce(
    (ordered, order) => ordered.order(order.column, {
      ascending: true,
      ...(order.nullsFirst === undefined ? {} : { nullsFirst: order.nullsFirst }),
    }),
    query,
  );
}

async function fetchRowsOrThrow<TRow>(
  fetchPage: (from: number, to: number, includeExactCount: boolean) => PromiseLike<unknown>,
  fetchFinalCount: () => PromiseLike<unknown>,
  code: EntityDataFetchErrorCode,
  validateRow: (row: unknown) => row is TRow,
  identity?: (row: TRow) => unknown,
): Promise<TRow[]> {
  try {
    return await fetchCompleteExportRows<TRow>({
      fetchPage,
      fetchFinalCount,
      validateRow,
      ...(identity ? { identity } : {}),
    });
  } catch {
    throw new EntityDataFetchError(code);
  }
}

function fetchRpcRows<TRow>(
  name: string,
  params: Record<string, unknown>,
  orders: readonly ExportOrder[],
  code: EntityDataFetchErrorCode,
  validateRow: (row: unknown) => row is TRow,
  identity?: (row: TRow) => unknown,
): Promise<TRow[]> {
  return fetchRowsOrThrow<TRow>(
    (from, to, includeExactCount) => {
      const query = exportDataClient.rpc<TRow>(
        name,
        params,
        includeExactCount ? { count: 'exact' } : undefined,
      );
      return applyStableOrder(query, orders).range(from, to);
    },
    // Export RPCs are VOLATILE in the linked schema, so PostgREST cannot run
    // them through GET/HEAD. A one-row POST range retains the exact count
    // without downloading the complete result a second time.
    () => exportDataClient
      .rpc<TRow>(name, params, { count: 'exact' })
      .range(0, 0),
    code,
    validateRow,
    identity,
  );
}

function fetchTableRows<TRow>(
  table: string,
  columns: string,
  workspaceId: string,
  orders: readonly ExportOrder[],
  code: EntityDataFetchErrorCode,
  validateRow: (row: unknown) => row is TRow,
  identity: (row: TRow) => unknown,
): Promise<TRow[]> {
  return fetchRowsOrThrow<TRow>(
    (from, to, includeExactCount) => {
      let query = exportDataClient
        .from<TRow>(table)
        .select(columns, includeExactCount ? { count: 'exact' } : undefined)
        .eq('workspace_id', workspaceId);
      query = applyStableOrder(query, orders);
      return query.range(from, to);
    },
    () => exportDataClient
      .from<TRow>(table)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
    code,
    validateRow,
    identity,
  );
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
  const data = await fetchRpcRows<MemberExportRow>(
    'get_workspace_members_for_export',
    {
      p_workspace_id: workspaceId,
    },
    [{ column: 'membership_id' }],
    'MEMBERS_QUERY_FAILED',
    isMemberExportRow,
    (row) => row.membership_id,
  );
  return data.map((r): Record<string, string> => ({
    email: r.email || '',
    display_name: r.display_name || '',
    role: r.role,
    status: r.status,
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
  const data = await fetchRpcRows<LeaveExportRow>(
    'get_workspace_leave_for_export',
    {
      p_workspace_id: workspaceId,
      p_start_date: filters?.startDate || null,
      p_end_date: filters?.endDate || null,
      p_status: filters?.statusFilter && filters.statusFilter !== 'all' ? filters.statusFilter : null,
    },
    // The legacy RPC does not expose a request ID. Keep every projected export
    // field in this tuple: physical ties are then observationally identical,
    // while any future projected field must extend the ordering contract.
    [
      'start_date',
      'end_date',
      'email',
      'leave_type',
      'status',
      'is_half_day',
      'half_day_period',
      'comment',
      'display_name',
      'team',
    ].map((column) => ({ column, nullsFirst: false })),
    'LEAVE_QUERY_FAILED',
    isLeaveExportRow,
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
  const data = await fetchTableRows<OfficeExportRow>(
    'enterprise_offices',
    'id, name, city, address',
    workspaceId,
    [{ column: 'name', nullsFirst: false }, { column: 'id' }],
    'OFFICES_QUERY_FAILED',
    (row) => matchesExportRowSchema(row, OFFICE_ROW_SCHEMA),
    (row) => row.id,
  );
  return data.map((o) => ({
    name: o.name || '',
    city: o.city || '',
    address: o.address || '',
    office_id: o.id,
  }));
}

async function fetchWorkCategories(workspaceId: string): Promise<Record<string, string>[]> {
  const data = await fetchTableRows<WorkCategoryExportRow>(
    'enterprise_workspace_role_categories',
    'id, name, is_active',
    workspaceId,
    [{ column: 'name', nullsFirst: false }, { column: 'id' }],
    'WORK_CATEGORIES_QUERY_FAILED',
    (row) => matchesExportRowSchema(row, WORK_CATEGORY_ROW_SCHEMA),
    (row) => row.id,
  );
  return data.map((c) => ({
    name: c.name || '',
    is_active: c.is_active ? 'true' : 'false',
    category_id: c.id,
  }));
}

async function fetchJobRoles(workspaceId: string): Promise<Record<string, string>[]> {
  const roles = await fetchTableRows<JobRoleExportRow>(
    'enterprise_workspace_roles',
    'id, name, is_active, category_id',
    workspaceId,
    [{ column: 'name', nullsFirst: false }, { column: 'id' }],
    'JOB_ROLES_QUERY_FAILED',
    (row) => matchesExportRowSchema(row, JOB_ROLE_ROW_SCHEMA),
    (row) => row.id,
  );
  if (!roles || roles.length === 0) return [];
  const cats = await fetchTableRows<JobRoleCategoryExportRow>(
    'enterprise_workspace_role_categories',
    'id, name',
    workspaceId,
    [{ column: 'id' }],
    'JOB_ROLE_CATEGORIES_QUERY_FAILED',
    (row) => matchesExportRowSchema(row, JOB_ROLE_CATEGORY_ROW_SCHEMA),
    (row) => row.id,
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
  const data = await fetchTableRows<PositionExportRow>(
    'enterprise_memberships',
    'id, business_role',
    workspaceId,
    [{ column: 'business_role', nullsFirst: false }, { column: 'id' }],
    'POSITIONS_QUERY_FAILED',
    (row) => matchesExportRowSchema(row, POSITION_ROW_SCHEMA),
    (row) => row.id,
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
  const data = await fetchTableRows<SkillExportRow>(
    'enterprise_skills',
    'id, name, category, color',
    workspaceId,
    [{ column: 'name', nullsFirst: false }, { column: 'id' }],
    'SKILLS_QUERY_FAILED',
    (row) => matchesExportRowSchema(row, SKILL_ROW_SCHEMA),
    (row) => row.id,
  );
  return data.map((s) => ({
    name: s.name || '',
    category: s.category || '',
    color: s.color || '',
    skill_id: s.id,
  }));
}
