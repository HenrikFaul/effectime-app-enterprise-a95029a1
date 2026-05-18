-- v3.45.0 — Embed SDK: generic multi-view RPC + member display names

-- Generic RPC: replaces capacity-planner-specific variant for new embeds.
-- Old get_embed_capacity_planner_data stays for backward compat.
CREATE OR REPLACE FUNCTION public.get_embed_view_data(
  _token     text,
  _view      text,   -- 'capacity_planner' | 'shift_roster'
  _from_date date,
  _to_date   date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_result       jsonb;
BEGIN
  -- Validate token (must be active, not expired, and allow this view)
  SELECT workspace_id INTO v_workspace_id
  FROM enterprise_embed_tokens
  WHERE token = _token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND _view = ANY(allowed_views);

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired embed token';
  END IF;

  UPDATE enterprise_embed_tokens SET last_used_at = now() WHERE token = _token;

  SELECT jsonb_build_object(
    'workspace_id', v_workspace_id,

    'offices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'city', o.city)
                       ORDER BY o.name)
      FROM enterprise_offices o
      WHERE o.workspace_id = v_workspace_id
    ), '[]'::jsonb),

    'coverage_rules', COALESCE((
      SELECT jsonb_agg(to_jsonb(cr))
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
        AND sa.shift_date >= _from_date
        AND sa.shift_date <= _to_date
    ), '[]'::jsonb),

    -- Member display names for roster view
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',       em.user_id,
        'display_name',  COALESCE(p.display_name, em.user_id::text),
        'business_role', em.business_role,
        'office_id',     em.office_id
      ) ORDER BY COALESCE(p.display_name, p.full_name, ''))
      FROM enterprise_memberships em
      LEFT JOIN profiles p ON p.user_id = em.user_id
      WHERE em.workspace_id = v_workspace_id
        AND em.status = 'active'
    ), '[]'::jsonb),

    'holidays', COALESCE((
      SELECT jsonb_agg(h.holiday_date ORDER BY h.holiday_date)
      FROM enterprise_holidays h
      WHERE h.workspace_id = v_workspace_id
        AND h.holiday_date >= _from_date
        AND h.holiday_date <= _to_date
    ), '[]'::jsonb),

    'blocked_dates', COALESCE((
      SELECT jsonb_agg(b.blocked_date ORDER BY b.blocked_date)
      FROM enterprise_blocked_dates b
      WHERE b.workspace_id = v_workspace_id
        AND b.blocked_date >= _from_date
        AND b.blocked_date <= _to_date
    ), '[]'::jsonb),

    'leave_requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',    lr.user_id,
        'start_date', lr.start_date,
        'end_date',   lr.end_date,
        'status',     lr.status
      ))
      FROM leave_requests lr
      WHERE lr.workspace_id = v_workspace_id
        AND lr.status IN ('approved', 'pending')
        AND lr.start_date <= _to_date
        AND lr.end_date   >= _from_date
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_embed_view_data(text, text, date, date) TO anon;
