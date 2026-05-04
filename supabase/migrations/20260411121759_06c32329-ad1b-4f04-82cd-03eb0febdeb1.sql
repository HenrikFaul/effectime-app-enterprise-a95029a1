
-- Enterprise role enum
CREATE TYPE public.enterprise_role AS ENUM ('owner', 'resourceAssistant', 'member');

-- Enterprise membership status enum
CREATE TYPE public.enterprise_membership_status AS ENUM ('active', 'invited', 'suspended', 'removed');

-- Enterprise workspaces
CREATE TABLE public.enterprise_workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Budapest',
  locale TEXT NOT NULL DEFAULT 'hu',
  weekday_start INTEGER NOT NULL DEFAULT 1,
  date_format TEXT NOT NULL DEFAULT 'yyyy-MM-dd',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_archived BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.enterprise_workspaces ENABLE ROW LEVEL SECURITY;

-- Enterprise memberships
CREATE TABLE public.enterprise_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role enterprise_role NOT NULL DEFAULT 'member',
  status enterprise_membership_status NOT NULL DEFAULT 'active',
  team TEXT,
  location TEXT,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.enterprise_memberships ENABLE ROW LEVEL SECURITY;

-- Enterprise invitations
CREATE TABLE public.enterprise_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role enterprise_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);

ALTER TABLE public.enterprise_invitations ENABLE ROW LEVEL SECURITY;

-- Helper: check enterprise role
CREATE OR REPLACE FUNCTION public.has_enterprise_role(_workspace_id UUID, _user_id UUID, _roles enterprise_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND status = 'active'
      AND role = ANY(_roles)
  )
$$;

-- Helper: is active member
CREATE OR REPLACE FUNCTION public.is_enterprise_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND status = 'active'
  )
$$;

-- RLS: enterprise_workspaces
CREATE POLICY "Members can view their workspaces"
  ON public.enterprise_workspaces FOR SELECT
  TO authenticated
  USING (is_enterprise_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create workspaces"
  ON public.enterprise_workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update workspaces"
  ON public.enterprise_workspaces FOR UPDATE
  TO authenticated
  USING (has_enterprise_role(id, auth.uid(), ARRAY['owner']::enterprise_role[]));

CREATE POLICY "Owners can delete workspaces"
  ON public.enterprise_workspaces FOR DELETE
  TO authenticated
  USING (has_enterprise_role(id, auth.uid(), ARRAY['owner']::enterprise_role[]));

-- RLS: enterprise_memberships
CREATE POLICY "Members can view workspace memberships"
  ON public.enterprise_memberships FOR SELECT
  TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and assistants can add members"
  ON public.enterprise_memberships FOR INSERT
  TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner', 'resourceAssistant']::enterprise_role[]));

CREATE POLICY "Owners and assistants can update members"
  ON public.enterprise_memberships FOR UPDATE
  TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner', 'resourceAssistant']::enterprise_role[]));

CREATE POLICY "Owners can remove members"
  ON public.enterprise_memberships FOR DELETE
  TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner']::enterprise_role[]));

-- RLS: enterprise_invitations
CREATE POLICY "Members can view workspace invitations"
  ON public.enterprise_invitations FOR SELECT
  TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()) OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Owners and assistants can create invitations"
  ON public.enterprise_invitations FOR INSERT
  TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner', 'resourceAssistant']::enterprise_role[]));

CREATE POLICY "Owners can delete invitations"
  ON public.enterprise_invitations FOR DELETE
  TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner']::enterprise_role[]));

-- Updated_at triggers
CREATE TRIGGER update_enterprise_workspaces_updated_at
  BEFORE UPDATE ON public.enterprise_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enterprise_memberships_updated_at
  BEFORE UPDATE ON public.enterprise_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
