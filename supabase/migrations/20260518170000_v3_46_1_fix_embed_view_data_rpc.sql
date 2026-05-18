-- v3.46.1 — Fix get_embed_view_data: correct table name + full field set
-- v3.46.0 accidentally referenced `enterprise_coverage_rules` (does not exist)
-- instead of `enterprise_office_coverage_rules`, and omitted array fields.
-- This patch restores the correct function body.

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
  v_workspace_id uuid;
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

  v_workspace_id := v_token_row.workspace_id;

  UPDATE enterprise_embed_tokens SET last_used_at = now() WHERE id = v_token_row.id;

  RETURN jsonb_build_object(
    'workspace_id', v_workspace_id,
    'can_write',    v_token_row.can_write,

    'offices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'city', o.city)
                       ORDER BY o.name)
      FROM enterprise_offices o
      WHERE o.workspace_id = v_workspace_id
        AND o.is_active = true
    ), '[]'::jsonb),

    -- Return ALL columns via to_jsonb so EmbedCapacityView gets business_roles[],
    -- skill_ids[], days_of_week[], min_headcount, valid_from, valid_until, etc.
    'coverage_rules', COALESCE((
      SELECT jsonb_agg(to_jsonb(cr) ORDER BY cr.office_id, cr.created_at)
      FROM enterprise_office_coverage_rules cr
      WHERE cr.workspace_id = v_workspace_id
        AND cr.status = 'active'
    ), '[]'::jsonb),

    'shift_assignments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',            sa.id,
        'user_id',       sa.user_id,
        'membership_id', sa.membership_id,
        'office_id',     sa.office_id,
        'business_role', sa.business_role,
        'skill_id',      sa.skill_id,
        'shift_date',    sa.shift_date
      ) ORDER BY sa.shift_date)
      FROM enterprise_shift_assignments sa
      WHERE sa.workspace_id = v_workspace_id
        AND sa.shift_date BETWEEN _from_date AND _to_date
    ), '[]'::jsonb),

    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',       em.user_id,
        'display_name',  COALESCE(p.display_name, em.user_id::text),
        'business_role', em.business_role,
        'office_id',     em.office_id,
        'membership_id', em.id
      ) ORDER BY COALESCE(p.display_name, em.user_id::text))
      FROM enterprise_memberships em
      LEFT JOIN profiles p ON p.user_id = em.user_id
      WHERE em.workspace_id = v_workspace_id
        AND em.status = 'active'
    ), '[]'::jsonb),

    'holidays', COALESCE((
      SELECT jsonb_agg(h.holiday_date ORDER BY h.holiday_date)
      FROM enterprise_holidays h
      WHERE h.workspace_id = v_workspace_id
        AND h.holiday_date BETWEEN _from_date AND _to_date
    ), '[]'::jsonb),

    'blocked_dates', COALESCE((
      SELECT jsonb_agg(b.blocked_date ORDER BY b.blocked_date)
      FROM enterprise_blocked_dates b
      WHERE b.workspace_id = v_workspace_id
        AND b.blocked_date BETWEEN _from_date AND _to_date
    ), '[]'::jsonb),

    'leave_requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',    lr.user_id,
        'start_date', lr.start_date,
        'end_date',   lr.end_date
      ))
      FROM leave_requests lr
      JOIN enterprise_memberships em
        ON em.user_id = lr.user_id AND em.workspace_id = v_workspace_id
      WHERE lr.status = 'approved'
        AND lr.start_date <= _to_date
        AND lr.end_date   >= _from_date
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_embed_view_data(text, text, date, date) TO anon;

-- Fix embed_assign_shift: drop old signature (return type changed) then recreate.
DROP FUNCTION IF EXISTS public.embed_assign_shift(text, uuid, uuid, text, date, uuid);

CREATE FUNCTION public.embed_assign_shift(
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
  v_membership_id uuid;
  v_id uuid;
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

  IF NOT EXISTS (
    SELECT 1 FROM enterprise_offices
    WHERE id = _office_id AND workspace_id = v_token_row.workspace_id
  ) THEN
    RAISE EXCEPTION 'Office not found in workspace';
  END IF;

  -- Resolve membership_id
  SELECT id INTO v_membership_id
  FROM enterprise_memberships
  WHERE user_id = _user_id AND workspace_id = v_token_row.workspace_id AND status = 'active'
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'Member not found in workspace';
  END IF;

  INSERT INTO enterprise_shift_assignments
    (workspace_id, membership_id, user_id, office_id, business_role, shift_date, skill_id)
  VALUES
    (v_token_row.workspace_id, v_membership_id, _user_id, _office_id, _business_role, _shift_date, _skill_id)
  ON CONFLICT (workspace_id, user_id, shift_date) DO UPDATE
    SET office_id     = EXCLUDED.office_id,
        business_role = EXCLUDED.business_role,
        skill_id      = EXCLUDED.skill_id,
        membership_id = EXCLUDED.membership_id
  RETURNING id INTO v_id;

  UPDATE enterprise_embed_tokens SET last_used_at = now() WHERE id = v_token_row.id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.embed_assign_shift(text, uuid, uuid, text, date, uuid) TO anon;
