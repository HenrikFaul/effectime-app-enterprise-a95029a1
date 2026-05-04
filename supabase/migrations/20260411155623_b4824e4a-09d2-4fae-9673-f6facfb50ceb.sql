
-- Create enterprise offices table
CREATE TABLE public.enterprise_offices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view offices" ON public.enterprise_offices
  FOR SELECT TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can create offices" ON public.enterprise_offices
  FOR INSERT TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can update offices" ON public.enterprise_offices
  FOR UPDATE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can delete offices" ON public.enterprise_offices
  FOR DELETE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- Add city and office_id to memberships
ALTER TABLE public.enterprise_memberships ADD COLUMN city text;
ALTER TABLE public.enterprise_memberships ADD COLUMN office_id uuid REFERENCES public.enterprise_offices(id) ON DELETE SET NULL;

-- Create member templates table
CREATE TABLE public.enterprise_member_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  default_role text NOT NULL DEFAULT 'member',
  default_team text,
  default_business_role text,
  default_office_id uuid REFERENCES public.enterprise_offices(id) ON DELETE SET NULL,
  default_city text,
  default_location text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_member_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view templates" ON public.enterprise_member_templates
  FOR SELECT TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can create templates" ON public.enterprise_member_templates
  FOR INSERT TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can update templates" ON public.enterprise_member_templates
  FOR UPDATE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can delete templates" ON public.enterprise_member_templates
  FOR DELETE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
