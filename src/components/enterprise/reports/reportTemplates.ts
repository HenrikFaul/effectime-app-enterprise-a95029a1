// Predefined report templates that managers can use as starting points.
// Each template defines a data_source + visual builder config.
// Datasets are exposed as business-friendly groupings on top of the existing
// data_source layer so the edge function backend remains unchanged (additive).

export type ReportDataSource =
  | 'memberships'
  | 'leave_requests'
  | 'approval_decisions'
  | 'role_allocations'
  | 'audit_events'
  | 'holidays'
  | 'company_leave_days';

export type ReportChartType = 'table' | 'bar' | 'stacked_bar' | 'line' | 'pie' | 'kpi' | 'leaderboard' | 'heatmap';

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'is_null' | 'not_null';
  value?: string | number | string[] | null;
}

export interface ReportConfig {
  fields: string[];
  filters: ReportFilter[];
  group_by: string[];
  aggregations: { field: string; fn: 'count' | 'sum' | 'avg' | 'min' | 'max'; alias?: string }[];
  sort?: { field: string; dir: 'asc' | 'desc' }[];
  limit?: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  data_source: ReportDataSource;
  chart_type: ReportChartType;
  config: ReportConfig;
  dataset_label?: string;
}

// Field metadata per data source — drives the visual builder
export const DATA_SOURCE_FIELDS: Record<ReportDataSource, { key: string; label: string; type: 'text' | 'number' | 'date' | 'enum' }[]> = {
  memberships: [
    { key: 'display_name', label: 'Név', type: 'text' },
    { key: 'role', label: 'Szerepkör', type: 'enum' },
    { key: 'business_role', label: 'Pozíció', type: 'text' },
    { key: 'team', label: 'Csapat', type: 'text' },
    { key: 'city', label: 'Város', type: 'text' },
    { key: 'office_id', label: 'Iroda', type: 'text' },
    { key: 'status', label: 'Státusz', type: 'enum' },
    { key: 'joined_at', label: 'Csatlakozás', type: 'date' },
  ],
  leave_requests: [
    { key: 'user_id', label: 'Tag', type: 'text' },
    { key: 'leave_type', label: 'Típus', type: 'enum' },
    { key: 'status', label: 'Státusz', type: 'enum' },
    { key: 'start_date', label: 'Kezdő dátum', type: 'date' },
    { key: 'end_date', label: 'Befejező dátum', type: 'date' },
    { key: 'is_half_day', label: 'Fél napos', type: 'enum' },
    { key: 'created_at', label: 'Létrehozva', type: 'date' },
    { key: 'reviewed_at', label: 'Elbírálva', type: 'date' },
  ],
  approval_decisions: [
    { key: 'decision', label: 'Döntés', type: 'enum' },
    { key: 'decided_by', label: 'Döntéshozó', type: 'text' },
    { key: 'created_at', label: 'Időpont', type: 'date' },
  ],
  role_allocations: [
    { key: 'membership_id', label: 'Tag', type: 'text' },
    { key: 'business_role', label: 'Pozíció', type: 'text' },
    { key: 'percentage', label: 'Arány %', type: 'number' },
    { key: 'is_priority', label: 'Elsődleges', type: 'enum' },
  ],
  audit_events: [
    { key: 'action', label: 'Művelet', type: 'text' },
    { key: 'actor_id', label: 'Végrehajtó', type: 'text' },
    { key: 'target_type', label: 'Célpont típus', type: 'text' },
    { key: 'created_at', label: 'Időpont', type: 'date' },
  ],
  holidays: [
    { key: 'name', label: 'Név', type: 'text' },
    { key: 'holiday_date', label: 'Dátum', type: 'date' },
    { key: 'is_recurring', label: 'Ismétlődő', type: 'enum' },
  ],
  company_leave_days: [
    { key: 'name', label: 'Név', type: 'text' },
    { key: 'leave_date', label: 'Dátum', type: 'date' },
    { key: 'is_recurring', label: 'Ismétlődő', type: 'enum' },
  ],
};

export const DATA_SOURCE_LABELS: Record<ReportDataSource, string> = {
  memberships: 'Tagok',
  leave_requests: 'Szabadság kérelmek',
  approval_decisions: 'Jóváhagyási döntések',
  role_allocations: 'Pozíció allokációk',
  audit_events: 'Audit események',
  holidays: 'Ünnepnapok',
  company_leave_days: 'Vállalati szabadnapok',
};

// Semantic dataset groupings (business-friendly UI labels grouping the underlying data sources)
export type SemanticDataset = 'people_analytics' | 'leave_analytics' | 'approval_analytics' | 'capacity_analytics' | 'audit_analytics';

export const SEMANTIC_DATASETS: { key: SemanticDataset; label: string; description: string; icon: string; sources: ReportDataSource[] }[] = [
  { key: 'people_analytics', label: 'Emberek és csapatok', description: 'Tagok, szerepkörök, csapatok, irodák megoszlása', icon: '👥', sources: ['memberships', 'role_allocations'] },
  { key: 'leave_analytics', label: 'Szabadság elemzés', description: 'Szabadság kérelmek típus, státusz, csapat szerint', icon: '🌴', sources: ['leave_requests'] },
  { key: 'approval_analytics', label: 'Jóváhagyás elemzés', description: 'Döntések, jóváhagyók, sebesség, szűk keresztmetszetek', icon: '✅', sources: ['approval_decisions', 'leave_requests'] },
  { key: 'capacity_analytics', label: 'Kapacitás és lefedettség', description: 'Ünnepnapok, vállalati szabadnapok, csapatallokáció', icon: '📊', sources: ['holidays', 'company_leave_days', 'role_allocations'] },
  { key: 'audit_analytics', label: 'Audit és megfelelés', description: 'Konfiguráció változások, aktivitás, tevékenységi napló', icon: '🔍', sources: ['audit_events'] },
];

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // 1. Team absence overview
  {
    id: 'tpl_team_absence_overview',
    name: 'Csapat szabadság áttekintő',
    description: 'Csapatonként mutatja a jóváhagyott, függő és elutasított szabadságok megoszlását.',
    data_source: 'leave_requests',
    chart_type: 'stacked_bar',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['user_id', 'leave_type', 'status', 'start_date'],
      filters: [],
      group_by: ['status'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'darab' }],
      sort: [{ field: 'darab', dir: 'desc' }],
    },
  },
  // 2. Monthly absence trend
  {
    id: 'tpl_monthly_absence_trend',
    name: 'Havi szabadság trend',
    description: 'Havi bontásban a szabadság kérelmek alakulása az elmúlt időszakban.',
    data_source: 'leave_requests',
    chart_type: 'line',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['start_date', 'status', 'leave_type'],
      filters: [{ field: 'status', operator: 'eq', value: 'approved' }],
      group_by: ['leave_type'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'kérelmek' }],
    },
  },
  // 3. Approval bottleneck
  {
    id: 'tpl_approval_bottleneck',
    name: 'Jóváhagyási szűk keresztmetszet',
    description: 'Mely döntéshozók terheltek a legjobban, és mennyi a legmagasabb döntésszám.',
    data_source: 'approval_decisions',
    chart_type: 'leaderboard',
    dataset_label: 'approval_analytics',
    config: {
      fields: ['decided_by', 'decision', 'created_at'],
      filters: [],
      group_by: ['decided_by'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'döntések' }],
      sort: [{ field: 'döntések', dir: 'desc' }],
      limit: 20,
    },
  },
  // 4. Leave type distribution
  {
    id: 'tpl_leave_type_distribution',
    name: 'Szabadságtípus megoszlás',
    description: 'A jóváhagyott szabadságok típus szerinti megoszlása.',
    data_source: 'leave_requests',
    chart_type: 'pie',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['leave_type', 'status'],
      filters: [{ field: 'status', operator: 'eq', value: 'approved' }],
      group_by: ['leave_type'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'darab' }],
    },
  },
  // 5. Role coverage risk (uses role_allocations)
  {
    id: 'tpl_role_coverage_risk',
    name: 'Pozíció lefedettségi kockázat',
    description: 'Mely pozíciókban van kevés ember vagy alacsony összesített kapacitás.',
    data_source: 'role_allocations',
    chart_type: 'bar',
    dataset_label: 'capacity_analytics',
    config: {
      fields: ['business_role', 'membership_id', 'percentage', 'is_priority'],
      filters: [],
      group_by: ['business_role'],
      aggregations: [
        { field: 'membership_id', fn: 'count', alias: 'fő' },
        { field: 'percentage', fn: 'sum', alias: 'összes %' },
      ],
      sort: [{ field: 'fő', dir: 'asc' }],
    },
  },
  // 6. Conflict / blocked days
  {
    id: 'tpl_conflict_days',
    name: 'Vállalati szabadnapok',
    description: 'A workspace szintű kötelező szabadnapok és blokkolt időszakok listája.',
    data_source: 'company_leave_days',
    chart_type: 'table',
    dataset_label: 'capacity_analytics',
    config: {
      fields: ['name', 'leave_date', 'is_recurring'],
      filters: [],
      group_by: [],
      aggregations: [],
      sort: [{ field: 'leave_date', dir: 'asc' }],
    },
  },
  // 7. Office absence pattern
  {
    id: 'tpl_office_absence_pattern',
    name: 'Iroda alapú megoszlás',
    description: 'Tagok és pozíciójuk eloszlása irodák/városok szerint.',
    data_source: 'memberships',
    chart_type: 'bar',
    dataset_label: 'people_analytics',
    config: {
      fields: ['city', 'business_role', 'team', 'status'],
      filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      group_by: ['city'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'fő' }],
      sort: [{ field: 'fő', dir: 'desc' }],
    },
  },
  // 8. Team composition
  {
    id: 'tpl_team_composition',
    name: 'Csapat összetétel',
    description: 'Csapatonkénti létszám és pozíciómegoszlás (aktív tagok).',
    data_source: 'memberships',
    chart_type: 'stacked_bar',
    dataset_label: 'people_analytics',
    config: {
      fields: ['team', 'business_role', 'status'],
      filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      group_by: ['team'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'fő' }],
      sort: [{ field: 'fő', dir: 'desc' }],
    },
  },
  // 9. Member workload
  {
    id: 'tpl_member_leave_frequency',
    name: 'Tag terheltségi rangsor',
    description: 'Top 20 tag a legtöbb szabadság kérelemmel az elmúlt időszakban.',
    data_source: 'leave_requests',
    chart_type: 'leaderboard',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['user_id', 'leave_type', 'status'],
      filters: [],
      group_by: ['user_id'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'kérelmek' }],
      sort: [{ field: 'kérelmek', dir: 'desc' }],
      limit: 20,
    },
  },
  // 10. Audit activity
  {
    id: 'tpl_audit_activity',
    name: 'Audit aktivitás',
    description: 'Műveletek típus szerinti megoszlása az audit naplóban.',
    data_source: 'audit_events',
    chart_type: 'bar',
    dataset_label: 'audit_analytics',
    config: {
      fields: ['action', 'actor_id', 'target_type', 'created_at'],
      filters: [],
      group_by: ['action'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'esemény' }],
      sort: [{ field: 'esemény', dir: 'desc' }],
      limit: 50,
    },
  },
];
