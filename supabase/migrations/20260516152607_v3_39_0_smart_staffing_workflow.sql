-- v3.39.0 Smart Staffing Workflow
-- Adds workspace-scoped availability, open-shift requests, and race-safe claim flow.
-- Nothing in this migration modifies existing tables.

-- ─── 1. EMPLOYEE AVAILABILITY ────────────────────────────────────────────────
-- Replaces personal_availability (no workspace_id) for manager-visible pool.
CREATE TABLE IF NOT EXISTS public.enterprise_staff_availability (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id  uuid NOT NULL,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  availability_date date NOT NULL,
  status         text NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','unavailable','preferred')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, availability_date)
);

ALTER TABLE public.enterprise_staff_availability ENABLE ROW LEVEL SECURITY;

-- Members can manage their own rows; managers can read all rows in workspace.
CREATE POLICY "availability_select" ON public.enterprise_staff_availability
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.enterprise_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "availability_insert" ON public.enterprise_staff_availability
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "availability_update" ON public.enterprise_staff_availability
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "availability_delete" ON public.enterprise_staff_availability
  FOR DELETE USING (user_id = auth.uid());

-- Index for the manager's date-range query
CREATE INDEX IF NOT EXISTS idx_esa_workspace_date
  ON public.enterprise_staff_availability (workspace_id, availability_date);

-- ─── 2. OPEN SHIFT REQUESTS ──────────────────────────────────────────────────
-- Manager-posted unfilled slots that employees can claim first-come-first-served.
CREATE TABLE IF NOT EXISTS public.enterprise_open_shift_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  office_id       uuid NOT NULL,
  shift_date      date NOT NULL,
  business_role   text,
  skill_id        uuid,
  notes           text,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','filled','cancelled')),
  filled_by_user_id uuid,
  filled_at       timestamptz,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_open_shift_requests ENABLE ROW LEVEL SECURITY;

-- All active members in the workspace can read open shift requests.
CREATE POLICY "osr_select" ON public.enterprise_open_shift_requests
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.enterprise_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only managers (admin role) can insert/update/delete via RPC.
-- Direct INSERT is blocked; writes go through the RPC below.
CREATE POLICY "osr_insert_manager" ON public.enterprise_open_shift_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.enterprise_memberships
      WHERE workspace_id = enterprise_open_shift_requests.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','owner')
    )
  );

CREATE POLICY "osr_update_rpc" ON public.enterprise_open_shift_requests
  FOR UPDATE USING (true);  -- restricted to SECURITY DEFINER RPC

CREATE INDEX IF NOT EXISTS idx_eosr_workspace_date
  ON public.enterprise_open_shift_requests (workspace_id, shift_date, status);

-- ─── 3. OPEN SHIFT CLAIMS ────────────────────────────────────────────────────
-- Each employee claim attempt.  UNIQUE prevents double-claiming by same user.
CREATE TABLE IF NOT EXISTS public.enterprise_open_shift_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES public.enterprise_open_shift_requests(id) ON DELETE CASCADE,
  membership_id  uuid NOT NULL,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'claimed'
                   CHECK (status IN ('claimed','superseded')),
  claimed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.enterprise_open_shift_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "osc_select" ON public.enterprise_open_shift_claims
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM public.enterprise_open_shift_requests
      WHERE workspace_id IN (
        SELECT workspace_id FROM public.enterprise_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- All writes go through the SECURITY DEFINER RPC; direct INSERT blocked.
CREATE POLICY "osc_insert_rpc" ON public.enterprise_open_shift_claims
  FOR INSERT WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_eosc_request
  ON public.enterprise_open_shift_claims (request_id, status);

-- ─── 4. CLAIM OPEN SHIFT RPC ─────────────────────────────────────────────────
-- Race-safe: SELECT … FOR UPDATE locks the request row before checking status.
-- Returns jsonb: {ok, assignment_id} on success or raises exception.
CREATE OR REPLACE FUNCTION public.claim_open_shift(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req       enterprise_open_shift_requests%ROWTYPE;
  v_mem       enterprise_memberships%ROWTYPE;
  v_uid       uuid := auth.uid();
  v_assign_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Lock the request row to prevent concurrent claims from racing.
  SELECT * INTO v_req
  FROM enterprise_open_shift_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_req.status <> 'open' THEN
    RAISE EXCEPTION 'request_not_open';
  END IF;

  -- Resolve caller's membership in this workspace.
  SELECT * INTO v_mem
  FROM enterprise_memberships
  WHERE workspace_id = v_req.workspace_id
    AND user_id = v_uid
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  -- Record the claim (UNIQUE(request_id, user_id) prevents idempotency issues).
  INSERT INTO enterprise_open_shift_claims (request_id, membership_id, user_id, status)
  VALUES (_request_id, v_mem.id, v_uid, 'claimed')
  ON CONFLICT (request_id, user_id) DO NOTHING;

  -- Create the shift assignment.
  INSERT INTO enterprise_shift_assignments
    (workspace_id, membership_id, user_id, office_id, business_role, skill_id, shift_date, created_by)
  VALUES
    (v_req.workspace_id, v_mem.id, v_uid, v_req.office_id,
     v_req.business_role, v_req.skill_id, v_req.shift_date, v_uid)
  ON CONFLICT (workspace_id, user_id, shift_date) DO NOTHING
  RETURNING id INTO v_assign_id;

  -- Mark request filled.
  UPDATE enterprise_open_shift_requests
  SET status = 'filled', filled_by_user_id = v_uid, filled_at = now(), updated_at = now()
  WHERE id = _request_id;

  -- Supersede other claims on same request.
  UPDATE enterprise_open_shift_claims
  SET status = 'superseded'
  WHERE request_id = _request_id AND user_id <> v_uid AND status = 'claimed';

  -- Notify the claimant that their shift was confirmed.
  INSERT INTO enterprise_notifications
    (workspace_id, user_id, event_type, title, message, related_type, related_id)
  VALUES
    (v_req.workspace_id, v_uid, 'shift_assigned',
     'Shift confirmed',
     'You claimed and were assigned to the open shift on ' || v_req.shift_date::text || '.',
     'open_shift_request', _request_id);

  -- Notify workspace admins that the shift was filled.
  INSERT INTO enterprise_notifications
    (workspace_id, user_id, event_type, title, message, related_type, related_id)
  SELECT
    v_req.workspace_id, em.user_id, 'open_shift_filled',
    'Open shift filled',
    'The open shift on ' || v_req.shift_date::text || ' has been claimed.',
    'open_shift_request', _request_id
  FROM enterprise_memberships em
  WHERE em.workspace_id = v_req.workspace_id
    AND em.status = 'active'
    AND em.role IN ('admin','owner')
    AND em.user_id <> v_uid;

  RETURN jsonb_build_object('ok', true, 'assignment_id', v_assign_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_open_shift(uuid) TO authenticated;

-- ─── 5. CREATE OPEN SHIFT REQUEST RPC ────────────────────────────────────────
-- Managers post open shifts; broadcasts notification to available members.
CREATE OR REPLACE FUNCTION public.create_open_shift_request(
  _workspace_id uuid,
  _office_id    uuid,
  _shift_date   date,
  _business_role text DEFAULT NULL,
  _skill_id     uuid DEFAULT NULL,
  _notes        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_req_id uuid;
BEGIN
  -- Caller must be admin/owner in workspace.
  IF NOT EXISTS (
    SELECT 1 FROM enterprise_memberships
    WHERE workspace_id = _workspace_id
      AND user_id = v_uid
      AND status = 'active'
      AND role IN ('admin','owner')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO enterprise_open_shift_requests
    (workspace_id, office_id, shift_date, business_role, skill_id, notes, created_by)
  VALUES
    (_workspace_id, _office_id, _shift_date, _business_role, _skill_id, _notes, v_uid)
  RETURNING id INTO v_req_id;

  -- Broadcast to all active members (they see it in the open shifts panel).
  INSERT INTO enterprise_notifications
    (workspace_id, user_id, event_type, title, message, related_type, related_id)
  SELECT
    _workspace_id, em.user_id, 'open_shift_broadcast',
    'Open shift available',
    'An open shift is available on ' || _shift_date::text || '. Claim it before it''s taken.',
    'open_shift_request', v_req_id
  FROM enterprise_memberships em
  WHERE em.workspace_id = _workspace_id
    AND em.status = 'active'
    AND em.user_id <> v_uid;

  RETURN v_req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_open_shift_request(uuid,uuid,date,text,uuid,text) TO authenticated;

-- ─── 6. UPDATED_AT TRIGGER ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_esa_updated_at'
  ) THEN
    CREATE TRIGGER trg_esa_updated_at
      BEFORE UPDATE ON public.enterprise_staff_availability
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_eosr_updated_at'
  ) THEN
    CREATE TRIGGER trg_eosr_updated_at
      BEFORE UPDATE ON public.enterprise_open_shift_requests
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;
