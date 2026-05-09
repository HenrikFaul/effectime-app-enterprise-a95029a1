-- GiGanttIc scheduling extension (additive, backward-compatible)
-- Adds milestone flag, explicit dependency_keys, and progress_pct to agile issues.
-- Also adds an explicit dependency edge table for future Finish-to-Start scheduling logic.

-- ── 1. Additive columns on enterprise_agile_issues ──────────────────────────

ALTER TABLE public.enterprise_agile_issues
  ADD COLUMN IF NOT EXISTS is_milestone        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_pct        numeric CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100)),
  ADD COLUMN IF NOT EXISTS dependency_keys     text[]  DEFAULT NULL,   -- explicit FS deps beyond parent_key
  ADD COLUMN IF NOT EXISTS critical_path       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gantt_color         text    DEFAULT NULL,   -- optional per-task override
  ADD COLUMN IF NOT EXISTS gantt_row_order     integer DEFAULT NULL;   -- manual sort within group

COMMENT ON COLUMN public.enterprise_agile_issues.is_milestone
  IS 'True when the issue represents a scheduling milestone (zero-duration diamond on GiGanttIc)';
COMMENT ON COLUMN public.enterprise_agile_issues.progress_pct
  IS 'Manual or computed completion 0-100; overrides hours-based calculation when set';
COMMENT ON COLUMN public.enterprise_agile_issues.dependency_keys
  IS 'Array of external_key values this issue depends on (Finish-to-Start); supplements parent_key hierarchy';
COMMENT ON COLUMN public.enterprise_agile_issues.critical_path
  IS 'True when this issue is on the computed critical path; updated by scheduling logic or manually flagged';

-- ── 2. Explicit dependency edge table for GiGanttIc ─────────────────────────
-- Supports Finish-to-Start (FS), Start-to-Start (SS), etc. for future CPM.

CREATE TABLE IF NOT EXISTS public.enterprise_ganttIc_dependencies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id   uuid        NOT NULL REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  predecessor_key  text        NOT NULL,   -- external_key of the predecessor issue
  successor_key    text        NOT NULL,   -- external_key of the successor issue
  dep_type         text        NOT NULL DEFAULT 'FS'
                               CHECK (dep_type IN ('FS','SS','FF','SF')),
  lag_days         integer     NOT NULL DEFAULT 0,  -- positive = lag, negative = lead
  is_auto          boolean     NOT NULL DEFAULT false,  -- true = derived from parent_key, false = manually set
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, predecessor_key, successor_key)
);

COMMENT ON TABLE public.enterprise_ganttIc_dependencies
  IS 'Explicit scheduling dependencies for GiGanttIc. Supports FS/SS/FF/SF types for future CPM.';

CREATE INDEX IF NOT EXISTS idx_gg_deps_workspace
  ON public.enterprise_ganttIc_dependencies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gg_deps_predecessor
  ON public.enterprise_ganttIc_dependencies(integration_id, predecessor_key);
CREATE INDEX IF NOT EXISTS idx_gg_deps_successor
  ON public.enterprise_ganttIc_dependencies(integration_id, successor_key);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.enterprise_ganttIc_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gg_deps_select" ON public.enterprise_ganttIc_dependencies
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "gg_deps_modify" ON public.enterprise_ganttIc_dependencies
  FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(
      workspace_id, auth.uid(),
      ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
    )
  )
  WITH CHECK (
    public.has_enterprise_role(
      workspace_id, auth.uid(),
      ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
    )
  );

-- ── 4. Cycle-prevention check function ──────────────────────────────────────
-- Prevents circular dependency graphs which would break topological sort / CPM.

CREATE OR REPLACE FUNCTION public.ganttIc_has_dependency_cycle(
  p_workspace_id   uuid,
  p_integration_id uuid,
  p_predecessor    text,
  p_successor      text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cycle boolean := false;
BEGIN
  -- BFS: can we reach predecessor starting from successor?
  WITH RECURSIVE reachable AS (
    SELECT successor_key AS key
    FROM   enterprise_ganttIc_dependencies
    WHERE  integration_id = p_integration_id
    AND    predecessor_key = p_successor
    UNION
    SELECT d.successor_key
    FROM   enterprise_ganttIc_dependencies d
    INNER JOIN reachable r ON d.predecessor_key = r.key
    WHERE  d.integration_id = p_integration_id
  )
  SELECT EXISTS (
    SELECT 1 FROM reachable WHERE key = p_predecessor
  ) INTO v_cycle;
  RETURN v_cycle;
END;
$$;

COMMENT ON FUNCTION public.ganttIc_has_dependency_cycle
  IS 'Returns TRUE if adding predecessor→successor would create a cycle. Call before INSERT.';

-- ── 5. Trigger: auto-set updated_at ─────────────────────────────────────────

CREATE TRIGGER set_gg_deps_updated_at
  BEFORE UPDATE ON public.enterprise_ganttIc_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
