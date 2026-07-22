// @ts-nocheck
// Supabase Edge Function: import-entity-data
// Handles bulk import for the Import/Export Center across multiple entities.
// Validates workspace membership + admin role, resolves references, and writes
// data with row-level error reporting and audit logging.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import {
  hasMemberInvitationCandidate,
  planMembersInviteInvitation,
  resolveCsvImportEntitlement,
  resolveMembersInviteEntitlement,
  type MembersInviteEntitlement,
} from './entitlement.ts';
import {
  boundedImportRowValue,
  rowWriteFailure,
  safeProviderCode,
} from './errors.ts';
import {
  createImportEntityDataHandler,
  ImportDependencyError,
  type AuthorizedImportCommand,
  type AuthorizedImportResult,
  type ImportRowError,
  type ImportSummary,
} from './handler.ts';
import {
  parseEnterpriseRole,
  parseMembershipStatus,
  validateExistingMemberAccess,
  validateInvitationAccess,
  type EnterpriseRole,
  type ImportActorRole,
  type MembershipStatus,
} from './security.ts';

type RowError = ImportRowError;
type Summary = ImportSummary;
type ImportServiceClient = ReturnType<typeof createClient>;

async function resolveAuthUsersByEmail(client: any, emails: unknown[]) {
  const { data, error } = await client.rpc('get_user_ids_by_emails', { p_emails: emails });
  if (error) {
    throw new ImportDependencyError('auth_directory_lookup');
  }
  if (!Array.isArray(data)) {
    throw new ImportDependencyError('auth_directory_response');
  }
  return data;
}

const logger = createStructuredLogger({ service: 'import-entity-data' });

Deno.serve(createImportEntityDataHandler({
  logger,
  createDependencies: (authHeader: string) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new ImportDependencyError('function_configuration');
    }

    // User-context client is restricted to authentication; the service client
    // resolves exact tenant authorization and owns the authorized import path.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    return {
      authenticate: async () => {
        try {
          const { data: { user }, error } = await userClient.auth.getUser();
          if (error || !user) return { kind: 'denied' as const };
          return { kind: 'authenticated' as const, userId: user.id };
        } catch {
          return { kind: 'unavailable' as const };
        }
      },
      resolveActor: async (workspaceId: string, userId: string) => {
        try {
          const { data, error } = await serviceClient
            .from('enterprise_memberships')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
          if (error) {
            return {
              kind: 'unavailable' as const,
              providerCode: error.code,
            };
          }
          if (!data || !['owner', 'resourceAssistant'].includes(data.role)) {
            return { kind: 'denied' as const };
          }
          return {
            kind: 'authorized' as const,
            role: data.role as ImportActorRole,
          };
        } catch {
          return { kind: 'unavailable' as const };
        }
      },
      resolveCsvImportEntitlement: (workspaceId: string) =>
        resolveCsvImportEntitlement(serviceClient, workspaceId),
      executeAuthorizedImport: (command: AuthorizedImportCommand) =>
        executeAuthorizedImport(serviceClient, command),
    };
  },
}));

async function executeAuthorizedImport(
  serviceClient: ImportServiceClient,
  command: AuthorizedImportCommand,
): Promise<AuthorizedImportResult> {
  const {
    workspace_id,
    entity,
    mode,
    rows,
    dry_run,
    actor_id,
    actor_role,
  } = command;

  // Audit and every entity read/write stay behind the handler's exact RBAC
  // and entitlement preflight.
  if (!dry_run) {
    try {
      const { error: auditStartError } = await serviceClient
        .from('enterprise_audit_events')
        .insert({
          workspace_id,
          actor_id,
          action: 'import.started',
          metadata: { entity, mode, row_count: rows.length },
        });
      if (auditStartError) {
        logger.error('import_started_audit_failed', {
          workspace_id,
          entity,
          provider_code: safeProviderCode(auditStartError.code),
        });
        throw new ImportDependencyError('audit_start_write');
      }
    } catch (error) {
      if (error instanceof ImportDependencyError) throw error;
      logger.error('import_started_audit_failed', {
        workspace_id,
        entity,
        provider_code: 'UNKNOWN',
      });
      throw new ImportDependencyError('audit_start_write');
    }
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
        actor_id,
        actor_role,
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
    try {
      const { error: auditCompletionError } = await serviceClient
        .from('enterprise_audit_events')
        .insert({
          workspace_id,
          actor_id,
          action: errors.length > 0 ? 'import.completed_with_errors' : 'import.completed',
          metadata: { entity, mode, ...summary, error_count: errors.length },
        });
      if (auditCompletionError) {
        // Entity writes may already be committed. Returning 503 here would
        // invite an unsafe whole-import retry, so retain the successful result
        // and emit only bounded operational evidence for reconciliation.
        logger.warn('import_completion_audit_failed_after_writes', {
          workspace_id,
          entity,
          provider_code: safeProviderCode(auditCompletionError.code),
        });
      }
    } catch {
      logger.warn('import_completion_audit_failed_after_writes', {
        workspace_id,
        entity,
        provider_code: 'UNKNOWN',
      });
    }
  }

  return { summary, errors };
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
  const { data: offices, error: officesError } = await client
    .from('enterprise_offices')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  if (officesError) {
    throw new ImportDependencyError('member_offices_lookup');
  }
  const officeByName = new Map((offices || []).map((o: any) => [o.name.toLowerCase(), o.id]));

  const { data: existingMemberships, error: membershipsError } = await client
    .from('enterprise_memberships')
    .select('id, user_id, role, status')
    .eq('workspace_id', workspaceId);
  if (membershipsError) {
    throw new ImportDependencyError('member_memberships_lookup');
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
      logger.error('members_invite_entitlement_lookup_failed', {
        workspace_id: workspaceId,
        step: membersInviteEntitlement.step,
      });
      throw new ImportDependencyError('members_invite_entitlement');
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = String(r.email || '').toLowerCase();
    if (!email) {
      errors.push({
        row_index: i,
        field: 'email',
        value: boundedImportRowValue(''),
        code: 'REQUIRED_EMPTY',
        message: 'Email kötelező',
      });
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
        value: boundedImportRowValue(r.role),
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
        value: boundedImportRowValue(r.status),
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
          value: boundedImportRowValue(r.role || r.status || ''),
          code: 'FORBIDDEN_ACCESS_CHANGE',
          message: accessError,
        });
        summary.failed++;
        return;
      }
      if (!membersInviteEntitlement) {
        throw new ImportDependencyError('members_invite_preflight');
      }
      const invitationPlan = planMembersInviteInvitation(
        membersInviteEntitlement,
        dryRun === true,
      );
      if (invitationPlan.kind === 'blocked') {
        errors.push({
          row_index: i,
          field: 'email',
          value: boundedImportRowValue(email),
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
        logger.error('bulk_member_invitation_failed', {
          workspace_id: workspaceId,
          row_index: i,
          provider_code: safeProviderCode(error.code),
        });
        errors.push({
          row_index: i,
          field: 'email',
          value: boundedImportRowValue(email),
          code: 'DB_ERROR',
          reason_code: 'INVITATION_FAILED',
          message: 'Invitation could not be issued',
        });
        summary.failed++;
      } else if (data?.ok === true) summary.created++;
      else if (data?.code === 'ALREADY_MEMBER') summary.skipped++;
      else {
        errors.push({
          row_index: i,
          field: 'email',
          value: boundedImportRowValue(email),
          code: 'DB_ERROR',
          reason_code: 'INVITATION_FAILED',
          message: 'Invitation could not be issued',
        });
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
          value: boundedImportRowValue(r.role || r.status || ''),
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
        errors.push(rowWriteFailure({ rowIndex: i, value: email }));
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
    throw new ImportDependencyError('leave_memberships_lookup');
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
  const { data: existing, error: existingLeaveError } = await client
    .from('leave_requests')
    .select('user_id, start_date, end_date, leave_type')
    .eq('workspace_id', workspaceId);
  if (existingLeaveError) {
    throw new ImportDependencyError('leave_existing_lookup');
  }
  const existingKeys = new Set((existing || []).map((e: any) => `${e.user_id}||${e.start_date}||${e.end_date}||${e.leave_type}`));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = String(r.email || '').toLowerCase();
    const userId = userIdByEmail.get(email);
    if (!userId) {
      errors.push({
        row_index: i,
        field: 'email',
        value: boundedImportRowValue(email),
        code: 'REFERENCE_NOT_FOUND',
        message: 'Tag nem található',
      });
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
      errors.push(rowWriteFailure({ rowIndex: i, value: email }));
      summary.failed++;
    } else summary.created++;
  }

  return { summary, errors };
}

// ===== Offices =====

async function importOffices(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing, error: officeLookupError } = await client
    .from('enterprise_offices')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  if (officeLookupError) {
    throw new ImportDependencyError('office_existing_lookup');
  }
  const idByName = new Map((existing || []).map((o: any) => [o.name.toLowerCase(), o.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: boundedImportRowValue(''), code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_offices').update({ city: r.city || null, address: r.address || null }).eq('id', existingId);
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_offices').insert({ workspace_id: workspaceId, name, city: r.city || null, address: r.address || null });
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Work Categories =====

async function importWorkCategories(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing, error: workCategoryLookupError } = await client
    .from('enterprise_workspace_role_categories')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  if (workCategoryLookupError) {
    throw new ImportDependencyError('work_category_existing_lookup');
  }
  const idByName = new Map((existing || []).map((c: any) => [c.name.toLowerCase(), c.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: boundedImportRowValue(''), code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    const isActive = r.is_active === true || r.is_active === 'true' || r.is_active === undefined;
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_workspace_role_categories').update({ is_active: isActive }).eq('id', existingId);
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_workspace_role_categories').insert({ workspace_id: workspaceId, name, is_active: isActive });
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Job Roles =====

async function importJobRoles(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: cats, error: jobCategoryLookupError } = await client
    .from('enterprise_workspace_role_categories')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  if (jobCategoryLookupError) {
    throw new ImportDependencyError('job_category_lookup');
  }
  const catIdByName = new Map((cats || []).map((c: any) => [c.name.toLowerCase(), c.id]));

  const { data: existing, error: jobRoleLookupError } = await client
    .from('enterprise_workspace_roles')
    .select('id, name, category_id')
    .eq('workspace_id', workspaceId);
  if (jobRoleLookupError) {
    throw new ImportDependencyError('job_role_existing_lookup');
  }
  const existingByKey = new Map((existing || []).map((r: any) => [`${r.category_id}||${r.name.toLowerCase()}`, r.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    const catName = String(r.category_name || '').trim();
    if (!name || !catName) { errors.push({ row_index: i, field: 'name', value: boundedImportRowValue(name), code: 'REQUIRED_EMPTY', message: 'Név és kategória kötelező' }); summary.failed++; continue; }
    const catId = catIdByName.get(catName.toLowerCase());
    if (!catId) { errors.push({ row_index: i, field: 'category_name', value: boundedImportRowValue(catName), code: 'REFERENCE_NOT_FOUND', message: 'Kategória nem található' }); summary.failed++; continue; }

    const key = `${catId}||${name.toLowerCase()}`;
    const existingId = existingByKey.get(key);
    const isActive = r.is_active === true || r.is_active === 'true' || r.is_active === undefined;
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_workspace_roles').update({ is_active: isActive }).eq('id', existingId);
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_workspace_roles').insert({ workspace_id: workspaceId, name, category_id: catId, is_active: isActive });
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Skills =====

async function importSkills(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing, error: skillLookupError } = await client
    .from('enterprise_skills')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  if (skillLookupError) {
    throw new ImportDependencyError('skill_existing_lookup');
  }
  const idByName = new Map((existing || []).map((s: any) => [s.name.toLowerCase(), s.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: boundedImportRowValue(''), code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_skills').update({ category: r.category || null, color: r.color || '#6366f1' }).eq('id', existingId);
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_skills').insert({ workspace_id: workspaceId, name, category: r.category || null, color: r.color || '#6366f1' });
      if (error) { errors.push(rowWriteFailure({ rowIndex: i, value: name })); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}
