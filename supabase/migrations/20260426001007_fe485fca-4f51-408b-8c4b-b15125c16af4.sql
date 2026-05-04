-- Office coverage rules: per-office, per-business_role minimum headcount
CREATE TABLE public.enterprise_office_coverage_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.enterprise_offices(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  min_headcount integer NOT NULL DEFAULT 1,
  -- Day scope: NULL = mindennap; days_of_week = ISO (0=Sun..6=Sat) szűrt napok; rule_date = konkrét dátum
  days_of_week smallint[] DEFAULT NULL,
  rule_date date DEFAULT NULL,
  valid_from date DEFAULT NULL,
  valid_until date DEFAULT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_office_coverage_rules_office ON public.enterprise_office_coverage_rules(office_id);
CREATE INDEX idx_office_coverage_rules_workspace ON public.enterprise_office_coverage_rules(workspace_id);

ALTER TABLE public.enterprise_office_coverage_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view office coverage rules"
  ON public.enterprise_office_coverage_rules FOR SELECT TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert office coverage rules"
  ON public.enterprise_office_coverage_rules FOR INSERT TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update office coverage rules"
  ON public.enterprise_office_coverage_rules FOR UPDATE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete office coverage rules"
  ON public.enterprise_office_coverage_rules FOR DELETE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE TRIGGER update_office_coverage_rules_updated_at
  BEFORE UPDATE ON public.enterprise_office_coverage_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- UI section states: workspace-szintű (cégszintű) menü szekció defaultok
CREATE TABLE public.enterprise_ui_section_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  state text NOT NULL DEFAULT 'default' CHECK (state IN ('default','opened','collapsed')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, section_key)
);

CREATE INDEX idx_ui_section_states_ws ON public.enterprise_ui_section_states(workspace_id);

ALTER TABLE public.enterprise_ui_section_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view ui section states"
  ON public.enterprise_ui_section_states FOR SELECT TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert ui section states"
  ON public.enterprise_ui_section_states FOR INSERT TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update ui section states"
  ON public.enterprise_ui_section_states FOR UPDATE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete ui section states"
  ON public.enterprise_ui_section_states FOR DELETE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

CREATE TRIGGER update_ui_section_states_updated_at
  BEFORE UPDATE ON public.enterprise_ui_section_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Holiday sync metadata oszlop (workspace-enkénti utolsó szinkron)
ALTER TABLE public.enterprise_workspaces
  ADD COLUMN IF NOT EXISTS holidays_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS holidays_auto_sync boolean NOT NULL DEFAULT false;