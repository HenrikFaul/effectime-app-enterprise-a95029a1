export type IntegrationProvider = 'jira' | 'azure_devops';

export const CONFIG_ACTIONS = new Set(['test_connection', 'discover_fields', 'sync_project_config']);
export const WRITE_ACTIONS = new Set(['create_issue', 'update_issue']);
export const READ_ACTIONS = new Set([
  'search_issues',
  'get_issue',
  'get_transitions',
  'search_assignable_users',
]);

export function isKnownIntegrationAction(action: string): boolean {
  return CONFIG_ACTIONS.has(action) || WRITE_ACTIONS.has(action) || READ_ACTIONS.has(action);
}

/** Matches the AGL-006/009/010 product contract and integration RLS role set. */
export function canManageIntegration(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'resourceAssistant';
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true;
  if (/^(fc|fd|fe[89ab])/i.test(host)) return true;
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export function isSafeIntegrationBaseUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
}

export function requiredIntegrationFeature(provider: IntegrationProvider, action: string): string | null {
  if (CONFIG_ACTIONS.has(action)) return provider === 'jira' ? 'jira_integration' : 'azure_devops';
  if (WRITE_ACTIONS.has(action)) return 'issue_writeback';
  if (READ_ACTIONS.has(action)) return 'agile_panel';
  return null;
}
