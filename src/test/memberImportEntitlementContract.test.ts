import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const importer = readFileSync(
  join(root, 'supabase/functions/import-entity-data/index.ts'),
  'utf8',
);
const entitlement = readFileSync(
  join(root, 'supabase/functions/import-entity-data/entitlement.ts'),
  'utf8',
);

describe('bulk member invitation entitlement contract', () => {
  it('uses the service-side tenant mapping and exact feature union', () => {
    expect(entitlement).toContain('.from("tenant_workspaces")');
    expect(entitlement).toContain('.select("tenant_id")');
    expect(entitlement).toContain('.eq("workspace_id", workspaceId)');
    expect(entitlement).toContain('client.rpc("tenant_enabled_features"');
    expect(entitlement).toContain('parseLookupResult(tenantEnvelope)');
    expect(entitlement).toContain('parseLookupResult(featureEnvelope)');
    expect(entitlement).toMatch(
      /\.feature_key ===\s+MEMBERS_INVITE_FEATURE_KEY/,
    );
    expect(entitlement).toContain('!featureResult.data.every(isEnabledFeatureRow)');
  });

  it('gates dry-run accounting before the existing invitation RPC', () => {
    const start = importer.indexOf('const createInvitation = async () =>');
    const end = importer.indexOf('\n    if (!userId)', start);
    const invitationPath = importer.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(invitationPath).toContain('planMembersInviteInvitation(');
    expect(invitationPath.indexOf("invitationPlan.kind === 'blocked'"))
      .toBeLessThan(invitationPath.indexOf('summary.created++'));
    expect(invitationPath.indexOf("invitationPlan.kind === 'dry_run'"))
      .toBeLessThan(invitationPath.indexOf("client.rpc('issue_enterprise_invitation'"));
    expect(importer).toContain("client.rpc('issue_enterprise_invitation'");
    expect(importer).not.toContain("from('enterprise_invitations').insert");
    expect(invitationPath).not.toContain('message: error.message');
    expect(invitationPath).toContain("message: 'Invitation could not be issued'");
    expect(invitationPath).toContain('errorCode,');
    expect(invitationPath).not.toMatch(/console\.error\([\s\S]*?\berror,\s*\}/);
    expect(importer).not.toContain('${membersInviteEntitlement.error}');
    expect(importer).toContain(
      "return jsonResponse({ error: 'Import dependency is temporarily unavailable' }, 503)",
    );
  });

  it('keeps existing-member updates outside the invitation entitlement gate', () => {
    expect(importer).toContain('hasMemberInvitationCandidate(');
    const updateStart = importer.indexOf('if (existingUserIds.has(userId))');
    const invitationElse = importer.indexOf(
      '// A global account is not tenant consent.',
      updateStart,
    );
    const existingMemberPath = importer.slice(updateStart, invitationElse);

    expect(updateStart).toBeGreaterThan(-1);
    expect(invitationElse).toBeGreaterThan(updateStart);
    expect(existingMemberPath).toContain(".from('enterprise_memberships')");
    expect(existingMemberPath).not.toContain('membersInviteEntitlement');
  });
});
