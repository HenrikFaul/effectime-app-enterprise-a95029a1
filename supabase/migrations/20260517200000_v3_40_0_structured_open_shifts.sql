-- v3.40.0: Structured Open Shift Enhancement
-- Adds: structured position FK, multi-skill array, escalation timeout,
--       waitlist table, filtered notifications (role/skill match only).
-- Backward-compatible: existing text business_role column preserved.

-- ─── 1. EXTEND enterprise_open_shift_requests ────────────────────────────────
ALTER TABLE public.enterprise_open_shift_requests
  ADD COLUMN IF NOT EXISTS role_id       uuid REFERENCES public.enterprise_workspace_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_ids     uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS respond_by_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notified_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timeout_hours numeric NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.enterprise_open_shift_requests.role_id IS
  'Structured FK to enterprise_workspace_roles; preferred over free-text business_role.';
COMMENT ON COLUMN public.enterprise_open_shift_requests.skill_ids IS
  'Array of skill UUIDs (enterprise_skills.id). Replaces single skill_id for multi-skill support.';
COMMENT ON COLUMN public.enterprise_open_shift_requests.respond_by_at IS
  'Deadline for first response; NULL = no escalation. Auto-set to created_at + timeout_hours.';
COMMENT ON COLUMN public.enterprise_open_shift_requests.escalation_level IS
  'How many escalation rounds have run. 0 = initial send, 1 = first escalation, etc.';
COMMENT ON COLUMN public.enterprise_open_shift_requests.notified_user_ids IS
  'All user_ids that have already received a notification for this request (dedup guard).';
COMMENT ON COLUMN public.enterprise_open_shift_requests.target_user_ids IS
  'Current active notification targets (selected top-N candidates for this round).';
COMMENT ON COLUMN public.enterprise_open_shift_requests.timeout_hours IS
  'Configurable escalation timeout in hours. Default 3h.';

CREATE INDEX IF NOT EXISTS idx_eosr_escalation
  ON public.enterprise_open_shift_requests (respond_by_at, status)
  WHERE status = 'open' AND respond_by_at IS NOT NULL;

-- ─── 2. WAITLIST TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enterprise_open_shift_waitlist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.enterprise_open_shift_requests(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position     int NOT NULL,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting', 'notified', 'assigned', 'dropped')),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.enterprise_open_shift_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_select" ON public.enterprise_open_shift_waitlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enterprise_open_shift_requests r
      WHERE r.id = request_id
        AND public.has_enterprise_role(r.workspace_id, auth.uid(),
              ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role,'member'::enterprise_role])
    )
  );

CREATE POLICY "waitlist_insert_rpc" ON public.enterprise_open_shift_waitlist
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "waitlist_update_rpc" ON public.enterprise_open_shift_waitlist
  FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_eoswl_request_pos
  ON public.enterprise_open_shift_waitlist (request_id, position);

-- ─── 3. SHIFT ASSIGNMENT CANCELLATION AUDIT ──────────────────────────────────
-- Track when an assigned employee cancels so replacement can be triggered.
CREATE TABLE IF NOT EXISTS public.enterprise_shift_cancellations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  assignment_id   uuid,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  office_id       uuid NOT NULL,
  shift_date      date NOT NULL,
  business_role   text,
  role_id         uuid,
  skill_ids       uuid[] NOT NULL DEFAULT '{}',
  replacement_found bool NOT NULL DEFAULT false,
  replacement_user_id uuid,
  cancelled_at    timestamptz NOT NULL DEFAULT now(),
  notified_managers bool NOT NULL DEFAULT false
);

ALTER TABLE public.enterprise_shift_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cancellations_select" ON public.enterprise_shift_cancellations
  FOR SELECT USING (
    public.has_enterprise_role(workspace_id, auth.uid(),
      ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role,'member'::enterprise_role])
  );

CREATE POLICY "cancellations_insert_rpc" ON public.enterprise_shift_cancellations
  FOR INSERT WITH CHECK (false);

CREATE POLICY "cancellations_update_rpc" ON public.enterprise_shift_cancellations
  FOR UPDATE USING (true);

-- ─── 4. UPDATED create_open_shift_request RPC ────────────────────────────────
-- Now accepts role_id, skill_ids[], timeout_hours, optional target_user_ids[].
-- Notifications go ONLY to role/skill-matching members (not everyone).
-- If target_user_ids is supplied, notifies only those (manager-selected shortlist).
CREATE OR REPLACE FUNCTION public.create_open_shift_request(
  _workspace_id    uuid,
  _office_id       uuid,
  _shift_date      date,
  _business_role   text    DEFAULT NULL,
  _skill_id        uuid    DEFAULT NULL,
  _notes           text    DEFAULT NULL,
  _role_id         uuid    DEFAULT NULL,
  _skill_ids       uuid[]  DEFAULT '{}',
  _timeout_hours   numeric DEFAULT 3,
  _target_user_ids uuid[]  DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_req_id      uuid;
  v_respond_by  timestamptz;
  v_role_name   text;
  v_all_skill_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT public.has_enterprise_role(_workspace_id, v_uid,
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Resolve role name from structured role_id for backward compat text field
  IF _role_id IS NOT NULL THEN
    SELECT name INTO v_role_name FROM enterprise_workspace_roles
    WHERE id = _role_id AND workspace_id = _workspace_id;
    IF v_role_name IS NOT NULL THEN
      _business_role := v_role_name;
    END IF;
  END IF;

  -- Merge legacy skill_id into skill_ids array
  v_all_skill_ids := _skill_ids;
  IF _skill_id IS NOT NULL AND NOT (_skill_id = ANY(v_all_skill_ids)) THEN
    v_all_skill_ids := array_append(v_all_skill_ids, _skill_id);
  END IF;

  -- Set escalation deadline
  IF _timeout_hours > 0 THEN
    v_respond_by := now() + (_timeout_hours || ' hours')::interval;
  END IF;

  INSERT INTO enterprise_open_shift_requests
    (workspace_id, office_id, shift_date, business_role, skill_id, notes,
     role_id, skill_ids, respond_by_at, timeout_hours, created_by,
     target_user_ids, notified_user_ids)
  VALUES
    (_workspace_id, _office_id, _shift_date, _business_role,
     CASE WHEN array_length(v_all_skill_ids,1) > 0 THEN v_all_skill_ids[1] ELSE NULL END,
     _notes,
     _role_id, v_all_skill_ids, v_respond_by, _timeout_hours, v_uid,
     _target_user_ids, ARRAY[v_uid])
  RETURNING id INTO v_req_id;

  -- Send notifications to: target list if provided; else role/skill-matching members
  INSERT INTO enterprise_notifications
    (workspace_id, user_id, event_type, title, message, related_type, related_id)
  SELECT
    _workspace_id,
    em.user_id,
    'open_shift_broadcast',
    'Open shift available',
    'An open shift is available on ' || _shift_date::text || '. Claim it before it''s taken.',
    'open_shift_request',
    v_req_id
  FROM enterprise_memberships em
  WHERE em.workspace_id = _workspace_id
    AND em.status = 'active'
    AND em.user_id <> v_uid
    -- If specific targets set, send only to them; else filter by role/skill match
    AND (
      CASE
        WHEN array_length(_target_user_ids, 1) > 0 THEN
          em.user_id = ANY(_target_user_ids)
        WHEN _business_role IS NOT NULL THEN
          em.business_role = _business_role
          OR (array_length(v_all_skill_ids, 1) > 0
              AND EXISTS (
                SELECT 1 FROM enterprise_member_skills ms
                WHERE ms.membership_id = em.id
                  AND ms.skill_id = ANY(v_all_skill_ids)
              ))
        WHEN array_length(v_all_skill_ids, 1) > 0 THEN
          EXISTS (
            SELECT 1 FROM enterprise_member_skills ms
            WHERE ms.membership_id = em.id
              AND ms.skill_id = ANY(v_all_skill_ids)
          )
        ELSE true
      END
    );

  -- Track who was notified
  UPDATE enterprise_open_shift_requests
  SET notified_user_ids = (
    SELECT array_agg(DISTINCT n.user_id)
    FROM enterprise_notifications n
    WHERE n.related_id = v_req_id AND n.event_type = 'open_shift_broadcast'
  )
  WHERE id = v_req_id;

  RETURN v_req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_open_shift_request(uuid,uuid,date,text,uuid,text,uuid,uuid[],numeric,uuid[]) TO authenticated;

-- ─── 5. JOIN WAITLIST RPC ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_open_shift_waitlist(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req enterprise_open_shift_requests%ROWTYPE;
  v_mem enterprise_memberships%ROWTYPE;
  v_pos int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_req FROM enterprise_open_shift_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_req.status = 'cancelled' THEN RAISE EXCEPTION 'request_cancelled'; END IF;

  SELECT * INTO v_mem FROM enterprise_memberships
  WHERE workspace_id = v_req.workspace_id AND user_id = v_uid AND status = 'active'
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member'; END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_pos
  FROM enterprise_open_shift_waitlist
  WHERE request_id = _request_id;

  INSERT INTO enterprise_open_shift_waitlist (request_id, membership_id, user_id, position)
  VALUES (_request_id, v_mem.id, v_uid, v_pos)
  ON CONFLICT (request_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'position', v_pos);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_open_shift_waitlist(uuid) TO authenticated;

-- ─── 6. CANCEL SHIFT ASSIGNMENT RPC (replacement search) ────────────────────
-- When an assigned employee cancels their shift assignment, this RPC:
--   a) deletes the assignment
--   b) re-opens or creates an open_shift_request for replacement
--   c) tries the first waitlisted person
--   d) if no replacement found, notifies workspace managers
CREATE OR REPLACE FUNCTION public.cancel_shift_assignment(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_assign    enterprise_shift_assignments%ROWTYPE;
  v_req_id    uuid;
  v_wl        enterprise_open_shift_waitlist%ROWTYPE;
  v_mem       enterprise_memberships%ROWTYPE;
  v_cancel_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_assign FROM enterprise_shift_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'assignment_not_found'; END IF;

  -- Only the assigned employee or workspace manager can cancel
  IF v_assign.user_id <> v_uid AND NOT public.has_enterprise_role(
      v_assign.workspace_id, v_uid,
      ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Record cancellation
  INSERT INTO enterprise_shift_cancellations
    (workspace_id, assignment_id, user_id, office_id, shift_date, business_role, skill_ids)
  VALUES
    (v_assign.workspace_id, _assignment_id, v_assign.user_id, v_assign.office_id,
     v_assign.shift_date, v_assign.business_role,
     CASE WHEN v_assign.skill_id IS NOT NULL THEN ARRAY[v_assign.skill_id] ELSE '{}' END)
  RETURNING id INTO v_cancel_id;

  -- Delete the assignment
  DELETE FROM enterprise_shift_assignments WHERE id = _assignment_id;

  -- Check if there's an existing open_shift_request for this slot to reopen
  SELECT id INTO v_req_id FROM enterprise_open_shift_requests
  WHERE workspace_id = v_assign.workspace_id
    AND office_id = v_assign.office_id
    AND shift_date = v_assign.shift_date
    AND status = 'filled'
    AND filled_by_user_id = v_assign.user_id
  LIMIT 1;

  IF v_req_id IS NOT NULL THEN
    -- Re-open the original request
    UPDATE enterprise_open_shift_requests
    SET status = 'open', filled_by_user_id = NULL, filled_at = NULL,
        respond_by_at = now() + (timeout_hours || ' hours')::interval,
        updated_at = now()
    WHERE id = v_req_id;
  ELSE
    -- Create a new replacement request
    SELECT id INTO v_req_id FROM public.create_open_shift_request(
      v_assign.workspace_id, v_assign.office_id, v_assign.shift_date,
      v_assign.business_role, v_assign.skill_id,
      'Replacement needed — previous assignee cancelled.',
      NULL, '{}', 3, '{}'
    );
    -- Suppress the re-query; create_open_shift_request returns uuid directly
  END IF;

  -- Try first eligible waitlisted person
  SELECT w.* INTO v_wl FROM enterprise_open_shift_waitlist w
  WHERE w.request_id = v_req_id AND w.status = 'waiting'
  ORDER BY w.position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_wl.id IS NOT NULL THEN
    -- Notify the waitlisted person
    UPDATE enterprise_open_shift_waitlist
    SET status = 'notified' WHERE id = v_wl.id;

    INSERT INTO enterprise_notifications
      (workspace_id, user_id, event_type, title, message, related_type, related_id)
    VALUES
      (v_assign.workspace_id, v_wl.user_id, 'open_shift_broadcast',
       'Shift opening available',
       'A shift you waitlisted for on ' || v_assign.shift_date::text || ' is now open. Claim it now.',
       'open_shift_request', v_req_id);

    UPDATE enterprise_shift_cancellations
    SET replacement_found = true, replacement_user_id = v_wl.user_id
    WHERE id = v_cancel_id;
  ELSE
    -- No replacement found — notify managers
    INSERT INTO enterprise_notifications
      (workspace_id, user_id, event_type, title, message, related_type, related_id)
    SELECT
      v_assign.workspace_id, em.user_id, 'shift_no_replacement',
      'No replacement found',
      'No replacement found for the shift on ' || v_assign.shift_date::text ||
        ' at office ' || v_assign.office_id::text || '.',
      'shift_assignment', _assignment_id
    FROM enterprise_memberships em
    WHERE em.workspace_id = v_assign.workspace_id
      AND em.status = 'active'
      AND em.role IN ('owner'::enterprise_role, 'resourceAssistant'::enterprise_role);

    UPDATE enterprise_shift_cancellations
    SET notified_managers = true
    WHERE id = v_cancel_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_req_id,
    'replacement_found', (v_wl.id IS NOT NULL),
    'waitlist_notified', v_wl.user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_shift_assignment(uuid) TO authenticated;

-- ─── 7. ESCALATION PROCESSING FUNCTION ──────────────────────────────────────
-- Called by pg_cron every 15 minutes.
-- Finds expired open shift requests and sends to next eligible batch.
CREATE OR REPLACE FUNCTION public.process_open_shift_escalations()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req   enterprise_open_shift_requests%ROWTYPE;
  v_count int := 0;
  v_new_notified uuid[];
BEGIN
  FOR v_req IN
    SELECT * FROM enterprise_open_shift_requests
    WHERE status = 'open'
      AND respond_by_at IS NOT NULL
      AND respond_by_at < now()
      AND escalation_level < 5
    ORDER BY respond_by_at ASC
  LOOP
    -- Find next batch of eligible members not yet notified
    WITH next_batch AS (
      SELECT em.user_id
      FROM enterprise_memberships em
      WHERE em.workspace_id = v_req.workspace_id
        AND em.status = 'active'
        AND NOT (em.user_id = ANY(v_req.notified_user_ids))
        AND (
          v_req.business_role IS NULL OR em.business_role = v_req.business_role
          OR (array_length(v_req.skill_ids, 1) > 0
              AND EXISTS (
                SELECT 1 FROM enterprise_member_skills ms
                WHERE ms.membership_id = em.id AND ms.skill_id = ANY(v_req.skill_ids)
              ))
        )
      ORDER BY em.user_id
      LIMIT 5
    )
    INSERT INTO enterprise_notifications
      (workspace_id, user_id, event_type, title, message, related_type, related_id)
    SELECT
      v_req.workspace_id, nb.user_id, 'open_shift_broadcast',
      'Open shift still available',
      'An open shift on ' || v_req.shift_date::text || ' still needs filling.',
      'open_shift_request', v_req.id
    FROM next_batch nb;

    -- Update notified list + escalation level + new deadline
    SELECT array_agg(DISTINCT n.user_id) INTO v_new_notified
    FROM enterprise_notifications n
    WHERE n.related_id = v_req.id AND n.event_type = 'open_shift_broadcast';

    UPDATE enterprise_open_shift_requests
    SET escalation_level = escalation_level + 1,
        notified_user_ids = COALESCE(v_new_notified, notified_user_ids),
        respond_by_at = now() + (timeout_hours || ' hours')::interval,
        updated_at = now()
    WHERE id = v_req.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─── 8. REGISTER pg_cron JOB ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'open-shift-escalation',
      '*/15 * * * *',
      'SELECT public.process_open_shift_escalations()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- pg_cron may not be enabled in all environments
END;
$$;

-- ─── 9. i18n EVENT TYPE (shift_no_replacement) ───────────────────────────────
-- No schema change needed; enterprise_notifications.event_type is text.

-- ─── 10. INDEXES FOR NEW COLUMNS ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_eosr_role_id
  ON public.enterprise_open_shift_requests (workspace_id, role_id);

CREATE INDEX IF NOT EXISTS idx_eosr_skill_ids
  ON public.enterprise_open_shift_requests USING GIN (skill_ids);
