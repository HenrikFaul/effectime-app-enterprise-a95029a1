-- v3.50.0 — Enrich get_embed_view_data for the embedded Calendar (timeline) + Smart-schedule wizard
--
-- Purely ADDITIVE / backward-compatible. Existing consumers keep working:
--   • Every previously-returned key keeps the same name and shape.
--   • New keys/fields are appended; old fields are unchanged.
--
-- What is added and why:
--   members[]            +team, +city, +weekly_capacity_hours, +base_working_hours,
--                        +skills[{skill_id,level}], +site_priorities[{office_id,priority}]
--                        → lets the embed run the SAME eligibility/ranking engine
--                          (lib/coverageEligibility) as the native Smart-batch wizard,
--                          and powers the calendar filters (team / skill / location).
--   leave_requests[]     +leave_type, +status   (now returns approved AND pending)
--                        → calendar colour-codes by leave type and shows the
--                          approved(emerald)/pending(amber) status dot, like the native
--                          TimelineView. Read-side consumers that only want approved
--                          leaves must filter on `status` (EmbedMemberScheduleView does).
--   leave_types[]        {id,name,color}   → calendar "Szabadság típusa" filter options.
--   skills[]             {id,name}         → calendar "Képesség / Skill" filter options.
--
-- The function stays SECURITY DEFINER and token-gated exactly as before.

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

    -- Enriched member rows. The extra fields drive the calendar filters and let the
    -- embed reuse the native eligibility engine inside the Smart-schedule wizard.
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',               em.user_id,
        'display_name',          COALESCE(p.display_name, em.user_id::text),
        'business_role',         em.business_role,
        'office_id',             em.office_id,
        'membership_id',         em.id,
        'team',                  em.team,
        'city',                  em.city,
        'weekly_capacity_hours', em.weekly_capacity_hours,
        'base_working_hours',    em.base_working_hours,
        'skills', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('skill_id', ms.skill_id, 'level', ms.level))
          FROM enterprise_member_skills ms
          WHERE ms.membership_id = em.id
            AND ms.workspace_id  = v_workspace_id
        ), '[]'::jsonb),
        'site_priorities', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('office_id', sp.office_id, 'priority', sp.priority))
          FROM enterprise_member_site_priorities sp
          WHERE sp.membership_id = em.id
            AND sp.workspace_id  = v_workspace_id
        ), '[]'::jsonb)
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

    -- Now returns approved + pending and carries leave_type + status.
    -- (Previously: approved only, no type/status.) Calendar uses both states;
    -- approved-only consumers must filter on `status`.
    'leave_requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',    lr.user_id,
        'start_date', lr.start_date,
        'end_date',   lr.end_date,
        'leave_type', lr.leave_type,
        'status',     lr.status
      ))
      FROM leave_requests lr
      WHERE lr.workspace_id = v_workspace_id
        AND lr.status IN ('approved', 'pending')
        AND lr.start_date <= _to_date
        AND lr.end_date   >= _from_date
    ), '[]'::jsonb),

    -- Filter-option sources for the embedded calendar.
    'leave_types', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', lt.id, 'name', lt.name, 'color', lt.color)
                       ORDER BY lt.name)
      FROM enterprise_leave_types lt
      WHERE lt.workspace_id = v_workspace_id
        AND lt.is_active = true
    ), '[]'::jsonb),

    'skills', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
      FROM enterprise_skills s
      WHERE s.workspace_id = v_workspace_id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_embed_view_data(text, text, date, date) TO anon;
