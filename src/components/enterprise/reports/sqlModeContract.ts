export const SQL_MODE_ALLOWED_TABLES = [
  'enterprise_memberships',
  'enterprise_member_role_allocations',
  'enterprise_teams',
  'enterprise_team_roles',
  'enterprise_offices',
  'enterprise_holidays',
  'enterprise_company_leave_days',
  'enterprise_blocked_dates',
  'enterprise_daily_rules',
  'leave_requests',
  'approval_decisions',
  'enterprise_audit_events',
  'enterprise_role_definitions',
] as const;

// This exact example is covered by the backend report-DSL contract test.
export const SQL_MODE_EXAMPLE = `SELECT business_role, percentage
FROM enterprise_member_role_allocations
ORDER BY business_role ASC
LIMIT 100;`;
