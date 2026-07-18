import { describe, expect, it } from 'vitest';
import {
  canManageIntegration,
  isKnownIntegrationAction,
  isSafeIntegrationBaseUrl,
  requiredIntegrationFeature,
} from '../../supabase/functions/jira-devops-proxy/security';

describe('Jira/Azure DevOps proxy security boundary', () => {
  it('rejects unknown actions and maps known actions to server-side entitlements', () => {
    expect(isKnownIntegrationAction('delete_everything')).toBe(false);
    expect(requiredIntegrationFeature('jira', 'test_connection')).toBe('jira_integration');
    expect(requiredIntegrationFeature('azure_devops', 'sync_project_config')).toBe('azure_devops');
    expect(requiredIntegrationFeature('jira', 'update_issue')).toBe('issue_writeback');
    expect(requiredIntegrationFeature('jira', 'search_issues')).toBe('agile_panel');
    expect(requiredIntegrationFeature('jira', 'unknown')).toBeNull();
  });

  it('limits configuration and write actions to the documented admin roles', () => {
    expect(canManageIntegration('owner')).toBe(true);
    expect(canManageIntegration('resourceAssistant')).toBe(true);
    expect(canManageIntegration('member')).toBe(false);
    expect(canManageIntegration(null)).toBe(false);
  });

  it.each([
    'http://jira.example.com',
    'https://localhost:8443',
    'https://127.0.0.1',
    'https://10.1.2.3',
    'https://172.16.0.1',
    'https://192.168.1.2',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]',
    'https://user:password@jira.example.com',
    'not-a-url',
  ])('rejects non-public integration targets: %s', (url) => {
    expect(isSafeIntegrationBaseUrl(url)).toBe(false);
  });

  it.each([
    'https://example.atlassian.net',
    'https://jira.example.com/root',
    'https://dev.azure.com/example',
  ])('accepts a syntactically public HTTPS integration target: %s', (url) => {
    expect(isSafeIntegrationBaseUrl(url)).toBe(true);
  });
});
