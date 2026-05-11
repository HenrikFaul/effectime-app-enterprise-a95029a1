-- Per-user external calendar integrations (M365 / Google)
CREATE TABLE IF NOT EXISTS public.enterprise_user_calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('ms365','google')),
  provider_user_email text,
  provider_user_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text,
  tenant_id text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  sync_events_in boolean NOT NULL DEFAULT true,
  sync_events_out boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_eucal_int_workspace ON public.enterprise_user_calendar_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_eucal_int_user ON public.enterprise_user_calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_eucal_int_active_due
  ON public.enterprise_user_calendar_integrations(is_active, last_sync_at)
  WHERE is_active = true;

ALTER TABLE public.enterprise_user_calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own calendar integration"
ON public.enterprise_user_calendar_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "admin reads workspace calendar integrations"
ON public.enterprise_user_calendar_integrations FOR SELECT
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "user inserts own calendar integration"
ON public.enterprise_user_calendar_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "user updates own calendar integration"
ON public.enterprise_user_calendar_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "user deletes own calendar integration"
ON public.enterprise_user_calendar_integrations FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_eucal_int_set_updated_at
BEFORE UPDATE ON public.enterprise_user_calendar_integrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sync log
CREATE TABLE IF NOT EXISTS public.enterprise_calendar_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.enterprise_user_calendar_integrations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound','both')),
  action text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','partial','error')),
  events_processed integer DEFAULT 0,
  error_message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecsl_workspace ON public.enterprise_calendar_sync_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecsl_integration ON public.enterprise_calendar_sync_log(integration_id, created_at DESC);

ALTER TABLE public.enterprise_calendar_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own sync log"
ON public.enterprise_calendar_sync_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "admin reads workspace sync log"
ON public.enterprise_calendar_sync_log FOR SELECT
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));