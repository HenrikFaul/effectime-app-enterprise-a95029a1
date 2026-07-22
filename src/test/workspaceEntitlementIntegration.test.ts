import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'src', 'components');
const sidebar = readFileSync(join(root, 'shell', 'WorkspaceSidebar.tsx'), 'utf8');
const dashboard = readFileSync(join(root, 'enterprise', 'WorkspaceDashboard.tsx'), 'utf8');
const recoveryPanel = readFileSync(join(root, 'enterprise', 'EntitlementRecoveryPanel.tsx'), 'utf8');
const revocationList = readFileSync(join(root, 'enterprise', 'ICalTokenRevocationList.tsx'), 'utf8');
const pluginCleanup = readFileSync(join(root, 'marketplace', 'InstalledPluginCleanupPanel.tsx'), 'utf8');

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
      /const canUseAdminOverride = canEdit\('admin_override'\)\s*&&\s*featureAccessAvailable\s*&&\s*isFeatureEnabled\('admin_override'\);/,
    );
    expect(dashboard).toContain('canOverride={canUseAdminOverride}');
    expect(dashboard).toMatch(
      /const hasRequestsAccess =[\s\S]*?isAdmin[\s\S]*?canView\('approvals'\)[\s\S]*?canEdit\('approvals'\)[\s\S]*?canUseAdminOverride/,
    );
  });

  it('fails closed before mounting the privacy-sensitive birthday widget', () => {
    expect(dashboard).toMatch(
      /const canUseBirthdayWidget = canView\('members'\)\s*&&\s*featureAccessAvailable\s*&&\s*isFeatureEnabled\('birthday_widget'\)\s*&&\s*isFeatureEnabled\('members_list'\);/,
    );
    expect(dashboard).toMatch(
      /canUseBirthdayWidget && \([\s\S]*?<BirthdayAnniversaryWidget[\s\S]*?workspaceId=\{workspace\.id\}[\s\S]*?workspaceTimeZone=\{workspace\.timezone\}[\s\S]*?\/>[\s\S]*?\)/,
    );
  });

  it('fails closed while member profile permissions or entitlements are loading', () => {
    expect(dashboard).toContain('loading: permissionsLoading');
    expect(dashboard).toMatch(
      /const canEditMemberProfiles = !permissionsLoading\s*&&\s*canEdit\('members'\)\s*&&\s*featureAccessAvailable\s*&&\s*isFeatureEnabled\('members_list'\);/,
    );
    expect(dashboard).toContain('canEditMemberProfiles={canEditMemberProfiles}');
    expect(dashboard).toContain('canEditMember={canEditMemberProfiles}');
  });

  it('fails closed for iCal use while keeping token revocation mounted', () => {
    expect(dashboard).toMatch(
      /const canUseIcalFeed = featureAccessAvailable\s*&&\s*isFeatureEnabled\('ical_feed'\);/,
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

  it('mounts a sanitized recovery surface outside every entitlement-gated tab', () => {
    const recoveryIndex = dashboard.indexOf('<EntitlementRecoveryPanel');
    const firstTabIndex = dashboard.indexOf('<TabsContent');
    expect(recoveryIndex).toBeGreaterThan(-1);
    expect(recoveryIndex).toBeLessThan(firstTabIndex);
    expect(dashboard).toContain('showRecovery: showEntitlementRecovery');
    expect(dashboard).toContain(
      'resolveEntitlementSurfaceState(featuresSuccess, featuresError, entitlementRetrying)',
    );
    expect(dashboard).toContain('await Promise.resolve().then(() => refetchFeatures());');
    expect(dashboard).toContain('key={entitlementContextKey}');
    expect(recoveryPanel).toContain('<ICalTokenRevocationList workspaceId={workspaceId} userId={userId} />');
    expect(recoveryPanel).not.toContain('error.message');
  });

  it('keeps outage revocation token-free and scopes deletion to the current actor and workspace', () => {
    expect(revocationList).toContain(".select('id, scope')");
    expect(revocationList).not.toMatch(/\.select\([^)]*token/);
    expect(revocationList).toMatch(
      /\.delete\(\{ count: 'exact' \}\)[\s\S]*?\.eq\('id', id\)[\s\S]*?\.eq\('workspace_id', workspaceId\)[\s\S]*?\.eq\('user_id', userId\)/,
    );
  });

  it('fails closed for paid header actions and repairs hidden deep links only from authorized tabs', () => {
    expect(dashboard).toContain('isAdmin && featureAccessAvailable && <CommandCenterButton');
    expect(dashboard).toContain('isAdmin && featureAccessAvailable && <OrgPulseButton');
    expect(dashboard).toContain("isAdmin && featureAccessAvailable && hasTabEntitlement('members')");
    expect(dashboard).toContain('const firstVisibleTab = visibleTopNavItems[0]?.value;');
    expect(dashboard).toContain('if (featureAccessAvailable && firstVisibleTab && !activeTabIsVisible)');
    expect(dashboard).toContain('setActiveTab(firstVisibleTab, { replace: true });');
  });

  it('keeps exact-owner plugin cleanup outside the marketplace browse entitlement', () => {
    expect(dashboard).toContain("import { InstalledPluginCleanupPanel } from '@/components/marketplace/InstalledPluginCleanupPanel';");
    expect(dashboard).toMatch(
      /userRole === 'owner' && \([\s\S]*?<InstalledPluginCleanupPanel workspaceId=\{workspace\.id\} \/>[\s\S]*?\)/,
    );

    const cleanupIndex = dashboard.indexOf('<InstalledPluginCleanupPanel');
    const marketplaceGateIndex = dashboard.indexOf('feature="plugin_marketplace_browse"');
    expect(cleanupIndex).toBeGreaterThan(-1);
    expect(marketplaceGateIndex).toBeGreaterThan(cleanupIndex);

    expect(pluginCleanup).toContain('useInstalledPlugins(workspaceId)');
    expect(pluginCleanup).toContain('uninstallPlugin(installation.id)');
    expect(pluginCleanup).not.toContain('useMarketplacePlugins');
    expect(pluginCleanup).not.toContain(".from('workspace_installed_plugins')");
  });
});
