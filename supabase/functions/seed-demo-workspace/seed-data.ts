// ============================================================
// SEED DATA MANIFEST
// ============================================================
// Ez a fájl az egyetlen gépileg olvasható forrása az összes
// demo workspace entitásnak. Emberi-olvasható párja:
//   .governance/entity-creation-inventory.md
//
// GOVERNANCE SZABÁLY:
//   Ha új tab / menü / dialog kerül az appba ahol új entitást
//   lehet létrehozni, ezt a fájlt ÉS az entity-creation-inventory.md
//   fájlt is frissíteni kell egyidejűleg.
//   A seed/index.ts-ben az új entitáshoz insert logikát is kell adni.
// ============================================================

// ── A. TAGOK ─────────────────────────────────────────────────────────────────

export const DEMO_PERSONAS = [
  { display_name: 'Anna Kovács',    team: 'Frontend',    city: 'Budapest', position: 'Senior Frontend Developer',  seniority: 'senior' as const },
  { display_name: 'Bence Tóth',     team: 'Backend',     city: 'Budapest', position: 'Backend Developer',           seniority: 'medior' as const },
  { display_name: 'Csilla Nagy',    team: 'Operations',  city: 'Debrecen', position: 'Operations Lead',             seniority: 'lead'   as const },
  { display_name: 'Dávid Szabó',    team: 'Frontend',    city: 'Budapest', position: 'Junior Frontend Developer',   seniority: 'junior' as const },
  { display_name: 'Eszter Kiss',    team: 'QA',          city: 'Szeged',   position: 'QA Engineer',                 seniority: 'medior' as const },
  { display_name: 'Ferenc Horváth', team: 'Backend',     city: 'Budapest', position: 'Senior Backend Developer',    seniority: 'senior' as const },
  { display_name: 'Gizella Varga',  team: 'Operations',  city: 'Debrecen', position: 'Operations Specialist',       seniority: 'medior' as const },
];

export const SKILL_NAMES = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'Tailwind CSS', 'Cypress', 'Jest'];
export const SKILL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#22c55e', '#f97316', '#ec4899'];

// ── B. IRODÁK ─────────────────────────────────────────────────────────────────

export const OFFICE_DEFS = [
  { name: 'Budapest HQ',    city: 'Budapest', address: 'Andrássy út 1, 1061 Budapest' },
  { name: 'Debrecen Office', city: 'Debrecen', address: 'Piac u. 20, 4024 Debrecen' },
  { name: 'Szeged Office',  city: 'Szeged',   address: 'Kárász u. 5, 6720 Szeged' },
];

// ── C. CSAPATOK ──────────────────────────────────────────────────────────────

export const TEAM_DEFS = [
  { name: 'Frontend',   description: 'Frontend / web app team' },
  { name: 'Backend',    description: 'Backend / API team' },
  { name: 'Operations', description: 'Operations and infrastructure' },
  { name: 'QA',         description: 'Quality assurance' },
];

// ── D. SZABADSÁG TÍPUSOK ─────────────────────────────────────────────────────

export const LEAVE_TYPE_DEFS = [
  { name: 'Éves szabadság',  color: '#3b82f6', is_paid: true,  requires_approval: true  },
  { name: 'Betegszabadság',  color: '#ef4444', is_paid: true,  requires_approval: false },
  { name: 'Fizetés nélküli', color: '#a855f7', is_paid: false, requires_approval: true  },
  { name: 'Otthoni munka',   color: '#10b981', is_paid: true,  requires_approval: false },
];

// ── E. ÜNNEPNAPOK ────────────────────────────────────────────────────────────

export const HU_HOLIDAYS_TEMPLATE = [
  { month: '01-01', name: 'Újév' },
  { month: '03-15', name: 'Nemzeti ünnep' },
  { month: '05-01', name: 'Munka ünnepe' },
  { month: '08-20', name: 'Államalapítás ünnepe' },
  { month: '10-23', name: '1956-os forradalom' },
  { month: '11-01', name: 'Mindenszentek' },
  { month: '12-25', name: 'Karácsony' },
  { month: '12-26', name: 'Karácsony másnapja' },
];

// ── F. PROJEKTEK ─────────────────────────────────────────────────────────────

export const PROJECT_DEFS = [
  {
    name: 'Customer Portal 2.0',
    description: 'Ügyféli önkiszolgáló portál modernizálása React + TypeScript alapokon.',
    status: 'active', color: '#3b82f6', offsetStart: -30, offsetEnd: 90,
    roles: ['Senior Frontend Developer', 'Backend Developer', 'QA Engineer'],
    skillNames: ['React', 'TypeScript', 'Cypress'],
    billRates: { 'Senior Frontend Developer': 120, 'Backend Developer': 110, 'QA Engineer': 90 },
  },
  {
    name: 'Backend API Refactor',
    description: 'Monolitikus backend mikro-szolgáltatásokra bontása Node.js és PostgreSQL.',
    status: 'active', color: '#10b981', offsetStart: -15, offsetEnd: 120,
    roles: ['Senior Backend Developer', 'Backend Developer'],
    skillNames: ['Node.js', 'PostgreSQL', 'Docker'],
    billRates: { 'Senior Backend Developer': 130, 'Backend Developer': 110 },
  },
  {
    name: 'QA Automation Framework',
    description: 'End-to-end tesztelési keretrendszer kiépítése Cypress és Jest alapokon.',
    status: 'active', color: '#f59e0b', offsetStart: 0, offsetEnd: 60,
    roles: ['QA Engineer', 'Senior Frontend Developer'],
    skillNames: ['Cypress', 'Jest', 'TypeScript'],
    billRates: { 'QA Engineer': 95, 'Senior Frontend Developer': 115 },
  },
  {
    name: 'Cloud Migration',
    description: 'On-premise infrastruktúra migrálása AWS-re (ECS, RDS, CloudFront).',
    status: 'planning', color: '#8b5cf6', offsetStart: 30, offsetEnd: 180,
    roles: ['Operations Lead', 'Operations Specialist', 'Senior Backend Developer'],
    skillNames: ['AWS', 'Docker', 'PostgreSQL'],
    billRates: { 'Operations Lead': 140, 'Operations Specialist': 100, 'Senior Backend Developer': 125 },
  },
];

// ── G. ÉRTESÍTÉSEK ───────────────────────────────────────────────────────────

export const NOTIFICATION_EVENT_TYPES = [
  'leave_request.submitted', 'leave_request.approved', 'leave_request.rejected',
  'substitute.requested', 'substitute.confirmed', 'approval.escalated',
  'onboarding.assigned', 'access_request.submitted', 'access_request.approved',
];

// ── H. SZERVEZET: JOGOSULTSÁG DEFINÍCIÓK ─────────────────────────────────────
// Szervezet → Jogosultság-menedzsment → enterprise_role_definitions + enterprise_role_permissions

export const ROLE_DEFINITION_DEFS = [
  { role_key: 'team_lead',        display_name: 'Team Lead',        description: 'Csapatvezető – szabadság-jóváhagyás és ütemezés', sort_order: 10 },
  { role_key: 'project_manager',  display_name: 'Project Manager',  description: 'Projektmenedzser – erőforrás-tervezés és riportok', sort_order: 20 },
  { role_key: 'tech_lead',        display_name: 'Tech Lead',        description: 'Műszaki vezető – skill-kezelés és kapacitás', sort_order: 30 },
];

export const ROLE_PERMISSION_DEFS = [
  { role_key: 'team_lead',       feature_key: 'leave_management', access_level: 'edit'     },
  { role_key: 'team_lead',       feature_key: 'team_schedule',    access_level: 'edit'     },
  { role_key: 'team_lead',       feature_key: 'reports',          access_level: 'readonly' },
  { role_key: 'project_manager', feature_key: 'projects',         access_level: 'edit'     },
  { role_key: 'project_manager', feature_key: 'capacity',         access_level: 'edit'     },
  { role_key: 'project_manager', feature_key: 'reports',          access_level: 'edit'     },
  { role_key: 'tech_lead',       feature_key: 'projects',         access_level: 'edit'     },
  { role_key: 'tech_lead',       feature_key: 'skills',           access_level: 'edit'     },
  { role_key: 'tech_lead',       feature_key: 'capacity',         access_level: 'readonly' },
];

// ── I. TAGOK: MEGHÍVÓ SABLONOK ───────────────────────────────────────────────
// Tagok → Meghívás → enterprise_member_templates

export const MEMBER_TEMPLATE_DEFS = [
  { template_name: 'Frontend fejlesztő',    default_role: 'member', default_team: 'Frontend',   default_business_role: 'Junior Frontend Developer',  default_city: 'Budapest', default_location: 'Budapest' },
  { template_name: 'Backend fejlesztő',     default_role: 'member', default_team: 'Backend',    default_business_role: 'Backend Developer',           default_city: 'Budapest', default_location: 'Budapest' },
  { template_name: 'Ops mérnök',            default_role: 'member', default_team: 'Operations', default_business_role: 'Operations Specialist',       default_city: 'Debrecen', default_location: 'Debrecen' },
  { template_name: 'QA mérnök',             default_role: 'member', default_team: 'QA',         default_business_role: 'QA Engineer',                 default_city: 'Szeged',   default_location: 'Szeged' },
  { template_name: 'Resource Assistant',    default_role: 'resourceAssistant', default_team: 'Frontend', default_business_role: 'Senior Frontend Developer', default_city: 'Budapest', default_location: 'Budapest' },
];

// ── J. LOKALIZÁCIÓ: SZÖVEG FELÜLÍRÁSOK ──────────────────────────────────────
// Beállítások → Lokalizáció → enterprise_translation_overrides

export const TRANSLATION_OVERRIDE_DEFS = [
  { locale: 'hu', key: 'workspace.members_label',  value: 'Csapattagok',      source: 'manual' },
  { locale: 'hu', key: 'leave.vacation_label',     value: 'Éves szabadság',   source: 'manual' },
  { locale: 'hu', key: 'member.status_active',     value: 'Aktív kolléga',    source: 'manual' },
  { locale: 'hu', key: 'project.status_active',    value: 'Futó projekt',     source: 'manual' },
];

// ── K. INTEGRÁCIÓ (Jira demo) ────────────────────────────────────────────────
// Beállítások → Integrációk → enterprise_workspace_integrations
// Erőforrások → Agile panel → enterprise_agile_issues / enterprise_agile_field_metadata

export const INTEGRATION_DEF = {
  provider: 'jira' as const,
  base_url: 'https://demo-company.atlassian.net',
  api_token: 'demo-token-placeholder',
  account_email: 'demo@effectime-demo.local',
  project_key: 'DEMO',
  is_active: true,
  auto_create_on_approval: false,
};

export const AGILE_ISSUE_DEFS = [
  {
    provider: 'jira', external_key: 'DEMO-1', external_id: 'demo-issue-1',
    project_key: 'DEMO', issue_type: 'Story', summary: 'Customer Portal – Login oldal modernizálása',
    status: 'In Progress', priority: 'High', sprint_name: 'Sprint 12', story_points: 5,
    assignee_name: 'Anna Kovács', reporter_email: 'demo@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.82, suggested_role: 'Senior Frontend Developer',
    url: 'https://demo-company.atlassian.net/browse/DEMO-1',
  },
  {
    provider: 'jira', external_key: 'DEMO-2', external_id: 'demo-issue-2',
    project_key: 'DEMO', issue_type: 'Bug', summary: 'API timeout fix – backend refactor során',
    status: 'To Do', priority: 'Medium', sprint_name: 'Sprint 12', story_points: 3,
    assignee_name: 'Bence Tóth', reporter_email: 'demo@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.91, suggested_role: 'Backend Developer',
    url: 'https://demo-company.atlassian.net/browse/DEMO-2',
  },
  {
    provider: 'jira', external_key: 'DEMO-3', external_id: 'demo-issue-3',
    project_key: 'DEMO', issue_type: 'Task', summary: 'CI/CD pipeline Azure DevOps-ba migrálás',
    status: 'Done', priority: 'Low', sprint_name: 'Sprint 11', story_points: 8,
    assignee_name: 'Csilla Nagy', reporter_email: 'demo@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.75, suggested_role: 'Operations Lead',
    url: 'https://demo-company.atlassian.net/browse/DEMO-3',
  },
  {
    provider: 'jira', external_key: 'DEMO-4', external_id: 'demo-issue-4',
    project_key: 'DEMO', issue_type: 'Story', summary: 'E2E teszt lefedettség növelése 80%-ra',
    status: 'In Progress', priority: 'High', sprint_name: 'Sprint 12', story_points: 13,
    assignee_name: 'Eszter Kiss', reporter_email: 'demo@effectime-demo.local',
    capacity_risk: 'high', fit_score: 0.88, suggested_role: 'QA Engineer',
    url: 'https://demo-company.atlassian.net/browse/DEMO-4',
  },
];

export const AGILE_FIELD_METADATA_DEFS = [
  { provider: 'jira', project_key: 'DEMO', field_id: 'story_points', field_name: 'Story Points', field_type: 'number',  is_custom: false },
  { provider: 'jira', project_key: 'DEMO', field_id: 'sprint',       field_name: 'Sprint',       field_type: 'array',   is_custom: false },
  { provider: 'jira', project_key: 'DEMO', field_id: 'capacity_risk',field_name: 'Capacity Risk',field_type: 'select',  is_custom: true,  schema: { values: ['low', 'medium', 'high'] } },
  { provider: 'jira', project_key: 'DEMO', field_id: 'fit_score',    field_name: 'Fit Score',    field_type: 'number',  is_custom: true,  schema: { min: 0, max: 1 } },
];
