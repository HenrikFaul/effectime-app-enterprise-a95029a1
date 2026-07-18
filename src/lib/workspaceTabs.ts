import { RESOURCE_TAB_FEATURES } from '@/lib/resourceTabs';

export const WORKSPACE_TAB_VALUES = [
  'my-portal',
  'members',
  'organization',
  'calendar',
  'time-attendance',
  'requests',
  'workflows',
  'resources',
  'reports-audit',
  'analytics',
  'developer',
  'security',
  'settings',
] as const;

export type WorkspaceTab = (typeof WORKSPACE_TAB_VALUES)[number];

/** Representative top-level entitlement(s) for each mounted workspace module. */
export const WORKSPACE_TAB_FEATURES: Record<WorkspaceTab, readonly string[]> = {
  'my-portal': ['leave_my_view'],
  members: ['members_list'],
  organization: ['org_structure'],
  calendar: ['calendar_monthly'],
  'time-attendance': ['attendance_log'],
  requests: ['leave_submit', 'leave_team_view', 'approval_inbox'],
  workflows: ['approval_inbox'],
  resources: Object.values(RESOURCE_TAB_FEATURES),
  'reports-audit': ['run_report', 'audit_log', 'export_center'],
  analytics: ['executive_dashboard'],
  developer: ['open_api'],
  security: ['soc2_iso'],
  settings: ['ws_general'],
};

const WORKSPACE_TAB_SET = new Set<string>(WORKSPACE_TAB_VALUES);

export function isWorkspaceTab(value: string | null | undefined): value is WorkspaceTab {
  return typeof value === 'string' && WORKSPACE_TAB_SET.has(value);
}

/**
 * Normalizes untrusted route/query input before it is passed to the tab shell.
 * Unknown values fall back to a real mounted tab instead of leaving the
 * dashboard in a blank state.
 */
export function normalizeWorkspaceTab(
  value: string | null | undefined,
  fallback: WorkspaceTab = 'members',
): WorkspaceTab {
  return isWorkspaceTab(value) ? value : fallback;
}

export function isWorkspaceTabEntitled(
  tab: WorkspaceTab,
  isEnabled: (feature: string) => boolean,
): boolean {
  return WORKSPACE_TAB_FEATURES[tab].some(isEnabled);
}
