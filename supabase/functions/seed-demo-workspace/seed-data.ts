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
// 22 demo persona — enterprise nagyvállalati méret szimulálásához.
// A seed függvény az enterprise_seed_config.members értékéig vesz belőlük.

export const DEMO_PERSONAS = [
  { display_name: 'Anna Kovács',       team: 'Frontend',    city: 'Budapest', position: 'Senior Frontend Developer',   seniority: 'senior' as const },
  { display_name: 'Bence Tóth',        team: 'Backend',     city: 'Budapest', position: 'Backend Developer',            seniority: 'medior' as const },
  { display_name: 'Csilla Nagy',       team: 'Operations',  city: 'Debrecen', position: 'Operations Lead',              seniority: 'lead'   as const },
  { display_name: 'Dávid Szabó',       team: 'Frontend',    city: 'Budapest', position: 'Junior Frontend Developer',    seniority: 'junior' as const },
  { display_name: 'Eszter Kiss',       team: 'QA',          city: 'Szeged',   position: 'QA Engineer',                  seniority: 'medior' as const },
  { display_name: 'Ferenc Horváth',    team: 'Backend',     city: 'Budapest', position: 'Senior Backend Developer',     seniority: 'senior' as const },
  { display_name: 'Gizella Varga',     team: 'Operations',  city: 'Debrecen', position: 'Operations Specialist',        seniority: 'medior' as const },
  { display_name: 'Henrietta Fekete',  team: 'Frontend',    city: 'Budapest', position: 'Frontend Developer',           seniority: 'medior' as const },
  { display_name: 'István Papp',       team: 'Backend',     city: 'Budapest', position: 'Backend Developer',            seniority: 'medior' as const },
  { display_name: 'Judit Molnár',      team: 'QA',          city: 'Szeged',   position: 'QA Lead',                      seniority: 'lead'   as const },
  { display_name: 'Kristóf Balogh',   team: 'Operations',  city: 'Debrecen', position: 'DevOps Engineer',              seniority: 'medior' as const },
  { display_name: 'László Szőke',      team: 'Backend',     city: 'Budapest', position: 'Junior Backend Developer',     seniority: 'junior' as const },
  { display_name: 'Mária Tóth',        team: 'Frontend',    city: 'Budapest', position: 'Frontend Developer',           seniority: 'medior' as const },
  { display_name: 'Nikolett Farkas',   team: 'QA',          city: 'Szeged',   position: 'QA Engineer',                  seniority: 'junior' as const },
  { display_name: 'Olivér Lengyel',    team: 'Operations',  city: 'Debrecen', position: 'Cloud Architect',              seniority: 'senior' as const },
  { display_name: 'Petra Szász',       team: 'Frontend',    city: 'Budapest', position: 'Senior Frontend Developer',    seniority: 'senior' as const },
  { display_name: 'Richárd Kővári',   team: 'QA',          city: 'Szeged',   position: 'Senior QA Engineer',           seniority: 'senior' as const },
  { display_name: 'Sándor Veres',      team: 'Backend',     city: 'Budapest', position: 'Senior Backend Developer',     seniority: 'senior' as const },
  { display_name: 'Tímea Bodnár',      team: 'Frontend',    city: 'Budapest', position: 'UX Designer',                  seniority: 'medior' as const },
  { display_name: 'Uzonka Pálfi',      team: 'Operations',  city: 'Debrecen', position: 'Operations Engineer',          seniority: 'junior' as const },
  { display_name: 'Viktor Mátyás',     team: 'Backend',     city: 'Budapest', position: 'Tech Lead',                    seniority: 'lead'   as const },
  { display_name: 'Zsuzsanna Hegedűs', team: 'Operations',  city: 'Budapest', position: 'Scrum Master',                 seniority: 'medior' as const },
];

export const SKILL_NAMES = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'Tailwind CSS', 'Cypress', 'Jest', 'Python', 'Kubernetes', 'Redis'];
export const SKILL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6', '#f43f5e'];

// ── B. IRODÁK ─────────────────────────────────────────────────────────────────

export const OFFICE_DEFS = [
  { name: 'Budapest HQ',     city: 'Budapest', address: 'Andrássy út 1, 1061 Budapest' },
  { name: 'Debrecen Office', city: 'Debrecen', address: 'Piac u. 20, 4024 Debrecen' },
  { name: 'Szeged Office',   city: 'Szeged',   address: 'Kárász u. 5, 6720 Szeged' },
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
  {
    name: 'Mobile App MVP',
    description: 'React Native alapú mobilalkalmazás prototípus belső eszközökhöz.',
    status: 'planning', color: '#f43f5e', offsetStart: 60, offsetEnd: 180,
    roles: ['Senior Frontend Developer', 'Backend Developer', 'QA Engineer'],
    skillNames: ['React', 'TypeScript', 'Jest'],
    billRates: { 'Senior Frontend Developer': 125, 'Backend Developer': 105, 'QA Engineer': 90 },
  },
];

// ── G. ÉRTESÍTÉSEK ───────────────────────────────────────────────────────────

export const NOTIFICATION_EVENT_TYPES = [
  'leave_request.submitted', 'leave_request.approved', 'leave_request.rejected',
  'substitute.requested', 'substitute.confirmed', 'approval.escalated',
  'onboarding.assigned', 'access_request.submitted', 'access_request.approved',
];

// ── H. SZERVEZET: JOGOSULTSÁG DEFINÍCIÓK ─────────────────────────────────────

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

export const MEMBER_TEMPLATE_DEFS = [
  { template_name: 'Frontend fejlesztő',    default_role: 'member', default_team: 'Frontend',   default_business_role: 'Junior Frontend Developer',   default_city: 'Budapest', default_location: 'Budapest' },
  { template_name: 'Backend fejlesztő',     default_role: 'member', default_team: 'Backend',    default_business_role: 'Backend Developer',            default_city: 'Budapest', default_location: 'Budapest' },
  { template_name: 'Ops mérnök',            default_role: 'member', default_team: 'Operations', default_business_role: 'Operations Specialist',        default_city: 'Debrecen', default_location: 'Debrecen' },
  { template_name: 'QA mérnök',             default_role: 'member', default_team: 'QA',         default_business_role: 'QA Engineer',                  default_city: 'Szeged',   default_location: 'Szeged' },
  { template_name: 'Resource Assistant',    default_role: 'resourceAssistant', default_team: 'Frontend', default_business_role: 'Senior Frontend Developer', default_city: 'Budapest', default_location: 'Budapest' },
];

// ── J. LOKALIZÁCIÓ: SZÖVEG FELÜLÍRÁSOK ──────────────────────────────────────

export const TRANSLATION_OVERRIDE_DEFS = [
  { locale: 'hu', key: 'workspace.members_label',  value: 'Csapattagok',      source: 'manual' },
  { locale: 'hu', key: 'leave.vacation_label',     value: 'Éves szabadság',   source: 'manual' },
  { locale: 'hu', key: 'member.status_active',     value: 'Aktív kolléga',    source: 'manual' },
  { locale: 'hu', key: 'project.status_active',    value: 'Futó projekt',     source: 'manual' },
];

// ── K. INTEGRÁCIÓ (Jira demo) ────────────────────────────────────────────────

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

// ── L. NAPI SZABÁLYOK (enterprise_daily_rules) ───────────────────────────────
// Szabadság → Napi szabályok

export const DAILY_RULE_DEFS = [
  { day_of_week: 1, max_off: 3, is_active: true },   // Hétfő
  { day_of_week: 2, max_off: 4, is_active: true },   // Kedd
  { day_of_week: 3, max_off: 4, is_active: true },   // Szerda
  { day_of_week: 4, max_off: 4, is_active: true },   // Csütörtök
  { day_of_week: 5, max_off: 5, is_active: true },   // Péntek
  { day_of_week: 6, max_off: 2, is_active: false },  // Szombat (inaktív)
  { day_of_week: 0, max_off: 2, is_active: false },  // Vasárnap (inaktív)
];

// ── M. JELENLÉT SZABÁLYOK (enterprise_office_coverage_rules) ─────────────────
// Szabadság → Jelenlét szabályok

export const OFFICE_COVERAGE_RULE_DEFS = [
  {
    officeName: 'Budapest HQ',
    name: 'Budapest HQ – minimum jelenlét (fejlesztők)',
    business_roles: ['Senior Frontend Developer', 'Senior Backend Developer'],
    days_of_week: [1, 2, 3, 4, 5], min_headcount: 2, status: 'active',
  },
  {
    officeName: 'Budapest HQ',
    name: 'Budapest HQ – minimum jelenlét (QA)',
    business_roles: ['QA Engineer'],
    days_of_week: [2, 3, 4], min_headcount: 1, status: 'active',
  },
  {
    officeName: 'Budapest HQ',
    name: 'Budapest HQ – hétfő belső meeting (összes fejlesztő)',
    business_roles: ['Frontend Developer', 'Backend Developer', 'Senior Frontend Developer', 'Senior Backend Developer'],
    days_of_week: [1], min_headcount: 3, status: 'active',
  },
  {
    officeName: 'Debrecen Office',
    name: 'Debrecen Office – ops jelenlét',
    business_roles: ['Operations Lead', 'Operations Specialist', 'DevOps Engineer'],
    days_of_week: [1, 2, 3, 4, 5], min_headcount: 1, status: 'active',
  },
  {
    officeName: 'Debrecen Office',
    name: 'Debrecen Office – cloud architect minimum',
    business_roles: ['Cloud Architect'],
    days_of_week: [1, 2, 3], min_headcount: 1, status: 'active',
  },
  {
    officeName: 'Szeged Office',
    name: 'Szeged Office – QA jelenlét',
    business_roles: ['QA Engineer', 'Senior QA Engineer', 'QA Lead'],
    days_of_week: [1, 2, 3, 4, 5], min_headcount: 1, status: 'active',
  },
  {
    officeName: 'Budapest HQ',
    name: 'Budapest HQ – sprint zárás (összes team)',
    business_roles: ['Senior Frontend Developer', 'Senior Backend Developer', 'Tech Lead'],
    days_of_week: [4, 5], min_headcount: 2, status: 'active',
  },
  {
    officeName: 'Budapest HQ',
    name: 'Budapest HQ – UX review nap',
    business_roles: ['UX Designer', 'Senior Frontend Developer'],
    days_of_week: [3], min_headcount: 1, status: 'active',
  },
  {
    officeName: 'Debrecen Office',
    name: 'Debrecen Office – infrastruktúra karbantartás',
    business_roles: ['DevOps Engineer', 'Cloud Architect'],
    days_of_week: [2], min_headcount: 1, status: 'active',
  },
  {
    officeName: 'Budapest HQ',
    name: 'Budapest HQ – scrum master jelenlét',
    business_roles: ['Scrum Master'],
    days_of_week: [1, 3, 5], min_headcount: 1, status: 'active',
  },
];

// ── N. SZABÁLY SABLONOK (enterprise_rule_templates) ──────────────────────────

export const RULE_TEMPLATE_DEFS = [
  {
    name: 'Max 3 absent Monday',
    description: 'Hétfőnként maximum 3 fő lehet szabadságon egyidejűleg.',
    template_data: { day_of_week: 1, max_off: 3, scope: 'workspace' },
  },
  {
    name: 'No leave during sprint close',
    description: 'Sprint lezárási napokon korlátozza a szabadságkérelmeket.',
    template_data: { rule_type: 'sprint_close_block', notify_requestor: true },
  },
  {
    name: 'Minimum 2 seniors present',
    description: 'Minden napon legalább 2 senior fejlesztőnek jelenlétére szükség van.',
    template_data: { role_filter: ['senior'], min_headcount: 2, scope: 'team' },
  },
  {
    name: 'No leave during product launch',
    description: 'Termékindítási időszakban tilos szabadságot kivenni.',
    template_data: { rule_type: 'launch_block', advance_notice_days: 14 },
  },
  {
    name: 'Friday afternoon WFH allowed',
    description: 'Péntek délután home office engedélyezve minden tagnak.',
    template_data: { day_of_week: 5, from_hour: 13, type: 'wfh_allowed' },
  },
];

// ── O. JÓVÁHAGYÁSI LÁNC (enterprise_approval_chains) ─────────────────────────

export const APPROVAL_CHAIN_DEFS = [
  { step_order: 1, approver_role: 'resourceAssistant', is_active: true },
  { step_order: 2, approver_role: 'owner',             is_active: true },
];

// ── P. SZERVEZET: KATALÓGUS DEFINÍCIÓK ──────────────────────────────────────
// Szervezet → Katalógus szerkesztő (CatalogListEditor) — minden tábla az
// (id, workspace_id, code, label, archived_at, sort_order) sémát követi.

export const JOB_FAMILY_DEFS = [
  { code: 'engineering', label: 'Engineering',       sort_order: 10 },
  { code: 'operations',  label: 'Operations',        sort_order: 20 },
  { code: 'qa',          label: 'Quality Assurance', sort_order: 30 },
  { code: 'management',  label: 'Management',        sort_order: 40 },
  { code: 'design',      label: 'Design',            sort_order: 50 },
  { code: 'product',     label: 'Product',           sort_order: 60 },
];

export const LEADERSHIP_LEVEL_DEFS = [
  { code: 'strategic',   label: 'Strategic',   sort_order: 10 },
  { code: 'operational', label: 'Operational', sort_order: 20 },
  { code: 'technical',   label: 'Technical',   sort_order: 30 },
  { code: 'execution',   label: 'Execution',   sort_order: 40 },
  { code: 'specialist',  label: 'Specialist',  sort_order: 50 },
];

export const CONTRACT_TYPE_DEFS = [
  { code: 'employee',      label: 'Alkalmazott',  is_default: true  },
  { code: 'contractor',    label: 'Megbízásos',   is_default: false },
  { code: 'subcontractor', label: 'Alvállalkozó', is_default: false },
  { code: 'consultant',    label: 'Tanácsadó',    is_default: false },
  { code: 'intern',        label: 'Gyakornok',    is_default: false },
];

export const INDUSTRY_DEFS = [
  { code: 'software',   label: 'Szoftverfejlesztés', is_default: true  },
  { code: 'fintech',    label: 'Fintech',            is_default: false },
  { code: 'ecommerce',  label: 'E-kereskedelem',     is_default: false },
  { code: 'healthcare', label: 'Egészségügy',        is_default: false },
  { code: 'logistics',  label: 'Logisztika',         is_default: false },
];

export const WORK_CATEGORY_DEFS = [
  { code: 'development', label: 'Fejlesztés' },
  { code: 'testing',     label: 'Tesztelés' },
  { code: 'operations',  label: 'Üzemeltetés' },
  { code: 'meetings',    label: 'Megbeszélések' },
  { code: 'design',      label: 'Tervezés' },
];

// ── Q. SZERVEZETI STRUKTÚRA HOZZÁRENDELÉSEK ──────────────────────────────────
// Minden persona display_name-jéhez megadja:
//   managerName — kinek a közvetlen beosztottja (undefined = top-level)
//   orgUnit     — melyik szervezeti egységbe tartozik
//   llCode      — LEADERSHIP_LEVEL_DEFS.code
//   contractCode — CONTRACT_TYPE_DEFS.code
//   leadershipCategory — 'operational' | 'technical'
// index.ts B8 szekciója ezt a táblát olvassa az összes demo tag frissítéséhez.

export const PERSONA_ORG_ASSIGNMENTS: Record<string, {
  managerName?: string;
  orgUnit: string;
  llCode: string;
  contractCode: string;
  leadershipCategory: 'operational' | 'technical';
}> = {
  'Anna Kovács':        { managerName: 'Viktor Mátyás',   orgUnit: 'Frontend csapat',  llCode: 'technical',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Bence Tóth':         { managerName: 'Ferenc Horváth',  orgUnit: 'Backend csapat',   llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Csilla Nagy':        { managerName: 'Viktor Mátyás',   orgUnit: 'Üzemeltetés',      llCode: 'operational', contractCode: 'employee',   leadershipCategory: 'operational' },
  'Dávid Szabó':        { managerName: 'Anna Kovács',     orgUnit: 'Frontend csapat',  llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Eszter Kiss':        { managerName: 'Judit Molnár',    orgUnit: 'QA csapat',        llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Ferenc Horváth':     { managerName: 'Viktor Mátyás',   orgUnit: 'Backend csapat',   llCode: 'technical',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Gizella Varga':      { managerName: 'Csilla Nagy',     orgUnit: 'Üzemeltetés',      llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'operational' },
  'Henrietta Fekete':   { managerName: 'Anna Kovács',     orgUnit: 'Frontend csapat',  llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'István Papp':        { managerName: 'Ferenc Horváth',  orgUnit: 'Backend csapat',   llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Judit Molnár':       { managerName: 'Viktor Mátyás',   orgUnit: 'QA csapat',        llCode: 'operational', contractCode: 'employee',   leadershipCategory: 'operational' },
  'Kristóf Balogh':     { managerName: 'Csilla Nagy',     orgUnit: 'Üzemeltetés',      llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'operational' },
  'László Szőke':       { managerName: 'Ferenc Horváth',  orgUnit: 'Backend csapat',   llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Mária Tóth':         { managerName: 'Anna Kovács',     orgUnit: 'Frontend csapat',  llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Nikolett Farkas':    { managerName: 'Judit Molnár',    orgUnit: 'QA csapat',        llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Olivér Lengyel':     { managerName: 'Csilla Nagy',     orgUnit: 'Üzemeltetés',      llCode: 'technical',   contractCode: 'contractor', leadershipCategory: 'technical'   },
  'Petra Szász':        { managerName: 'Anna Kovács',     orgUnit: 'Frontend csapat',  llCode: 'technical',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Richárd Kővári':     { managerName: 'Judit Molnár',    orgUnit: 'QA csapat',        llCode: 'technical',   contractCode: 'contractor', leadershipCategory: 'technical'   },
  'Sándor Veres':       { managerName: 'Ferenc Horváth',  orgUnit: 'Backend csapat',   llCode: 'technical',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Tímea Bodnár':       { managerName: 'Anna Kovács',     orgUnit: 'Frontend csapat',  llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Uzonka Pálfi':       { managerName: 'Csilla Nagy',     orgUnit: 'Üzemeltetés',      llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'operational' },
  'Viktor Mátyás':      {                                 orgUnit: 'Mérnöki részleg',  llCode: 'strategic',   contractCode: 'employee',   leadershipCategory: 'operational' },
  'Zsuzsanna Hegedűs':  { managerName: 'Viktor Mátyás',   orgUnit: 'Mérnöki részleg',  llCode: 'operational', contractCode: 'employee',   leadershipCategory: 'operational' },
};

// ── DEFAULT SEED QUANTITIES ───────────────────────────────────────────────────
// Ezek az alapértelmezett mennyiségek ha az enterprise_seed_config-ban
// nincs mentett konfiguráció. A UI-ban felül lehet írni.

export const DEFAULT_SEED_QUANTITIES = {
  members:               22,
  offices:                3,
  teams:                  4,
  leave_types:            4,
  holidays:               8,
  skills:                12,
  job_families:           6,
  leadership_levels:      4,
  contract_types:         4,
  industries:             3,
  work_categories:        5,
  org_units:              5,
  projects:               5,
  daily_rules:            7,
  office_coverage_rules: 10,
  approval_chains:        2,
  rule_templates:         5,
  reports:                4,
  scenarios:              2,
  access_systems:         4,
  onboarding_templates:   2,
  role_definitions:       3,
  member_templates:       5,
  translation_overrides:  4,
  agile_issues:           4,
  ical_tokens:            4,
};
