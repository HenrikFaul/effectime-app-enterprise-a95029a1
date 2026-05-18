-- v3.44.0 — Embed SDK: iframe embed token system for third-party CRM integration

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enterprise_embed_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  label        text        NOT NULL,
  token        text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  allowed_views text[]     NOT NULL DEFAULT '{capacity_planner}',
  is_active    boolean     NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_embed_tokens ENABLE ROW LEVEL SECURITY;

-- Workspace admins can manage their own embed tokens
CREATE POLICY "workspace_owners_manage_embed_tokens"
  ON public.enterprise_embed_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.enterprise_memberships em
      WHERE em.workspace_id = enterprise_embed_tokens.workspace_id
        AND em.user_id = auth.uid()
        AND em.role = 'owner'
        AND em.status = 'active'
    )
  );

-- ── 2. RPC: create_embed_token ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_embed_token(
  _workspace_id  uuid,
  _label         text,
  _allowed_views text[]      DEFAULT '{capacity_planner}',
  _expires_at    timestamptz DEFAULT NULL
)
RETURNS TABLE (id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token text;
  v_id    uuid;
BEGIN
  IF NOT has_enterprise_role(_workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO enterprise_embed_tokens(workspace_id, created_by, label, token, allowed_views, expires_at)
  VALUES (_workspace_id, auth.uid(), _label, v_token, _allowed_views, _expires_at)
  RETURNING enterprise_embed_tokens.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

-- ── 3. RPC: revoke_embed_token ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_embed_token(_token_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE enterprise_embed_tokens
  SET is_active = false
  WHERE id = _token_id
    AND has_enterprise_role(enterprise_embed_tokens.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]);
END;
$$;

-- ── 4. RPC: get_embed_capacity_planner_data — anon-callable ──────────────────
CREATE OR REPLACE FUNCTION public.get_embed_capacity_planner_data(
  _token     text,
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
  -- Validate token (must be active, not expired, and cover capacity_planner)
  SELECT workspace_id INTO v_workspace_id
  FROM enterprise_embed_tokens
  WHERE token = _token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND 'capacity_planner' = ANY(allowed_views);

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

-- Allow anon (unauthenticated) callers to use this single RPC
GRANT EXECUTE ON FUNCTION public.get_embed_capacity_planner_data(text, date, date) TO anon;
