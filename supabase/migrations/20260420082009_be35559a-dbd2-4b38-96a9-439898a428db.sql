
-- Projects table
CREATE TABLE public.enterprise_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  is_open_ended boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  color text NOT NULL DEFAULT '#3b82f6',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_enterprise_projects_workspace ON public.enterprise_projects(workspace_id);
CREATE INDEX idx_enterprise_projects_dates ON public.enterprise_projects(workspace_id, start_date, end_date);

ALTER TABLE public.enterprise_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view projects" ON public.enterprise_projects
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can create projects" ON public.enterprise_projects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]) AND created_by = auth.uid());

CREATE POLICY "Admins can update projects" ON public.enterprise_projects
  FOR UPDATE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can delete projects" ON public.enterprise_projects
  FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE TRIGGER trg_enterprise_projects_updated
  BEFORE UPDATE ON public.enterprise_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project resource requirements (per position)
CREATE TABLE public.enterprise_project_resource_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.enterprise_projects(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  required_percentage numeric NOT NULL DEFAULT 100 CHECK (required_percentage >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, business_role)
);

CREATE INDEX idx_eprr_project ON public.enterprise_project_resource_requirements(project_id);

ALTER TABLE public.enterprise_project_resource_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view requirements" ON public.enterprise_project_resource_requirements
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert requirements" ON public.enterprise_project_resource_requirements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update requirements" ON public.enterprise_project_resource_requirements
  FOR UPDATE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete requirements" ON public.enterprise_project_resource_requirements
  FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE TRIGGER trg_eprr_updated
  BEFORE UPDATE ON public.enterprise_project_resource_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project assignments: actual member -> project allocations
CREATE TABLE public.enterprise_project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.enterprise_projects(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  allocated_percentage numeric NOT NULL DEFAULT 0 CHECK (allocated_percentage >= 0 AND allocated_percentage <= 100),
  start_date date NOT NULL,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_epa_project ON public.enterprise_project_assignments(project_id);
CREATE INDEX idx_epa_membership ON public.enterprise_project_assignments(membership_id);
CREATE INDEX idx_epa_workspace_dates ON public.enterprise_project_assignments(workspace_id, start_date, end_date);

ALTER TABLE public.enterprise_project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view assignments" ON public.enterprise_project_assignments
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert assignments" ON public.enterprise_project_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update assignments" ON public.enterprise_project_assignments
  FOR UPDATE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete assignments" ON public.enterprise_project_assignments
  FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE TRIGGER trg_epa_updated
  BEFORE UPDATE ON public.enterprise_project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
