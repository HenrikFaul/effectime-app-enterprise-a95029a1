
-- ============ SKILLS ============
CREATE TABLE public.enterprise_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);
ALTER TABLE public.enterprise_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view skills" ON public.enterprise_skills FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert skills" ON public.enterprise_skills FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update skills" ON public.enterprise_skills FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete skills" ON public.enterprise_skills FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE TRIGGER trg_skills_updated BEFORE UPDATE ON public.enterprise_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.enterprise_member_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.enterprise_skills(id) ON DELETE CASCADE,
  level smallint NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(membership_id, skill_id)
);
ALTER TABLE public.enterprise_member_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view member skills" ON public.enterprise_member_skills FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert member skills" ON public.enterprise_member_skills FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update member skills" ON public.enterprise_member_skills FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete member skills" ON public.enterprise_member_skills FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE TABLE public.enterprise_project_skill_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.enterprise_projects(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.enterprise_skills(id) ON DELETE CASCADE,
  min_level smallint NOT NULL DEFAULT 3 CHECK (min_level BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, skill_id)
);
ALTER TABLE public.enterprise_project_skill_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view proj skills" ON public.enterprise_project_skill_requirements FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert proj skills" ON public.enterprise_project_skill_requirements FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update proj skills" ON public.enterprise_project_skill_requirements FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete proj skills" ON public.enterprise_project_skill_requirements FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

-- ============ RATES ============
CREATE TABLE public.enterprise_member_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  cost_rate numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_member_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view member rates" ON public.enterprise_member_rates FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert member rates" ON public.enterprise_member_rates FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update member rates" ON public.enterprise_member_rates FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete member rates" ON public.enterprise_member_rates FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE TABLE public.enterprise_project_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.enterprise_projects(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  bill_rate numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, business_role)
);
ALTER TABLE public.enterprise_project_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view project rates" ON public.enterprise_project_rates FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert project rates" ON public.enterprise_project_rates FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update project rates" ON public.enterprise_project_rates FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete project rates" ON public.enterprise_project_rates FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE TRIGGER trg_project_rates_updated BEFORE UPDATE ON public.enterprise_project_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SCENARIOS ============
CREATE TABLE public.enterprise_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_baseline boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view scenarios" ON public.enterprise_scenarios FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert scenarios" ON public.enterprise_scenarios FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]) AND created_by = auth.uid());
CREATE POLICY "Admins update scenarios" ON public.enterprise_scenarios FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete scenarios" ON public.enterprise_scenarios FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE TRIGGER trg_scenarios_updated BEFORE UPDATE ON public.enterprise_scenarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.enterprise_scenario_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.enterprise_scenarios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.enterprise_projects(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  allocated_percentage numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_scenario_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view scenario asgn" ON public.enterprise_scenario_assignments FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert scenario asgn" ON public.enterprise_scenario_assignments FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update scenario asgn" ON public.enterprise_scenario_assignments FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete scenario asgn" ON public.enterprise_scenario_assignments FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

-- ============ EXTENSIONS ============
ALTER TABLE public.enterprise_project_assignments
  ADD COLUMN IF NOT EXISTS is_tentative boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billable boolean NOT NULL DEFAULT true;

ALTER TABLE public.enterprise_memberships
  ADD COLUMN IF NOT EXISTS weekly_capacity_hours numeric NOT NULL DEFAULT 40;

CREATE INDEX IF NOT EXISTS idx_member_skills_workspace ON public.enterprise_member_skills(workspace_id, membership_id);
CREATE INDEX IF NOT EXISTS idx_project_skills_workspace ON public.enterprise_project_skill_requirements(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_member_rates_lookup ON public.enterprise_member_rates(membership_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_scenario_asgn_scenario ON public.enterprise_scenario_assignments(scenario_id);
