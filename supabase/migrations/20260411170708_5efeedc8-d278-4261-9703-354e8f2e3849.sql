
-- Company leave days table (distinct from blocked dates and holidays)
CREATE TABLE public.enterprise_company_leave_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  name TEXT NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_company_leave_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view company leave days" ON public.enterprise_company_leave_days FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins can create company leave days" ON public.enterprise_company_leave_days FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins can update company leave days" ON public.enterprise_company_leave_days FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins can delete company leave days" ON public.enterprise_company_leave_days FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- Half-day leave support
ALTER TABLE public.leave_requests ADD COLUMN is_half_day BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.leave_requests ADD COLUMN half_day_period TEXT CHECK (half_day_period IN ('morning', 'afternoon'));

-- Working pattern per membership
ALTER TABLE public.enterprise_memberships ADD COLUMN working_pattern JSONB DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false}'::jsonb;
