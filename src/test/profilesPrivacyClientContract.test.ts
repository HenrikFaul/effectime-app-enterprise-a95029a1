import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("profiles privacy client contract", () => {
  it("keeps the birthday widget on the minimal versioned RPC with no raw-profile fallback", () => {
    const widget = source("src/components/enterprise/BirthdayAnniversaryWidget.tsx");
    const adapter = source("src/lib/workspaceMilestonesApi.ts");

    expect(widget).toContain("loadWorkspaceMemberMilestones(workspaceId");
    expect(widget).not.toContain(".from('profiles')");
    expect(widget).not.toContain('.from("profiles")');
    expect(widget).not.toContain("preferences");
    expect(adapter).toMatch(/client\.rpc\(["']get_workspace_member_milestones_v1["']/);
    expect(adapter).not.toContain(".from('profiles')");
    expect(adapter).not.toContain('.from("profiles")');
    expect(adapter).toMatch(/["']invalid-response["']/);
  });

  it("reads locale through a self-only RPC and persists by the real profiles user_id key", () => {
    const provider = source("src/i18n/I18nProvider.tsx");
    expect(provider).toContain(".rpc('get_my_profile_locale_v1')");
    expect(provider.match(/\.eq\('user_id', userId\)/g)).toHaveLength(1);
    expect(provider).not.toContain(".select('preferred_locale')");
    expect(provider).not.toContain(".eq('id', user.id)");
  });

  it("routes member edits through the atomic RPC while keeping global names self-only", () => {
    const sheet = source("src/components/enterprise/MemberProfileSheet.tsx");
    const adapter = source("src/lib/workspaceMemberProfileApi.ts");
    const dashboard = source("src/components/enterprise/WorkspaceDashboard.tsx");

    expect(sheet).toContain("saveWorkspaceMemberProfile(payload");
    expect(sheet).toContain("loadWorkspaceMemberProfileEditSnapshot(workspaceId, member.id");
    expect(sheet).toContain("expectedDisplayName: displayName === null");
    expect(sheet).not.toContain(".eq('membership_id', member.id)");
    expect(sheet).not.toContain("business_role, location, city, office_id, base_working_hours, profile_revision");
    expect(sheet).toContain("member?.user_id === currentUserId");
    expect(sheet).toContain("disabled={!canEditDisplayName}");
    expect(sheet).not.toMatch(/\.from\(["']profiles["']\)/);
    expect(sheet).not.toContain(".update(");
    expect(sheet).not.toContain(".delete(");
    expect(sheet).not.toContain(".insert(");
    expect(sheet).not.toContain(".upsert(");
    expect(sheet).toContain("isAdmin={canEditMember}");
    expect(sheet).not.toContain("isAdmin={isAdmin}");
    expect(adapter).toContain('rpc("save_workspace_member_profile_v1"');
    expect(adapter).toContain("p_expected_display_name: expectedDisplayName");
    expect(adapter).toContain('rpc("get_workspace_member_profile_edit_snapshot_v1"');
    expect(adapter).not.toMatch(/\.from\(["']profiles["']\)/);
    expect(dashboard).toContain("canEdit('members')");
    expect(dashboard).toContain("isFeatureEnabled('members_list')");
    expect(dashboard).toContain("canEditMember={canEditMemberProfiles}");
    expect(dashboard).toContain("currentUserId={userId}");
    expect(dashboard).not.toContain("isAdmin={true}");
  });

  it("refreshes all three member-profile mount projections with stale-result guards", () => {
    const memberList = source("src/components/enterprise/MemberList.tsx");
    const orgChart = source("src/components/enterprise/organization/OrgChart.tsx");
    const dashboard = source("src/components/enterprise/WorkspaceDashboard.tsx");

    expect(memberList).toContain("onMemberUpdated={fetchMembers}");
    expect(memberList).toContain("const fetchGenerationRef = useRef(0)");
    expect(memberList).toContain("fetchGenerationRef.current === generation");
    expect(orgChart).toMatch(
      /onMemberUpdated=\{\(\) => \{\s*void load\(\);\s*\}\}/,
    );
    expect(orgChart).toContain("const loadGenerationRef = useRef(0)");
    expect(orgChart).toContain("loadGenerationRef.current === generation");
    expect(orgChart).toContain("office_id, base_working_hours");
    expect(dashboard).toMatch(
      /onMemberUpdated=\{\(\) => \{\s*void fetchMyMembership\(\);\s*\}\}/,
    );
    expect(dashboard).toContain("const membershipLoadGenerationRef = useRef(0)");
    expect(dashboard).toContain("membershipLoadGenerationRef.current === generation");
  });

  it("keeps Capacity Fit on the safe coworker projection without a profile e-mail fallback", () => {
    const capacityFit = source("src/components/enterprise/agile/CapacityFit.tsx");

    expect(capacityFit).toContain(".select('user_id, display_name')");
    expect(capacityFit).not.toMatch(/\.select\(["'][^"']*email[^"']*["']\)/);
    expect(capacityFit).toContain("memberDirectoryStatus === 'error'");
    expect(capacityFit).toContain("memberDirectoryRetry");
  });
});
