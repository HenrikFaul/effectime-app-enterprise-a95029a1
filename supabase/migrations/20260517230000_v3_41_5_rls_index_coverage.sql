-- v3.41.5 — RLS Index Coverage Sweep
-- Adds CONCURRENTLY indexes on workspace_id / user_id columns that are
-- referenced in RLS policies but were missing indexes, causing seq-scans
-- on every authenticated query to these tables.
-- All indexes use IF NOT EXISTS — safe to re-run (idempotent).

-- HIGH PRIORITY: leave_requests is a frequently queried table
CREATE INDEX IF NOT EXISTS idx_leave_requests_workspace_id
  ON public.leave_requests(workspace_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id
  ON public.leave_requests(user_id);

-- HIGH PRIORITY: notifications polled on every page load
CREATE INDEX IF NOT EXISTS idx_enterprise_notifications_workspace_id
  ON public.enterprise_notifications(workspace_id);

-- MEDIUM PRIORITY
CREATE INDEX IF NOT EXISTS idx_approval_decisions_workspace_id
  ON public.approval_decisions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_quota_transactions_workspace_id
  ON public.enterprise_quota_transactions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_allowances_workspace_id
  ON public.enterprise_allowances(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_company_leave_days_workspace_id
  ON public.enterprise_company_leave_days(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_hr_workflow_tasks_workspace_id
  ON public.enterprise_hr_workflow_tasks(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_shift_cancellations_workspace_id
  ON public.enterprise_shift_cancellations(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_shift_cancellations_user_id
  ON public.enterprise_shift_cancellations(user_id);

CREATE INDEX IF NOT EXISTS idx_leave_request_attachments_workspace_id
  ON public.leave_request_attachments(workspace_id);

CREATE INDEX IF NOT EXISTS idx_leave_request_substitutes_workspace_id
  ON public.leave_request_substitutes(workspace_id);

-- LOW PRIORITY (small or infrequently queried tables — included for completeness)
CREATE INDEX IF NOT EXISTS idx_enterprise_agile_field_metadata_workspace_id
  ON public.enterprise_agile_field_metadata(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_daily_rules_workspace_id
  ON public.enterprise_daily_rules(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_escalation_rules_workspace_id
  ON public.enterprise_escalation_rules(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_export_jobs_workspace_id
  ON public.enterprise_export_jobs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_integration_sync_log_workspace_id
  ON public.enterprise_integration_sync_log(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_member_rates_workspace_id
  ON public.enterprise_member_rates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_member_templates_workspace_id
  ON public.enterprise_member_templates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_office_equipment_workspace_id
  ON public.enterprise_office_equipment(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_office_min_staffing_workspace_id
  ON public.enterprise_office_min_staffing(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_offices_workspace_id
  ON public.enterprise_offices(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_project_rates_workspace_id
  ON public.enterprise_project_rates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_project_resource_requirements_workspace_id
  ON public.enterprise_project_resource_requirements(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_rule_templates_workspace_id
  ON public.enterprise_rule_templates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_scenario_assignments_workspace_id
  ON public.enterprise_scenario_assignments(workspace_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_scenarios_workspace_id
  ON public.enterprise_scenarios(workspace_id);

CREATE INDEX IF NOT EXISTS idx_plugin_webhook_events_workspace_id
  ON public.plugin_webhook_events(workspace_id);

CREATE INDEX IF NOT EXISTS idx_qr_clock_sessions_workspace_id
  ON public.qr_clock_sessions(workspace_id);
