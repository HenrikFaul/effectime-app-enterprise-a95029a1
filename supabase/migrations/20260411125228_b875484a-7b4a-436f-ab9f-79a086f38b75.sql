
-- Enterprise leave types
CREATE TABLE public.enterprise_leave_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_paid BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

ALTER TABLE public.enterprise_leave_types ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_enterprise_leave_types_updated_at
  BEFORE UPDATE ON public.enterprise_leave_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view leave types" ON public.enterprise_leave_types
  FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage leave types" ON public.enterprise_leave_types
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can update leave types" ON public.enterprise_leave_types
  FOR UPDATE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can delete leave types" ON public.enterprise_leave_types
  FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- Enterprise holidays
CREATE TABLE public.enterprise_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, holiday_date)
);

ALTER TABLE public.enterprise_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view holidays" ON public.enterprise_holidays
  FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage holidays" ON public.enterprise_holidays
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can update holidays" ON public.enterprise_holidays
  FOR UPDATE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can delete holidays" ON public.enterprise_holidays
  FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- Enterprise blocked dates
CREATE TABLE public.enterprise_blocked_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, blocked_date)
);

ALTER TABLE public.enterprise_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view blocked dates" ON public.enterprise_blocked_dates
  FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage blocked dates" ON public.enterprise_blocked_dates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can delete blocked dates" ON public.enterprise_blocked_dates
  FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- Enterprise daily rules (max off, min coverage)
CREATE TABLE public.enterprise_daily_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  rule_date DATE,
  day_of_week INTEGER,
  max_off INTEGER,
  min_coverage INTEGER,
  team_filter TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_date_or_dow CHECK (rule_date IS NOT NULL OR day_of_week IS NOT NULL)
);

ALTER TABLE public.enterprise_daily_rules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_enterprise_daily_rules_updated_at
  BEFORE UPDATE ON public.enterprise_daily_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view daily rules" ON public.enterprise_daily_rules
  FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can manage daily rules" ON public.enterprise_daily_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can update daily rules" ON public.enterprise_daily_rules
  FOR UPDATE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Owners can delete daily rules" ON public.enterprise_daily_rules
  FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));
