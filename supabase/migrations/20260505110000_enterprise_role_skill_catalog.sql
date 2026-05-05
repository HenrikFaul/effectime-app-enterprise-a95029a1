-- Enterprise Role/Skill Catalog (global inventory + workspace-level customizations)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enterprise_experience_level') THEN
    CREATE TYPE public.enterprise_experience_level AS ENUM ('junior', 'medior', 'senior', 'lead', 'principal');
  END IF;
END $$;

-- Global inventory (maintained centrally, reusable for every workspace)
CREATE TABLE IF NOT EXISTS public.enterprise_catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_catalog_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.enterprise_catalog_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS public.enterprise_catalog_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  normalized_name text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_catalog_role_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.enterprise_catalog_roles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.enterprise_catalog_skills(id) ON DELETE CASCADE,
  required boolean NOT NULL DEFAULT true,
  min_experience_level public.enterprise_experience_level,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_roles_category ON public.enterprise_catalog_roles(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_role_skills_role ON public.enterprise_catalog_role_skills(role_id);
CREATE INDEX IF NOT EXISTS idx_catalog_role_skills_skill ON public.enterprise_catalog_role_skills(skill_id);

-- Workspace-level copy/customization layer (company-specific overrides)
CREATE TABLE IF NOT EXISTS public.enterprise_workspace_role_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  catalog_category_id uuid REFERENCES public.enterprise_catalog_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.enterprise_workspace_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.enterprise_workspace_role_categories(id) ON DELETE CASCADE,
  catalog_role_id uuid REFERENCES public.enterprise_catalog_roles(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, category_id, name)
);

CREATE TABLE IF NOT EXISTS public.enterprise_workspace_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  catalog_skill_id uuid REFERENCES public.enterprise_catalog_skills(id) ON DELETE SET NULL,
  skill_id uuid REFERENCES public.enterprise_skills(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.enterprise_workspace_role_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.enterprise_workspace_roles(id) ON DELETE CASCADE,
  workspace_skill_id uuid NOT NULL REFERENCES public.enterprise_workspace_skills(id) ON DELETE CASCADE,
  required boolean NOT NULL DEFAULT true,
  approved boolean NOT NULL DEFAULT true,
  min_experience_level public.enterprise_experience_level,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, workspace_skill_id)
);

ALTER TABLE public.enterprise_memberships
  ADD COLUMN IF NOT EXISTS business_role_id uuid REFERENCES public.enterprise_workspace_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ws_role_categories_workspace ON public.enterprise_workspace_role_categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_roles_workspace ON public.enterprise_workspace_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_skills_workspace ON public.enterprise_workspace_skills(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_role_skills_workspace ON public.enterprise_workspace_role_skills(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memberships_business_role_id ON public.enterprise_memberships(business_role_id);

-- updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catalog_categories_updated') THEN
    CREATE TRIGGER trg_catalog_categories_updated BEFORE UPDATE ON public.enterprise_catalog_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catalog_roles_updated') THEN
    CREATE TRIGGER trg_catalog_roles_updated BEFORE UPDATE ON public.enterprise_catalog_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catalog_skills_updated') THEN
    CREATE TRIGGER trg_catalog_skills_updated BEFORE UPDATE ON public.enterprise_catalog_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_role_categories_updated') THEN
    CREATE TRIGGER trg_ws_role_categories_updated BEFORE UPDATE ON public.enterprise_workspace_role_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_roles_updated') THEN
    CREATE TRIGGER trg_ws_roles_updated BEFORE UPDATE ON public.enterprise_workspace_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_skills_updated') THEN
    CREATE TRIGGER trg_ws_skills_updated BEFORE UPDATE ON public.enterprise_workspace_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ws_role_skills_updated') THEN
    CREATE TRIGGER trg_ws_role_skills_updated BEFORE UPDATE ON public.enterprise_workspace_role_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE public.enterprise_workspace_role_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_workspace_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_workspace_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_workspace_role_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view ws role categories" ON public.enterprise_workspace_role_categories FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage ws role categories" ON public.enterprise_workspace_role_categories FOR ALL TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])) WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Members view ws roles" ON public.enterprise_workspace_roles FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage ws roles" ON public.enterprise_workspace_roles FOR ALL TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])) WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Members view ws skills" ON public.enterprise_workspace_skills FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage ws skills" ON public.enterprise_workspace_skills FOR ALL TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])) WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Members view ws role skills" ON public.enterprise_workspace_role_skills FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins manage ws role skills" ON public.enterprise_workspace_role_skills FOR ALL TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])) WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
