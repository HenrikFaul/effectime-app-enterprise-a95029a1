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

  it("keeps global display-name changes self-only and off profile insert/upsert paths", () => {
    const sheet = source("src/components/enterprise/MemberProfileSheet.tsx");
    const adapter = source("src/lib/workspaceMemberProfileApi.ts");
    const dashboard = source("src/components/enterprise/WorkspaceDashboard.tsx");

    expect(sheet).toContain("updateMyWorkspaceProfileDisplayName(");
    expect(sheet).toContain("member?.user_id === currentUserId");
    expect(sheet).toContain("disabled={!canEditDisplayName}");
    expect(sheet).not.toMatch(/\.from\(["']profiles["']\)/);
    expect(sheet).not.toContain(".upsert(");
    expect(adapter).toContain('rpc("update_my_workspace_profile_display_name_v1"');
    expect(adapter).not.toMatch(/\.from\(["']profiles["']\)/);
    expect(dashboard).toContain("currentUserId={userId}");
    expect(dashboard).not.toContain("isAdmin={true}");
  });

  it("keeps Capacity Fit on the safe coworker projection without a profile e-mail fallback", () => {
    const capacityFit = source("src/components/enterprise/agile/CapacityFit.tsx");

    expect(capacityFit).toContain(".select('user_id, display_name')");
    expect(capacityFit).not.toMatch(/\.select\(["'][^"']*email[^"']*["']\)/);
    expect(capacityFit).toContain("memberDirectoryStatus === 'error'");
    expect(capacityFit).toContain("memberDirectoryRetry");
  });
});
