// @ts-nocheck
// Supabase Edge Function: import-entity-data
// Handles bulk import for the Import/Export Center across multiple entities.
// Validates workspace membership + admin role, resolves references, and writes
// data with row-level error reporting and audit logging.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CSV_IMPORT_REQUIRED_FEATURE_KEYS,
  hasMemberInvitationCandidate,
  planCsvImportAccess,
  planMembersInviteInvitation,
  resolveCsvImportEntitlement,
  resolveMembersInviteEntitlement,
  type MembersInviteEntitlement,
} from './entitlement.ts';
import {
  parseEnterpriseRole,
  parseMembershipStatus,
  validateExistingMemberAccess,
  validateInvitationAccess,
  type EnterpriseRole,
  type ImportActorRole,
  type MembershipStatus,
} from './security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ImportRequest {
  workspace_id: string;
  entity: string;
  mode: 'create' | 'upsert';
  rows: Record<string, any>[];
  dry_run?: boolean;
}

interface RowError {
  row_index: number;
  field: string;
  value: string;
  code: string;
  message: string;
}

interface Summary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

class ImportDependencyError extends Error {}

async function resolveAuthUsersByEmail(client: any, emails: unknown[]) {
  const { data, error } = await client.rpc('get_user_ids_by_emails', { p_emails: emails });
  if (error) {
    throw new ImportDependencyError(`Auth directory lookup failed: ${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new ImportDependencyError('Auth directory lookup returned an invalid response');
  }
  return data;
}

const SUPPORTED_ENTITIES = ['members', 'leave', 'offices', 'work_categories', 'job_roles', 'skills'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // User-context client (for auth check + RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // Service client for writes that need elevated privilege (e.g. profile lookups)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body: ImportRequest = await req.json();
    const { workspace_id, entity, mode, rows, dry_run } = body;

    if (!workspace_id || !entity || !Array.isArray(rows)) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    if (!['create', 'upsert'].includes(mode)) {
      return jsonResponse({ error: 'Invalid import mode' }, 400);
    }
    if (rows.length > 2000) {
      return jsonResponse({ error: 'Import row limit exceeded' }, 413);
    }
    if (!SUPPORTED_ENTITIES.includes(entity)) {
      return jsonResponse({ error: `Unsupported entity: ${entity}` }, 400);
    }

    // Resolve the exact active actor role. Importing member access fields needs
    // stricter rules than the other resource-assistant import operations.
    const { data: actorMembership, error: actorMembershipError } = await serviceClient
      .from('enterprise_memberships')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (actorMembershipError) {
      console.error('Failed to resolve import actor membership', actorMembershipError);
      return jsonResponse({ error: 'Workspace authorization is temporarily unavailable' }, 503);
    }
    if (!actorMembership || !['owner', 'resourceAssistant'].includes(actorMembership.role)) {
      return jsonResponse({ error: 'Forbidden: admin role required' }, 403);
    }
    const actorRole = actorMembership.role as ImportActorRole;

    // Feature preflight must complete after authentication/RBAC but before
    // audit events, dry-run accounting, or any entity-specific reads/writes.
    // csv_import depends on members_list in the shipped feature catalog.
    const csvImportEntitlement = await resolveCsvImportEntitlement(
      serviceClient,
      workspace_id,
    );
    const csvImportAccess = planCsvImportAccess(csvImportEntitlement);
    if (csvImportAccess.kind === 'blocked') {
      if (!csvImportEntitlement.enabled && csvImportEntitlement.reason === 'lookup_error') {
        console.error('csv_import entitlement lookup failed', {
          workspaceId: workspace_id,
          step: csvImportEntitlement.step,
          features: CSV_IMPORT_REQUIRED_FEATURE_KEYS,
        });
      }
      return jsonResponse({ error: csvImportAccess.message }, csvImportAccess.status);
    }

    // Audit: import.started
    if (!dry_run) {
      await serviceClient.from('enterprise_audit_events').insert({
        workspace_id,
        actor_id: user.id,
        action: 'import.started',
        metadata: { entity, mode, row_count: rows.length },
      });
    }

    let summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
    let errors: RowError[] = [];

    switch (entity) {
      case 'members':
        ({ summary, errors } = await importMembers(
          serviceClient,
          workspace_id,
          mode,
          rows,
          dry_run,
          user.id,
          actorRole,
        ));
        break;
      case 'leave':
        ({ summary, errors } = await importLeave(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'offices':
        ({ summary, errors } = await importOffices(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'work_categories':
        ({ summary, errors } = await importWorkCategories(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'job_roles':
        ({ summary, errors } = await importJobRoles(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'skills':
        ({ summary, errors } = await importSkills(serviceClient, workspace_id, mode, rows, dry_run));
        break;
    }

    if (!dry_run) {
      await serviceClient.from('enterprise_audit_events').insert({
        workspace_id,
        actor_id: user.id,
        action: errors.length > 0 ? 'import.completed_with_errors' : 'import.completed',
        metadata: { entity, mode, ...summary, error_count: errors.length },
      });
    }

    return jsonResponse({ success: true, summary, errors });
  } catch (e: any) {
    console.error('import-entity-data fatal:', e);
    if (e instanceof ImportDependencyError) {
      return jsonResponse({ error: 'Import dependency is temporarily unavailable' }, 503);
    }
    return jsonResponse({ error: e?.message || 'Internal error' }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ===== Members =====

async function importMembers(
  client: any,
  workspaceId: string,
  mode: string,
  rows: any[],
  dryRun: boolean | undefined,
  actorId: string,
  actorRole: ImportActorRole,
) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  // Pre-fetch existing data for resolution
  const { data: offices } = await client.from('enterprise_offices').select('id, name').eq('workspace_id', workspaceId);
  const officeByName = new Map((offices || []).map((o: any) => [o.name.toLowerCase(), o.id]));

  const { data: existingMemberships, error: membershipsError } = await client
    .from('enterprise_memberships')
    .select('id, user_id, role, status')
    .eq('workspace_id', workspaceId);
  if (membershipsError) {
    throw new ImportDependencyError(`Membership lookup failed: ${membershipsError.message}`);
  }
  const existingUserIds = new Set((existingMemberships || []).map((m: any) => m.user_id));
  const membershipByUser = new Map((existingMemberships || []).map((m: any) => [m.user_id, m]));

  // Map emails → user_ids via auth.users (profiles has no email column)
  const emails = rows.map(r => r.email).filter(Boolean);
  const authUsers = await resolveAuthUsersByEmail(client, emails);
  const userIdByEmail = new Map((authUsers || []).map((u: any) => [u.email.toLowerCase(), u.user_id]));

  // Resolve the paid invitation capability before processing any row that can
  // create an invitation. A valid disabled result blocks invitation rows only;
  // existing-member updates remain independent from members_invite.
  const hasInvitationCandidate = hasMemberInvitationCandidate(
    rows,
    userIdByEmail,
    existingUserIds,
  );
  let membersInviteEntitlement: MembersInviteEntitlement | null = null;
  if (hasInvitationCandidate) {
    membersInviteEntitlement = await resolveMembersInviteEntitlement(client, workspaceId);
    if (!membersInviteEntitlement.enabled && membersInviteEntitlement.reason === 'lookup_error') {
      console.error('members_invite entitlement lookup failed', {
        workspaceId,
        step: membersInviteEntitlement.step,
      });
      throw new ImportDependencyError('members_invite entitlement lookup failed');
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = String(r.email || '').toLowerCase();
    if (!email) {
      errors.push({ row_index: i, field: 'email', value: '', code: 'REQUIRED_EMPTY', message: 'Email kötelező' });
      summary.failed++;
      continue;
    }

    const userId = userIdByEmail.get(email);
    const officeId = r.office_name ? officeByName.get(String(r.office_name).toLowerCase()) : undefined;

    const requestedRole = r.role == null || String(r.role).trim() === ''
      ? undefined
      : parseEnterpriseRole(r.role);
    if (r.role != null && String(r.role).trim() !== '' && !requestedRole) {
      errors.push({
        row_index: i,
        field: 'role',
        value: String(r.role),
        code: 'INVALID_ROLE',
        message: 'Érvénytelen workspace szerepkör',
      });
      summary.failed++;
      continue;
    }

    const requestedStatus = r.status == null || String(r.status).trim() === ''
      ? undefined
      : parseMembershipStatus(r.status);
    if (r.status != null && String(r.status).trim() !== '' && !requestedStatus) {
      errors.push({
        row_index: i,
        field: 'status',
        value: String(r.status),
        code: 'INVALID_STATUS',
        message: 'Érvénytelen tagsági státusz',
      });
      summary.failed++;
      continue;
    }

    const invitationRole = requestedRole || 'member';

    const createInvitation = async () => {
      const accessError = validateInvitationAccess({
        actorRole,
        requestedRole: invitationRole,
        requestedStatus,
      });
      if (accessError) {
        errors.push({
          row_index: i,
          field: requestedRole && requestedRole !== 'member' ? 'role' : 'status',
          value: String(r.role || r.status || ''),
          code: 'FORBIDDEN_ACCESS_CHANGE',
          message: accessError,
        });
        summary.failed++;
        return;
      }
      if (!membersInviteEntitlement) {
        throw new ImportDependencyError('members_invite entitlement was not preflighted');
      }
      const invitationPlan = planMembersInviteInvitation(
        membersInviteEntitlement,
        dryRun === true,
      );
      if (invitationPlan.kind === 'blocked') {
        errors.push({
          row_index: i,
          field: 'email',
          value: email,
          code: invitationPlan.code,
          message: invitationPlan.message,
        });
        summary.failed++;
        return;
      }
      if (invitationPlan.kind === 'dry_run') {
        summary.created++;
        return;
      }
      const { data, error } = await client.rpc('issue_enterprise_invitation', {
        _workspace_id: workspaceId,
        _email: email,
        _role: invitationRole,
        _expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        _prefill: {},
        _actor_id: actorId,
      });
      if (error) {
        const errorCode = typeof error.code === 'string' && /^[a-z0-9_]{1,32}$/i.test(error.code)
          ? error.code
          : 'UNKNOWN';
        console.error('Bulk member invitation RPC failed', {
          workspaceId,
          rowIndex: i,
          errorCode,
        });
        errors.push({
          row_index: i,
          field: 'email',
          value: email,
          code: 'DB_ERROR',
          message: 'Invitation could not be issued',
        });
        summary.failed++;
      } else if (data?.ok === true) summary.created++;
      else if (data?.code === 'ALREADY_MEMBER') summary.skipped++;
      else {
        errors.push({ row_index: i, field: 'email', value: email, code: 'DB_ERROR', message: 'Invitation could not be issued' });
        summary.failed++;
      }
    };

    if (!userId) {
      // Unknown users must accept an invitation before a membership exists.
      await createInvitation();
      continue;
    }

    // Build membership fields shared by insert and update
    const membershipFields = (base: any, includeAccessFields: boolean) => {
      if (includeAccessFields && requestedRole) base.role = requestedRole;
      if (includeAccessFields && requestedStatus) base.status = requestedStatus;
      if (r.team !== undefined) base.team = r.team || null;
      if (r.business_role !== undefined) base.business_role = r.business_role || null;
      if (r.location !== undefined) base.location = r.location || null;
      if (officeId !== undefined) base.office_id = officeId || null;
      if (r.city !== undefined) base.city = r.city || null;
      if (r.joined_at) base.joined_at = r.joined_at;
      if (r.base_working_hours != null && r.base_working_hours !== '') base.base_working_hours = Number(r.base_working_hours);
      if (r.weekly_capacity_hours != null && r.weekly_capacity_hours !== '') base.weekly_capacity_hours = Number(r.weekly_capacity_hours);
      if (r.seniority) base.seniority = r.seniority;
      if (r.leadership_category !== undefined) base.leadership_category = r.leadership_category || null;
      if (r.employer_rights !== undefined) base.employer_rights = r.employer_rights === true || r.employer_rights === 'true';
      return base;
    };

    // User exists. Check if they have a membership in this workspace.
    if (existingUserIds.has(userId)) {
      if (mode === 'create') { summary.skipped++; continue; }
      const existingMembership = membershipByUser.get(userId);
      const accessError = validateExistingMemberAccess({
        actorRole,
        actorId,
        targetUserId: userId,
        currentRole: existingMembership.role as EnterpriseRole,
        currentStatus: existingMembership.status as MembershipStatus,
        requestedRole,
        requestedStatus,
      });
      if (accessError) {
        errors.push({
          row_index: i,
          field: requestedRole && requestedRole !== existingMembership.role ? 'role' : 'status',
          value: String(r.role || r.status || ''),
          code: 'FORBIDDEN_ACCESS_CHANGE',
          message: accessError,
        });
        summary.failed++;
        continue;
      }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client
        .from('enterprise_memberships')
        .update(membershipFields({}, actorRole === 'owner'))
        .eq('id', existingMembership.id);
      if (error) {
        errors.push({ row_index: i, field: 'general', value: email, code: 'DB_ERROR', message: error.message });
        summary.failed++;
      } else summary.updated++;
    } else {
      // A global account is not tenant consent. Use the same invitation flow as
      // an unknown email and let acceptance create the membership.
      await createInvitation();
    }
  }

  return { summary, errors };
}

// ===== Leave =====

async function importLeave(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: workspaceMemberships, error: workspaceMembershipsError } = await client
    .from('enterprise_memberships')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (workspaceMembershipsError) {
    throw new ImportDependencyError(`Leave membership lookup failed: ${workspaceMembershipsError.message}`);
  }
  const activeWorkspaceUserIds = new Set(
    (workspaceMemberships || []).map((membership: any) => membership.user_id),
  );

  const emails = rows.map(r => r.email).filter(Boolean);
  const authUsers = await resolveAuthUsersByEmail(client, emails);
  const userIdByEmail = new Map(
    (authUsers || [])
      .filter((authUser: any) => activeWorkspaceUserIds.has(authUser.user_id))
      .map((authUser: any) => [authUser.email.toLowerCase(), authUser.user_id]),
  );

  // Pre-fetch existing for duplicate detection
  const { data: existing } = await client.from('leave_requests').select('user_id, start_date, end_date, leave_type').eq('workspace_id', workspaceId);
  const existingKeys = new Set((existing || []).map((e: any) => `${e.user_id}||${e.start_date}||${e.end_date}||${e.leave_type}`));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = String(r.email || '').toLowerCase();
    const userId = userIdByEmail.get(email);
    if (!userId) {
      errors.push({ row_index: i, field: 'email', value: email, code: 'REFERENCE_NOT_FOUND', message: `Tag nem található: ${email}` });
      summary.failed++;
      continue;
    }
    const key = `${userId}||${r.start_date}||${r.end_date}||${r.leave_type}`;
    if (existingKeys.has(key)) {
      summary.skipped++;
      continue;
    }
    if (dryRun) { summary.created++; continue; }

    const { error } = await client.from('leave_requests').insert({
      workspace_id: workspaceId,
      user_id: userId,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status || 'approved',
      comment: r.comment || null,
      is_half_day: r.is_half_day === true || r.is_half_day === 'true',
      half_day_period: r.half_day_period || null,
    });
    if (error) {
      errors.push({ row_index: i, field: 'general', value: email, code: 'DB_ERROR', message: error.message });
      summary.failed++;
    } else summary.created++;
  }

  return { summary, errors };
}

// ===== Offices =====

async function importOffices(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing } = await client.from('enterprise_offices').select('id, name').eq('workspace_id', workspaceId);
  const idByName = new Map((existing || []).map((o: any) => [o.name.toLowerCase(), o.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: '', code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_offices').update({ city: r.city || null, address: r.address || null }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_offices').insert({ workspace_id: workspaceId, name, city: r.city || null, address: r.address || null });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Work Categories =====

async function importWorkCategories(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing } = await client.from('enterprise_workspace_role_categories').select('id, name').eq('workspace_id', workspaceId);
  const idByName = new Map((existing || []).map((c: any) => [c.name.toLowerCase(), c.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: '', code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    const isActive = r.is_active === true || r.is_active === 'true' || r.is_active === undefined;
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_workspace_role_categories').update({ is_active: isActive }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_workspace_role_categories').insert({ workspace_id: workspaceId, name, is_active: isActive });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Job Roles =====

async function importJobRoles(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: cats } = await client.from('enterprise_workspace_role_categories').select('id, name').eq('workspace_id', workspaceId);
  const catIdByName = new Map((cats || []).map((c: any) => [c.name.toLowerCase(), c.id]));

  const { data: existing } = await client.from('enterprise_workspace_roles').select('id, name, category_id').eq('workspace_id', workspaceId);
  const existingByKey = new Map((existing || []).map((r: any) => [`${r.category_id}||${r.name.toLowerCase()}`, r.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    const catName = String(r.category_name || '').trim();
    if (!name || !catName) { errors.push({ row_index: i, field: 'name', value: name, code: 'REQUIRED_EMPTY', message: 'Név és kategória kötelező' }); summary.failed++; continue; }
    const catId = catIdByName.get(catName.toLowerCase());
    if (!catId) { errors.push({ row_index: i, field: 'category_name', value: catName, code: 'REFERENCE_NOT_FOUND', message: `Kategória nem található: ${catName}` }); summary.failed++; continue; }

    const key = `${catId}||${name.toLowerCase()}`;
    const existingId = existingByKey.get(key);
    const isActive = r.is_active === true || r.is_active === 'true' || r.is_active === undefined;
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_workspace_roles').update({ is_active: isActive }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_workspace_roles').insert({ workspace_id: workspaceId, name, category_id: catId, is_active: isActive });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Skills =====

async function importSkills(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing } = await client.from('enterprise_skills').select('id, name').eq('workspace_id', workspaceId);
  const idByName = new Map((existing || []).map((s: any) => [s.name.toLowerCase(), s.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: '', code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_skills').update({ category: r.category || null, color: r.color || '#6366f1' }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_skills').insert({ workspace_id: workspaceId, name, category: r.category || null, color: r.color || '#6366f1' });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}
