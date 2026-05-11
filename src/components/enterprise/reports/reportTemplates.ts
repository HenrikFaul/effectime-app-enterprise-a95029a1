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

// Semantic dataset groupings (business-friendly UI labels grouping the underlying data sources)
export type SemanticDataset = 'people_analytics' | 'leave_analytics' | 'approval_analytics' | 'capacity_analytics' | 'audit_analytics';

type TFunction = (key: string) => string;

// Field metadata per data source — drives the visual builder
export const getDataSourceFields = (t: TFunction): Record<ReportDataSource, { key: string; label: string; type: 'text' | 'number' | 'date' | 'enum' }[]> => ({
  memberships: [
    { key: 'display_name', label: t('report_templates.field_name'), type: 'text' },
    { key: 'role', label: t('report_templates.field_role'), type: 'enum' },
    { key: 'business_role', label: t('report_templates.field_position'), type: 'text' },
    { key: 'team', label: t('report_templates.field_team'), type: 'text' },
    { key: 'city', label: t('report_templates.field_city'), type: 'text' },
    { key: 'office_id', label: t('report_templates.field_office'), type: 'text' },
    { key: 'status', label: t('report_templates.field_status_label'), type: 'enum' },
    { key: 'joined_at', label: t('report_templates.field_joined_at'), type: 'date' },
  ],
  leave_requests: [
    { key: 'user_id', label: t('report_templates.field_member'), type: 'text' },
    { key: 'leave_type', label: t('report_templates.field_type'), type: 'enum' },
    { key: 'status', label: t('report_templates.field_status_label'), type: 'enum' },
    { key: 'start_date', label: t('report_templates.field_start_date'), type: 'date' },
    { key: 'end_date', label: t('report_templates.field_end_date'), type: 'date' },
    { key: 'is_half_day', label: t('report_templates.field_half_day'), type: 'enum' },
    { key: 'created_at', label: t('report_templates.field_created_at_label'), type: 'date' },
    { key: 'reviewed_at', label: t('report_templates.field_reviewed_at'), type: 'date' },
  ],
  approval_decisions: [
    { key: 'decision', label: t('report_templates.field_decision'), type: 'enum' },
    { key: 'decided_by', label: t('report_templates.field_decision_by'), type: 'text' },
    { key: 'created_at', label: t('report_templates.field_timestamp'), type: 'date' },
  ],
  role_allocations: [
    { key: 'membership_id', label: t('report_templates.field_member'), type: 'text' },
    { key: 'business_role', label: t('report_templates.field_position'), type: 'text' },
    { key: 'percentage', label: t('report_templates.field_percentage'), type: 'number' },
    { key: 'is_priority', label: t('report_templates.field_priority'), type: 'enum' },
  ],
  audit_events: [
    { key: 'action', label: t('report_templates.field_action'), type: 'text' },
    { key: 'actor_id', label: t('report_templates.field_actor'), type: 'text' },
    { key: 'target_type', label: t('report_templates.field_target_type'), type: 'text' },
    { key: 'created_at', label: t('report_templates.field_timestamp'), type: 'date' },
  ],
  holidays: [
    { key: 'name', label: t('report_templates.field_name'), type: 'text' },
    { key: 'holiday_date', label: t('report_templates.field_date'), type: 'date' },
    { key: 'is_recurring', label: t('report_templates.field_recurring'), type: 'enum' },
  ],
  company_leave_days: [
    { key: 'name', label: t('report_templates.field_name'), type: 'text' },
    { key: 'leave_date', label: t('report_templates.field_date'), type: 'date' },
    { key: 'is_recurring', label: t('report_templates.field_recurring'), type: 'enum' },
  ],
});

export const getDataSourceLabels = (t: TFunction): Record<ReportDataSource, string> => ({
  memberships: t('report_templates.source_memberships'),
  leave_requests: t('report_templates.source_leave_requests'),
  approval_decisions: t('report_templates.source_approval_decisions'),
  role_allocations: t('report_templates.source_role_allocations'),
  audit_events: t('report_templates.source_audit_events'),
  holidays: t('report_templates.source_holidays'),
  company_leave_days: t('report_templates.source_company_leave_days'),
});

export const getSemanticDatasets = (t: TFunction): { key: SemanticDataset; label: string; description: string; icon: string; sources: ReportDataSource[] }[] => [
  { key: 'people_analytics', label: t('report_templates.dataset_people_label'), description: t('report_templates.dataset_people_desc'), icon: '👥', sources: ['memberships', 'role_allocations'] },
  { key: 'leave_analytics', label: t('report_templates.dataset_leave_label'), description: t('report_templates.dataset_leave_desc'), icon: '🌴', sources: ['leave_requests'] },
  { key: 'approval_analytics', label: t('report_templates.dataset_approval_label'), description: t('report_templates.dataset_approval_desc'), icon: '✅', sources: ['approval_decisions', 'leave_requests'] },
  { key: 'capacity_analytics', label: t('report_templates.dataset_capacity_label'), description: t('report_templates.dataset_capacity_desc'), icon: '📊', sources: ['holidays', 'company_leave_days', 'role_allocations'] },
  { key: 'audit_analytics', label: t('report_templates.dataset_audit_label'), description: t('report_templates.dataset_audit_desc'), icon: '🔍', sources: ['audit_events'] },
];

export const getReportTemplates = (t: TFunction): ReportTemplate[] => [
  {
    id: 'tpl_team_absence_overview',
    name: t('report_templates.tpl_team_absence_name'),
    description: t('report_templates.tpl_team_absence_desc'),
    data_source: 'leave_requests',
    chart_type: 'stacked_bar',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['user_id', 'leave_type', 'status', 'start_date'],
      filters: [],
      group_by: ['status'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'count' }],
      sort: [{ field: 'count', dir: 'desc' }],
    },
  },
  {
    id: 'tpl_monthly_absence_trend',
    name: t('report_templates.tpl_monthly_trend_name'),
    description: t('report_templates.tpl_monthly_trend_desc'),
    data_source: 'leave_requests',
    chart_type: 'line',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['start_date', 'status', 'leave_type'],
      filters: [{ field: 'status', operator: 'eq', value: 'approved' }],
      group_by: ['leave_type'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'requests' }],
    },
  },
  {
    id: 'tpl_approval_bottleneck',
    name: t('report_templates.tpl_approval_bottleneck_name'),
    description: t('report_templates.tpl_approval_bottleneck_desc'),
    data_source: 'approval_decisions',
    chart_type: 'leaderboard',
    dataset_label: 'approval_analytics',
    config: {
      fields: ['decided_by', 'decision', 'created_at'],
      filters: [],
      group_by: ['decided_by'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'decisions' }],
      sort: [{ field: 'decisions', dir: 'desc' }],
      limit: 20,
    },
  },
  {
    id: 'tpl_leave_type_distribution',
    name: t('report_templates.tpl_leave_type_dist_name'),
    description: t('report_templates.tpl_leave_type_dist_desc'),
    data_source: 'leave_requests',
    chart_type: 'pie',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['leave_type', 'status'],
      filters: [{ field: 'status', operator: 'eq', value: 'approved' }],
      group_by: ['leave_type'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'count' }],
    },
  },
  {
    id: 'tpl_role_coverage_risk',
    name: t('report_templates.tpl_role_coverage_name'),
    description: t('report_templates.tpl_role_coverage_desc'),
    data_source: 'role_allocations',
    chart_type: 'bar',
    dataset_label: 'capacity_analytics',
    config: {
      fields: ['business_role', 'membership_id', 'percentage', 'is_priority'],
      filters: [],
      group_by: ['business_role'],
      aggregations: [
        { field: 'membership_id', fn: 'count', alias: 'people' },
        { field: 'percentage', fn: 'sum', alias: 'total_pct' },
      ],
      sort: [{ field: 'people', dir: 'asc' }],
    },
  },
  {
    id: 'tpl_conflict_days',
    name: t('report_templates.tpl_conflict_days_name'),
    description: t('report_templates.tpl_conflict_days_desc'),
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
  {
    id: 'tpl_office_absence_pattern',
    name: t('report_templates.tpl_office_pattern_name'),
    description: t('report_templates.tpl_office_pattern_desc'),
    data_source: 'memberships',
    chart_type: 'bar',
    dataset_label: 'people_analytics',
    config: {
      fields: ['city', 'business_role', 'team', 'status'],
      filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      group_by: ['city'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'people' }],
      sort: [{ field: 'people', dir: 'desc' }],
    },
  },
  {
    id: 'tpl_team_composition',
    name: t('report_templates.tpl_team_composition_name'),
    description: t('report_templates.tpl_team_composition_desc'),
    data_source: 'memberships',
    chart_type: 'stacked_bar',
    dataset_label: 'people_analytics',
    config: {
      fields: ['team', 'business_role', 'status'],
      filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      group_by: ['team'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'people' }],
      sort: [{ field: 'people', dir: 'desc' }],
    },
  },
  {
    id: 'tpl_member_leave_frequency',
    name: t('report_templates.tpl_member_workload_name'),
    description: t('report_templates.tpl_member_workload_desc'),
    data_source: 'leave_requests',
    chart_type: 'leaderboard',
    dataset_label: 'leave_analytics',
    config: {
      fields: ['user_id', 'leave_type', 'status'],
      filters: [],
      group_by: ['user_id'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'requests' }],
      sort: [{ field: 'requests', dir: 'desc' }],
      limit: 20,
    },
  },
  {
    id: 'tpl_audit_activity',
    name: t('report_templates.tpl_audit_activity_name'),
    description: t('report_templates.tpl_audit_activity_desc'),
    data_source: 'audit_events',
    chart_type: 'bar',
    dataset_label: 'audit_analytics',
    config: {
      fields: ['action', 'actor_id', 'target_type', 'created_at'],
      filters: [],
      group_by: ['action'],
      aggregations: [{ field: 'id', fn: 'count', alias: 'events' }],
      sort: [{ field: 'events', dir: 'desc' }],
      limit: 50,
    },
  },
];
