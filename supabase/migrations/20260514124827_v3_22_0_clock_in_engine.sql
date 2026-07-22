-- v3.22.0 — GPS / NFC / QR Clock-In engine (Top-20 Rank 10)
-- Mobile attendance verification: replaces physical time-clock hardware.
-- All clock events are append-only; RLS scopes reads to self / managers /
-- admins; writes are SECURITY DEFINER RPCs only.

-- ── 1. Geofence config on offices ───────────────────────────────────────────
ALTER TABLE public.enterprise_offices
  ADD COLUMN IF NOT EXISTS geofence_lat numeric,
  ADD COLUMN IF NOT EXISTS geofence_lng numeric,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS clock_in_nfc_tag text;

-- ── 2. Clock events log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clock_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id  uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  event_type     text NOT NULL CHECK (event_type IN ('clock_in','clock_out')),
  method         text NOT NULL CHECK (method IN ('gps','nfc','qr','manual')),
  office_id      uuid REFERENCES public.enterprise_offices(id) ON DELETE SET NULL,
  latitude       numeric,
  longitude      numeric,
  distance_m     numeric,                       -- distance from geofence center if gps
  verified       boolean NOT NULL DEFAULT false,
  raw_data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clock_events_workspace_time
  ON public.clock_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clock_events_membership_time
  ON public.clock_events (membership_id, created_at DESC);

ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clock_events_read ON public.clock_events;
CREATE POLICY clock_events_read
  ON public.clock_events FOR SELECT TO authenticated
  USING (
    membership_id IN (SELECT id FROM public.enterprise_memberships WHERE user_id = auth.uid())
    OR public.has_enterprise_role(workspace_id, auth.uid(),
        ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS clock_events_no_direct_write ON public.clock_events;
CREATE POLICY clock_events_no_direct_write
  ON public.clock_events FOR INSERT TO authenticated WITH CHECK (false);

-- ── 3. Rotating QR sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qr_clock_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   uuid NOT NULL REFERENCES public.enterprise_offices(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  code        text NOT NULL,                   -- random rotating code
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_sessions_office_expires
  ON public.qr_clock_sessions (office_id, expires_at DESC);

ALTER TABLE public.qr_clock_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_sessions_read ON public.qr_clock_sessions;
CREATE POLICY qr_sessions_read ON public.qr_clock_sessions FOR SELECT TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(),
          ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS qr_sessions_no_direct_write ON public.qr_clock_sessions;
CREATE POLICY qr_sessions_no_direct_write ON public.qr_clock_sessions FOR INSERT TO authenticated WITH CHECK (false);

-- ── 4. Haversine distance helper (km) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ))
$$;

-- ── 5. Generate a rotating QR code (manager only) ───────────────────────────
CREATE OR REPLACE FUNCTION public.clock_generate_qr(
  _office_id uuid,
  _ttl_seconds integer DEFAULT 60
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_caller    uuid;
  v_workspace uuid;
  v_code      text;
  v_session_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT workspace_id INTO v_workspace FROM public.enterprise_offices WHERE id = _office_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'Office not found'; END IF;

  IF NOT public.has_enterprise_role(v_workspace, v_caller,
       ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]) THEN
    RAISE EXCEPTION 'Forbidden: manager role required';
  END IF;

  v_code := encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.qr_clock_sessions (office_id, workspace_id, code, created_by, expires_at)
  VALUES (_office_id, v_workspace, v_code, v_caller, now() + (COALESCE(_ttl_seconds, 60) || ' seconds')::interval)
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('ok', true, 'session_id', v_session_id, 'code', v_code,
                            'expires_at', now() + (COALESCE(_ttl_seconds, 60) || ' seconds')::interval);
END;
$$;
REVOKE ALL ON FUNCTION public.clock_generate_qr(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clock_generate_qr(uuid, integer) TO authenticated;

-- ── 6. Clock-in/out RPC ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clock_event(
  _workspace_id uuid,
  _event_type   text,                            -- clock_in | clock_out
  _method       text,                            -- gps | nfc | qr | manual
  _latitude     numeric DEFAULT NULL,
  _longitude    numeric DEFAULT NULL,
  _qr_code      text    DEFAULT NULL,
  _nfc_tag      text    DEFAULT NULL,
  _office_id    uuid    DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  IF v_membership_id IS NULL THEN RAISE EXCEPTION 'Not an active member of this workspace'; END IF;

  -- Method validation
  IF _method = 'gps' THEN
    IF _latitude IS NULL OR _longitude IS NULL THEN
      RAISE EXCEPTION 'GPS clock-in requires latitude+longitude';
    END IF;
    -- Find any office in this workspace whose geofence contains the point
    SELECT o.id, o.geofence_radius_m, o.geofence_lat, o.geofence_lng,
           public.haversine_km(o.geofence_lat, o.geofence_lng, _latitude, _longitude) * 1000
      INTO v_office_id, v_radius, v_office_lat, v_office_lng, v_distance
      FROM public.enterprise_offices o
      WHERE o.workspace_id = _workspace_id
        AND o.geofence_lat IS NOT NULL AND o.geofence_lng IS NOT NULL
      ORDER BY public.haversine_km(o.geofence_lat, o.geofence_lng, _latitude, _longitude) ASC
      LIMIT 1;
    IF v_office_id IS NOT NULL AND v_distance <= COALESCE(v_radius, 150) THEN
      v_verified := true;
    END IF;

  ELSIF _method = 'qr' THEN
    IF _qr_code IS NULL THEN RAISE EXCEPTION 'QR clock-in requires qr_code'; END IF;
    SELECT office_id INTO v_office_id FROM public.qr_clock_sessions
     WHERE workspace_id = _workspace_id AND code = _qr_code AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1;
    v_verified := v_office_id IS NOT NULL;

  ELSIF _method = 'nfc' THEN
    IF _nfc_tag IS NULL THEN RAISE EXCEPTION 'NFC clock-in requires nfc_tag'; END IF;
    SELECT id INTO v_office_id FROM public.enterprise_offices
     WHERE workspace_id = _workspace_id AND clock_in_nfc_tag = _nfc_tag LIMIT 1;
    v_verified := v_office_id IS NOT NULL;

  ELSIF _method = 'manual' THEN
    -- Manual entry is unverified by definition; manager can review later.
    v_verified := false;
  END IF;

  IF _method <> 'manual' AND NOT v_verified THEN
    RAISE EXCEPTION 'Clock-in could not be verified (method=% — check location, QR code, or NFC tag)', _method;
  END IF;

  INSERT INTO public.clock_events
    (workspace_id, membership_id, event_type, method, office_id,
     latitude, longitude, distance_m, verified, raw_data)
  VALUES (_workspace_id, v_membership_id, _event_type, _method, v_office_id,
          _latitude, _longitude, v_distance, v_verified,
          jsonb_build_object('qr', _qr_code IS NOT NULL, 'nfc', _nfc_tag IS NOT NULL))
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'verified', v_verified,
    'office_id', v_office_id,
    'distance_m', v_distance
  );
END;
$$;
REVOKE ALL ON FUNCTION public.clock_event(uuid, text, text, numeric, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clock_event(uuid, text, text, numeric, numeric, text, text, uuid) TO authenticated;

-- ── 7. Feature catalog refresh ──────────────────────────────────────────────
INSERT INTO public.features (feature_key, name, module, description, status, dependencies, route_path, menu_path, sort_order)
VALUES
  ('clock_in_gps', 'GPS clock-in', 'attendance',
   'Geofenced GPS-based clock-in/out with server-side anti-spoofing',
   'active', ARRAY['attendance_log']::text[], '/w/:workspaceId', ARRAY['My Portal','Clock in']::text[], 1100),
  ('clock_in_qr', 'QR clock-in', 'attendance',
   'Rotating 60-second QR codes generated by site managers; scanned by employees',
   'active', ARRAY['attendance_log']::text[], '/w/:workspaceId', ARRAY['My Portal','Clock in']::text[], 1110),
  ('clock_in_nfc', 'NFC clock-in', 'attendance',
   'NFC tag tap-to-clock-in; one NFC tag per office entrance',
   'active', ARRAY['attendance_log']::text[], '/w/:workspaceId', ARRAY['My Portal','Clock in']::text[], 1120),
  ('clock_in_board', 'Live attendance board', 'attendance',
   'Real-time who-is-clocked-in board per site (manager view)',
   'active', ARRAY['clock_in_gps','clock_in_qr','clock_in_nfc']::text[], '/w/:workspaceId', ARRAY['Time & Attendance','Live board']::text[], 1130)
ON CONFLICT (feature_key) DO UPDATE
  SET route_path = EXCLUDED.route_path, menu_path = EXCLUDED.menu_path,
      module = EXCLUDED.module, description = EXCLUDED.description,
      dependencies = EXCLUDED.dependencies;

WITH t AS (SELECT id FROM public.tiers WHERE tier_key IN ('pro','enterprise')),
     f AS (SELECT id FROM public.features WHERE feature_key IN ('clock_in_gps','clock_in_qr','clock_in_nfc','clock_in_board'))
INSERT INTO public.tier_features (tier_id, feature_id) SELECT t.id, f.id FROM t, f
ON CONFLICT DO NOTHING;;
