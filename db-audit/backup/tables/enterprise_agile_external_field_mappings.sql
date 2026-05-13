-- Backup of public.enterprise_agile_external_field_mappings (taken 2026-05-13)
-- Reason for deletion: zero rows; no INSERT/SELECT code anywhere; part of
-- the "agile capacity sync extension" (migration 20260430160000) that was
-- never wired to the running jira-devops-proxy edge function or UI. Pass
-- 1+2+3 all agree unused.

CREATE TABLE IF NOT EXISTS public.enterprise_agile_external_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_field_id text NOT NULL,
  normalized_field text NOT NULL,
  sync_direction text DEFAULT 'in'::text NOT NULL CHECK (sync_direction = ANY (ARRAY['in','out','both'])),
  is_required boolean DEFAULT false NOT NULL,
  is_safe_writeback boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (integration_id, external_field_id, normalized_field)
);

ALTER TABLE public.enterprise_agile_external_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agile_field_mappings_modify" ON public.enterprise_agile_external_field_mappings
  FOR ALL
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]))
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "agile_field_mappings_select" ON public.enterprise_agile_external_field_mappings
  FOR SELECT
  USING (is_enterprise_member(workspace_id, auth.uid()));

-- Row count at backup time: 0 (empty table)
