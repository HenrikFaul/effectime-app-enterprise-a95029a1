-- org_pulse_membership VIEW + translation_overrides TABLE
-- Applied 2026-05-09 to fix missing schema objects causing 404s.
-- The sibling file 20260505140000_phase8_overrides_pulse.sql was in git but
-- never applied to production; this migration supersedes it for production
-- and uses idempotent DDL so both can coexist without conflicts.

-- ── 1. enterprise_org_pulse_membership VIEW ──────────────────────────────────
CREATE OR REPLACE VIEW public.enterprise_org_pulse_membership AS
SELECT
  workspace_id,
  COUNT(*)  FILTER (WHERE status = 'active')                                 AS active_count,
  COUNT(*)  FILTER (WHERE status = 'active' AND org_unit_id IS NULL)         AS missing_org_unit,
  COUNT(*)  FILTER (WHERE status = 'active' AND manager_id IS NULL)          AS missing_manager,
  COUNT(*)  FILTER (WHERE status = 'active' AND contract_type_id IS NULL)    AS missing_contract,
  COUNT(*)  FILTER (WHERE status = 'active' AND leadership_level_id IS NULL) AS missing_leadership,
  COUNT(*)  FILTER (WHERE status = 'active' AND employer_rights = TRUE)      AS employer_rights_count
FROM public.enterprise_memberships
GROUP BY workspace_id;

GRANT SELECT ON public.enterprise_org_pulse_membership TO authenticated, anon;

-- ── 2. enterprise_translation_overrides TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enterprise_translation_overrides (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  locale       TEXT        NOT NULL,
  key          TEXT        NOT NULL,
  value        TEXT        NOT NULL,
  source       TEXT        NOT NULL DEFAULT 'manual',
  authored_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT enterprise_translation_overrides_uniq UNIQUE (workspace_id, locale, key)
);

CREATE INDEX IF NOT EXISTS idx_translation_overrides_workspace_locale
  ON public.enterprise_translation_overrides (workspace_id, locale);

ALTER TABLE public.enterprise_translation_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations_select"
  ON public.enterprise_translation_overrides FOR SELECT
  USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "translations_insert"
  ON public.enterprise_translation_overrides FOR INSERT
  WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner']::enterprise_role[]));

CREATE POLICY "translations_update"
  ON public.enterprise_translation_overrides FOR UPDATE
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner']::enterprise_role[]));

CREATE POLICY "translations_delete"
  ON public.enterprise_translation_overrides FOR DELETE
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner']::enterprise_role[]));

CREATE TRIGGER trg_translation_overrides_updated_at
  BEFORE UPDATE ON public.enterprise_translation_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
