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

// ── AGILE ISSUES ─────────────────────────────────────────────────────────────
// 33 ticket a Kanban / Scrum / Gantt nézetek teljes bemutatójához.
//
// Sprint idővonalak (today = 0):
//   Sprint 10: -60 → -30  (lezárt, 2 hónappal ezelőtt)
//   Sprint 11: -30 → 0    (lezárt, múlt hónap)
//   Sprint 12:   0 → +14  (aktív sprint)
//   Sprint 13: +14 → +28  (következő sprint, tervezett)
//
// startOff / dueOff: napok eltolása today-hez képest — az index.ts
//   addDays(today, offset) segítségével számítja a tényleges dátumot.
//
// Típusok: Epic · Story · Bug · Task · Sub-task
// parent_key: hierarchia Kanban/Scrum parent-child kapcsolathoz.

export const AGILE_ISSUE_DEFS: Array<{
  provider: string; external_key: string; external_id: string;
  project_key: string; parent_key?: string; issue_type: string;
  summary: string; description?: string; status: string;
  priority: string; sprint_name?: string; team_name?: string;
  story_points?: number; assignee_name: string; reporter_email: string;
  capacity_risk?: string; fit_score?: number; suggested_role?: string;
  original_estimate_hours?: number; remaining_hours?: number; completed_hours?: number;
  url: string; startOff: number; dueOff: number;
}> = [

  // ══ EPICS (3) ═════════════════════════════════════════════════════════════
  {
    provider: 'jira', external_key: 'DEMO-1', external_id: 'demo-epic-1',
    project_key: 'DEMO', issue_type: 'Epic',
    summary: 'Customer Portal 2.0 – Teljes modernizáció',
    description: 'Az ügyféli önkiszolgáló portál teljes újraírása React + TypeScript alapokon. Tartalmazza a login, dashboard, profil és mobilos nézetek modernizálását.',
    status: 'In Progress', priority: 'High', team_name: 'Frontend', story_points: 55,
    assignee_name: 'Anna Kovács', reporter_email: 'viktor.matyas@effectime-demo.local',
    capacity_risk: 'high', fit_score: 0.91, suggested_role: 'Senior Frontend Developer',
    original_estimate_hours: 220, remaining_hours: 80, completed_hours: 140,
    url: 'https://demo-company.atlassian.net/browse/DEMO-1',
    startOff: -60, dueOff: 42,
  },
  {
    provider: 'jira', external_key: 'DEMO-2', external_id: 'demo-epic-2',
    project_key: 'DEMO', issue_type: 'Epic',
    summary: 'Backend API Refactor & Mikroszolgáltatások',
    description: 'A monolitikus backend szétbontása független mikroszolgáltatásokra (User, Auth, Notification). Node.js, PostgreSQL, Docker, API gateway.',
    status: 'In Progress', priority: 'High', team_name: 'Backend', story_points: 63,
    assignee_name: 'Ferenc Horváth', reporter_email: 'viktor.matyas@effectime-demo.local',
    capacity_risk: 'high', fit_score: 0.87, suggested_role: 'Senior Backend Developer',
    original_estimate_hours: 252, remaining_hours: 120, completed_hours: 132,
    url: 'https://demo-company.atlassian.net/browse/DEMO-2',
    startOff: -45, dueOff: 56,
  },
  {
    provider: 'jira', external_key: 'DEMO-3', external_id: 'demo-epic-3',
    project_key: 'DEMO', issue_type: 'Epic',
    summary: 'QA & DevOps Automatizáció',
    description: 'End-to-end Cypress tesztek, Jest unit coverage 80%-ra, CI/CD pipeline Azure DevOps-ban és Kubernetes deployment.',
    status: 'In Progress', priority: 'Medium', team_name: 'QA', story_points: 44,
    assignee_name: 'Judit Molnár', reporter_email: 'viktor.matyas@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.83, suggested_role: 'QA Lead',
    original_estimate_hours: 176, remaining_hours: 48, completed_hours: 128,
    url: 'https://demo-company.atlassian.net/browse/DEMO-3',
    startOff: -30, dueOff: 14,
  },

  // ══ STORIES — Customer Portal Epic (DEMO-1) ════════════════════════════════
  {
    provider: 'jira', external_key: 'DEMO-4', external_id: 'demo-story-4',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Story',
    summary: 'Login oldal modernizálása – új design + validáció',
    description: 'Az összes login form mező validálása, hibaüzenetek lokalizálása, loading state és session token kezelés.',
    status: 'In Progress', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Frontend', story_points: 8,
    assignee_name: 'Anna Kovács', reporter_email: 'petra.szasz@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.88, suggested_role: 'Senior Frontend Developer',
    original_estimate_hours: 32, remaining_hours: 8, completed_hours: 24,
    url: 'https://demo-company.atlassian.net/browse/DEMO-4',
    startOff: -5, dueOff: 9,
  },
  {
    provider: 'jira', external_key: 'DEMO-5', external_id: 'demo-story-5',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Story',
    summary: 'Dashboard redesign – widgetek és összesítők',
    description: 'Főoldali dashboard widgetek újratervezése: összesítők, gyors műveletek, legutóbbi aktivitás szekció.',
    status: 'To Do', priority: 'High', sprint_name: 'Sprint 13', team_name: 'Frontend', story_points: 13,
    assignee_name: 'Petra Szász', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.85, suggested_role: 'Senior Frontend Developer',
    original_estimate_hours: 52, remaining_hours: 52, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-5',
    startOff: 14, dueOff: 28,
  },
  {
    provider: 'jira', external_key: 'DEMO-6', external_id: 'demo-story-6',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Story',
    summary: 'User profile szerkesztő – adatok és fénykép',
    description: 'Profilszerkesztő oldal: személyes adatok, profilkép feltöltés (S3), jelszóváltás, értesítési beállítások.',
    status: 'Done', priority: 'Medium', sprint_name: 'Sprint 11', team_name: 'Frontend', story_points: 5,
    assignee_name: 'Henrietta Fekete', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.92, suggested_role: 'Frontend Developer',
    original_estimate_hours: 20, remaining_hours: 0, completed_hours: 20,
    url: 'https://demo-company.atlassian.net/browse/DEMO-6',
    startOff: -28, dueOff: -14,
  },
  {
    provider: 'jira', external_key: 'DEMO-7', external_id: 'demo-story-7',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Story',
    summary: 'Mobil responsiv layout – breakpoint javítások',
    description: 'xs/sm breakpointok javítása: navigáció, táblázatok, modálok és filterek mobilos megjelenése.',
    status: 'Done', priority: 'Medium', sprint_name: 'Sprint 11', team_name: 'Frontend', story_points: 3,
    assignee_name: 'Dávid Szabó', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.79, suggested_role: 'Junior Frontend Developer',
    original_estimate_hours: 12, remaining_hours: 0, completed_hours: 14,
    url: 'https://demo-company.atlassian.net/browse/DEMO-7',
    startOff: -25, dueOff: -10,
  },

  // ══ STORIES — API Refactor Epic (DEMO-2) ══════════════════════════════════
  {
    provider: 'jira', external_key: 'DEMO-8', external_id: 'demo-story-8',
    project_key: 'DEMO', parent_key: 'DEMO-2', issue_type: 'Story',
    summary: 'User service kiszervezése önálló mikroszolgáltatásba',
    description: 'User CRUD, session kezelés és jogosultság-ellenőrzés kiszervezése dedikált user-service-be. Docker compose integráció.',
    status: 'In Progress', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Backend', story_points: 13,
    assignee_name: 'Ferenc Horváth', reporter_email: 'viktor.matyas@effectime-demo.local',
    capacity_risk: 'high', fit_score: 0.86, suggested_role: 'Senior Backend Developer',
    original_estimate_hours: 52, remaining_hours: 20, completed_hours: 32,
    url: 'https://demo-company.atlassian.net/browse/DEMO-8',
    startOff: -7, dueOff: 7,
  },
  {
    provider: 'jira', external_key: 'DEMO-9', external_id: 'demo-story-9',
    project_key: 'DEMO', parent_key: 'DEMO-2', issue_type: 'Story',
    summary: 'Auth service migráció – JWT + refresh token',
    description: 'Authentikációs logika kiszervezése: JWT access + refresh token, blacklist táblázat, Redis alapú session cache.',
    status: 'In Review', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Backend', story_points: 8,
    assignee_name: 'Sándor Veres', reporter_email: 'ferenc.horvath@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.90, suggested_role: 'Senior Backend Developer',
    original_estimate_hours: 32, remaining_hours: 4, completed_hours: 28,
    url: 'https://demo-company.atlassian.net/browse/DEMO-9',
    startOff: -10, dueOff: 3,
  },
  {
    provider: 'jira', external_key: 'DEMO-10', external_id: 'demo-story-10',
    project_key: 'DEMO', parent_key: 'DEMO-2', issue_type: 'Story',
    summary: 'API gateway beállítása – routing és rate limiting',
    description: 'Kong/Nginx alapú API gateway: service discovery, rate limiting (100 req/min), SSL termination, request logging.',
    status: 'To Do', priority: 'Medium', sprint_name: 'Sprint 13', team_name: 'Backend', story_points: 8,
    assignee_name: 'István Papp', reporter_email: 'ferenc.horvath@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.78, suggested_role: 'Backend Developer',
    original_estimate_hours: 32, remaining_hours: 32, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-10',
    startOff: 14, dueOff: 28,
  },
  {
    provider: 'jira', external_key: 'DEMO-11', external_id: 'demo-story-11',
    project_key: 'DEMO', parent_key: 'DEMO-2', issue_type: 'Story',
    summary: 'Database connection pooling – PgBouncer konfig',
    description: 'PgBouncer telepítése és konfigurálása: pool size optimalizálás, monitoring, Prometheus metrikák exportálása.',
    status: 'Done', priority: 'Low', sprint_name: 'Sprint 11', team_name: 'Backend', story_points: 5,
    assignee_name: 'Bence Tóth', reporter_email: 'sandor.veres@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.83, suggested_role: 'Backend Developer',
    original_estimate_hours: 20, remaining_hours: 0, completed_hours: 18,
    url: 'https://demo-company.atlassian.net/browse/DEMO-11',
    startOff: -30, dueOff: -20,
  },

  // ══ STORIES — QA Epic (DEMO-3) ════════════════════════════════════════════
  {
    provider: 'jira', external_key: 'DEMO-12', external_id: 'demo-story-12',
    project_key: 'DEMO', parent_key: 'DEMO-3', issue_type: 'Story',
    summary: 'Cypress E2E teszt keretrendszer – alapok',
    description: 'Cypress projekt létrehozása, alapkonfigurálás, custom command-ok, Page Object Model struktúra, CI integráció.',
    status: 'In Progress', priority: 'High', sprint_name: 'Sprint 12', team_name: 'QA', story_points: 8,
    assignee_name: 'Eszter Kiss', reporter_email: 'judit.molnar@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.88, suggested_role: 'QA Engineer',
    original_estimate_hours: 32, remaining_hours: 10, completed_hours: 22,
    url: 'https://demo-company.atlassian.net/browse/DEMO-12',
    startOff: -5, dueOff: 10,
  },
  {
    provider: 'jira', external_key: 'DEMO-13', external_id: 'demo-story-13',
    project_key: 'DEMO', parent_key: 'DEMO-3', issue_type: 'Story',
    summary: 'Jest unit teszt coverage 80%-ra emelése',
    description: 'Kritikus service és utility függvények unit tesztjeinek megírása, mock-ok, Jest coverage riport CI-ban.',
    status: 'Done', priority: 'Medium', sprint_name: 'Sprint 11', team_name: 'QA', story_points: 5,
    assignee_name: 'Richárd Kővári', reporter_email: 'judit.molnar@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.94, suggested_role: 'Senior QA Engineer',
    original_estimate_hours: 20, remaining_hours: 0, completed_hours: 22,
    url: 'https://demo-company.atlassian.net/browse/DEMO-13',
    startOff: -30, dueOff: -15,
  },
  {
    provider: 'jira', external_key: 'DEMO-14', external_id: 'demo-story-14',
    project_key: 'DEMO', parent_key: 'DEMO-3', issue_type: 'Story',
    summary: 'CI/CD pipeline Azure DevOps – build + deploy',
    description: 'Azure Pipelines YAML konfiguráció: lint, test, build, Docker image push, staging deploy, rollback trigger.',
    status: 'Done', priority: 'High', sprint_name: 'Sprint 11', team_name: 'Operations', story_points: 8,
    assignee_name: 'Csilla Nagy', reporter_email: 'viktor.matyas@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.76, suggested_role: 'Operations Lead',
    original_estimate_hours: 32, remaining_hours: 0, completed_hours: 30,
    url: 'https://demo-company.atlassian.net/browse/DEMO-14',
    startOff: -28, dueOff: -2,
  },
  {
    provider: 'jira', external_key: 'DEMO-15', external_id: 'demo-story-15',
    project_key: 'DEMO', parent_key: 'DEMO-3', issue_type: 'Story',
    summary: 'Kubernetes deployment konfig – prod cluster',
    description: 'K8s manifest-ek: Deployment, Service, Ingress, HPA, PodDisruptionBudget, secrets management Vault integrációval.',
    status: 'To Do', priority: 'Medium', sprint_name: 'Sprint 13', team_name: 'Operations', story_points: 13,
    assignee_name: 'Olivér Lengyel', reporter_email: 'csilla.nagy@effectime-demo.local',
    capacity_risk: 'high', fit_score: 0.81, suggested_role: 'Cloud Architect',
    original_estimate_hours: 52, remaining_hours: 52, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-15',
    startOff: 14, dueOff: 28,
  },

  // ══ BUGS (8) ══════════════════════════════════════════════════════════════
  {
    provider: 'jira', external_key: 'DEMO-16', external_id: 'demo-bug-16',
    project_key: 'DEMO', parent_key: 'DEMO-2', issue_type: 'Bug',
    summary: 'API timeout – login kérésnél >3s válaszidő',
    description: 'Magas terhelésnél a /auth/login endpoint >3s válaszidőt produkál. Connection pool exhaustion gyanús. Reprodukálható: 50+ concurrent request.',
    status: 'To Do', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Backend', story_points: 3,
    assignee_name: 'Bence Tóth', reporter_email: 'istvan.papp@effectime-demo.local',
    capacity_risk: 'high', fit_score: 0.89, suggested_role: 'Backend Developer',
    original_estimate_hours: 8, remaining_hours: 8, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-16',
    startOff: 0, dueOff: 7,
  },
  {
    provider: 'jira', external_key: 'DEMO-17', external_id: 'demo-bug-17',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Bug',
    summary: 'Memory leak – dashboard komponens unmount után',
    description: 'A dashboard widgetek unmount után nem törlik a WebSocket subscription-öket és setInterval-okat, ez memory leak-et okoz.',
    status: 'In Progress', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Frontend', story_points: 5,
    assignee_name: 'Anna Kovács', reporter_email: 'petra.szasz@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.84, suggested_role: 'Senior Frontend Developer',
    original_estimate_hours: 12, remaining_hours: 4, completed_hours: 8,
    url: 'https://demo-company.atlassian.net/browse/DEMO-17',
    startOff: -3, dueOff: 5,
  },
  {
    provider: 'jira', external_key: 'DEMO-18', external_id: 'demo-bug-18',
    project_key: 'DEMO', parent_key: 'DEMO-2', issue_type: 'Bug',
    summary: 'CORS hiba – staging API elérésénél',
    description: 'Az staging API nem küldi az Access-Control-Allow-Origin headert Firefox alatt. Chrome és Safari esetén működik.',
    status: 'Done', priority: 'Medium', sprint_name: 'Sprint 11', team_name: 'Backend', story_points: 2,
    assignee_name: 'István Papp', reporter_email: 'bence.toth@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.95, suggested_role: 'Backend Developer',
    original_estimate_hours: 4, remaining_hours: 0, completed_hours: 3,
    url: 'https://demo-company.atlassian.net/browse/DEMO-18',
    startOff: -30, dueOff: -22,
  },
  {
    provider: 'jira', external_key: 'DEMO-19', external_id: 'demo-bug-19',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Bug',
    summary: 'Broken pagination – 100+ rekordnál nem lapoz',
    description: 'A táblázat pagináció 100 sor felett elromlik: az "előző" gomb disabled marad, a sorindex nem frissül.',
    status: 'To Do', priority: 'Medium', sprint_name: 'Sprint 12', team_name: 'Frontend', story_points: 3,
    assignee_name: 'Henrietta Fekete', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.77, suggested_role: 'Frontend Developer',
    original_estimate_hours: 8, remaining_hours: 8, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-19',
    startOff: 0, dueOff: 10,
  },
  {
    provider: 'jira', external_key: 'DEMO-20', external_id: 'demo-bug-20',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Bug',
    summary: 'PDF export – missing error handling, blank fájl',
    description: 'Ha a PDF generáló service nem elérhető, a felhasználó üres fájlt tölt le hibaüzenet nélkül.',
    status: 'To Do', priority: 'Low', sprint_name: 'Sprint 13', team_name: 'Frontend', story_points: 2,
    assignee_name: 'Mária Tóth', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.73, suggested_role: 'Frontend Developer',
    original_estimate_hours: 6, remaining_hours: 6, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-20',
    startOff: 14, dueOff: 20,
  },
  {
    provider: 'jira', external_key: 'DEMO-21', external_id: 'demo-bug-21',
    project_key: 'DEMO', parent_key: 'DEMO-2', issue_type: 'Bug',
    summary: 'Session timeout – 15 perc inaktivitás után kizárja az aktív felhasználókat',
    description: 'A session timeout 15 percre van beállítva de az elvárás 60 perc. A token refresh nem hívódik meg inaktív tab esetén.',
    status: 'In Review', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Backend', story_points: 5,
    assignee_name: 'Sándor Veres', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.87, suggested_role: 'Senior Backend Developer',
    original_estimate_hours: 16, remaining_hours: 2, completed_hours: 14,
    url: 'https://demo-company.atlassian.net/browse/DEMO-21',
    startOff: -5, dueOff: 5,
  },
  {
    provider: 'jira', external_key: 'DEMO-22', external_id: 'demo-bug-22',
    project_key: 'DEMO', parent_key: 'DEMO-3', issue_type: 'Bug',
    summary: 'Null pointer exception – riport generálásnál üres dataset',
    description: 'Ha a riport queryje 0 sort ad vissza, a PDF generátor NPE-t dob. A catch block nincs implementálva.',
    status: 'Done', priority: 'High', sprint_name: 'Sprint 11', team_name: 'QA', story_points: 2,
    assignee_name: 'Judit Molnár', reporter_email: 'richard.kovari@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.96, suggested_role: 'QA Lead',
    original_estimate_hours: 4, remaining_hours: 0, completed_hours: 5,
    url: 'https://demo-company.atlassian.net/browse/DEMO-22',
    startOff: -30, dueOff: -25,
  },
  {
    provider: 'jira', external_key: 'DEMO-23', external_id: 'demo-bug-23',
    project_key: 'DEMO', parent_key: 'DEMO-1', issue_type: 'Bug',
    summary: 'Mobil keyboard – iOS-on feltolja az elrendezést',
    description: 'iOS Safari virtuális billentyűzet megjelenésekor az input fölé kerül a submit gomb és a footer, overlapping layout.',
    status: 'To Do', priority: 'Medium', sprint_name: 'Sprint 13', team_name: 'Frontend', story_points: 3,
    assignee_name: 'Dávid Szabó', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.71, suggested_role: 'Junior Frontend Developer',
    original_estimate_hours: 8, remaining_hours: 8, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-23',
    startOff: 14, dueOff: 25,
  },

  // ══ TASKS (6) ═════════════════════════════════════════════════════════════
  {
    provider: 'jira', external_key: 'DEMO-24', external_id: 'demo-task-24',
    project_key: 'DEMO', issue_type: 'Task',
    summary: 'Code review guideline dokumentálás és onboarding',
    description: 'Pull request sablonok, review checklist, branch naming convention és merge strategy dokumentálása a wiki-be.',
    status: 'Done', priority: 'Low', sprint_name: 'Sprint 11', team_name: 'Backend', story_points: 3,
    assignee_name: 'Viktor Mátyás', reporter_email: 'zsuzsanna.hegedus@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.82, suggested_role: 'Tech Lead',
    original_estimate_hours: 8, remaining_hours: 0, completed_hours: 10,
    url: 'https://demo-company.atlassian.net/browse/DEMO-24',
    startOff: -30, dueOff: -20,
  },
  {
    provider: 'jira', external_key: 'DEMO-25', external_id: 'demo-task-25',
    project_key: 'DEMO', issue_type: 'Task',
    summary: 'Docker Compose dev environment – egységesítés',
    description: 'Egységes docker-compose.dev.yml a teljes stack lokális indításához: API, frontend, DB, Redis, mock services.',
    status: 'In Progress', priority: 'Medium', sprint_name: 'Sprint 12', team_name: 'Operations', story_points: 5,
    assignee_name: 'Kristóf Balogh', reporter_email: 'csilla.nagy@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.85, suggested_role: 'DevOps Engineer',
    original_estimate_hours: 16, remaining_hours: 6, completed_hours: 10,
    url: 'https://demo-company.atlassian.net/browse/DEMO-25',
    startOff: -5, dueOff: 7,
  },
  {
    provider: 'jira', external_key: 'DEMO-26', external_id: 'demo-task-26',
    project_key: 'DEMO', issue_type: 'Task',
    summary: 'AWS RDS automatikus backup és Point-in-Time Recovery',
    description: 'RDS backup window beállítása, retention 30 nap, PITR tesztelése staging-on, monitoring alert-ek beállítása.',
    status: 'Done', priority: 'Medium', sprint_name: 'Sprint 12', team_name: 'Operations', story_points: 3,
    assignee_name: 'Olivér Lengyel', reporter_email: 'csilla.nagy@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.88, suggested_role: 'Cloud Architect',
    original_estimate_hours: 12, remaining_hours: 0, completed_hours: 11,
    url: 'https://demo-company.atlassian.net/browse/DEMO-26',
    startOff: -10, dueOff: 0,
  },
  {
    provider: 'jira', external_key: 'DEMO-27', external_id: 'demo-task-27',
    project_key: 'DEMO', issue_type: 'Task',
    summary: 'Developer onboarding dokumentáció frissítése',
    description: 'README, architecture decision records (ADR), API dokumentáció (OpenAPI 3.0), lokális setup lépések frissítése.',
    status: 'To Do', priority: 'Low', sprint_name: 'Sprint 13', team_name: 'Operations', story_points: 3,
    assignee_name: 'Zsuzsanna Hegedűs', reporter_email: 'viktor.matyas@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.79, suggested_role: 'Scrum Master',
    original_estimate_hours: 10, remaining_hours: 10, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-27',
    startOff: 14, dueOff: 28,
  },
  {
    provider: 'jira', external_key: 'DEMO-28', external_id: 'demo-task-28',
    project_key: 'DEMO', issue_type: 'Task',
    summary: 'Performance profiling – frontend bundle elemzés',
    description: 'Webpack Bundle Analyzer futtatása, code splitting lehetőségek azonosítása, lazy loading implementáció tervezése.',
    status: 'In Review', priority: 'Medium', sprint_name: 'Sprint 12', team_name: 'Backend', story_points: 3,
    assignee_name: 'László Szőke', reporter_email: 'sandor.veres@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.75, suggested_role: 'Junior Backend Developer',
    original_estimate_hours: 8, remaining_hours: 2, completed_hours: 6,
    url: 'https://demo-company.atlassian.net/browse/DEMO-28',
    startOff: -2, dueOff: 5,
  },
  {
    provider: 'jira', external_key: 'DEMO-29', external_id: 'demo-task-29',
    project_key: 'DEMO', issue_type: 'Task',
    summary: 'Security audit előkészítés – OWASP checklist',
    description: 'OWASP Top 10 checklist átfutása, penetration test scope definiálása, külső biztonsági cég briefing dokumentuma.',
    status: 'To Do', priority: 'High', sprint_name: 'Sprint 13', team_name: 'QA', story_points: 5,
    assignee_name: 'Richárd Kővári', reporter_email: 'viktor.matyas@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.86, suggested_role: 'Senior QA Engineer',
    original_estimate_hours: 16, remaining_hours: 16, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-29',
    startOff: 14, dueOff: 28,
  },

  // ══ SUB-TASKS (4) ═════════════════════════════════════════════════════════
  {
    provider: 'jira', external_key: 'DEMO-30', external_id: 'demo-subtask-30',
    project_key: 'DEMO', parent_key: 'DEMO-4', issue_type: 'Sub-task',
    summary: 'Login form – validációs logika implementálása',
    description: 'Email regex, jelszó erősség meter, "maradj bejelentkezve" checkbox és form submit disabled state.',
    status: 'Done', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Frontend', story_points: 2,
    assignee_name: 'Tímea Bodnár', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.90, suggested_role: 'UX Designer',
    original_estimate_hours: 6, remaining_hours: 0, completed_hours: 6,
    url: 'https://demo-company.atlassian.net/browse/DEMO-30',
    startOff: -5, dueOff: -1,
  },
  {
    provider: 'jira', external_key: 'DEMO-31', external_id: 'demo-subtask-31',
    project_key: 'DEMO', parent_key: 'DEMO-4', issue_type: 'Sub-task',
    summary: 'Login oldal – UI komponens és layout',
    description: 'Shadcn/ui Card alapú login oldal layout, dark/light mode kompatibilis, brand logo elhelyezés, animált transition.',
    status: 'Done', priority: 'Medium', sprint_name: 'Sprint 12', team_name: 'Frontend', story_points: 3,
    assignee_name: 'Dávid Szabó', reporter_email: 'anna.kovacs@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.82, suggested_role: 'Junior Frontend Developer',
    original_estimate_hours: 8, remaining_hours: 0, completed_hours: 9,
    url: 'https://demo-company.atlassian.net/browse/DEMO-31',
    startOff: -5, dueOff: -2,
  },
  {
    provider: 'jira', external_key: 'DEMO-32', external_id: 'demo-subtask-32',
    project_key: 'DEMO', parent_key: 'DEMO-8', issue_type: 'Sub-task',
    summary: 'User service – unit tesztek megírása',
    description: 'Jest tesztek a UserService CRUD metódusokhoz, mock DB réteg, 85%+ coverage cél.',
    status: 'In Progress', priority: 'Medium', sprint_name: 'Sprint 12', team_name: 'QA', story_points: 3,
    assignee_name: 'Nikolett Farkas', reporter_email: 'judit.molnar@effectime-demo.local',
    capacity_risk: 'low', fit_score: 0.80, suggested_role: 'QA Engineer',
    original_estimate_hours: 10, remaining_hours: 4, completed_hours: 6,
    url: 'https://demo-company.atlassian.net/browse/DEMO-32',
    startOff: -3, dueOff: 7,
  },
  {
    provider: 'jira', external_key: 'DEMO-33', external_id: 'demo-subtask-33',
    project_key: 'DEMO', parent_key: 'DEMO-9', issue_type: 'Sub-task',
    summary: 'Auth token refresh – silent renew logika',
    description: 'Axios interceptor a lejárt access token csendes megújításához: queue-ba rendezi a párhuzamos kéréseket, retry 3x.',
    status: 'To Do', priority: 'High', sprint_name: 'Sprint 12', team_name: 'Backend', story_points: 2,
    assignee_name: 'László Szőke', reporter_email: 'sandor.veres@effectime-demo.local',
    capacity_risk: 'medium', fit_score: 0.77, suggested_role: 'Junior Backend Developer',
    original_estimate_hours: 6, remaining_hours: 6, completed_hours: 0,
    url: 'https://demo-company.atlassian.net/browse/DEMO-33',
    startOff: 0, dueOff: 3,
  },
];

export const AGILE_FIELD_METADATA_DEFS = [
  { provider: 'jira', project_key: 'DEMO', field_id: 'story_points',    field_name: 'Story Points',   field_type: 'number',  is_custom: false },
  { provider: 'jira', project_key: 'DEMO', field_id: 'sprint',          field_name: 'Sprint',         field_type: 'array',   is_custom: false },
  { provider: 'jira', project_key: 'DEMO', field_id: 'parent_key',      field_name: 'Parent Issue',   field_type: 'string',  is_custom: false },
  { provider: 'jira', project_key: 'DEMO', field_id: 'capacity_risk',   field_name: 'Capacity Risk',  field_type: 'select',  is_custom: true,  schema: { values: ['low', 'medium', 'high'] } },
  { provider: 'jira', project_key: 'DEMO', field_id: 'fit_score',       field_name: 'Fit Score',      field_type: 'number',  is_custom: true,  schema: { min: 0, max: 1 } },
  { provider: 'jira', project_key: 'DEMO', field_id: 'estimate_hours',  field_name: 'Estimate (h)',   field_type: 'number',  is_custom: false },
  { provider: 'jira', project_key: 'DEMO', field_id: 'completed_hours', field_name: 'Logged (h)',     field_type: 'number',  is_custom: false },
];

// ── L. NAPI SZABÁLYOK (enterprise_daily_rules) ───────────────────────────────
// Szabadság → Napi szabályok

export const DAILY_RULE_DEFS = [
  { day_of_week: 1, max_off: 3 }, // Hétfő
  { day_of_week: 2, max_off: 4 }, // Kedd
  { day_of_week: 3, max_off: 4 }, // Szerda
  { day_of_week: 4, max_off: 4 }, // Csütörtök
  { day_of_week: 5, max_off: 5 }, // Péntek
  { day_of_week: 6, max_off: 2 }, // Szombat
  { day_of_week: 0, max_off: 2 }, // Vasárnap
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
// Szervezet → Katalógus szerkesztő (CatalogListEditor).

export const JOB_FAMILY_DEFS = [
  { code: 'engineering', label: 'Engineering' },
  { code: 'operations',  label: 'Operations' },
  { code: 'qa',          label: 'Quality Assurance' },
  { code: 'management',  label: 'Management' },
  { code: 'design',      label: 'Design' },
  { code: 'product',     label: 'Product' },
];

export const LEADERSHIP_LEVEL_DEFS = [
  { code: 'strategic',   label: 'Strategic',   sort_order: 10 },  // L1 VP/C-level
  { code: 'operational', label: 'Operational', sort_order: 20 },  // L2 Department Heads
  { code: 'technical',   label: 'Technical',   sort_order: 30 },  // L3 Tech Leads
  { code: 'execution',   label: 'Execution',   sort_order: 40 },  // L4 Seniors
  { code: 'specialist',  label: 'Specialist',  sort_order: 50 },  // L5 Juniors/Mediors
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
// 5 szintű hierarchia — org chart fa bemutatójához:
//
//  L1 (strategic):   Viktor Mátyás  [VP Engineering, nincs felettese]
//  L2 (operational): Ferenc Horváth [Head of Engineering]
//                    Csilla Nagy    [Head of Operations]
//                    Judit Molnár   [Head of QA]
//                    Zsuzsanna Hegedűs [Scrum Master]
//  L3 (technical):   Anna Kovács    [Frontend Tech Lead → Ferenc]
//                    Sándor Veres   [Backend Tech Lead → Ferenc]
//                    Olivér Lengyel [Cloud Architect → Csilla]
//                    Gizella Varga  [Ops Specialist → Csilla]
//                    Richárd Kővári [Senior QA → Judit]
//  L4 (execution):   Petra Szász    [Senior FE → Anna]
//                    Tímea Bodnár   [UX Designer → Anna]
//                    István Papp    [Backend Dev → Sándor]
//                    Kristóf Balogh [DevOps → Olivér]
//                    Eszter Kiss    [QA Eng → Richárd]
//                    Nikolett Farkas[QA Eng → Richárd]
//  L5 (specialist):  Henrietta Fekete [FE Dev → Petra]
//                    Mária Tóth     [FE Dev → Petra]
//                    Dávid Szabó    [Junior FE → Tímea]
//                    Bence Tóth     [Backend Dev → István]
//                    László Szőke   [Junior Backend → István]
//                    Uzonka Pálfi   [Ops Eng → Gizella]

export const PERSONA_ORG_ASSIGNMENTS: Record<string, {
  managerName?: string;
  orgUnit: string;
  llCode: string;
  contractCode: string;
  leadershipCategory: 'operational' | 'technical';
}> = {
  // L1 — VP Engineering
  'Viktor Mátyás':      {                                  orgUnit: 'Mérnöki részleg', llCode: 'strategic',   contractCode: 'employee',   leadershipCategory: 'operational' },

  // L2 — Department Heads (report to Viktor)
  'Ferenc Horváth':     { managerName: 'Viktor Mátyás',   orgUnit: 'Mérnöki részleg', llCode: 'operational', contractCode: 'employee',   leadershipCategory: 'operational' },
  'Csilla Nagy':        { managerName: 'Viktor Mátyás',   orgUnit: 'Üzemeltetés',     llCode: 'operational', contractCode: 'employee',   leadershipCategory: 'operational' },
  'Judit Molnár':       { managerName: 'Viktor Mátyás',   orgUnit: 'QA csapat',       llCode: 'operational', contractCode: 'employee',   leadershipCategory: 'operational' },
  'Zsuzsanna Hegedűs':  { managerName: 'Viktor Mátyás',   orgUnit: 'Mérnöki részleg', llCode: 'operational', contractCode: 'employee',   leadershipCategory: 'operational' },

  // L3 — Tech Leads / Senior Managers (report to L2)
  'Anna Kovács':        { managerName: 'Ferenc Horváth',  orgUnit: 'Frontend csapat', llCode: 'technical',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Sándor Veres':       { managerName: 'Ferenc Horváth',  orgUnit: 'Backend csapat',  llCode: 'technical',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Olivér Lengyel':     { managerName: 'Csilla Nagy',     orgUnit: 'Üzemeltetés',     llCode: 'technical',   contractCode: 'contractor', leadershipCategory: 'technical'   },
  'Gizella Varga':      { managerName: 'Csilla Nagy',     orgUnit: 'Üzemeltetés',     llCode: 'technical',   contractCode: 'employee',   leadershipCategory: 'operational' },
  'Richárd Kővári':     { managerName: 'Judit Molnár',    orgUnit: 'QA csapat',       llCode: 'technical',   contractCode: 'contractor', leadershipCategory: 'technical'   },

  // L4 — Seniors / Specialists (report to L3)
  'Petra Szász':        { managerName: 'Anna Kovács',     orgUnit: 'Frontend csapat', llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Tímea Bodnár':       { managerName: 'Anna Kovács',     orgUnit: 'Frontend csapat', llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'István Papp':        { managerName: 'Sándor Veres',    orgUnit: 'Backend csapat',  llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Kristóf Balogh':     { managerName: 'Olivér Lengyel',  orgUnit: 'Üzemeltetés',     llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'operational' },
  'Eszter Kiss':        { managerName: 'Richárd Kővári',  orgUnit: 'QA csapat',       llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Nikolett Farkas':    { managerName: 'Richárd Kővári',  orgUnit: 'QA csapat',       llCode: 'execution',   contractCode: 'employee',   leadershipCategory: 'technical'   },

  // L5 — Juniors / Mediors (report to L4)
  'Henrietta Fekete':   { managerName: 'Petra Szász',     orgUnit: 'Frontend csapat', llCode: 'specialist',  contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Mária Tóth':         { managerName: 'Petra Szász',     orgUnit: 'Frontend csapat', llCode: 'specialist',  contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Dávid Szabó':        { managerName: 'Tímea Bodnár',    orgUnit: 'Frontend csapat', llCode: 'specialist',  contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Bence Tóth':         { managerName: 'István Papp',     orgUnit: 'Backend csapat',  llCode: 'specialist',  contractCode: 'employee',   leadershipCategory: 'technical'   },
  'László Szőke':       { managerName: 'István Papp',     orgUnit: 'Backend csapat',  llCode: 'specialist',  contractCode: 'employee',   leadershipCategory: 'technical'   },
  'Uzonka Pálfi':       { managerName: 'Gizella Varga',   orgUnit: 'Üzemeltetés',     llCode: 'specialist',  contractCode: 'employee',   leadershipCategory: 'operational' },
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
  leadership_levels:      5,  // all 5 levels required for 5-level org chart
  contract_types:         5,
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
  agile_issues:          33,  // full Kanban/Scrum/Gantt dataset
  ical_tokens:            4,
};

// ── Q. CÉLOK / EREDMÉNYEK (one-to-one beszélgetésekből) ─────────────────────
// `assignee_name` segítségével rendelődnek hozzá a megfelelő demo personához.
// Az index.ts a memberById map alapján keres rá.
export const MEMBER_GOAL_DEFS: Array<{
  assignee_name: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'achieved' | 'dropped';
  target_offset_days: number | null;
  achieved_offset_days?: number | null;
}> = [
  { assignee_name: 'Anna Kovács',     title: 'React 19 migráció vezetése',                    description: 'Q3-ban átállítjuk a Customer Portal-t React 19-re. Anna a tech lead.', status: 'in_progress', target_offset_days: 60 },
  { assignee_name: 'Anna Kovács',     title: 'Mentor szerep – junior frontendesek',           description: 'Heti 1 óra code review és pair programming Dáviddal és Henriettával.',   status: 'achieved',    target_offset_days: -30, achieved_offset_days: -10 },
  { assignee_name: 'Bence Tóth',      title: 'Senior Backend előléptetés',                    description: 'Architektúra design dokumentum + on-call rotáció megtanulása.',         status: 'in_progress', target_offset_days: 90 },
  { assignee_name: 'Dávid Szabó',     title: 'TypeScript szakmai vizsga',                     description: 'Microsoft / Meta TS certification — Q4 vége.',                          status: 'open',        target_offset_days: 120 },
  { assignee_name: 'Eszter Kiss',     title: 'Cypress E2E coverage 60% felett',               description: 'Customer Portal teljes login + dashboard útvonal lefedése.',            status: 'in_progress', target_offset_days: 45 },
  { assignee_name: 'Ferenc Horváth',  title: 'Mikroszolgáltatás osztály belső előadás',       description: 'Knowledge sharing session a backend csapatnak — Sprint 13.',           status: 'open',        target_offset_days: 30 },
  { assignee_name: 'Henrietta Fekete',title: 'Profil oldal redesign — UI rework',             description: 'Tímeával közösen, design system alapján.',                              status: 'achieved',    target_offset_days: -45, achieved_offset_days: -20 },
  { assignee_name: 'Judit Molnár',    title: 'QA strategy dokumentum',                        description: 'Teljes test piramis (unit / integration / E2E / VRT) leírása.',         status: 'in_progress', target_offset_days: 21 },
  { assignee_name: 'Petra Szász',     title: 'Konferencia előadás — React Summit',            description: 'Workshop a TanStack Query patternekről, október.',                      status: 'open',        target_offset_days: 150 },
  { assignee_name: 'Sándor Veres',    title: 'PostgreSQL teljesítmény-finomhangolás',         description: 'Lassú reportok query plan elemzése + indexelés.',                       status: 'achieved',    target_offset_days: -60, achieved_offset_days: -35 },
  { assignee_name: 'Viktor Mátyás',   title: 'Roadmap workshop facilitálás',                  description: 'Q4 roadmap kalibráció minden csapatvezetővel.',                         status: 'in_progress', target_offset_days: 14 },
  { assignee_name: 'Zsuzsanna Hegedűs', title: 'Sprint review formátum újragondolása',        description: 'Demo + retro külön session-ben — visszajelzés alapján.',                status: 'achieved',    target_offset_days: -20, achieved_offset_days: -5 },
];
