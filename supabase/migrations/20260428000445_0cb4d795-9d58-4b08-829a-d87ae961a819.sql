-- ============================================================
-- 1) ENTERPRISE OFFICE COVERAGE RULES — multi-position, name, expiry, archive
-- ============================================================

ALTER TABLE public.enterprise_office_coverage_rules
  ADD COLUMN IF NOT EXISTS business_roles text[] NULL,
  ADD COLUMN IF NOT EXISTS skill_ids uuid[] NULL,
  ADD COLUMN IF NOT EXISTS name text NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- Constraint: status only allows known values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_office_coverage_rules_status_check'
  ) THEN
    ALTER TABLE public.enterprise_office_coverage_rules
      ADD CONSTRAINT enterprise_office_coverage_rules_status_check
      CHECK (status IN ('active','archived','expired'));
  END IF;
END $$;

-- Backfill: copy legacy single-value into arrays for existing rows
UPDATE public.enterprise_office_coverage_rules
SET business_roles = ARRAY[business_role]
WHERE business_role IS NOT NULL
  AND (business_roles IS NULL OR array_length(business_roles, 1) IS NULL);

UPDATE public.enterprise_office_coverage_rules
SET skill_ids = ARRAY[skill_id]
WHERE skill_id IS NOT NULL
  AND (skill_ids IS NULL OR array_length(skill_ids, 1) IS NULL);

CREATE INDEX IF NOT EXISTS idx_eocr_status_valid_until
  ON public.enterprise_office_coverage_rules(status, valid_until);

-- Auto-archive function (soft delete on expiry)
CREATE OR REPLACE FUNCTION public.auto_archive_expired_coverage_rules()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived_count integer;
BEGIN
  UPDATE public.enterprise_office_coverage_rules
  SET status = 'archived',
      archived_at = now()
  WHERE status = 'active'
    AND valid_until IS NOT NULL
    AND valid_until < CURRENT_DATE;
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

-- ============================================================
-- 2) ENTERPRISE AGILE — Jira / Azure DevOps integration cache
-- ============================================================

CREATE TABLE IF NOT EXISTS public.enterprise_agile_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  provider text NOT NULL,                       -- 'jira' | 'azure_devops'
  external_key text NOT NULL,                   -- e.g. 'PROJ-123' or work item id
  external_id text NULL,
  project_key text NULL,
  parent_key text NULL,
  issue_type text NULL,
  summary text NULL,
  status text NULL,
  priority text NULL,
  assignee_email text NULL,
  assignee_name text NULL,
  reporter_email text NULL,
  sprint_name text NULL,
  iteration_path text NULL,
  due_date date NULL,
  start_date date NULL,
  original_estimate_hours numeric NULL,
  remaining_hours numeric NULL,
  completed_hours numeric NULL,
  story_points numeric NULL,
  labels text[] NULL,
  components text[] NULL,
  raw jsonb NULL,                               -- full upstream payload
  custom_fields jsonb NULL,
  url text NULL,
  external_updated_at timestamptz NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, external_key)
);

CREATE INDEX IF NOT EXISTS idx_eai_workspace ON public.enterprise_agile_issues(workspace_id);
CREATE INDEX IF NOT EXISTS idx_eai_assignee ON public.enterprise_agile_issues(assignee_email);
CREATE INDEX IF NOT EXISTS idx_eai_sprint ON public.enterprise_agile_issues(sprint_name);
CREATE INDEX IF NOT EXISTS idx_eai_status ON public.enterprise_agile_issues(status);

CREATE TABLE IF NOT EXISTS public.enterprise_agile_field_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  project_key text NULL,
  field_id text NOT NULL,                       -- e.g. 'customfield_10010'
  field_name text NOT NULL,
  field_type text NULL,
  is_custom boolean NOT NULL DEFAULT false,
  schema jsonb NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, field_id)
);

CREATE TABLE IF NOT EXISTS public.enterprise_agile_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  event text NOT NULL,                          -- 'connection_test' | 'fetch_issues' | 'create_issue' | 'update_issue' | 'field_discovery'
  status text NOT NULL,                         -- 'success' | 'error'
  details jsonb NULL,
  error_message text NULL,
  triggered_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easl_workspace_created ON public.enterprise_agile_sync_log(workspace_id, created_at DESC);

-- RLS
ALTER TABLE public.enterprise_agile_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_agile_field_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_agile_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agile_issues_select" ON public.enterprise_agile_issues;
CREATE POLICY "agile_issues_select" ON public.enterprise_agile_issues
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "agile_issues_modify" ON public.enterprise_agile_issues;
CREATE POLICY "agile_issues_modify" ON public.enterprise_agile_issues
  FOR ALL TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

DROP POLICY IF EXISTS "agile_fields_select" ON public.enterprise_agile_field_metadata;
CREATE POLICY "agile_fields_select" ON public.enterprise_agile_field_metadata
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "agile_fields_modify" ON public.enterprise_agile_field_metadata;
CREATE POLICY "agile_fields_modify" ON public.enterprise_agile_field_metadata
  FOR ALL TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

DROP POLICY IF EXISTS "agile_sync_log_select" ON public.enterprise_agile_sync_log;
CREATE POLICY "agile_sync_log_select" ON public.enterprise_agile_sync_log
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "agile_sync_log_insert" ON public.enterprise_agile_sync_log;
CREATE POLICY "agile_sync_log_insert" ON public.enterprise_agile_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

-- updated_at trigger for agile_issues
DROP TRIGGER IF EXISTS trg_eai_updated_at ON public.enterprise_agile_issues;
CREATE TRIGGER trg_eai_updated_at
  BEFORE UPDATE ON public.enterprise_agile_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();