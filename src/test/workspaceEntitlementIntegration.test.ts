import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'src', 'components');
const sidebar = readFileSync(join(root, 'shell', 'WorkspaceSidebar.tsx'), 'utf8');
const dashboard = readFileSync(join(root, 'enterprise', 'WorkspaceDashboard.tsx'), 'utf8');

describe('workspace navigation/content entitlement integration', () => {
  it('renders both navigation layouts from the same pre-filtered item model', () => {
    expect(sidebar).not.toContain('useEnabledFeatures');
    expect(sidebar).not.toContain('featureKey');
    expect(sidebar).toContain('{items.map((item) =>');
    expect(dashboard).toContain('const visibleTopNavItems = WORKSPACE_TOP_NAV_ITEMS.filter');
    expect(dashboard).toContain('items={visibleTopNavItems.map');
    expect(dashboard).toContain('{visibleTopNavItems.map((item) =>');
  });

  it('uses the same top-level entitlement helper for nav and mounted content', () => {
    expect(dashboard).toContain('isWorkspaceTabEntitled(tab, isFeatureEnabled)');
    expect(dashboard).toContain('return visible && hasTabEntitlement(item.value);');
    for (const tab of [
      'my-portal',
      'members',
      'calendar',
      'time-attendance',
      'requests',
      'resources',
      'reports-audit',
      'analytics',
      'developer',
      'security',
      'settings',
    ]) {
      expect(dashboard).toContain(`hasTabEntitlement('${tab}')`);
    }
  });

  it('does not mount Microsoft 365 settings outside its paid feature gate', () => {
    expect(dashboard).toMatch(
      /<FeatureGate workspaceId=\{workspace\.id\} feature="ms365_calendar_sync">[\s\S]*?<M365IntegrationPanel workspaceId=\{workspace\.id\} \/>[\s\S]*?<\/FeatureGate>/,
    );
  });

  it('fails closed before exposing the paid admin override action', () => {
    expect(dashboard).toMatch(
      /const canUseAdminOverride = canEdit\('admin_override'\)\s*&&\s*!featuresLoading\s*&&\s*!featuresError\s*&&\s*isFeatureEnabled\('admin_override'\);/,
    );
    expect(dashboard).toContain('canOverride={canUseAdminOverride}');
    expect(dashboard).toMatch(
      /const hasRequestsAccess =[\s\S]*?isAdmin[\s\S]*?canView\('approvals'\)[\s\S]*?canEdit\('approvals'\)[\s\S]*?canUseAdminOverride/,
    );
  });

  it('fails closed before mounting the privacy-sensitive birthday widget', () => {
    expect(dashboard).toMatch(
      /const canUseBirthdayWidget = canView\('members'\)\s*&&\s*!featuresLoading\s*&&\s*!featuresError\s*&&\s*isFeatureEnabled\('birthday_widget'\)\s*&&\s*isFeatureEnabled\('members_list'\);/,
    );
    expect(dashboard).toMatch(
      /canUseBirthdayWidget && \([\s\S]*?<BirthdayAnniversaryWidget[\s\S]*?workspaceId=\{workspace\.id\}[\s\S]*?workspaceTimeZone=\{workspace\.timezone\}[\s\S]*?\/>[\s\S]*?\)/,
    );
  });

  it('fails closed while member profile permissions or entitlements are loading', () => {
    expect(dashboard).toContain('loading: permissionsLoading');
    expect(dashboard).toMatch(
      /const canEditMemberProfiles = !permissionsLoading\s*&&\s*canEdit\('members'\)\s*&&\s*!featuresLoading\s*&&\s*!featuresError\s*&&\s*isFeatureEnabled\('members_list'\);/,
    );
    expect(dashboard).toContain('canEditMemberProfiles={canEditMemberProfiles}');
    expect(dashboard).toContain('canEditMember={canEditMemberProfiles}');
  });

  it('fails closed for iCal use while keeping token revocation mounted', () => {
    expect(dashboard).toMatch(
      /const canUseIcalFeed = !featuresLoading\s*&&\s*!featuresError\s*&&\s*isFeatureEnabled\('ical_feed'\);/,
    );
    expect(dashboard).toContain('canUseIcalFeed={canUseIcalFeed}');
    expect(dashboard).toContain('canCreateTeamFeed={isAdmin}');
    expect(dashboard).toContain('key={`${workspace.id}:${userId}`}');
    expect(dashboard).toContain("const canViewWorkspaceSettings = canView('settings');");
    expect(dashboard).toMatch(
      /<TabsContent value="my-portal"[\s\S]*?!canViewWorkspaceSettings[\s\S]*?<ICalSubscription[\s\S]*?<\/TabsContent>/,
    );
    expect(dashboard).toMatch(
      /canViewWorkspaceSettings && hasTabEntitlement\('settings'\)[\s\S]*?<WorkspaceSettings/,
    );
    expect(dashboard).not.toMatch(/<FeatureGate[^>]+feature="ical_feed"/);
  });
});
