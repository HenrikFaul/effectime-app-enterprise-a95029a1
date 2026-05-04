-- Csapatok kezelése: csapat = név + hozzárendelt pozíciók (business_role-ok)
CREATE TABLE IF NOT EXISTS public.enterprise_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.enterprise_team_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.enterprise_teams(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  business_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, business_role)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_teams_workspace ON public.enterprise_teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_team_roles_team ON public.enterprise_team_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_team_roles_workspace ON public.enterprise_team_roles(workspace_id);

ALTER TABLE public.enterprise_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_team_roles ENABLE ROW LEVEL SECURITY;

-- enterprise_teams policies
CREATE POLICY "Members view teams" ON public.enterprise_teams
  FOR SELECT USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert teams" ON public.enterprise_teams
  FOR INSERT WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update teams" ON public.enterprise_teams
  FOR UPDATE USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete teams" ON public.enterprise_teams
  FOR DELETE USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- enterprise_team_roles policies
CREATE POLICY "Members view team roles" ON public.enterprise_team_roles
  FOR SELECT USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert team roles" ON public.enterprise_team_roles
  FOR INSERT WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins delete team roles" ON public.enterprise_team_roles
  FOR DELETE USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE TRIGGER update_enterprise_teams_updated_at
  BEFORE UPDATE ON public.enterprise_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';