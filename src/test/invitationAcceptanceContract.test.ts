import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const readContract = (...path: string[]) =>
  readFileSync(join(root, ...path), 'utf8').replace(/\r\n?/g, '\n');
const migration = readContract(
  'supabase/migrations/20260717133000_v3_51_3_atomic_invitation_acceptance.sql',
);
const boundaryMigration = readContract(
  'supabase/migrations/20260717132000_v3_51_3_reproducibility_and_atomic_settings.sql',
);
const joinEvent = readContract('supabase/functions/join-event/index.ts');
const createWorkspaceUser = readContract(
  'supabase/functions/create-workspace-user/index.ts',
);
const inviteDialog = readContract('src/components/enterprise/InviteMemberDialog.tsx');
const positionPicker = readContract(
  'src/components/enterprise/positions/PositionPickerDialog.tsx',
);
const transactionalEmail = readContract(
  'supabase/functions/send-transactional-email/index.ts',
);

describe('atomic invitation acceptance contract', () => {
  it('locks and commits invitation, workspace and membership in one service-only RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.accept_enterprise_invitation');
    const acceptance = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.accept_enterprise_invitation'),
    );
    const invitationLock = acceptance.indexOf('FROM public.enterprise_invitations\n  WHERE token');
    const workspaceLock = acceptance.indexOf('FROM public.enterprise_workspaces\n  WHERE id');
    const membershipLock = acceptance.indexOf('FROM public.enterprise_memberships\n  WHERE workspace_id');
    expect(invitationLock).toBeGreaterThan(-1);
    expect(workspaceLock).toBeGreaterThan(invitationLock);
    expect(membershipLock).toBeGreaterThan(workspaceLock);
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.accept_enterprise_invitation\(text, uuid, jsonb\)[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toContain('SET accepted_at = now()');
    expect(migration).toContain("v_prefills := v_prefills - v_invitation.id::text");
  });

  it('routes token acceptance through the RPC without partial REST writes', () => {
    const acceptBlock = joinEvent.slice(
      joinEvent.indexOf("if (action === 'accept-enterprise-invite')"),
      joinEvent.indexOf("if (action === 'update-temp-name')"),
    );
    expect(acceptBlock).toContain("admin.rpc(\n        'accept_enterprise_invitation'");
    expect(acceptBlock).not.toContain("from('enterprise_memberships')");
    expect(acceptBlock).not.toContain("from('enterprise_member_skills')");
    expect(acceptBlock).not.toContain("from('enterprise_member_role_allocations')");
    expect(acceptBlock).not.toContain("from('enterprise_invitations')");
  });

  it('keeps catalog/workspace IDs explicit and materializes them into the correct domains', () => {
    expect(positionPicker).toContain("source: 'workspace' | 'catalog'");
    expect(positionPicker).toContain('source: selectedRole.source');
    expect(positionPicker).toContain('materializedCatalogRoleIds');
    expect(positionPicker).not.toContain('usingGlobalCatalog');
    expect(inviteDialog).toContain('prefill.position_source = pickedPosition.source');
    expect(migration).toContain('FROM public.enterprise_workspace_roles');
    expect(migration).toContain('FROM public.enterprise_catalog_roles AS role');
    expect(migration).toContain('FROM public.enterprise_workspace_skills');
    expect(migration).toContain('FROM public.enterprise_catalog_skills');
    expect(migration).toContain('INSERT INTO public.enterprise_workspace_role_skills');
    expect(migration).toContain('FOR v_catalog_role_skill IN');
    expect(migration).toContain('FROM public.enterprise_catalog_role_skills AS role_skill');
    expect(migration).toContain("jsonb_build_array('workspace_skill_domain_repaired')");
    expect(migration).toContain('skill_id = EXCLUDED.skill_id');
    expect(migration).toContain('business_role_id = COALESCE(v_workspace_role_id, business_role_id)');
    expect(positionPicker).not.toContain('cats.length === 0 && rs.length === 0');
  });

  it('issues/reissues invitations atomically and does not expose tokens to an email-only JWT', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.issue_enterprise_invitation');
    expect(migration).toContain('ON CONFLICT (workspace_id, email) DO UPDATE SET');
    expect(migration).toContain('accepted_at = NULL');
    expect(migration).toContain("public.enterprise_invitations.role = 'member'::public.enterprise_role");
    expect(migration).toContain('Only a workspace owner may replace an elevated invitation');
    expect(migration).toContain('extensions.gen_random_bytes(32)');
    expect(inviteDialog).toContain("rpc(\n        'issue_enterprise_invitation'");
    expect(inviteDialog).not.toContain("from('enterprise_invitations')\n        .insert");
    expect(boundaryMigration).toContain('DROP POLICY IF EXISTS "Admins or invitee can view invitations"');
    expect(boundaryMigration).toContain('CREATE POLICY "Admins view workspace invitations"');
    expect(transactionalEmail).toContain('(await sha256Hex(invitation.token)).slice(0, 16)');
    expect(transactionalEmail).toContain(
      'enterprise-invite-${invitation.id}-${tokenFingerprint}',
    );
    expect(transactionalEmail).not.toContain('idempotencyKey = `enterprise-invite-${invitation.id}`');
  });

  it('preserves exactly one primary business-role allocation', () => {
    expect(inviteDialog).toContain(
      'allocations.find((allocation) => allocation.is_priority)?.business_role',
    );
    expect(migration).toContain("allocation.value ? 'is_priority'");
    expect(migration).toContain("allocation.value @> '{\"is_priority\": true}'::jsonb");
    expect(migration).toContain('DELETE FROM public.enterprise_member_role_allocations');
    expect(migration).toMatch(
      /AND abs\(\(\s+SELECT sum\(COALESCE\(\(allocation\.value ->> 'percentage'\)::numeric, 100\)\)/,
    );
    expect(migration).toContain('percentage, is_priority');
    expect(migration).toContain('is_priority = EXCLUDED.is_priority');
  });

  it('fails closed instead of letting tenant admins pre-claim global identities', () => {
    expect(createWorkspaceUser).toContain('code: "DIRECT_CREATE_DISABLED"');
    expect(createWorkspaceUser).not.toContain('admin.createUser');
    expect(createWorkspaceUser).not.toContain('email_confirm');
    expect(inviteDialog).not.toContain("functions.invoke('create-workspace-user'");
    expect(inviteDialog).not.toContain('members.mode_create');
  });
});
