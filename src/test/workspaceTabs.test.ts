import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_TAB_FEATURES,
  WORKSPACE_TAB_VALUES,
  isWorkspaceTab,
  isWorkspaceTabEntitled,
  normalizeWorkspaceTab,
} from '@/lib/workspaceTabs';

describe('workspace tab route normalization', () => {
  it.each(WORKSPACE_TAB_VALUES)('accepts the mounted tab %s', (tab) => {
    expect(isWorkspaceTab(tab)).toBe(true);
    expect(normalizeWorkspaceTab(tab)).toBe(tab);
  });

  it.each([null, undefined, '', 'unknown', '../settings', 'members?admin=1']) (
    'falls back for untrusted value %s',
    (tab) => {
      expect(normalizeWorkspaceTab(tab)).toBe('members');
    },
  );

  it('supports an explicit mounted fallback', () => {
    expect(normalizeWorkspaceTab('not-a-tab', 'my-portal')).toBe('my-portal');
  });

  it('defines a fail-closed entitlement contract for every mounted workspace tab', () => {
    expect(Object.keys(WORKSPACE_TAB_FEATURES).sort()).toEqual([...WORKSPACE_TAB_VALUES].sort());
    for (const tab of WORKSPACE_TAB_VALUES) {
      expect(WORKSPACE_TAB_FEATURES[tab].length).toBeGreaterThan(0);
      expect(isWorkspaceTabEntitled(tab, () => false)).toBe(false);
      const enabled = WORKSPACE_TAB_FEATURES[tab][0];
      expect(isWorkspaceTabEntitled(tab, (feature) => feature === enabled)).toBe(true);
    }
  });

  it('keeps Resources reachable when only the payroll add-on child feature is enabled', () => {
    expect(WORKSPACE_TAB_FEATURES.resources).toContain('payroll_engine');
    expect(isWorkspaceTabEntitled('resources', (feature) => feature === 'payroll_engine')).toBe(true);
  });
});
