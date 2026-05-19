-- v3.47.0 — Embed SDK: check_member_availability + get_team_headcount RPCs
-- These are token-gated, anonymously callable functions for CRM API integrations.
-- They complement the iframe embed views with lightweight JSON API calls.

-- ─── check_member_availability ────────────────────────────────────────────────
-- Returns: 'in_office' | 'on_leave' | 'not_scheduled' | 'not_found'
-- Usage: SELECT public.check_member_availability(_token, _user_id, _date);

CREATE FUNCTION public.check_member_availability(
  _token   text,
  _user_id uuid,
  _date    date
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row enterprise_embed_tokens%ROWTYPE;
  v_wid       uuid;
BEGIN
  SELECT * INTO v_token_row
  FROM enterprise_embed_tokens
  WHERE token = _token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired embed token';
  END IF;

  v_wid := v_token_row.workspace_id;

  -- Member must be active in this workspace
  IF NOT EXISTS (
    SELECT 1 FROM enterprise_memberships
    WHERE user_id = _user_id AND workspace_id = v_wid AND status = 'active'
  ) THEN
    RETURN 'not_found';
  END IF;

  -- On approved leave?
  IF EXISTS (
    SELECT 1
    FROM leave_requests lr
    JOIN enterprise_memberships em
      ON em.user_id = lr.user_id AND em.workspace_id = v_wid
    WHERE lr.user_id = _user_id
      AND lr.status  = 'approved'
      AND lr.start_date <= _date
      AND lr.end_date   >= _date
  ) THEN
    RETURN 'on_leave';
  END IF;

  -- Assigned to a shift (in office)?
  IF EXISTS (
    SELECT 1
    FROM enterprise_shift_assignments
    WHERE user_id       = _user_id
      AND workspace_id  = v_wid
      AND shift_date    = _date
  ) THEN
    RETURN 'in_office';
  END IF;

  RETURN 'not_scheduled';
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_member_availability(text, uuid, date) TO anon;

-- ─── get_team_headcount ───────────────────────────────────────────────────────
-- Returns per-office headcount vs. required for the requested date range.
-- Useful for dashboard widgets / CRM automation triggers.

CREATE FUNCTION public.get_team_headcount(
  _token      text,
  _from_date  date DEFAULT CURRENT_DATE,
  _to_date    date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row enterprise_embed_tokens%ROWTYPE;
  v_wid       uuid;
BEGIN
  SELECT * INTO v_token_row
  FROM enterprise_embed_tokens
  WHERE token = _token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired embed token';
  END IF;

  v_wid := v_token_row.workspace_id;

  UPDATE enterprise_embed_tokens SET last_used_at = now() WHERE id = v_token_row.id;

  RETURN jsonb_build_object(
    'from_date', _from_date,
    'to_date',   _to_date,

    'offices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'city', o.city) ORDER BY o.name)
      FROM enterprise_offices o
      WHERE o.workspace_id = v_wid
    ), '[]'::jsonb),

    -- All active rules (needed to compute required headcount per day)
    'coverage_rules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',           cr.id,
        'office_id',    cr.office_id,
        'min_headcount',cr.min_headcount,
        'days_of_week', cr.days_of_week,
        'rule_date',    cr.rule_date,
        'valid_from',   cr.valid_from,
        'valid_until',  cr.valid_until
      ) ORDER BY cr.office_id)
      FROM enterprise_office_coverage_rules cr
      WHERE cr.workspace_id = v_wid AND cr.status = 'active'
    ), '[]'::jsonb),

    -- Actual assignments in the range (only office_id + shift_date needed)
    'shift_assignments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'office_id',  sa.office_id,
        'shift_date', sa.shift_date
      ) ORDER BY sa.shift_date)
      FROM enterprise_shift_assignments sa
      WHERE sa.workspace_id = v_wid
        AND sa.shift_date BETWEEN _from_date AND _to_date
    ), '[]'::jsonb),

    -- Holidays in range (affect staffing expectations)
    'holidays', COALESCE((
      SELECT jsonb_agg(h.holiday_date ORDER BY h.holiday_date)
      FROM enterprise_holidays h
      WHERE h.workspace_id = v_wid
        AND h.holiday_date BETWEEN _from_date AND _to_date
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_headcount(text, date, date) TO anon;
