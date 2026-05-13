-- Backup of public.feature_gate_events (taken 2026-05-13)
-- Reason for deletion: zero rows; no INSERT/SELECT/UPDATE/DELETE code path
-- anywhere in src/ or supabase/functions/. RLS policies exist but no
-- application code uses them. Pass 1+2+3 all agree unused.

CREATE TABLE IF NOT EXISTS public.feature_gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.enterprise_workspaces(id) ON DELETE SET NULL,
  user_id uuid,
  feature_key text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL,
  blocked_reason text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_gate_events_workspace
  ON public.feature_gate_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_gate_events_feature
  ON public.feature_gate_events (feature_key, created_at DESC);

ALTER TABLE public.feature_gate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_gate_events_insert_auth" ON public.feature_gate_events
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "feature_gate_events_workspace_read" ON public.feature_gate_events
  FOR SELECT
  USING ((workspace_id IS NULL) OR is_enterprise_member(workspace_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Row count at backup time: 0 (empty table)
