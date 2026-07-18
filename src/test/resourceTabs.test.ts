import { describe, expect, it } from 'vitest';
import { getAvailableResourceTabs, RESOURCE_TAB_FEATURES, shouldShowProjectGantt } from '@/lib/resourceTabs';

function entitlementCheck(features: readonly string[]) {
  const enabled = new Set(features);
  return (feature: string) => enabled.has(feature);
}

describe('resource sub-tab entitlement mapping', () => {
  it('returns no tabs when the entitlement result is empty', () => {
    expect(getAvailableResourceTabs(() => false, true)).toEqual([]);
  });

  it('keeps Enterprise-only modules out of a Pro feature set', () => {
    const proFeatures = [
      RESOURCE_TAB_FEATURES.dashboard,
      RESOURCE_TAB_FEATURES.heatmap,
      RESOURCE_TAB_FEATURES.projects,
      RESOURCE_TAB_FEATURES.agile,
      RESOURCE_TAB_FEATURES.gaps,
    ];

    expect(getAvailableResourceTabs(entitlementCheck(proFeatures), true)).toEqual([
      'dashboard',
      'heatmap',
      'projects',
      'agile',
      'gaps',
    ]);
  });

  it('exposes scenario, financial, wellbeing and payroll modules only with their entitlements', () => {
    const enterpriseOnly = [
      RESOURCE_TAB_FEATURES.scenarios,
      RESOURCE_TAB_FEATURES.financials,
      RESOURCE_TAB_FEATURES.wellbeing,
      RESOURCE_TAB_FEATURES.payroll,
    ];

    expect(getAvailableResourceTabs(entitlementCheck(enterpriseOnly), true)).toEqual([
      'scenarios',
      'financials',
      'wellbeing',
      'payroll',
    ]);
  });

  it('keeps admin-only wellbeing and payroll tabs hidden from non-admin members', () => {
    const enabled = entitlementCheck(Object.values(RESOURCE_TAB_FEATURES));

    expect(getAvailableResourceTabs(enabled, false)).not.toContain('wellbeing');
    expect(getAvailableResourceTabs(enabled, false)).not.toContain('payroll');
  });

  it('mounts the project Gantt only with its dedicated entitlement', () => {
    expect(shouldShowProjectGantt(entitlementCheck(['projects']))).toBe(false);
    expect(shouldShowProjectGantt(entitlementCheck(['projects', 'gantt_timeline']))).toBe(true);
  });
});
