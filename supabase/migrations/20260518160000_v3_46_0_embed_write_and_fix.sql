-- v3.46.0 — Embed write support + gen_random_bytes fix
-- Applied 2026-05-18

-- 1. Add can_write column to embed tokens
ALTER TABLE public.enterprise_embed_tokens
  ADD COLUMN IF NOT EXISTS can_write boolean NOT NULL DEFAULT false;

-- 2. Fix create_embed_token — use extensions.gen_random_bytes (search_path = public hides the extensions schema)
CREATE OR REPLACE FUNCTION public.create_embed_token(
  _workspace_id uuid,
  _label        text,
  _allowed_views text[]     DEFAULT '{capacity_planner}',
  _expires_at   timestamptz DEFAULT NULL,
  _can_write    boolean     DEFAULT false
)
RETURNS TABLE (id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_id    uuid;
BEGIN
  IF NOT has_enterprise_role(_workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO enterprise_embed_tokens
    (workspace_id, label, token, allowed_views, expires_at, can_write)
  VALUES
    (_workspace_id, _label, v_token, _allowed_views, _expires_at, _can_write)
  RETURNING enterprise_embed_tokens.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_embed_token(uuid, text, text[], timestamptz, boolean) TO authenticated;

-- 3. Update get_embed_view_data to return can_write + membership_id in members array
CREATE OR REPLACE FUNCTION public.get_embed_view_data(
  _token     text,
  _view      text,
  _from_date date,
  _to_date   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row enterprise_embed_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token_row
  FROM enterprise_embed_tokens
  WHERE token = _token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired embed token';
  END IF;

  IF NOT (_view = ANY(v_token_row.allowed_views)) THEN
    RAISE EXCEPTION 'View % not allowed for this token', _view;
  END IF;

  -- Update last_used_at
  UPDATE enterprise_embed_tokens SET last_used_at = now() WHERE id = v_token_row.id;

  RETURN jsonb_build_object(
    'workspace_id', v_token_row.workspace_id,
    'can_write',    v_token_row.can_write,
    'offices', (
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'city', o.city))
      FROM enterprise_offices o
      WHERE o.workspace_id = v_token_row.workspace_id AND o.is_active = true
    ),
    'coverage_rules', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', cr.id, 'office_id', cr.office_id,
        'business_role', cr.business_role,
        'required_count', cr.required_count,
        'skill_id', cr.skill_id
      ))
      FROM enterprise_coverage_rules cr
      JOIN enterprise_offices o ON o.id = cr.office_id
      WHERE o.workspace_id = v_token_row.workspace_id
    ),
    'shift_assignments', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', sa.id,
        'user_id', sa.user_id,
        'office_id', sa.office_id,
        'business_role', sa.business_role,
        'shift_date', sa.shift_date
      ))
      FROM enterprise_shift_assignments sa
      JOIN enterprise_offices o ON o.id = sa.office_id
      WHERE o.workspace_id = v_token_row.workspace_id
        AND sa.shift_date BETWEEN _from_date AND _to_date
    ),
    'members', (
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',       em.user_id,
        'display_name',  COALESCE(p.display_name, em.user_id::text),
        'business_role', em.business_role,
        'office_id',     em.office_id,
        'membership_id', em.id
      ))
      FROM enterprise_memberships em
      LEFT JOIN profiles p ON p.user_id = em.user_id
      WHERE em.workspace_id = v_token_row.workspace_id
        AND em.status = 'active'
    ),
    'holidays', (
      SELECT jsonb_agg(h.holiday_date::text)
      FROM enterprise_holidays h
      WHERE h.workspace_id = v_token_row.workspace_id
        AND h.holiday_date BETWEEN _from_date AND _to_date
    ),
    'blocked_dates', (
      SELECT jsonb_agg(bd.blocked_date::text)
      FROM enterprise_blocked_dates bd
      WHERE bd.workspace_id = v_token_row.workspace_id
        AND bd.blocked_date BETWEEN _from_date AND _to_date
    ),
    'leave_requests', (
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',    lr.user_id,
        'start_date', lr.start_date,
        'end_date',   lr.end_date
      ))
      FROM enterprise_leave_requests lr
      JOIN enterprise_memberships em ON em.user_id = lr.user_id AND em.workspace_id = v_token_row.workspace_id
      WHERE lr.status = 'approved'
        AND lr.start_date <= _to_date AND lr.end_date >= _from_date
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_embed_view_data(text, text, date, date) TO anon;

-- 4. embed_assign_shift — anon-callable, validates token + can_write
CREATE OR REPLACE FUNCTION public.embed_assign_shift(
  _token         text,
  _user_id       uuid,
  _office_id     uuid,
  _business_role text,
  _shift_date    date,
  _skill_id      uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row enterprise_embed_tokens%ROWTYPE;
  v_id        uuid;
BEGIN
  SELECT * INTO v_token_row
  FROM enterprise_embed_tokens
  WHERE token = _token
    AND is_active = true
    AND can_write = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token or write not permitted';
  END IF;

  -- Verify office belongs to workspace
  IF NOT EXISTS (
    SELECT 1 FROM enterprise_offices
    WHERE id = _office_id AND workspace_id = v_token_row.workspace_id
  ) THEN
    RAISE EXCEPTION 'Office not found in workspace';
  END IF;

  INSERT INTO enterprise_shift_assignments
    (user_id, office_id, business_role, shift_date, skill_id, workspace_id)
  VALUES
    (_user_id, _office_id, _business_role, _shift_date, _skill_id, v_token_row.workspace_id)
  ON CONFLICT (user_id, shift_date) DO UPDATE
    SET office_id = EXCLUDED.office_id,
        business_role = EXCLUDED.business_role,
        skill_id = EXCLUDED.skill_id
  RETURNING id INTO v_id;

  UPDATE enterprise_embed_tokens SET last_used_at = now() WHERE id = v_token_row.id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.embed_assign_shift(text, uuid, uuid, text, date, uuid) TO anon;

-- 5. embed_remove_shift — anon-callable, validates token + can_write
CREATE OR REPLACE FUNCTION public.embed_remove_shift(
  _token         text,
  _assignment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row enterprise_embed_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token_row
  FROM enterprise_embed_tokens
  WHERE token = _token
    AND is_active = true
    AND can_write = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token or write not permitted';
  END IF;

  DELETE FROM enterprise_shift_assignments sa
  USING enterprise_offices o
  WHERE sa.id = _assignment_id
    AND sa.office_id = o.id
    AND o.workspace_id = v_token_row.workspace_id;

  UPDATE enterprise_embed_tokens SET last_used_at = now() WHERE id = v_token_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.embed_remove_shift(text, uuid) TO anon;
