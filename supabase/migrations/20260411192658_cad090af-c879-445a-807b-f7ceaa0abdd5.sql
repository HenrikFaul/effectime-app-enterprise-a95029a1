
-- Role definitions per workspace (system + custom roles)
CREATE TABLE public.enterprise_role_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, role_key)
);

ALTER TABLE public.enterprise_role_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view role definitions"
  ON public.enterprise_role_definitions FOR SELECT
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage role definitions"
  ON public.enterprise_role_definitions FOR ALL
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

-- Permission assignments per role per feature
CREATE TABLE public.enterprise_role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'none' CHECK (access_level IN ('none', 'readonly', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, role_key, feature_key)
);

ALTER TABLE public.enterprise_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view role permissions"
  ON public.enterprise_role_permissions FOR SELECT
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage role permissions"
  ON public.enterprise_role_permissions FOR ALL
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]))
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner','resourceAssistant']::enterprise_role[]));

-- Triggers for updated_at
CREATE TRIGGER update_role_definitions_updated_at
  BEFORE UPDATE ON public.enterprise_role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.enterprise_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to seed default roles and permissions for a new workspace
CREATE OR REPLACE FUNCTION public.seed_workspace_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert system role definitions
  INSERT INTO public.enterprise_role_definitions (workspace_id, role_key, display_name, description, is_system, sort_order)
  VALUES
    (NEW.id, 'owner', 'Tulajdonos', 'Teljes hozzáférés minden funkcióhoz', true, 0),
    (NEW.id, 'resourceAssistant', 'Erőforrás asszisztens', 'HR és erőforrás-kezelési jogosultságok', true, 1),
    (NEW.id, 'member', 'Tag', 'Alapszintű hozzáférés', true, 2);

  -- Default permissions for owner (everything edit)
  INSERT INTO public.enterprise_role_permissions (workspace_id, role_key, feature_key, access_level)
  SELECT NEW.id, 'owner', f, 'edit'
  FROM unnest(ARRAY[
    'calendar','calendar_sidebar','leave_requests_view','leave_requests_submit',
    'approvals','members','invitations','rules','notifications',
    'reports','audit','export','settings','admin_override'
  ]) AS f;

  -- Default permissions for resourceAssistant
  INSERT INTO public.enterprise_role_permissions (workspace_id, role_key, feature_key, access_level)
  VALUES
    (NEW.id, 'resourceAssistant', 'calendar', 'edit'),
    (NEW.id, 'resourceAssistant', 'calendar_sidebar', 'edit'),
    (NEW.id, 'resourceAssistant', 'leave_requests_view', 'edit'),
    (NEW.id, 'resourceAssistant', 'leave_requests_submit', 'edit'),
    (NEW.id, 'resourceAssistant', 'approvals', 'edit'),
    (NEW.id, 'resourceAssistant', 'members', 'edit'),
    (NEW.id, 'resourceAssistant', 'invitations', 'edit'),
    (NEW.id, 'resourceAssistant', 'rules', 'edit'),
    (NEW.id, 'resourceAssistant', 'notifications', 'edit'),
    (NEW.id, 'resourceAssistant', 'reports', 'readonly'),
    (NEW.id, 'resourceAssistant', 'audit', 'readonly'),
    (NEW.id, 'resourceAssistant', 'export', 'edit'),
    (NEW.id, 'resourceAssistant', 'settings', 'none'),
    (NEW.id, 'resourceAssistant', 'admin_override', 'edit');

  -- Default permissions for member
  INSERT INTO public.enterprise_role_permissions (workspace_id, role_key, feature_key, access_level)
  VALUES
    (NEW.id, 'member', 'calendar', 'readonly'),
    (NEW.id, 'member', 'calendar_sidebar', 'readonly'),
    (NEW.id, 'member', 'leave_requests_view', 'readonly'),
    (NEW.id, 'member', 'leave_requests_submit', 'edit'),
    (NEW.id, 'member', 'approvals', 'none'),
    (NEW.id, 'member', 'members', 'readonly'),
    (NEW.id, 'member', 'invitations', 'none'),
    (NEW.id, 'member', 'rules', 'none'),
    (NEW.id, 'member', 'notifications', 'readonly'),
    (NEW.id, 'member', 'reports', 'none'),
    (NEW.id, 'member', 'audit', 'none'),
    (NEW.id, 'member', 'export', 'none'),
    (NEW.id, 'member', 'settings', 'none'),
    (NEW.id, 'member', 'admin_override', 'none');

  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_roles_on_workspace_create
  AFTER INSERT ON public.enterprise_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_workspace_roles();
