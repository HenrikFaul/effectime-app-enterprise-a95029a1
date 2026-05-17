-- v3.41.0: Fix claim_open_shift — add explicit already_assigned guard,
-- remove silent DO NOTHING from shift_assignments INSERT (was masking conflicts
-- when a user had an existing assignment on the same date).
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

  SELECT * INTO v_mem
  FROM enterprise_memberships
  WHERE workspace_id = v_req.workspace_id
    AND user_id = v_uid
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  -- Explicit already-assigned guard: prevents silent DO NOTHING hiding the conflict
  IF EXISTS (
    SELECT 1 FROM enterprise_shift_assignments
    WHERE workspace_id = v_req.workspace_id
      AND user_id = v_uid
      AND shift_date = v_req.shift_date
  ) THEN
    RAISE EXCEPTION 'already_assigned';
  END IF;

  INSERT INTO enterprise_open_shift_claims (request_id, membership_id, user_id, status)
  VALUES (_request_id, v_mem.id, v_uid, 'claimed')
  ON CONFLICT (request_id, user_id) DO NOTHING;

  INSERT INTO enterprise_shift_assignments
    (workspace_id, membership_id, user_id, office_id, business_role, skill_id, shift_date, created_by)
  VALUES
    (v_req.workspace_id, v_mem.id, v_uid, v_req.office_id,
     v_req.business_role, v_req.skill_id, v_req.shift_date, v_uid)
  RETURNING id INTO v_assign_id;

  UPDATE enterprise_open_shift_requests
  SET status = 'filled', filled_by_user_id = v_uid, filled_at = now(), updated_at = now()
  WHERE id = _request_id;

  UPDATE enterprise_open_shift_claims
  SET status = 'superseded'
  WHERE request_id = _request_id AND user_id <> v_uid AND status = 'claimed';

  INSERT INTO enterprise_notifications
    (workspace_id, user_id, event_type, title, message, related_type, related_id)
  VALUES
    (v_req.workspace_id, v_uid, 'shift_assigned',
     'Shift confirmed',
     'You claimed and were assigned to the open shift on ' || v_req.shift_date::text || '.',
     'open_shift_request', _request_id);

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
    AND em.role IN ('owner'::enterprise_role, 'resourceAssistant'::enterprise_role)
    AND em.user_id <> v_uid;

  RETURN jsonb_build_object('ok', true, 'assignment_id', v_assign_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_open_shift(uuid) TO authenticated;
