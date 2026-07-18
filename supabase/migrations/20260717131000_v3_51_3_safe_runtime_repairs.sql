-- v3.51.3 — additive repairs for two runtime failures proven by linked DB lint
--
-- This migration is intentionally limited to objects whose complete schema is
-- already represented locally. Remote-only function bodies are left for the
-- documented schema-reconciliation step in PROJECT_AUDIT.md.

-- validate_password_policy previously concatenated scalar text literals to a
-- text array. PostgreSQL resolves that expression as an array literal and
-- raises "malformed array literal" for every failing rule.
CREATE OR REPLACE FUNCTION public.validate_password_policy(_password text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_failures text[] := ARRAY[]::text[];
BEGIN
  IF _password IS NULL OR length(_password) < 10 THEN
    v_failures := array_append(v_failures, 'min_length_10');
  END IF;
  IF _password !~ '[A-Z]' THEN
    v_failures := array_append(v_failures, 'requires_uppercase');
  END IF;
  IF _password !~ '[a-z]' THEN
    v_failures := array_append(v_failures, 'requires_lowercase');
  END IF;
  IF _password !~ '[0-9]' THEN
    v_failures := array_append(v_failures, 'requires_digit');
  END IF;
  IF _password !~ '[^A-Za-z0-9]' THEN
    v_failures := array_append(v_failures, 'requires_special_char');
  END IF;

  RETURN jsonb_build_object(
    'ok', cardinality(v_failures) = 0,
    'failures', v_failures
  );
END;
$function$;

-- The original candidate migration put this column inside CREATE TABLE IF NOT
-- EXISTS. On the linked database an older candidates table already existed, so
-- the whole declaration was skipped while the RPC referencing the column was
-- still installed. The repair is nullable and does not rewrite existing rows.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS enterprise_membership_id uuid;

DO $repair_candidate_membership_fk$
BEGIN
  IF to_regclass('public.enterprise_memberships') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.candidates'::regclass
         AND conname = 'candidates_enterprise_membership_id_fkey'
     ) THEN
    ALTER TABLE public.candidates
      ADD CONSTRAINT candidates_enterprise_membership_id_fkey
      FOREIGN KEY (enterprise_membership_id)
      REFERENCES public.enterprise_memberships(id)
      ON DELETE SET NULL;
  END IF;
END
$repair_candidate_membership_fk$;

CREATE INDEX IF NOT EXISTS idx_candidates_enterprise_membership_id
  ON public.candidates (enterprise_membership_id)
  WHERE enterprise_membership_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_candidate_membership_workspace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.enterprise_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.id = NEW.enterprise_membership_id
      AND membership.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Candidate membership must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_candidate_membership_workspace()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_candidates_membership_workspace ON public.candidates;
CREATE TRIGGER trg_candidates_membership_workspace
BEFORE INSERT OR UPDATE OF workspace_id, enterprise_membership_id
ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.guard_candidate_membership_workspace();

-- Repeat the correlation inside the SECURITY DEFINER path so a legacy bad row
-- created before the trigger cannot link an onboarding instance across tenants.
CREATE OR REPLACE FUNCTION public.candidate_generate_onboarding(
  _workspace_id uuid,
  _candidate_id uuid,
  _start_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_candidate public.candidates;
  v_template public.enterprise_onboarding_templates;
  v_instance_id uuid;
BEGIN
  IF NOT public.has_enterprise_role(
    _workspace_id,
    auth.uid(),
    ARRAY[
      'owner'::public.enterprise_role,
      'resourceAssistant'::public.enterprise_role
    ]
  ) THEN
    RAISE EXCEPTION 'Insufficient role to generate onboarding'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.workspace_has_any_feature(_workspace_id, ARRAY['onboarding_template']) THEN
    RAISE EXCEPTION 'Onboarding template feature is not enabled for this workspace'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.workspace_has_any_feature(_workspace_id, ARRAY['onboarding_inbox']) THEN
    RAISE EXCEPTION 'Onboarding inbox feature is not enabled for this workspace'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_candidate
  FROM public.candidates
  WHERE id = _candidate_id
    AND workspace_id = _workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found in this workspace'
      USING ERRCODE = '02000';
  END IF;

  IF v_candidate.enterprise_membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'candidate_id', _candidate_id,
      'onboarding_instance_id', NULL,
      'template_used', NULL
    );
  END IF;

  PERFORM 1
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = v_candidate.enterprise_membership_id
    AND membership.workspace_id = _workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate membership does not belong to this workspace'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_template
  FROM public.enterprise_onboarding_templates
  WHERE workspace_id = _workspace_id
    AND status = 'published'
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'candidate_id', _candidate_id,
      'onboarding_instance_id', NULL,
      'template_used', NULL
    );
  END IF;

  INSERT INTO public.enterprise_onboarding_instances (
    workspace_id, member_id, template_id, template_version,
    status, started_at, due_at
  ) VALUES (
    _workspace_id,
    v_candidate.enterprise_membership_id,
    v_template.id,
    v_template.version,
    'in_progress',
    now(),
    (_start_date + INTERVAL '30 days')::timestamptz
  )
  RETURNING id INTO v_instance_id;

  RETURN jsonb_build_object(
    'ok', true,
    'candidate_id', _candidate_id,
    'onboarding_instance_id', v_instance_id,
    'template_used', v_template.name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.candidate_generate_onboarding(uuid, uuid, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_generate_onboarding(uuid, uuid, date)
  TO authenticated;
