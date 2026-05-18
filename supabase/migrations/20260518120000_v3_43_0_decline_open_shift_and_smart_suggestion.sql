-- v3.43.0: Add decline_open_shift_invitation RPC
-- Allows an employee to decline a targeted open-shift invitation.
-- The shift stays open for others; the user is removed from notified/target lists
-- so they won't receive duplicate notifications.

-- Expand the status check constraint to include 'declined'
ALTER TABLE public.enterprise_open_shift_claims
  DROP CONSTRAINT IF EXISTS enterprise_open_shift_claims_status_check;
ALTER TABLE public.enterprise_open_shift_claims
  ADD CONSTRAINT enterprise_open_shift_claims_status_check
  CHECK (status IN ('claimed', 'superseded', 'declined'));

-- RPC: employee declines a shift invitation they were targeted/notified for
CREATE OR REPLACE FUNCTION public.decline_open_shift_invitation(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req enterprise_open_shift_requests%ROWTYPE;
  v_mem enterprise_memberships%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_req
  FROM enterprise_open_shift_requests
  WHERE id = _request_id;

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

  -- Record the decline (upsert — idempotent if they somehow already had a claim row)
  INSERT INTO enterprise_open_shift_claims (request_id, membership_id, user_id, status)
  VALUES (_request_id, v_mem.id, v_uid, 'declined')
  ON CONFLICT (request_id, user_id) DO UPDATE SET status = 'declined';

  -- Remove from notification lists so they don't get future notifications for this request
  UPDATE enterprise_open_shift_requests
  SET
    notified_user_ids = array_remove(notified_user_ids, v_uid),
    target_user_ids   = array_remove(target_user_ids, v_uid),
    updated_at        = now()
  WHERE id = _request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_open_shift_invitation(uuid) TO authenticated;
