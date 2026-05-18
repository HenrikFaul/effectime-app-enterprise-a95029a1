-- v3.46.4 — Fix embed_assign_shift: created_by NOT NULL + role/skill validation
-- Root cause: auth.uid() returns NULL in anon context, created_by was missing from INSERT.
-- Also: if member has no business_role and rule has no roles/skills, the
-- shift_role_or_skill CHECK constraint (business_role IS NOT NULL OR skill_id IS NOT NULL)
-- would fire with a cryptic DB error. Now we resolve from membership or raise clearly.

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
  v_token_row     enterprise_embed_tokens%ROWTYPE;
  v_membership_id uuid;
  v_role_to_use   text;
  v_id            uuid;
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

  SELECT id INTO v_membership_id
  FROM enterprise_memberships
  WHERE user_id = _user_id
    AND workspace_id = v_token_row.workspace_id
    AND status = 'active'
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'Member not found in workspace';
  END IF;

  -- Satisfy the shift_role_or_skill CHECK: business_role IS NOT NULL OR skill_id IS NOT NULL.
  -- If the caller passed neither, fall back to the member's default business_role.
  v_role_to_use := _business_role;
  IF v_role_to_use IS NULL AND _skill_id IS NULL THEN
    SELECT business_role INTO v_role_to_use
    FROM enterprise_memberships
    WHERE id = v_membership_id;
  END IF;

  IF v_role_to_use IS NULL AND _skill_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign shift: member has no role or skill configured.';
  END IF;

  INSERT INTO enterprise_shift_assignments
    (workspace_id, membership_id, user_id, office_id, business_role, shift_date, skill_id, created_by)
  VALUES
    (v_token_row.workspace_id, v_membership_id, _user_id, _office_id,
     v_role_to_use, _shift_date, _skill_id,
     _user_id)
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
