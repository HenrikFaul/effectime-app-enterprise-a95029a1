-- v3.0.0 — Preferred locale + Organization module foundation
-- Additive migration; no destructive operations. Safe to run repeatedly.

-- =========================================================================
-- 1. profiles.preferred_locale
-- =========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_locale text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_preferred_locale_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_locale_check
      CHECK (preferred_locale IS NULL OR preferred_locale IN ('en', 'hu'));
  END IF;
END$$;

-- =========================================================================
-- 2. enterprise_workspaces.default_locale
-- =========================================================================
ALTER TABLE public.enterprise_workspaces
  ADD COLUMN IF NOT EXISTS default_locale text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enterprise_workspaces_default_locale_check'
  ) THEN
    ALTER TABLE public.enterprise_workspaces
      ADD CONSTRAINT enterprise_workspaces_default_locale_check
      CHECK (default_locale IS NULL OR default_locale IN ('en', 'hu'));
  END IF;
END$$;

-- =========================================================================
-- 3. Organization: org units, leadership, contracts, industry, categories, job families
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_org_units (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  parent_id    uuid REFERENCES public.enterprise_org_units(id) ON DELETE SET NULL,
  name         text NOT NULL,
  unit_type    text,
  archived_at  timestamptz,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_units_workspace ON public.enterprise_org_units(workspace_id);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON public.enterprise_org_units(parent_id);

CREATE TABLE IF NOT EXISTS public.enterprise_leadership_levels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  code         text NOT NULL,
  label        text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_leadership_levels_workspace ON public.enterprise_leadership_levels(workspace_id);

CREATE TABLE IF NOT EXISTS public.enterprise_contract_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  code         text NOT NULL,
  label        text NOT NULL,
  is_default   boolean NOT NULL DEFAULT false,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_contract_types_workspace ON public.enterprise_contract_types(workspace_id);

CREATE TABLE IF NOT EXISTS public.enterprise_industries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  code         text NOT NULL,
  label        text NOT NULL,
  is_default   boolean NOT NULL DEFAULT false,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_industries_workspace ON public.enterprise_industries(workspace_id);

CREATE TABLE IF NOT EXISTS public.enterprise_work_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  code         text NOT NULL,
  label        text NOT NULL,
  parent_id    uuid REFERENCES public.enterprise_work_categories(id) ON DELETE SET NULL,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_work_categories_workspace ON public.enterprise_work_categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_work_categories_parent ON public.enterprise_work_categories(parent_id);

CREATE TABLE IF NOT EXISTS public.enterprise_job_families (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  code         text NOT NULL,
  label        text NOT NULL,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_job_families_workspace ON public.enterprise_job_families(workspace_id);

-- =========================================================================
-- 4. Additive columns on enterprise_memberships
-- =========================================================================

ALTER TABLE public.enterprise_memberships
  ADD COLUMN IF NOT EXISTS org_unit_id          uuid REFERENCES public.enterprise_org_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_id           uuid REFERENCES public.enterprise_memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leadership_level_id  uuid REFERENCES public.enterprise_leadership_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_type_id     uuid REFERENCES public.enterprise_contract_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leadership_category  text,
  ADD COLUMN IF NOT EXISTS employer_rights      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position_catalog_id  uuid REFERENCES public.enterprise_workspace_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seniority            public.enterprise_experience_level;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enterprise_memberships_leadership_category_check'
  ) THEN
    ALTER TABLE public.enterprise_memberships
      ADD CONSTRAINT enterprise_memberships_leadership_category_check
      CHECK (leadership_category IS NULL OR leadership_category IN ('strategic','operational','technical','execution','none'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_memberships_org_unit ON public.enterprise_memberships(org_unit_id);
CREATE INDEX IF NOT EXISTS idx_memberships_manager ON public.enterprise_memberships(manager_id);
CREATE INDEX IF NOT EXISTS idx_memberships_contract_type ON public.enterprise_memberships(contract_type_id);
CREATE INDEX IF NOT EXISTS idx_memberships_leadership_level ON public.enterprise_memberships(leadership_level_id);
CREATE INDEX IF NOT EXISTS idx_memberships_position_catalog ON public.enterprise_memberships(position_catalog_id);

-- =========================================================================
-- 5. Cycle protection on manager_id
-- =========================================================================

CREATE OR REPLACE FUNCTION public.enterprise_memberships_check_manager_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cur uuid := NEW.manager_id;
  hops int := 0;
BEGIN
  IF NEW.manager_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.manager_id = NEW.id THEN
    RAISE EXCEPTION 'Membership cannot be its own manager';
  END IF;
  WHILE cur IS NOT NULL AND hops < 50 LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'Manager assignment introduces a cycle';
    END IF;
    SELECT manager_id INTO cur FROM public.enterprise_memberships WHERE id = cur;
    hops := hops + 1;
  END LOOP;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_memberships_manager_cycle') THEN
    CREATE TRIGGER trg_memberships_manager_cycle
    BEFORE INSERT OR UPDATE OF manager_id, id ON public.enterprise_memberships
    FOR EACH ROW EXECUTE FUNCTION public.enterprise_memberships_check_manager_cycle();
  END IF;
END$$;

-- =========================================================================
-- 6. updated_at triggers
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_org_units_updated') THEN
    CREATE TRIGGER trg_org_units_updated BEFORE UPDATE ON public.enterprise_org_units
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_leadership_levels_updated') THEN
    CREATE TRIGGER trg_leadership_levels_updated BEFORE UPDATE ON public.enterprise_leadership_levels
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contract_types_updated') THEN
    CREATE TRIGGER trg_contract_types_updated BEFORE UPDATE ON public.enterprise_contract_types
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_industries_updated') THEN
    CREATE TRIGGER trg_industries_updated BEFORE UPDATE ON public.enterprise_industries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_work_categories_updated') THEN
    CREATE TRIGGER trg_work_categories_updated BEFORE UPDATE ON public.enterprise_work_categories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_job_families_updated') THEN
    CREATE TRIGGER trg_job_families_updated BEFORE UPDATE ON public.enterprise_job_families
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- =========================================================================
-- 7. Org chart snapshots (Phase 4)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_org_chart_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_chart_snapshots_workspace ON public.enterprise_org_chart_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_org_chart_snapshots_generated_at
  ON public.enterprise_org_chart_snapshots(workspace_id, generated_at DESC);

-- =========================================================================
-- 8. RLS
-- =========================================================================

ALTER TABLE public.enterprise_org_units             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_leadership_levels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_contract_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_industries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_work_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_job_families          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_org_chart_snapshots   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- enterprise_org_units
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view org units' AND tablename = 'enterprise_org_units') THEN
    CREATE POLICY "Members view org units" ON public.enterprise_org_units
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage org units' AND tablename = 'enterprise_org_units') THEN
    CREATE POLICY "Admins manage org units" ON public.enterprise_org_units
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- leadership_levels
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view leadership levels' AND tablename = 'enterprise_leadership_levels') THEN
    CREATE POLICY "Members view leadership levels" ON public.enterprise_leadership_levels
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage leadership levels' AND tablename = 'enterprise_leadership_levels') THEN
    CREATE POLICY "Admins manage leadership levels" ON public.enterprise_leadership_levels
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- contract_types
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view contract types' AND tablename = 'enterprise_contract_types') THEN
    CREATE POLICY "Members view contract types" ON public.enterprise_contract_types
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage contract types' AND tablename = 'enterprise_contract_types') THEN
    CREATE POLICY "Admins manage contract types" ON public.enterprise_contract_types
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- industries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view industries' AND tablename = 'enterprise_industries') THEN
    CREATE POLICY "Members view industries" ON public.enterprise_industries
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage industries' AND tablename = 'enterprise_industries') THEN
    CREATE POLICY "Admins manage industries" ON public.enterprise_industries
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- work_categories
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view work categories' AND tablename = 'enterprise_work_categories') THEN
    CREATE POLICY "Members view work categories" ON public.enterprise_work_categories
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage work categories' AND tablename = 'enterprise_work_categories') THEN
    CREATE POLICY "Admins manage work categories" ON public.enterprise_work_categories
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- job_families
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view job families' AND tablename = 'enterprise_job_families') THEN
    CREATE POLICY "Members view job families" ON public.enterprise_job_families
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage job families' AND tablename = 'enterprise_job_families') THEN
    CREATE POLICY "Admins manage job families" ON public.enterprise_job_families
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- org_chart_snapshots
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view org chart snapshots' AND tablename = 'enterprise_org_chart_snapshots') THEN
    CREATE POLICY "Members view org chart snapshots" ON public.enterprise_org_chart_snapshots
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage org chart snapshots' AND tablename = 'enterprise_org_chart_snapshots') THEN
    CREATE POLICY "Admins manage org chart snapshots" ON public.enterprise_org_chart_snapshots
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;
END$$;

-- =========================================================================
-- 9. Per-workspace contract type seeding (idempotent)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.seed_default_contract_types(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.enterprise_contract_types (workspace_id, code, label, is_default)
  VALUES
    (p_workspace_id, 'employee',     'Employee',          true),
    (p_workspace_id, 'contractor',   'Contractor',        false),
    (p_workspace_id, 'subcontractor','Subcontractor',     false),
    (p_workspace_id, 'leased',       'Leased workforce',  false),
    (p_workspace_id, 'consultant',   'Consultant',        false),
    (p_workspace_id, 'temporary',    'Temporary worker',  false)
  ON CONFLICT (workspace_id, code) DO NOTHING;
END$$;

CREATE OR REPLACE FUNCTION public.seed_default_leadership_levels(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.enterprise_leadership_levels (workspace_id, code, label, sort_order)
  VALUES
    (p_workspace_id, 'strategic',  'Strategic',  10),
    (p_workspace_id, 'operational','Operational',20),
    (p_workspace_id, 'technical',  'Technical',  30),
    (p_workspace_id, 'execution',  'Execution',  40)
  ON CONFLICT (workspace_id, code) DO NOTHING;
END$$;
