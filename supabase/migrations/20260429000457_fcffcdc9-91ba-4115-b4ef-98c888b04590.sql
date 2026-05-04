-- =====================================================================
-- 1) NEW TABLE: enterprise_member_site_priorities (Phase II — allowedSites)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.enterprise_member_site_priorities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.enterprise_offices(id) ON DELETE CASCADE,
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (membership_id, office_id)
);

CREATE INDEX IF NOT EXISTS idx_emsp_workspace ON public.enterprise_member_site_priorities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_emsp_membership ON public.enterprise_member_site_priorities(membership_id);
CREATE INDEX IF NOT EXISTS idx_emsp_office ON public.enterprise_member_site_priorities(office_id);

ALTER TABLE public.enterprise_member_site_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view site priorities"
  ON public.enterprise_member_site_priorities
  FOR SELECT
  TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert site priorities"
  ON public.enterprise_member_site_priorities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update site priorities"
  ON public.enterprise_member_site_priorities
  FOR UPDATE
  TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete site priorities"
  ON public.enterprise_member_site_priorities
  FOR DELETE
  TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE TRIGGER trg_emsp_updated_at
  BEFORE UPDATE ON public.enterprise_member_site_priorities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2) Loosen legacy check on coverage rules — accept multi-value cols too
-- =====================================================================
ALTER TABLE public.enterprise_office_coverage_rules
  DROP CONSTRAINT IF EXISTS coverage_rule_role_or_skill_required;

ALTER TABLE public.enterprise_office_coverage_rules
  ADD CONSTRAINT coverage_rule_role_or_skill_required CHECK (
    business_role IS NOT NULL
    OR skill_id IS NOT NULL
    OR (business_roles IS NOT NULL AND array_length(business_roles, 1) >= 1)
    OR (skill_ids IS NOT NULL AND array_length(skill_ids, 1) >= 1)
  );

-- =====================================================================
-- 3) Update default filters_config to include new aggregate filters
--    (existing rows are not touched — useCalendarFilterConfig auto-merges)
-- =====================================================================
ALTER TABLE public.tenant_calendar_settings
  ALTER COLUMN filters_config SET DEFAULT
    '[
      {"id": "office", "order": 1, "enabled": true},
      {"id": "team", "order": 2, "enabled": true},
      {"id": "business_role", "order": 3, "enabled": true},
      {"id": "leave_type", "order": 4, "enabled": true},
      {"id": "status", "order": 5, "enabled": true},
      {"id": "skill", "order": 6, "enabled": true},
      {"id": "location", "order": 7, "enabled": true},
      {"id": "site_priority", "order": 8, "enabled": false},
      {"id": "utilization", "order": 9, "enabled": false},
      {"id": "assignment_state", "order": 10, "enabled": false},
      {"id": "capacity_band", "order": 11, "enabled": false}
    ]'::jsonb;