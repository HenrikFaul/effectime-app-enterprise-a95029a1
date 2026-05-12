-- =============================================================================
-- Migration: 20260512220000_payroll_security_platform
-- Created:   2026-05-12
-- Summary:   Payroll & Security Platform foundation tables and functions.
--
--   1. Extends enterprise_audit_events with ip_address and user_agent columns.
--   2. payroll_periods          – track payroll cycle open/locked/exported state.
--   3. payroll_export_configs   – per-workspace payroll-provider configuration.
--   4. data_retention_policies  – configurable retention rules per table.
--   5. gdpr_requests            – GDPR export / deletion request tracking.
--   6. enforce_data_retention() – function for pg_cron (activated by admin).
--
-- RLS strategy:
--   SELECT  → is_enterprise_member()
--   INSERT/UPDATE/DELETE → has_enterprise_role(... owner / resourceAssistant)
--   Exception: gdpr_requests INSERT → any member but must set requestor_id = auth.uid()
-- =============================================================================


-- ─── 1. Extend enterprise_audit_events ───────────────────────────────────────

ALTER TABLE public.enterprise_audit_events
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;


-- ─── 2. payroll_periods ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID       NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'locked', 'exported')),
  locked_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at   TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  exported_to TEXT,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_periods_dates_check CHECK (end_date > start_date)
);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payroll_periods_workspace_start
  ON public.payroll_periods (workspace_id, start_date DESC);

-- SELECT: workspace members
DROP POLICY IF EXISTS "payroll_periods_select" ON public.payroll_periods;
CREATE POLICY "payroll_periods_select"
  ON public.payroll_periods
  FOR SELECT
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

-- INSERT: owner / resourceAssistant
DROP POLICY IF EXISTS "payroll_periods_insert" ON public.payroll_periods;
CREATE POLICY "payroll_periods_insert"
  ON public.payroll_periods
  FOR INSERT
  WITH CHECK (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- UPDATE: owner / resourceAssistant
DROP POLICY IF EXISTS "payroll_periods_update" ON public.payroll_periods;
CREATE POLICY "payroll_periods_update"
  ON public.payroll_periods
  FOR UPDATE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- DELETE: owner / resourceAssistant
DROP POLICY IF EXISTS "payroll_periods_delete" ON public.payroll_periods;
CREATE POLICY "payroll_periods_delete"
  ON public.payroll_periods
  FOR DELETE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );


-- ─── 3. payroll_export_configs ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_export_configs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  provider       TEXT        NOT NULL,
  config         JSONB       NOT NULL DEFAULT '{}',
  field_mappings JSONB       NOT NULL DEFAULT '{}',
  is_active      BOOL        NOT NULL DEFAULT true,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

ALTER TABLE public.payroll_export_configs ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_payroll_export_configs_updated_at'
  ) THEN
    CREATE TRIGGER trg_payroll_export_configs_updated_at
      BEFORE UPDATE ON public.payroll_export_configs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- SELECT: workspace members
DROP POLICY IF EXISTS "payroll_export_configs_select" ON public.payroll_export_configs;
CREATE POLICY "payroll_export_configs_select"
  ON public.payroll_export_configs
  FOR SELECT
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

-- INSERT: owner / resourceAssistant
DROP POLICY IF EXISTS "payroll_export_configs_insert" ON public.payroll_export_configs;
CREATE POLICY "payroll_export_configs_insert"
  ON public.payroll_export_configs
  FOR INSERT
  WITH CHECK (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- UPDATE: owner / resourceAssistant
DROP POLICY IF EXISTS "payroll_export_configs_update" ON public.payroll_export_configs;
CREATE POLICY "payroll_export_configs_update"
  ON public.payroll_export_configs
  FOR UPDATE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- DELETE: owner / resourceAssistant
DROP POLICY IF EXISTS "payroll_export_configs_delete" ON public.payroll_export_configs;
CREATE POLICY "payroll_export_configs_delete"
  ON public.payroll_export_configs
  FOR DELETE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );


-- ─── 4. data_retention_policies ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  table_name     TEXT        NOT NULL,
  retention_days INT         NOT NULL CHECK (retention_days > 0),
  is_active      BOOL        NOT NULL DEFAULT false,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, table_name)
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_data_retention_policies_updated_at'
  ) THEN
    CREATE TRIGGER trg_data_retention_policies_updated_at
      BEFORE UPDATE ON public.data_retention_policies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- SELECT: workspace members
DROP POLICY IF EXISTS "data_retention_policies_select" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_select"
  ON public.data_retention_policies
  FOR SELECT
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

-- INSERT: owner / resourceAssistant
DROP POLICY IF EXISTS "data_retention_policies_insert" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_insert"
  ON public.data_retention_policies
  FOR INSERT
  WITH CHECK (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- UPDATE: owner / resourceAssistant
DROP POLICY IF EXISTS "data_retention_policies_update" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_update"
  ON public.data_retention_policies
  FOR UPDATE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- DELETE: owner / resourceAssistant
DROP POLICY IF EXISTS "data_retention_policies_delete" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_delete"
  ON public.data_retention_policies
  FOR DELETE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );


-- ─── 5. gdpr_requests ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  requestor_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type   TEXT        NOT NULL
                             CHECK (request_type IN ('export', 'deletion')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  notes          TEXT,
  completed_at   TIMESTAMPTZ,
  completed_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_workspace_status_created
  ON public.gdpr_requests (workspace_id, status, created_at DESC);

-- SELECT: owner / resourceAssistant only
DROP POLICY IF EXISTS "gdpr_requests_select" ON public.gdpr_requests;
CREATE POLICY "gdpr_requests_select"
  ON public.gdpr_requests
  FOR SELECT
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- INSERT: any workspace member, but requestor_id must equal the caller
DROP POLICY IF EXISTS "gdpr_requests_insert" ON public.gdpr_requests;
CREATE POLICY "gdpr_requests_insert"
  ON public.gdpr_requests
  FOR INSERT
  WITH CHECK (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND requestor_id = auth.uid()
  );

-- UPDATE: owner / resourceAssistant
DROP POLICY IF EXISTS "gdpr_requests_update" ON public.gdpr_requests;
CREATE POLICY "gdpr_requests_update"
  ON public.gdpr_requests
  FOR UPDATE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );

-- DELETE: owner / resourceAssistant
DROP POLICY IF EXISTS "gdpr_requests_delete" ON public.gdpr_requests;
CREATE POLICY "gdpr_requests_delete"
  ON public.gdpr_requests
  FOR DELETE
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
    )
  );


-- ─── 6. enforce_data_retention() ─────────────────────────────────────────────
-- Called by pg_cron when an admin activates the schedule.
-- The pg_cron job itself is NOT created here — it must be activated separately
-- by a superuser / admin once the pg_cron extension is enabled.
-- Guard: only policies with is_active = true are processed.

CREATE OR REPLACE FUNCTION public.enforce_data_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy RECORD;
BEGIN
  FOR policy IN
    SELECT * FROM public.data_retention_policies WHERE is_active = true
  LOOP
    -- Only handle known safe tables to prevent SQL-injection via table_name.
    IF policy.table_name = 'enterprise_audit_events' THEN
      DELETE FROM public.enterprise_audit_events
        WHERE workspace_id = policy.workspace_id
          AND created_at < now() - (policy.retention_days || ' days')::INTERVAL;

    ELSIF policy.table_name = 'enterprise_api_usage_logs' THEN
      DELETE FROM public.enterprise_api_usage_logs
        WHERE workspace_id = policy.workspace_id
          AND created_at < now() - (policy.retention_days || ' days')::INTERVAL;

    ELSIF policy.table_name = 'wellbeing_scores' THEN
      DELETE FROM public.wellbeing_scores
        WHERE workspace_id = policy.workspace_id
          AND calculated_at < now() - (policy.retention_days || ' days')::INTERVAL;

    END IF;
  END LOOP;
END;
$$;
