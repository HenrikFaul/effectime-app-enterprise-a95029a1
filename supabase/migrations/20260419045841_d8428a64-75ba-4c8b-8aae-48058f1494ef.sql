
CREATE TABLE public.enterprise_report_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.enterprise_reports(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','monthly')),
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 28),
  hour_of_day integer NOT NULL DEFAULT 8 CHECK (hour_of_day BETWEEN 0 AND 23),
  recipients text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  last_run_status text,
  last_run_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view schedules"
  ON public.enterprise_report_schedules FOR SELECT
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can create schedules"
  ON public.enterprise_report_schedules FOR INSERT
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role])
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update schedules"
  ON public.enterprise_report_schedules FOR UPDATE
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins can delete schedules"
  ON public.enterprise_report_schedules FOR DELETE
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE TRIGGER update_enterprise_report_schedules_updated_at
  BEFORE UPDATE ON public.enterprise_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_report_schedules_active ON public.enterprise_report_schedules(is_active, hour_of_day) WHERE is_active = true;
CREATE INDEX idx_report_schedules_workspace ON public.enterprise_report_schedules(workspace_id);
