-- 1) Bővítjük a meglévő coverage rules táblát skill-támogatással
ALTER TABLE public.enterprise_office_coverage_rules
  ADD COLUMN IF NOT EXISTS skill_id uuid,
  ADD COLUMN IF NOT EXISTS min_skill_level smallint DEFAULT 1;

-- A business_role-t opcionálissá tesszük (ha skill_id van megadva)
ALTER TABLE public.enterprise_office_coverage_rules
  ALTER COLUMN business_role DROP NOT NULL;

-- Validáció: legalább az egyik (business_role vagy skill_id) kötelező
ALTER TABLE public.enterprise_office_coverage_rules
  DROP CONSTRAINT IF EXISTS coverage_rule_role_or_skill_required;
ALTER TABLE public.enterprise_office_coverage_rules
  ADD CONSTRAINT coverage_rule_role_or_skill_required
  CHECK (business_role IS NOT NULL OR skill_id IS NOT NULL);

-- 2) Új tábla: shift_assignments (roster)
CREATE TABLE IF NOT EXISTS public.enterprise_shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  user_id uuid NOT NULL,
  office_id uuid NOT NULL,
  business_role text,
  skill_id uuid,
  shift_date date NOT NULL,
  notes text,
  is_tentative boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_role_or_skill CHECK (business_role IS NOT NULL OR skill_id IS NOT NULL),
  CONSTRAINT uq_shift_user_date UNIQUE (workspace_id, user_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_shift_workspace_date
  ON public.enterprise_shift_assignments (workspace_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_office_date
  ON public.enterprise_shift_assignments (office_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_user_date
  ON public.enterprise_shift_assignments (user_id, shift_date);

ALTER TABLE public.enterprise_shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view shift assignments"
  ON public.enterprise_shift_assignments FOR SELECT TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert shift assignments"
  ON public.enterprise_shift_assignments FOR INSERT TO authenticated
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update shift assignments"
  ON public.enterprise_shift_assignments FOR UPDATE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete shift assignments"
  ON public.enterprise_shift_assignments FOR DELETE TO authenticated
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE TRIGGER trg_shift_assignments_updated
  BEFORE UPDATE ON public.enterprise_shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();