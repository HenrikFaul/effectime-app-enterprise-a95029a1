-- v3.33.9 — enterprise_coverage_rules view + email_queue table
--
-- AnalyticsDashboard queries enterprise_coverage_rules with columns
-- (id, workspace_id, office_id, applies_to, min_headcount, business_role, skill_id).
-- The underlying data lives in enterprise_office_coverage_rules; this view
-- adds the derived applies_to field and exposes only non-archived rows.
--
-- email_queue is queried by superadmin-hub (soft-fail) for the
-- email-queue-status dashboard widget. Creating it here silences the errors.

-- =========================================================================
-- 1. enterprise_coverage_rules view
-- =========================================================================

CREATE OR REPLACE VIEW public.enterprise_coverage_rules AS
SELECT
  id,
  workspace_id,
  office_id,
  CASE
    WHEN skill_id IS NOT NULL
      OR (skill_ids IS NOT NULL AND array_length(skill_ids, 1) > 0)
    THEN 'skill'
    WHEN business_role IS NOT NULL
      OR (business_roles IS NOT NULL AND array_length(business_roles, 1) > 0)
    THEN 'role'
    ELSE 'all'
  END AS applies_to,
  min_headcount,
  business_role,
  skill_id
FROM public.enterprise_office_coverage_rules
WHERE archived_at IS NULL;

GRANT SELECT ON public.enterprise_coverage_rules TO authenticated, anon;

-- =========================================================================
-- 2. email_queue
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.email_queue (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient   text        NOT NULL,
  subject     text,
  body_html   text,
  status      text        NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  error       text,
  CONSTRAINT email_queue_status_check
    CHECK (status IN ('pending','sent','failed'))
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status
  ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at
  ON public.email_queue(created_at DESC);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Superadmins read email queue'
      AND tablename = 'email_queue'
  ) THEN
    CREATE POLICY "Superadmins read email queue" ON public.email_queue
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END;
$$;
