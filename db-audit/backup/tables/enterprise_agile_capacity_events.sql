-- Backup of public.enterprise_agile_capacity_events (taken 2026-05-13)
-- Reason for deletion: zero rows; no INSERT/SELECT code anywhere; part of
-- the "agile capacity sync extension" (migration 20260430160000) that was
-- never wired to the running jira-devops-proxy edge function or UI. Pass
-- 1+2+3 all agree unused.

CREATE TABLE IF NOT EXISTS public.enterprise_agile_capacity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  issue_key text,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['change','capacity','variance','risk','writeback','simulation'])),
  impact_summary text NOT NULL,
  risk_level text DEFAULT 'low'::text NOT NULL CHECK (risk_level = ANY (ARRAY['low','medium','high'])),
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  auto_action_taken text,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ea_events_workspace_created
  ON public.enterprise_agile_capacity_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ea_events_integration_created
  ON public.enterprise_agile_capacity_events (integration_id, created_at DESC);

ALTER TABLE public.enterprise_agile_capacity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agile_capacity_events_insert" ON public.enterprise_agile_capacity_events
  FOR INSERT
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "agile_capacity_events_select" ON public.enterprise_agile_capacity_events
  FOR SELECT
  USING (is_enterprise_member(workspace_id, auth.uid()));

-- Row count at backup time: 0 (empty table)
