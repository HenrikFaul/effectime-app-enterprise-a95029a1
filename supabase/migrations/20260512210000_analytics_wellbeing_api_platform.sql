-- =====================================================================
-- v3.9.0 / v3.10.0 / v3.11.0  Analytics · Wellbeing · Developer API
-- =====================================================================

-- ─── 1. Wellbeing scores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellbeing_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id   UUID NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  score           INT  NOT NULL DEFAULT 100 CHECK (score >= 0 AND score <= 100),
  components      JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wellbeing_score_per_member UNIQUE (workspace_id, membership_id)
);

CREATE INDEX IF NOT EXISTS idx_wellbeing_scores_workspace
  ON public.wellbeing_scores (workspace_id, score);
CREATE INDEX IF NOT EXISTS idx_wellbeing_scores_membership
  ON public.wellbeing_scores (membership_id);

ALTER TABLE public.wellbeing_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own wellbeing score"
  ON public.wellbeing_scores FOR SELECT
  USING (
    membership_id IN (
      SELECT id FROM public.enterprise_memberships
      WHERE user_id = auth.uid() AND workspace_id = wellbeing_scores.workspace_id
    )
    OR public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[])
  );

CREATE POLICY "Admins can manage wellbeing scores"
  ON public.wellbeing_scores FOR ALL
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

-- ─── 2. Wellbeing alerts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellbeing_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  alert_type    TEXT NOT NULL CHECK (alert_type IN ('burnout_risk','high_overtime','low_leave_usage','weekend_overload')),
  severity      TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  message       TEXT,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wellbeing_alerts_workspace
  ON public.wellbeing_alerts (workspace_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_wellbeing_alerts_membership
  ON public.wellbeing_alerts (membership_id, triggered_at DESC);

ALTER TABLE public.wellbeing_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view/manage wellbeing alerts"
  ON public.wellbeing_alerts FOR ALL
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

CREATE POLICY "Members view own alerts"
  ON public.wellbeing_alerts FOR SELECT
  USING (
    membership_id IN (
      SELECT id FROM public.enterprise_memberships
      WHERE user_id = auth.uid() AND workspace_id = wellbeing_alerts.workspace_id
    )
  );

-- ─── 3. API keys ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enterprise_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,           -- first 8 chars shown in UI (e.g. "eff_live_")
  key_hash      TEXT NOT NULL,           -- SHA-256 hash of full key
  scopes        TEXT[] NOT NULL DEFAULT ARRAY['read'],
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_api_key_hash UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace
  ON public.enterprise_api_keys (workspace_id, revoked_at);

ALTER TABLE public.enterprise_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage API keys"
  ON public.enterprise_api_keys FOR ALL
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

-- ─── 4. API usage logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enterprise_api_usage_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  api_key_id    UUID REFERENCES public.enterprise_api_keys(id) ON DELETE SET NULL,
  method        TEXT NOT NULL,
  path          TEXT NOT NULL,
  status_code   INT  NOT NULL,
  duration_ms   INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_day
  ON public.enterprise_api_usage_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_key
  ON public.enterprise_api_usage_logs (api_key_id, created_at DESC);

ALTER TABLE public.enterprise_api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view API usage"
  ON public.enterprise_api_usage_logs FOR SELECT
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

CREATE POLICY "Service role inserts API usage"
  ON public.enterprise_api_usage_logs FOR INSERT
  WITH CHECK (true);   -- written by edge function with service_role key

-- ─── 5. Webhook subscriptions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enterprise_webhook_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  secret        TEXT NOT NULL,            -- HMAC signing secret (stored hashed in prod ideally)
  events        TEXT[] NOT NULL,          -- e.g. ['leave.approved','schedule.changed']
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_active
  ON public.enterprise_webhook_subscriptions (workspace_id, is_active);

ALTER TABLE public.enterprise_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage webhooks"
  ON public.enterprise_webhook_subscriptions FOR ALL
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

-- updated_at trigger for webhooks
CREATE OR REPLACE FUNCTION public.set_webhook_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_updated_at ON public.enterprise_webhook_subscriptions;
CREATE TRIGGER trg_webhook_updated_at
  BEFORE UPDATE ON public.enterprise_webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_webhook_updated_at();
