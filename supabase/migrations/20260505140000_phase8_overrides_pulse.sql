-- v3.0.0 Phase 8 — Persistent translation overrides + Org Pulse aggregates +
-- decision-memory observed-outcome stale tracking. Idempotent additive.

-- =========================================================================
-- 1. Translation overrides (workspace-scoped persistent overrides)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_translation_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  locale        text NOT NULL,
  key           text NOT NULL,
  value         text NOT NULL,
  source        text NOT NULL DEFAULT 'csv_import',
  authored_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_translation_overrides_locale_check
    CHECK (locale IN ('en','hu')),
  UNIQUE(workspace_id, locale, key)
);

CREATE INDEX IF NOT EXISTS idx_translation_overrides_workspace_locale
  ON public.enterprise_translation_overrides(workspace_id, locale);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_translation_overrides_updated') THEN
    CREATE TRIGGER trg_translation_overrides_updated BEFORE UPDATE ON public.enterprise_translation_overrides
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

ALTER TABLE public.enterprise_translation_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view translation overrides' AND tablename = 'enterprise_translation_overrides') THEN
    CREATE POLICY "Members view translation overrides" ON public.enterprise_translation_overrides
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage translation overrides' AND tablename = 'enterprise_translation_overrides') THEN
    CREATE POLICY "Admins manage translation overrides" ON public.enterprise_translation_overrides
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;
END$$;

-- =========================================================================
-- 2. Org Pulse helper view — privacy-safe aggregates with k>=5 floor
-- =========================================================================

CREATE OR REPLACE VIEW public.enterprise_org_pulse_membership AS
SELECT
  w.id            AS workspace_id,
  COUNT(*) FILTER (WHERE m.status = 'active')                       AS active_count,
  COUNT(*) FILTER (WHERE m.status = 'active' AND m.org_unit_id IS NULL)        AS missing_org_unit,
  COUNT(*) FILTER (WHERE m.status = 'active' AND m.manager_id IS NULL)         AS missing_manager,
  COUNT(*) FILTER (WHERE m.status = 'active' AND m.contract_type_id IS NULL)   AS missing_contract,
  COUNT(*) FILTER (WHERE m.status = 'active' AND m.leadership_level_id IS NULL) AS missing_leadership,
  COUNT(*) FILTER (WHERE m.status = 'active' AND m.employer_rights = true)     AS employer_rights_count
FROM public.enterprise_workspaces w
LEFT JOIN public.enterprise_memberships m ON m.workspace_id = w.id
GROUP BY w.id;

GRANT SELECT ON public.enterprise_org_pulse_membership TO authenticated;

-- =========================================================================
-- 3. Decision-memory observed-outcome stale flag
-- =========================================================================

ALTER TABLE public.enterprise_decision_memory
  ADD COLUMN IF NOT EXISTS observation_due_at timestamptz;

-- Auto-set observation_due_at on insert (default: 14 days after authored_at)
CREATE OR REPLACE FUNCTION public.enterprise_decision_memory_set_due()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.observation_due_at IS NULL THEN
    NEW.observation_due_at := COALESCE(NEW.authored_at, now()) + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_decision_memory_set_due') THEN
    CREATE TRIGGER trg_decision_memory_set_due
      BEFORE INSERT ON public.enterprise_decision_memory
      FOR EACH ROW EXECUTE FUNCTION public.enterprise_decision_memory_set_due();
  END IF;
END$$;
