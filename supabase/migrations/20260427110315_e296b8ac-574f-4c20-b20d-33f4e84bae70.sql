CREATE TABLE IF NOT EXISTS public.tenant_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  filters_config jsonb NOT NULL DEFAULT '[
    {"id":"office","enabled":true,"order":1},
    {"id":"team","enabled":true,"order":2},
    {"id":"business_role","enabled":true,"order":3},
    {"id":"leave_type","enabled":true,"order":4},
    {"id":"status","enabled":true,"order":5}
  ]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.tenant_calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view calendar settings"
  ON public.tenant_calendar_settings FOR SELECT TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert calendar settings"
  ON public.tenant_calendar_settings FOR INSERT TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update calendar settings"
  ON public.tenant_calendar_settings FOR UPDATE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Owners delete calendar settings"
  ON public.tenant_calendar_settings FOR DELETE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

CREATE TRIGGER trg_tenant_calendar_settings_updated
  BEFORE UPDATE ON public.tenant_calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();