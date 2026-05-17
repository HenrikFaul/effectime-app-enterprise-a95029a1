-- cancel_open_shift_request: owner/resourceAssistant can cancel an open broadcast
CREATE OR REPLACE FUNCTION public.cancel_open_shift_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_req  enterprise_open_shift_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM enterprise_open_shift_requests
  WHERE id = _request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT public.has_enterprise_role(v_req.workspace_id, v_uid,
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_req.status <> 'open' THEN
    RAISE EXCEPTION 'not_open';
  END IF;

  UPDATE enterprise_open_shift_requests
  SET status = 'cancelled'
  WHERE id = _request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_open_shift_request(uuid) TO authenticated;
