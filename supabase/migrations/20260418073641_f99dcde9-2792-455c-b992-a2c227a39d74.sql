
-- Reload Postgrest schema cache so newly added columns become accessible via API
NOTIFY pgrst, 'reload schema';

-- Create table for storing multiple business role allocations per member with percentage distribution
CREATE TABLE IF NOT EXISTS public.enterprise_member_role_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  percentage numeric(5,2) NOT NULL DEFAULT 100 CHECK (percentage >= 0 AND percentage <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, business_role)
);

CREATE INDEX IF NOT EXISTS idx_member_role_alloc_workspace ON public.enterprise_member_role_allocations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_member_role_alloc_membership ON public.enterprise_member_role_allocations(membership_id);

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS update_member_role_alloc_updated_at ON public.enterprise_member_role_allocations;
CREATE TRIGGER update_member_role_alloc_updated_at
BEFORE UPDATE ON public.enterprise_member_role_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.enterprise_member_role_allocations ENABLE ROW LEVEL SECURITY;

-- Members can view allocations within their workspace
CREATE POLICY "Members view role allocations"
  ON public.enterprise_member_role_allocations
  FOR SELECT
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

-- Owners and resourceAssistants can manage
CREATE POLICY "Admins insert role allocations"
  ON public.enterprise_member_role_allocations
  FOR INSERT
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update role allocations"
  ON public.enterprise_member_role_allocations
  FOR UPDATE
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete role allocations"
  ON public.enterprise_member_role_allocations
  FOR DELETE
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

-- Backfill existing single-role memberships into allocations table at 100%
INSERT INTO public.enterprise_member_role_allocations (workspace_id, membership_id, business_role, percentage)
SELECT workspace_id, id, business_role, 100
FROM public.enterprise_memberships
WHERE business_role IS NOT NULL AND business_role <> ''
ON CONFLICT (membership_id, business_role) DO NOTHING;
