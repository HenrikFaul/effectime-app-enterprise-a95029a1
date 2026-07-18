export const RESOURCE_TAB_FEATURES = {
  dashboard: 'resource_dashboard',
  heatmap: 'utilization_heatmap',
  projects: 'projects',
  agile: 'agile_panel',
  scenarios: 'scenario_planner',
  financials: 'financials',
  gaps: 'capacity_gap',
  wellbeing: 'burnout_engine',
  payroll: 'payroll_engine',
} as const;

export type ResourceTabKey = keyof typeof RESOURCE_TAB_FEATURES;

export function shouldShowProjectGantt(isEnabled: (feature: string) => boolean): boolean {
  return isEnabled('gantt_timeline');
}

const ADMIN_ONLY_RESOURCE_TABS = new Set<ResourceTabKey>(['wellbeing', 'payroll']);

export function getAvailableResourceTabs(
  isEnabled: (feature: string) => boolean,
  isAdmin: boolean,
): ResourceTabKey[] {
  return (Object.keys(RESOURCE_TAB_FEATURES) as ResourceTabKey[]).filter((tab) => (
    (isAdmin || !ADMIN_ONLY_RESOURCE_TABS.has(tab)) && isEnabled(RESOURCE_TAB_FEATURES[tab])
  ));
}
