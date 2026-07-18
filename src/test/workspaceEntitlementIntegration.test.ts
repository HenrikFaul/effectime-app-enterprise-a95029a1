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
});
