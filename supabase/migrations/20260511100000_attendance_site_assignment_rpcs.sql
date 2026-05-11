-- Attendance site-assignment SECURITY DEFINER RPCs
--
-- The enterprise_shift_assignments table's INSERT/UPDATE/DELETE RLS policies
-- restrict writes to owner/resourceAssistant only.  Employees must be able to
-- record which office they worked from each day (the "site picker" in the day
-- editor dialog), so we route those writes through SECURITY DEFINER functions
-- that:
--   1. Verify the caller owns the membership record (not just any workspace member)
--   2. Populate business_role from the membership (satisfies the shift_role_or_skill
--      CHECK constraint — falls back to 'employee' when the profile has no role)
--   3. Use an atomic ON CONFLICT upsert keyed on the UNIQUE constraint
--      uq_shift_user_date (workspace_id, user_id, shift_date)

-- ─── upsert ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.attendance_upsert_site_assignment(
  p_workspace_id  uuid,
  p_membership_id uuid,
  p_office_id     uuid,
  p_shift_date    date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_biz_role text;
BEGIN
  -- Caller must own this exact membership record
  SELECT business_role
    INTO v_biz_role
    FROM enterprise_memberships
   WHERE id           = p_membership_id
     AND workspace_id = p_workspace_id
     AND user_id      = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found or does not belong to the calling user';
  END IF;

  -- Atomic upsert; business_role satisfies the shift_role_or_skill CHECK
  -- constraint — fall back to 'employee' when not set on the profile yet.
  INSERT INTO enterprise_shift_assignments (
    workspace_id,
    membership_id,
    user_id,
    office_id,
    shift_date,
    business_role,
    created_by
  ) VALUES (
    p_workspace_id,
    p_membership_id,
    v_user_id,
    p_office_id,
    p_shift_date,
    COALESCE(v_biz_role, 'employee'),
    v_user_id
  )
  ON CONFLICT (workspace_id, user_id, shift_date)
  DO UPDATE SET
    office_id     = EXCLUDED.office_id,
    membership_id = EXCLUDED.membership_id,
    business_role = EXCLUDED.business_role,
    updated_at    = now();
END;
$$;

-- ─── remove ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.attendance_remove_site_assignment(
  p_workspace_id  uuid,
  p_membership_id uuid,
  p_shift_date    date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Allow the membership owner or a workspace admin to remove the assignment
  IF NOT EXISTS (
    SELECT 1
      FROM enterprise_memberships
     WHERE id           = p_membership_id
       AND workspace_id = p_workspace_id
       AND user_id      = v_user_id
  ) AND NOT has_enterprise_role(
    p_workspace_id,
    v_user_id,
    ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM enterprise_shift_assignments
   WHERE workspace_id  = p_workspace_id
     AND membership_id = p_membership_id
     AND shift_date    = p_shift_date;
END;
$$;
