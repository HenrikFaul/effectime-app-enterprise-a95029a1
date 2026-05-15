-- v3.33.8 — ATS candidate pipeline: tables + RPCs (v3.31.0 feature completion)
--
-- Creates the two tables referenced by useCandidates.ts (candidates,
-- interview_slots) and the three RPCs called by that hook:
--   candidate_create_slot      – manager creates an available slot
--   candidate_self_book        – public-facing (anon) self-booking via token
--   candidate_generate_onboarding – kick off onboarding for a hired candidate
--
-- candidate_interview_slot_eligible already exists (v3.33.3 sweep); it
-- references interview_slots, so this migration must precede any attempt
-- to run the function against live data.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION /
-- IF NOT EXISTS policy guards throughout.

-- =========================================================================
-- 1. candidates
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.candidates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name                text NOT NULL,
  email               text NOT NULL,
  position_applied    text,
  ats_provider        text,
  ats_candidate_id    text,
  status              text NOT NULL DEFAULT 'new',
  -- Optional link set when the candidate is hired and gets a membership
  enterprise_membership_id  uuid REFERENCES public.enterprise_memberships(id) ON DELETE SET NULL,
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidates_status_check CHECK (
    status IN ('new','screening','interview','offer','hired','rejected','withdrawn')
  ),
  CONSTRAINT candidates_ats_provider_check CHECK (
    ats_provider IS NULL OR ats_provider IN ('greenhouse','lever','workable','internal')
  )
);

CREATE INDEX IF NOT EXISTS idx_candidates_workspace
  ON public.candidates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email
  ON public.candidates(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_candidates_status
  ON public.candidates(workspace_id, status);

CREATE OR REPLACE FUNCTION public.set_candidates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON public.candidates;
CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_candidates_updated_at();

-- =========================================================================
-- 2. interview_slots
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.interview_slots (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  candidate_id                uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  interviewer_membership_ids  uuid[] NOT NULL DEFAULT '{}',
  slot_start                  timestamptz NOT NULL,
  slot_end                    timestamptz NOT NULL,
  status                      text NOT NULL DEFAULT 'available',
  booking_token               text UNIQUE,
  notes                       text,
  outcome_rating              integer,
  outcome_recommendation      text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_slots_status_check CHECK (
    status IN ('available','booked','completed','cancelled','no_show')
  ),
  CONSTRAINT interview_slots_outcome_recommendation_check CHECK (
    outcome_recommendation IS NULL OR
    outcome_recommendation IN ('strong_hire','hire','no_hire','strong_no_hire')
  ),
  CONSTRAINT interview_slots_outcome_rating_check CHECK (
    outcome_rating IS NULL OR (outcome_rating BETWEEN 1 AND 5)
  ),
  CONSTRAINT interview_slots_time_order_check CHECK (slot_end > slot_start)
);

CREATE INDEX IF NOT EXISTS idx_interview_slots_workspace
  ON public.interview_slots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_interview_slots_candidate
  ON public.interview_slots(candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interview_slots_start
  ON public.interview_slots(workspace_id, slot_start);
CREATE INDEX IF NOT EXISTS idx_interview_slots_token
  ON public.interview_slots(booking_token) WHERE booking_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_interview_slots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_interview_slots_updated_at ON public.interview_slots;
CREATE TRIGGER trg_interview_slots_updated_at
  BEFORE UPDATE ON public.interview_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_interview_slots_updated_at();

-- =========================================================================
-- 3. RLS
-- =========================================================================

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- candidates: members can read; owners/resourceAssistants manage
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view candidates' AND tablename = 'candidates') THEN
    CREATE POLICY "Members view candidates" ON public.candidates
      FOR SELECT TO authenticated
      USING (public.is_enterprise_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage candidates' AND tablename = 'candidates') THEN
    CREATE POLICY "Admins manage candidates" ON public.candidates
      FOR ALL TO authenticated
      USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]))
      WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]));
  END IF;

  -- interview_slots: members can read; owners/resourceAssistants manage
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view interview slots' AND tablename = 'interview_slots') THEN
    CREATE POLICY "Members view interview slots" ON public.interview_slots
      FOR SELECT TO authenticated
      USING (public.is_enterprise_member(workspace_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage interview slots' AND tablename = 'interview_slots') THEN
    CREATE POLICY "Admins manage interview slots" ON public.interview_slots
      FOR ALL TO authenticated
      USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]))
      WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]));
  END IF;

  -- interview_slots: anon can read a single available slot by booking_token
  -- (needed for the public self-booking page to display slot details)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon reads slot by booking token' AND tablename = 'interview_slots') THEN
    CREATE POLICY "Anon reads slot by booking token" ON public.interview_slots
      FOR SELECT TO anon
      USING (booking_token IS NOT NULL AND status = 'available');
  END IF;
END;
$$;

-- =========================================================================
-- 4. candidate_create_slot
-- =========================================================================
-- Creates an available interview slot after verifying all interviewers are
-- eligible (no leave conflicts, no double-bookings) via
-- candidate_interview_slot_eligible. Generates a random booking_token so
-- the slot can later be self-booked by a candidate.
-- Returns the new slot's UUID.

CREATE OR REPLACE FUNCTION public.candidate_create_slot(
  _workspace_id    uuid,
  _slot_start      timestamptz,
  _slot_end        timestamptz,
  _interviewer_ids uuid[],
  _notes           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slot_id uuid;
BEGIN
  -- Caller must be a workspace admin/owner
  IF NOT public.has_enterprise_role(_workspace_id, auth.uid(),
       ARRAY['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]) THEN
    RAISE EXCEPTION 'Insufficient role to create interview slots'
      USING ERRCODE = '42501';
  END IF;

  IF _slot_end <= _slot_start THEN
    RAISE EXCEPTION 'slot_end must be after slot_start'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.candidate_interview_slot_eligible(_slot_start, _slot_end, _interviewer_ids) THEN
    RAISE EXCEPTION 'One or more interviewers are unavailable for this time slot (leave conflict or double-booking)'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.interview_slots (
    workspace_id,
    interviewer_membership_ids,
    slot_start,
    slot_end,
    status,
    booking_token,
    notes
  ) VALUES (
    _workspace_id,
    _interviewer_ids,
    _slot_start,
    _slot_end,
    'available',
    gen_random_uuid()::text,
    _notes
  )
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.candidate_create_slot(uuid, timestamptz, timestamptz, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_create_slot(uuid, timestamptz, timestamptz, uuid[], text) TO authenticated;

-- =========================================================================
-- 5. candidate_self_book
-- =========================================================================
-- Public-facing (anon) self-booking. Looks up an available slot by
-- booking_token, creates or upserts the candidate record, and marks the
-- slot as booked. Returns slot details + candidate_id.

CREATE OR REPLACE FUNCTION public.candidate_self_book(
  _booking_token   text,
  _candidate_name  text,
  _candidate_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slot        public.interview_slots;
  v_candidate   public.candidates;
  v_candidate_id uuid;
BEGIN
  -- Find the available slot
  SELECT * INTO v_slot
  FROM public.interview_slots
  WHERE booking_token = _booking_token
    AND status = 'available'
  FOR UPDATE;  -- lock to prevent race

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found or no longer available'
      USING ERRCODE = '02000';
  END IF;

  -- Upsert candidate by (workspace_id, email)
  SELECT * INTO v_candidate
  FROM public.candidates
  WHERE workspace_id = v_slot.workspace_id
    AND email = lower(trim(_candidate_email))
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.candidates (workspace_id, name, email, status)
    VALUES (v_slot.workspace_id, _candidate_name, lower(trim(_candidate_email)), 'interview')
    RETURNING * INTO v_candidate;
  ELSE
    -- Advance status to 'interview' if still at 'new'/'screening'
    IF v_candidate.status IN ('new', 'screening') THEN
      UPDATE public.candidates
      SET status = 'interview', updated_at = now()
      WHERE id = v_candidate.id;
    END IF;
    v_candidate_id := v_candidate.id;
  END IF;

  v_candidate_id := COALESCE(v_candidate_id, v_candidate.id);

  -- Book the slot
  UPDATE public.interview_slots
  SET
    candidate_id  = v_candidate_id,
    status        = 'booked',
    booking_token = NULL,  -- consume the token
    updated_at    = now()
  WHERE id = v_slot.id;

  RETURN jsonb_build_object(
    'ok',           true,
    'slot_id',      v_slot.id,
    'slot_start',   v_slot.slot_start,
    'slot_end',     v_slot.slot_end,
    'candidate_id', v_candidate_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.candidate_self_book(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_self_book(text, text, text) TO anon, authenticated;

-- =========================================================================
-- 6. candidate_generate_onboarding
-- =========================================================================
-- Creates an enterprise_onboarding_instances row for a hired candidate.
-- Requires the candidate to have an enterprise_membership_id set (i.e. the
-- candidate has already been provisioned as a workspace member). If no
-- membership exists, returns ok=true with null instance fields (no-op).
-- Uses the most recently published onboarding template for the workspace.

CREATE OR REPLACE FUNCTION public.candidate_generate_onboarding(
  _workspace_id  uuid,
  _candidate_id  uuid,
  _start_date    date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_candidate       public.candidates;
  v_template        public.enterprise_onboarding_templates;
  v_instance_id     uuid;
BEGIN
  -- Caller must be a workspace admin/owner
  IF NOT public.has_enterprise_role(_workspace_id, auth.uid(),
       ARRAY['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]) THEN
    RAISE EXCEPTION 'Insufficient role to generate onboarding'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch the candidate
  SELECT * INTO v_candidate
  FROM public.candidates
  WHERE id = _candidate_id AND workspace_id = _workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found in this workspace'
      USING ERRCODE = '02000';
  END IF;

  -- No linked membership yet — return a no-op success so the caller can
  -- set up the membership first and retry.
  IF v_candidate.enterprise_membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok',                    true,
      'candidate_id',          _candidate_id,
      'onboarding_instance_id', NULL,
      'template_used',         NULL
    );
  END IF;

  -- Pick the best matching published template for the workspace
  SELECT * INTO v_template
  FROM public.enterprise_onboarding_templates
  WHERE workspace_id = _workspace_id
    AND status = 'published'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',                    true,
      'candidate_id',          _candidate_id,
      'onboarding_instance_id', NULL,
      'template_used',         NULL
    );
  END IF;

  -- Create the onboarding instance
  INSERT INTO public.enterprise_onboarding_instances (
    workspace_id,
    member_id,
    template_id,
    template_version,
    status,
    started_at,
    due_at
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
    'ok',                    true,
    'candidate_id',          _candidate_id,
    'onboarding_instance_id', v_instance_id,
    'template_used',         v_template.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.candidate_generate_onboarding(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_generate_onboarding(uuid, uuid, date) TO authenticated;
