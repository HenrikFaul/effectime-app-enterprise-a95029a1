-- v3.39.1 Fix: clock_event — relax GPS/QR/NFC verification for clock_out
-- Clock-out should never be blocked by geofence/QR/NFC mismatch:
-- employees often clock out after leaving the premises.
-- Only clock_in requires strict location verification.

CREATE OR REPLACE FUNCTION public.clock_event(
  _workspace_id uuid,
  _event_type   text,
  _method       text,
  _latitude     numeric DEFAULT NULL,
  _longitude    numeric DEFAULT NULL,
  _qr_code      text    DEFAULT NULL,
  _nfc_tag      text    DEFAULT NULL,
  _office_id    uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid;
  v_membership_id uuid;
  v_verified      boolean := false;
  v_distance      numeric;
  v_office_id     uuid := _office_id;
  v_radius        integer;
  v_office_lat    numeric;
  v_office_lng    numeric;
  v_event_id      uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF _event_type NOT IN ('clock_in','clock_out') THEN
    RAISE EXCEPTION 'event_type must be clock_in or clock_out';
  END IF;
  IF _method NOT IN ('gps','nfc','qr','manual') THEN
    RAISE EXCEPTION 'method must be one of gps,nfc,qr,manual';
  END IF;

  SELECT id INTO v_membership_id FROM public.enterprise_memberships
   WHERE user_id = v_caller AND workspace_id = _workspace_id AND status = 'active';
  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'Not an active member of this workspace';
  END IF;

  -- Method-based verification (best-effort; clock_out does not hard-fail on mismatch)
  IF _method = 'gps' THEN
    IF _latitude IS NULL OR _longitude IS NULL THEN
      RAISE EXCEPTION 'GPS clock requires latitude+longitude';
    END IF;
    SELECT o.id, o.geofence_radius_m, o.geofence_lat, o.geofence_lng,
           public.haversine_km(o.geofence_lat, o.geofence_lng, _latitude, _longitude) * 1000
      INTO v_office_id, v_radius, v_office_lat, v_office_lng, v_distance
      FROM public.enterprise_offices o
      WHERE o.workspace_id = _workspace_id
        AND o.geofence_lat IS NOT NULL
        AND o.geofence_lng IS NOT NULL
      ORDER BY public.haversine_km(o.geofence_lat, o.geofence_lng, _latitude, _longitude) ASC
      LIMIT 1;
    IF v_office_id IS NOT NULL AND v_distance <= COALESCE(v_radius, 150) THEN
      v_verified := true;
    END IF;

  ELSIF _method = 'qr' THEN
    IF _qr_code IS NULL THEN RAISE EXCEPTION 'QR clock requires qr_code'; END IF;
    SELECT office_id INTO v_office_id FROM public.qr_clock_sessions
     WHERE workspace_id = _workspace_id AND code = _qr_code AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1;
    v_verified := v_office_id IS NOT NULL;

  ELSIF _method = 'nfc' THEN
    IF _nfc_tag IS NULL THEN RAISE EXCEPTION 'NFC clock requires nfc_tag'; END IF;
    SELECT id INTO v_office_id FROM public.enterprise_offices
     WHERE workspace_id = _workspace_id AND clock_in_nfc_tag = _nfc_tag LIMIT 1;
    v_verified := v_office_id IS NOT NULL;

  ELSIF _method = 'manual' THEN
    v_verified := false;
  END IF;

  -- Only block on verification failure for clock_in.
  -- clock_out is recorded as unverified when the check does not pass —
  -- employees legitimately clock out after leaving the geofenced area.
  IF _event_type = 'clock_in' AND _method <> 'manual' AND NOT v_verified THEN
    RAISE EXCEPTION 'Clock-in could not be verified (method=% — check location, QR code, or NFC tag)', _method;
  END IF;

  INSERT INTO public.clock_events
    (workspace_id, membership_id, event_type, method, office_id,
     latitude, longitude, distance_m, verified, raw_data)
  VALUES
    (_workspace_id, v_membership_id, _event_type, _method, v_office_id,
     _latitude, _longitude, v_distance, v_verified,
     jsonb_build_object('qr', _qr_code IS NOT NULL, 'nfc', _nfc_tag IS NOT NULL))
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok',        true,
    'event_id',  v_event_id,
    'verified',  v_verified,
    'office_id', v_office_id,
    'distance_m', v_distance
  );
END;
$$;
