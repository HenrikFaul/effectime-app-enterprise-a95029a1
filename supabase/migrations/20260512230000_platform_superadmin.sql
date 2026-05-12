-- Migration: platform_feature_flags table + RLS + seed
-- Creates the platform feature flags infrastructure for the superadmin control plane.

-- ── Table ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  description TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT 'general',
  enabled     BOOL        NOT NULL DEFAULT false,
  notes       TEXT,
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row-Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_feature_flags_select" ON public.platform_feature_flags;
CREATE POLICY "platform_feature_flags_select"
  ON public.platform_feature_flags
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "platform_feature_flags_insert" ON public.platform_feature_flags;
CREATE POLICY "platform_feature_flags_insert"
  ON public.platform_feature_flags
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "platform_feature_flags_update" ON public.platform_feature_flags;
CREATE POLICY "platform_feature_flags_update"
  ON public.platform_feature_flags
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "platform_feature_flags_delete" ON public.platform_feature_flags;
CREATE POLICY "platform_feature_flags_delete"
  ON public.platform_feature_flags
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Index ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS platform_feature_flags_category_key_idx
  ON public.platform_feature_flags (category, key);

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE TRIGGER platform_feature_flags_updated_at
  BEFORE UPDATE ON public.platform_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Seed initial feature flags ─────────────────────────────────────────────────
INSERT INTO public.platform_feature_flags (key, description, category, enabled, notes)
VALUES
  ('locale.cs_enabled',                  'Czech locale available to users',                                    'locale',     true, null),
  ('locale.sk_enabled',                  'Slovak locale available to users',                                   'locale',     true, null),
  ('locale.pl_enabled',                  'Polish locale available to users',                                   'locale',     true, null),
  ('locale.hu_enabled',                  'Hungarian locale available to users',                                'locale',     true, null),
  ('platform.demo_seeding_enabled',      'Allow demo workspace seeding via DemoSeedConfigDialog',              'platform',   true, null),
  ('platform.recovery_mode_enabled',     'Allow workspace recovery mode activation',                           'platform',   true, null),
  ('platform.api_keys_enabled',          'Enable Developer API key management for workspace admins',           'enterprise', true, null),
  ('platform.wellbeing_engine_enabled',  'Enable Wellbeing & Burnout detection engine',                        'enterprise', true, null),
  ('platform.payroll_export_enabled',    'Enable Payroll Export module for workspace admins',                  'enterprise', true, null),
  ('platform.analytics_dashboard_enabled', 'Enable Executive Analytics dashboard for workspace admins',       'enterprise', true, null)
ON CONFLICT (key) DO NOTHING;
