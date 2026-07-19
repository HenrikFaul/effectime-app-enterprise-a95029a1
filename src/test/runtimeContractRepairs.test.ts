import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const readContract = (...path: string[]) =>
  readFileSync(join(root, ...path), 'utf8').replace(/\r\n?/g, '\n');
const migration = readContract(
  'supabase/migrations/20260717132000_v3_51_3_reproducibility_and_atomic_settings.sql',
);
const dashboard = readContract('src/components/enterprise/WorkspaceDashboard.tsx');
const featureHook = readContract('src/hooks/useFeature.ts');
const importer = readContract('supabase/functions/import-entity-data/index.ts');
const importerSecurity = readContract('supabase/functions/import-entity-data/security.ts');
const emailWorker = readContract('supabase/functions/process-email-queue/index.ts');
const approvalInbox = readContract('src/components/enterprise/ApprovalInbox.tsx');
const workflowsModule = readContract(
  'src/components/enterprise/workflows/WorkflowsModule.tsx',
);
const accessInbox = readContract(
  'src/components/enterprise/workflows/AccessInbox.tsx',
);

describe('restored and hardened runtime contracts', () => {
  it('keeps auth-directory lookup service-role-only and makes importer failures explicit', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_user_ids_by_emails');
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_user_ids_by_emails\(text\[\]\) FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_user_ids_by_emails\(text\[\]\) TO service_role/,
    );
    expect(importer.match(/await resolveAuthUsersByEmail\(client, emails\)/g)).toHaveLength(2);
    expect(importer).toContain('return jsonResponse({ error: \'Import dependency is temporarily unavailable\' }, 503)');
  });

  it('prevents bulk member import from escalating access or bypassing invitations', () => {
    expect(importer).toContain(".select('role')");
    expect(importer).toContain(".eq('status', 'active')");
    expect(importer).toContain('validateExistingMemberAccess({');
    expect(importer).toContain('validateInvitationAccess({');
    expect(importer).not.toContain("from('enterprise_memberships').insert(membershipFields");
    expect(importer).toContain("client.rpc('issue_enterprise_invitation'");
    expect(importerSecurity).toContain("input.actorRole !== 'owner'");
    expect(importerSecurity).toContain('input.actorId === input.targetUserId');
    expect(importerSecurity).toContain("value.trim() === 'inactive' ? 'suspended'");
  });

  it('imports leave only for active members of the target workspace', () => {
    expect(importer).toContain('const activeWorkspaceUserIds = new Set(');
    expect(importer).toContain('.filter((authUser: any) => activeWorkspaceUserIds.has(authUser.user_id))');
    expect(importer).toContain('Leave membership lookup failed:');
  });

  it('exposes feature metadata only through a membership-scoped frontend RPC', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.tenant_id_for_workspace\(uuid\) FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.tenant_enabled_features\(uuid\) FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.workspace_enabled_features');
    expect(migration).toContain('public.is_enterprise_member(_workspace_id, auth.uid())');
    expect(featureHook).toContain('.rpc("workspace_enabled_features"');
    expect(featureHook).not.toContain('.rpc("tenant_id_for_workspace"');
    expect(featureHook).not.toContain('.rpc("tenant_enabled_features"');
  });

  it('enforces Financials and Payroll entitlements inside direct-CRUD RLS', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.workspace_has_any_feature');
    expect(migration).toContain("ARRAY['financials', 'payroll_engine']");
    expect(migration).toContain('ON public.enterprise_project_rates');
    expect(migration).toContain("ARRAY['financials']");
    expect(migration).toContain('ON public.payroll_periods');
    expect(migration).toContain("ARRAY['payroll_engine']");
    expect(migration).toContain('ON public.payroll_export_configs');
    expect(migration).toContain("ARRAY['payroll_export']");
    expect(migration.match(/Entitled admins view member rates/g)).toHaveLength(1);
    expect(migration.match(/Entitled members view project rates[\s\S]*?has_enterprise_role/g)).toHaveLength(1);
    expect(migration.match(/payroll_periods_select[\s\S]*?has_enterprise_role/g)).toHaveLength(1);
    expect(migration.match(/payroll_export_configs_select[\s\S]*?has_enterprise_role/g)).toHaveLength(1);
    expect(migration.match(/membership\.id = enterprise_member_rates\.membership_id/g)).toHaveLength(5);
    expect(migration.match(/project\.id = enterprise_project_rates\.project_id/g)).toHaveLength(5);
  });

  it('enforces scenario-planner entitlement and workspace consistency in RLS', () => {
    expect(migration).toContain('CREATE POLICY "Entitled members view scenarios"');
    expect(migration).toContain('CREATE POLICY "Entitled admins insert scenario assignments"');
    expect(migration.match(/ARRAY\['scenario_planner'\]/g)?.length).toBeGreaterThanOrEqual(8);
    expect(migration).toContain('scenario.id = enterprise_scenario_assignments.scenario_id');
    expect(migration).toContain('scenario.workspace_id = enterprise_scenario_assignments.workspace_id');
    expect(migration).toContain('project.id = enterprise_scenario_assignments.project_id');
    expect(migration).toContain('member.id = enterprise_scenario_assignments.membership_id');
  });

  it('atomically patches only owned workspace settings keys', () => {
    expect(migration).toContain("settings = COALESCE(settings, '{}'::jsonb) || _settings_patch");
    expect(migration).toContain("ARRAY['owner'::public.enterprise_role]");
    expect(dashboard).toContain(".rpc('patch_workspace_settings'");
    expect(dashboard).toContain('_settings_patch: { customReports, calendarWidgets }');
    expect(dashboard).not.toMatch(/\.update\(\{[^}]*settings:/s);
    expect(dashboard).toContain('Array.isArray(persistedSettings.customReports)');
    expect(dashboard).toContain('Array.isArray(persistedSettings.calendarWidgets)');
  });

  it('aligns and observes rate-limited email logging and installs a Vault-backed worker', () => {
    expect(migration).toMatch(/'dlq', 'rate_limited'/);
    expect(migration).toContain("'process-email-queue',");
    expect(migration).toContain("'5 seconds',");
    expect(migration).toContain("'/functions/v1/process-email-queue'");
    expect(migration).toContain("endpoint.name = 'supabase_function_base_url'");
    expect(migration).toContain("credential.name = 'email_queue_service_role_key'");
    expect(emailWorker).toContain('const { error: rateLimitLogError }');
    expect(emailWorker).toContain("console.error('Failed to persist rate-limit send log'");
    expect(migration).toContain("'send-scheduled-reports-hourly',");
    expect(migration).toContain("'/functions/v1/send-scheduled-reports'");
  });

  it('retains the scoped prefill helper and uses atomic invitation issuance in the UI', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.set_workspace_invitation_prefill');
    expect(migration).toContain("COALESCE(settings -> 'invitation_prefills', '{}'::jsonb)");
    expect(migration).toContain('|| jsonb_build_object(_invitation_id::text, _prefill)');
    const inviteDialog = readFileSync(
      join(root, 'src/components/enterprise/InviteMemberDialog.tsx'),
      'utf8',
    );
    expect(inviteDialog).toContain("'issue_enterprise_invitation'");
    expect(inviteDialog).not.toContain('.update({ settings:');
    expect(inviteDialog).toContain('emailData?.success === true');
    expect(inviteDialog).toContain("emailData?.reason === 'email_suppressed'");
  });

  it('commits leave status, decision ledger and audit event in one locked RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.decide_leave_request');
    expect(migration).toContain('FOR UPDATE;');
    expect(migration).toContain('INSERT INTO public.approval_decisions');
    expect(migration).toContain('INSERT INTO public.enterprise_audit_events');
    const inbox = readFileSync(
      join(root, 'src/components/enterprise/ApprovalInbox.tsx'),
      'utf8',
    );
    expect(inbox.match(/\.rpc\('decide_leave_request'/g)).toHaveLength(2);
    expect(inbox).not.toContain(".from('approval_decisions').insert");
    expect(inbox).toContain("{ count: succeeded }");
    expect(inbox).toContain('if (failed > 0)');
  });

  it('blocks direct forged leave approvals and decision-ledger writes', () => {
    expect(migration).toContain('CREATE POLICY "Members can create own pending leave requests"');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_leave_request_direct_mutation');
    expect(migration).toContain('Leave decisions can only be written by decide_leave_request');
    expect(migration).toContain('DROP POLICY IF EXISTS "Admins can create approval decisions"');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_approval_decision_direct_mutation');
    expect(migration).toContain("IF current_user = 'authenticated' THEN");
  });

  it('disables destructive direct membership deletion in favor of guarded status changes', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Owners can remove members"');
    expect(migration).toContain('Workspace owners cannot change their own role or status directly');
  });

  it('keeps membership metadata foreign keys inside the membership workspace', () => {
    for (const table of [
      'enterprise_offices',
      'enterprise_org_units',
      'enterprise_memberships AS manager',
      'enterprise_contract_types',
      'enterprise_leadership_levels',
      'enterprise_workspace_roles',
    ]) {
      expect(migration).toContain(`FROM public.${table}`);
    }
    expect(migration).toContain('manager.workspace_id = NEW.workspace_id');
  });

  it('preserves the integrated admin override through an atomic audited RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_admin_leave_override');
    expect(migration).toContain("'leave_request.admin_override'");
    expect(migration).toContain("'approved'::public.leave_request_status");
    expect(migration).toContain("workspace_has_any_feature(_workspace_id, ARRAY['admin_override'])");
    expect(migration).toContain("SET status = 'approved'::public.leave_request_status");
    expect(dashboard).toContain('{canOverride ? <div className="flex justify-end mb-2">');
    const overrideUi = readFileSync(
      join(root, 'src/components/enterprise/AdminLeaveOverride.tsx'),
      'utf8',
    );
    expect(overrideUi).toContain("rpc('create_admin_leave_override'");
    expect(overrideUi).not.toContain("from('leave_requests').insert");
    expect(overrideUi).not.toContain('logAuditEvent');
  });

  it('enforces the paid iCal entitlement at the token table boundary', () => {
    expect(migration).toContain("workspace_has_any_feature(workspace_id, ARRAY['ical_feed'])");
  });

  it('enforces workflow entitlements in both mounted UI and direct-CRUD RLS', () => {
    for (const feature of [
      'onboarding_template',
      'onboarding_inbox',
      'access_systems',
      'access_templates',
      'access_inbox',
    ]) {
      expect(workflowsModule).toContain(`isEnabled('${feature}')`);
      expect(migration).toContain(`ARRAY['${feature}']`);
    }
    expect(migration).toContain('access_system.workspace_id = template.workspace_id');
    expect(migration).toContain('target_member.workspace_id = enterprise_access_requests.workspace_id');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.seed_default_access_systems');
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.seed_default_access_systems\(uuid\) FROM PUBLIC, anon/,
    );
  });

  it('prevents cross-tenant quota writes and only refunds an outstanding consume', () => {
    expect(migration).toContain('CREATE POLICY "Admins insert tenant-local quota transactions"');
    expect(migration).toContain('quota.workspace_id = enterprise_quota_transactions.workspace_id');
    expect(migration).toContain('quota.membership_id = membership.id');
    expect(migration).toContain('leave_request.user_id = membership.user_id');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.handle_leave_quota_change');
    expect(migration).toContain('SELECT COALESCE(sum(quota_txn.amount_days), 0)');
    expect(migration).toContain('IF v_net_amount < 0 THEN');
    expect(migration).toContain("'refund'::public.quota_transaction_type, -v_net_amount");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.handle_leave_quota_change\(\)[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
  });

  it('honors configured approval permissions and keeps permission configuration owner-only', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.has_workspace_permission');
    expect(migration).toContain('CREATE POLICY "Owners can manage role permissions"');
    expect(migration).toContain('CREATE POLICY "Owners can manage role definitions"');
    expect(migration).toContain("'admin_override',\n    'edit'");
    expect(migration).toContain("'approvals',\n       'edit'");
    expect(dashboard).toContain("canViewApprovals={canView('approvals')}");
    expect(dashboard).toContain('canApprove={canApprove}');
    expect(approvalInbox).toContain('canApprove && isPending');
    expect(approvalInbox).toContain("canApprove && statusFilter === 'pending'");
  });

  it('restricts private leave data and preserves immutable decision/quota ledgers', () => {
    expect(migration).toContain('CREATE POLICY "Authorized users view leave requests"');
    expect(migration).toContain('NOT COALESCE(is_private, false)');
    expect(migration).toContain("'requests_team',\n          'readonly'");
    expect(migration).toContain('CREATE POLICY "Authorized users view approval decisions"');
    expect(migration).toContain('DROP POLICY IF EXISTS "Owners can delete leave requests"');
  });

  it('commits access request decisions and their ledger atomically', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.decide_access_request');
    expect(migration).toContain('FROM public.enterprise_access_requests');
    expect(migration).toContain('FOR UPDATE;');
    expect(migration).toContain('Invalid access request state transition');
    expect(migration).toContain('INSERT INTO public.enterprise_access_decisions');
    expect(migration).toContain('CREATE TRIGGER record_access_request_submission');
    expect(migration).toContain('DROP POLICY IF EXISTS "Entitled admins manage access requests"');
    expect(migration).toContain('DROP POLICY IF EXISTS "Entitled users write access decisions"');
    expect(accessInbox).toContain("rpc('decide_access_request'");
    expect(accessInbox).not.toContain("from('enterprise_access_decisions').insert");
    expect(accessInbox).not.toContain("from('enterprise_access_requests')\n      .update");
  });
});
