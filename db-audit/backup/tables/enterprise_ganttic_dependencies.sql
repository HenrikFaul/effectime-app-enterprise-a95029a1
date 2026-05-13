-- Backup of public.enterprise_ganttic_dependencies (taken 2026-05-13)
-- Reason for deletion: zero rows; no app code references; no function/RPC
-- writes to it; sole helper `ganttic_has_dependency_cycle` is also orphaned.
-- Pass 1 (grep), Pass 2 (runtime trace), Pass 3 (necessity) all agree unused.
-- Restoration: run this file. The companion trigger and function are
-- restored from their own backup files (set_updated_at lives on, no need to
-- recreate the function; only the wiring trigger and the helper function
-- need restoring).
--
-- Original comment on table:
--   Explicit scheduling dependencies for GiGanttIc. Supports FS/SS/FF/SF
--   types for future CPM.

CREATE TABLE IF NOT EXISTS public.enterprise_ganttic_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  integration_id uuid NOT NULL,
  predecessor_key text NOT NULL,
  successor_key text NOT NULL,
  dep_type text DEFAULT 'FS'::text NOT NULL CHECK (dep_type = ANY (ARRAY['FS','SS','FF','SF'])),
  lag_days integer DEFAULT 0 NOT NULL,
  is_auto boolean DEFAULT false NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT enterprise_ganttic_dependencies_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT enterprise_ganttic_dependencies_integration_id_fkey
    FOREIGN KEY (integration_id) REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  UNIQUE (integration_id, predecessor_key, successor_key)
);

COMMENT ON TABLE public.enterprise_ganttic_dependencies IS
  'Explicit scheduling dependencies for GiGanttIc. Supports FS/SS/FF/SF types for future CPM.';

CREATE INDEX IF NOT EXISTS idx_gg_deps_workspace
  ON public.enterprise_ganttic_dependencies (workspace_id);
CREATE INDEX IF NOT EXISTS idx_gg_deps_predecessor
  ON public.enterprise_ganttic_dependencies (integration_id, predecessor_key);
CREATE INDEX IF NOT EXISTS idx_gg_deps_successor
  ON public.enterprise_ganttic_dependencies (integration_id, successor_key);

ALTER TABLE public.enterprise_ganttic_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gg_deps_modify" ON public.enterprise_ganttic_dependencies
  FOR ALL
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]))
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "gg_deps_select" ON public.enterprise_ganttic_dependencies
  FOR SELECT
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE TRIGGER set_gg_deps_updated_at
  BEFORE UPDATE ON public.enterprise_ganttic_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row count at backup time: 0 (empty table)
