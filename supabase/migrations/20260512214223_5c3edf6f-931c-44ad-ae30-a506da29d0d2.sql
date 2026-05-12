
-- =========================================================================
-- Phase 5: Tier & Feature Management Foundation
-- =========================================================================

-- 1. TENANTS (billing entity that owns 1..N workspaces)
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  billing_email text,
  country text,
  vat_number text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);
CREATE INDEX idx_tenant_workspaces_tenant ON public.tenant_workspaces(tenant_id);

-- 2. FEATURE CATALOG
CREATE TABLE public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  name text NOT NULL,
  module text NOT NULL,
  description text,
  fiscal_weight numeric NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'active',
  dependencies text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_features_module ON public.features(module);

-- 3. TIERS
CREATE TABLE public.tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_per_seat numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  billing_period text NOT NULL DEFAULT 'monthly',
  max_seats integer,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tier_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES public.tiers(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  limit_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier_id, feature_id)
);

-- 4. ADDONS
CREATE TABLE public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_per_seat numeric NOT NULL DEFAULT 0,
  monthly_flat numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.addon_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  limit_value jsonb,
  UNIQUE (addon_id, feature_id)
);

-- 5. TENANT SUBSCRIPTIONS / OVERRIDES
CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.tiers(id),
  seats integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);

CREATE TABLE public.tenant_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.addons(id),
  seats integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, addon_id)
);

CREATE TABLE public.tenant_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_id)
);

-- 6. TELEMETRY
CREATE TABLE public.feature_gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.enterprise_workspaces(id) ON DELETE SET NULL,
  user_id uuid,
  feature_key text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL,
  blocked_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feature_gate_events_workspace ON public.feature_gate_events(workspace_id, created_at DESC);
CREATE INDEX idx_feature_gate_events_feature ON public.feature_gate_events(feature_key, created_at DESC);

-- =========================================================================
-- HELPER FUNCTIONS
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_workspaces tw
    JOIN public.enterprise_memberships em ON em.workspace_id = tw.workspace_id
    WHERE tw.tenant_id = _tenant_id
      AND em.user_id = _user_id
      AND em.status = 'active'
  );
$$;

-- updated_at triggers
CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_features_updated_at BEFORE UPDATE ON public.features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_tiers_updated_at BEFORE UPDATE ON public.tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_addons_updated_at BEFORE UPDATE ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_tenant_subscriptions_updated_at BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- RLS POLICIES
-- =========================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_gate_events ENABLE ROW LEVEL SECURITY;

-- Catalog tables: read for all authenticated, write for superadmin
CREATE POLICY "features_read_auth" ON public.features FOR SELECT TO authenticated USING (true);
CREATE POLICY "features_admin_write" ON public.features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tiers_read_auth" ON public.tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "tiers_admin_write" ON public.tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tier_features_read_auth" ON public.tier_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "tier_features_admin_write" ON public.tier_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "addons_read_auth" ON public.addons FOR SELECT TO authenticated USING (true);
CREATE POLICY "addons_admin_write" ON public.addons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "addon_features_read_auth" ON public.addon_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "addon_features_admin_write" ON public.addon_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tenants: superadmin write; tenant members read their own
CREATE POLICY "tenants_admin_all" ON public.tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tenants_member_read" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id, auth.uid()));

CREATE POLICY "tenant_workspaces_admin_all" ON public.tenant_workspaces FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tenant_workspaces_member_read" ON public.tenant_workspaces FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "tenant_subscriptions_admin_all" ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tenant_subscriptions_member_read" ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "tenant_addons_admin_all" ON public.tenant_addons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tenant_addons_member_read" ON public.tenant_addons FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "tenant_feature_overrides_admin_all" ON public.tenant_feature_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tenant_feature_overrides_member_read" ON public.tenant_feature_overrides FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- Telemetry: workspace members read their events; any authenticated insert
CREATE POLICY "feature_gate_events_insert_auth" ON public.feature_gate_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "feature_gate_events_workspace_read" ON public.feature_gate_events FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR public.is_enterprise_member(workspace_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- =========================================================================
-- SEED DATA: tiers + addons
-- =========================================================================
INSERT INTO public.tiers (tier_key, name, description, price_per_seat, currency, billing_period, max_seats, sort_order)
VALUES
  ('freemium', 'Freemium', 'Alapszintű csapatok számára, max 10 fő.', 0, 'EUR', 'monthly', 10, 0),
  ('pro', 'Pro', 'Növekvő csapatok: konfliktusmotor, sync, erőforrás-tervezés.', 8, 'EUR', 'monthly', NULL, 1),
  ('enterprise', 'Enterprise', 'Vállalati: audit, SOC2, branding, analytics.', 18, 'EUR', 'monthly', NULL, 2)
ON CONFLICT (tier_key) DO NOTHING;

INSERT INTO public.addons (addon_key, name, description, price_per_seat, monthly_flat, currency)
VALUES
  ('addon_payroll',   'Payroll Integration',  'Bér- és HR-rendszer integráció.',          3, 0, 'EUR'),
  ('addon_agile',     'Agile Boards',         'Jira/Confluence sync és agile board.',      2, 0, 'EUR'),
  ('addon_api',       'Open API',             'Public API hozzáférés és webhookok.',       0, 99, 'EUR'),
  ('addon_ai',        'AI Assistant',         'AI alapú javaslatok és scheduling.',        4, 0, 'EUR'),
  ('addon_wellbeing', 'Wellbeing Engine',     'Burnout monitoring és wellbeing analytics.',2, 0, 'EUR')
ON CONFLICT (addon_key) DO NOTHING;
