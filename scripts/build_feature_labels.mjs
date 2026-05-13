#!/usr/bin/env node
/**
 * Generates the `features.*` i18n entries (name + description) for the EN
 * and HU bundles from a translation table plus the HU source-of-truth in
 * docs/tiering/features.json.
 *
 * Output: writes a TypeScript snippet to stdout that should be pasted into
 * `src/i18n/resources/en.ts` and `src/i18n/resources/hu.ts` inside the
 * `features:` namespace (created once).
 *
 *   node scripts/build_feature_labels.mjs en  > /tmp/en_features.ts
 *   node scripts/build_feature_labels.mjs hu  > /tmp/hu_features.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const features = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/tiering/features.json'), 'utf8'));

const target = process.argv[2] || 'en';

// EN translation table for all 135 features. Hand-translated from the HU
// seed (`docs/tiering/features.json`); keep descriptions ~1 line, business-
// language, no jargon a non-engineer wouldn't understand. The HU bundle is
// generated automatically from the JSON.
const EN = {
  // admin
  admin_api: { name: 'Platform admin API', description: 'Service operations.' },
  admin_dashboard: { name: 'Platform admin dashboard', description: 'SaaS operations.' },
  email_preview: { name: 'Email preview', description: 'Developer tool.' },
  superadmin_control_plane: { name: 'Superadmin Control Plane', description: 'Platform control plane.' },
  // agile
  agile_gantt: { name: 'Agile Gantt', description: 'Hybrid view.' },
  agile_panel: { name: 'Agile panel', description: 'Agile teams.' },
  azure_devops: { name: 'Azure DevOps integration', description: 'Microsoft ecosystem.' },
  backlog_browser: { name: 'Backlog browser', description: 'Backlog grooming.' },
  capacity_fit: { name: 'Capacity fit', description: 'Sprint capacity match.' },
  issue_writeback: { name: 'Issue write-back', description: 'Two-way Jira sync.' },
  jira_integration: { name: 'Jira integration', description: 'Atlassian ecosystem.' },
  jira_issue_editor: { name: 'Jira issue editor', description: 'Inline edit.' },
  kanban: { name: 'Kanban board', description: 'Visual workflow.' },
  scrum: { name: 'Scrum board', description: 'Sprint management.' },
  // ai
  ai_burnout_predict: { name: 'Burnout prediction', description: 'Wellbeing forecast.' },
  ai_chat_assist: { name: 'Chat assistant (Slack/Teams slash cmd)', description: 'Assistant channel.' },
  ai_smart_schedule: { name: 'Smart Schedule (AI suggestions)', description: 'AI assistant.' },
  // approvals
  admin_override: { name: 'Admin override', description: 'Emergency intervention.' },
  approval_bulk: { name: 'Bulk approval', description: 'Efficiency for large teams.' },
  approval_chain: { name: 'Approval chain config', description: 'Multi-level workflow.' },
  approval_inbox: { name: 'Approver inbox', description: 'Manager workflow.' },
  approval_individual: { name: 'Individual approval', description: 'Basic decision making.' },
  decision_memory: { name: 'Decision memory monitor', description: 'Expired decisions.' },
  escalation: { name: 'Escalation', description: 'SLA enforcement.' },
  // attendance
  attendance_audit: { name: 'Attendance audit', description: 'Compliance.' },
  attendance_edit_mode: { name: 'Edit mode + batch drag', description: 'UX accelerator.' },
  attendance_log: { name: 'Time attendance log', description: 'Time tracking.' },
  attendance_oncall: { name: 'On-call duty', description: '24/7 teams.' },
  attendance_periods: { name: 'Period workflow', description: 'Month-end close.' },
  payroll_export: { name: 'Payroll export', description: 'Payroll handoff.' },
  site_assignment: { name: 'Site assignment', description: 'Shift / site.' },
  // auth
  account_delete: { name: 'Delete account (GDPR)', description: 'GDPR compliance.' },
  auth_email_login: { name: 'Email login', description: 'Daily sign-in.' },
  auth_email_signup: { name: 'Email sign-up', description: 'User entry point; prerequisite for every feature.' },
  auth_google_oauth: { name: 'Google OAuth', description: 'Friction-free login with Google.' },
  auth_magic_link: { name: 'Magic link', description: 'Passwordless login.' },
  auth_password_reset: { name: 'Password reset', description: 'Self-service recovery.' },
  email_unsubscribe: { name: 'Unsubscribe', description: 'CAN-SPAM / GDPR.' },
  profile_edit: { name: 'Edit profile', description: 'User base-data maintenance.' },
  // calendar
  annual_trend: { name: 'Annual trend chart', description: 'Trend analysis.' },
  annual_view: { name: 'Annual view', description: 'Annual planning.' },
  birthday_widget: { name: 'Birthdays widget', description: 'Team cohesion.' },
  calendar_filters: { name: 'Calendar filters', description: 'Personalized view.' },
  calendar_monthly: { name: 'Monthly calendar', description: 'Visual overview.' },
  coverage_planner: { name: 'Coverage planner', description: 'Shift / coverage.' },
  google_calendar_sync: { name: 'Google Workspace calendar sync', description: 'Google-first companies.' },
  ical_feed: { name: 'iCal feed', description: 'Outlook / Google subscribe.' },
  ms365_calendar_sync: { name: 'M365 calendar sync (two-way)', description: 'Enterprise go / no-go.' },
  skill_capacity_report: { name: 'Skill capacity report', description: 'Skill bottleneck.' },
  timeline_view: { name: 'Timeline view', description: 'Long-period overview.' },
  // help
  help_drawer: { name: 'Contextual help', description: 'Onboarding aid.' },
  help_regenerator: { name: 'Help article regenerator', description: 'AI content.' },
  help_registry: { name: 'Help anchor registry', description: 'Developer infrastructure.' },
  // leave
  allowances: { name: 'Allowances management', description: 'Cafeteria / benefits.' },
  leave_cancel: { name: 'Cancel request', description: 'User self-service.' },
  leave_conflict_check: { name: 'Conflict check', description: 'Team coverage protection.' },
  leave_half_day: { name: 'Half-day request', description: 'Flexibility.' },
  leave_my_view: { name: 'My requests', description: 'Overview.' },
  leave_private: { name: 'Private request', description: 'Sensitive leave (medical).' },
  leave_quota_balance: { name: 'Quota balance', description: 'Remaining days calculation.' },
  leave_quotas: { name: 'Quota admin', description: 'HR rules.' },
  leave_submit: { name: 'Submit leave request', description: 'Self-service baseline.' },
  leave_team_view: { name: 'Team requests', description: 'Manager visibility.' },
  substitute_inbox: { name: 'Substitution request', description: 'Coverage guarantee.' },
  // members
  instant_member_create: { name: 'Instant member create', description: 'Bulk onboarding from ATS.' },
  invitation_accept: { name: 'Accept invitation', description: 'Invite flow closure.' },
  member_deactivate: { name: 'Deactivate member', description: 'Leavers.' },
  member_edit: { name: 'Edit member data', description: 'HR base data.' },
  member_role_change: { name: 'Change member role', description: 'Permissions management.' },
  members_invite: { name: 'Invite member', description: 'Team building.' },
  members_list: { name: 'List members', description: 'Team transparency.' },
  offices: { name: 'Offices / sites', description: 'Site organization.' },
  teams: { name: 'Manage teams', description: 'Team structure.' },
  // org
  contract_types: { name: 'Contract types', description: 'Employment type.' },
  industries: { name: 'Industries', description: 'Benchmark targeting.' },
  job_families: { name: 'Job families', description: 'Career path.' },
  leadership_levels: { name: 'Leadership levels', description: 'Hierarchy category.' },
  org_chart: { name: 'Org chart view', description: 'Visual hierarchy.' },
  org_chart_fullscreen: { name: 'Org chart fullscreen', description: 'Presentation mode.' },
  org_chart_panzoom: { name: 'Org chart pan / zoom', description: 'Large org browsing.' },
  org_chart_snapshot: { name: 'Org chart snapshot', description: 'Historical archive.' },
  org_structure: { name: 'Organizational structure', description: 'Org model.' },
  work_categories: { name: 'Work categories', description: 'Cost-center breakdown.' },
  // platform
  feature_flags: { name: 'Platform Feature Flags', description: 'Tier baseline.' },
  multilingual: { name: '5-locale full coverage', description: 'EU coverage.' },
  open_api: { name: 'Open API / Developer Platform', description: 'API access.' },
  payroll_engine: { name: 'Payroll Integration Engine', description: 'Multi-payroll system.' },
  soc2_iso: { name: 'SOC 2 / ISO 27001 Security Center', description: 'Compliance evidence.' },
  // reports
  audit_log: { name: 'Audit log', description: 'Compliance / SOC 2.' },
  burnout_engine: { name: 'Burnout & Wellbeing engine', description: 'Wellbeing prediction.' },
  executive_dashboard: { name: 'Executive Analytics', description: 'C-suite KPI dashboard.' },
  export_center: { name: 'Report export', description: 'CSV / XLSX download.' },
  run_report: { name: 'Run report', description: 'Manager KPI.' },
  scheduled_reports: { name: 'Scheduled report', description: 'Email report.' },
  // resources
  business_roles: { name: 'Business role management', description: 'Role catalog.' },
  capacity_dna: { name: 'Capacity DNA', description: 'Team DNA profile.' },
  capacity_gap: { name: 'Capacity gap report', description: 'Hiring plan.' },
  financials: { name: 'Financial panel', description: 'Cost / revenue.' },
  gantt_timeline: { name: 'Gantt timeline', description: 'Classic planning tool.' },
  project_editor: { name: 'Project editor', description: 'CRUD.' },
  projects: { name: 'Projects', description: 'Project model.' },
  resource_dashboard: { name: 'Resource overview', description: 'Capacity dashboard.' },
  scenario_planner: { name: 'Scenario planner', description: 'What-if analysis.' },
  skills_mgmt: { name: 'Manage skills', description: 'Skill matrix.' },
  utilization_heatmap: { name: 'Utilization heatmap', description: 'Over / under-load.' },
  // rules
  company_days: { name: 'Company-wide days', description: 'Company closed.' },
  holiday_sync: { name: 'Holiday sync', description: 'Per-country automation.' },
  holidays: { name: 'Holidays', description: 'Workday calculation.' },
  leave_blocked_dates: { name: 'Blocked dates', description: 'Peak-period protection.' },
  leave_daily_rules: { name: 'Daily rules (headcount)', description: 'Minimum coverage.' },
  leave_types: { name: 'Leave types', description: 'Type taxonomy.' },
  office_coverage_rules: { name: 'Office coverage rules', description: 'Site-level control.' },
  rule_templates: { name: 'Rule template library', description: 'Quick configuration.' },
  // settings
  branding: { name: 'Branding', description: 'White-label / logo.' },
  csv_import: { name: 'CSV import', description: 'Bulk migration.' },
  help_settings: { name: 'Help system settings', description: 'KB editing.' },
  integration_health: { name: 'Integration health', description: 'Monitoring.' },
  localization: { name: 'Localization / translation', description: '5 languages.' },
  notification_prefs: { name: 'Notification preferences', description: 'Self-service.' },
  notifications: { name: 'Notifications', description: 'Email / in-app.' },
  role_permissions: { name: 'Role permissions', description: 'Granular RBAC.' },
  ui_section_state: { name: 'UI section state', description: 'UI customization.' },
  ws_general: { name: 'General workspace settings', description: 'TZ / locale / name.' },
  // workflows
  access_inbox: { name: 'Access inbox', description: 'Approval workflow.' },
  access_systems: { name: 'Access systems', description: 'IT system catalog.' },
  access_templates: { name: 'Access request templates', description: 'Standardized request.' },
  onboarding_inbox: { name: 'Onboarding inbox', description: 'Task tracking.' },
  onboarding_template: { name: 'Onboarding template', description: 'New-hire checklist.' },
  // workspace
  demo_workspace_seed: { name: 'Demo workspace seed', description: 'Onboarding accelerator for new customers.' },
  recovery_mode: { name: 'Recovery mode', description: 'Emergency recovery with superadmin.' },
  workspace_archive: { name: 'Archive workspace', description: 'Lifecycle management.' },
  workspace_create: { name: 'Create workspace', description: 'Tenancy baseline; prerequisite for every enterprise feature.' },
  workspace_delete: { name: 'Delete workspace', description: 'Hard delete + GDPR.' },
  workspace_general_settings: { name: 'General workspace settings (TZ, locale)', description: 'Localization + time zone.' },
  workspace_select: { name: 'Switch workspace', description: 'Manage multiple companies / projects with one account.' },
};

// Sanity check: every feature in the catalog has an EN translation.
const missing = features.filter((f) => !EN[f.feature_key]).map((f) => f.feature_key);
if (missing.length > 0) {
  console.error(`EN translation missing for: ${missing.join(', ')}`);
  process.exit(1);
}

const out = [];
const sorted = [...features].sort((a, b) => a.feature_key.localeCompare(b.feature_key));
for (const f of sorted) {
  const tr = target === 'en'
    ? EN[f.feature_key]
    : { name: f.name, description: f.description ?? '' };
  // Escape single quotes in TS string literals
  const esc = (s) => (s ?? '').replace(/'/g, "\\'");
  out.push(`    ${f.feature_key}: { name: '${esc(tr.name)}', description: '${esc(tr.description)}' },`);
}

process.stdout.write(out.join('\n') + '\n');
