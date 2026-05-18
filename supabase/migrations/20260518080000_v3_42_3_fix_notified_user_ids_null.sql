-- v3.42.3: Fix create_open_shift_request — notified_user_ids null violation
--
-- Root cause:
--   The final UPDATE in create_open_shift_request sets:
--     notified_user_ids = (SELECT array_agg(DISTINCT n.user_id) ...)
--   When the notification INSERT matches zero rows (e.g., the only members
--   matching the position are the creator themselves, who is excluded by
--   `em.user_id <> v_uid`, OR members match via enterprise_member_role_allocations
--   which the old notification WHERE clause didn't check), array_agg() returns
--   NULL — violating the NOT NULL constraint on the column (error 23502).
--
-- Two fixes in this migration:
--   1. Wrap the array_agg() with COALESCE(..., '{}'::uuid[]) so a zero-match
--      aggregate never produces NULL.
--   2. Extend the notification candidate filter to also include members whose
--      business_role matches via enterprise_member_role_allocations (consistent
--      with the v3.41.7 client-side fix that expanded the candidate list).
--
-- Zero schema changes. Pure function replacement.

CREATE OR REPLACE FUNCTION public.create_open_shift_request(
  _workspace_id    uuid,
  _office_id       uuid,
  _shift_date      date,
  _business_role   text    DEFAULT NULL,
  _skill_id        uuid    DEFAULT NULL,
  _notes           text    DEFAULT NULL,
  _role_id         uuid    DEFAULT NULL,
  _skill_ids       uuid[]  DEFAULT '{}',
  _timeout_hours   numeric DEFAULT 3,
  _target_user_ids uuid[]  DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_req_id      uuid;
  v_respond_by  timestamptz;
  v_role_name   text;
  v_all_skill_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT public.has_enterprise_role(_workspace_id, v_uid,
      ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Resolve role name from structured role_id for backward compat text field
  IF _role_id IS NOT NULL THEN
    SELECT name INTO v_role_name FROM enterprise_workspace_roles
    WHERE id = _role_id AND workspace_id = _workspace_id;
    IF v_role_name IS NOT NULL THEN
      _business_role := v_role_name;
    END IF;
  END IF;

  -- Merge legacy skill_id into skill_ids array
  v_all_skill_ids := _skill_ids;
  IF _skill_id IS NOT NULL AND NOT (_skill_id = ANY(v_all_skill_ids)) THEN
    v_all_skill_ids := array_append(v_all_skill_ids, _skill_id);
  END IF;

  -- Set escalation deadline
  IF _timeout_hours > 0 THEN
    v_respond_by := now() + (_timeout_hours || ' hours')::interval;
  END IF;

  INSERT INTO enterprise_open_shift_requests
    (workspace_id, office_id, shift_date, business_role, skill_id, notes,
     role_id, skill_ids, respond_by_at, timeout_hours, created_by,
     target_user_ids, notified_user_ids)
  VALUES
    (_workspace_id, _office_id, _shift_date, _business_role,
     CASE WHEN array_length(v_all_skill_ids,1) > 0 THEN v_all_skill_ids[1] ELSE NULL END,
     _notes,
     _role_id, v_all_skill_ids, v_respond_by, _timeout_hours, v_uid,
     _target_user_ids, ARRAY[v_uid])
  RETURNING id INTO v_req_id;

  -- Send notifications to: target list if provided; else role/skill-matching members.
  -- Role matching checks BOTH enterprise_memberships.business_role AND
  -- enterprise_member_role_allocations (added in v3.41.7 for candidate list parity).
  INSERT INTO enterprise_notifications
    (workspace_id, user_id, event_type, title, message, related_type, related_id)
  SELECT
    _workspace_id,
    em.user_id,
    'open_shift_broadcast',
    'Open shift available',
    'An open shift is available on ' || _shift_date::text || '. Claim it before it''s taken.',
    'open_shift_request',
    v_req_id
  FROM enterprise_memberships em
  WHERE em.workspace_id = _workspace_id
    AND em.status = 'active'
    AND em.user_id <> v_uid
    AND (
      CASE
        WHEN array_length(_target_user_ids, 1) > 0 THEN
          em.user_id = ANY(_target_user_ids)
        WHEN _business_role IS NOT NULL THEN
          em.business_role = _business_role
          OR EXISTS (
            SELECT 1 FROM enterprise_member_role_allocations alloc
            WHERE alloc.membership_id = em.id
              AND alloc.workspace_id = _workspace_id
              AND alloc.business_role = _business_role
          )
          OR (array_length(v_all_skill_ids, 1) > 0
              AND EXISTS (
                SELECT 1 FROM enterprise_member_skills ms
                WHERE ms.membership_id = em.id
                  AND ms.skill_id = ANY(v_all_skill_ids)
              ))
        WHEN array_length(v_all_skill_ids, 1) > 0 THEN
          EXISTS (
            SELECT 1 FROM enterprise_member_skills ms
            WHERE ms.membership_id = em.id
              AND ms.skill_id = ANY(v_all_skill_ids)
          )
        ELSE true
      END
    );

  -- Track who was notified.
  -- FIX: COALESCE ensures notified_user_ids is never NULL even when
  -- no notifications were sent (array_agg returns NULL on empty input).
  UPDATE enterprise_open_shift_requests
  SET notified_user_ids = COALESCE(
    (SELECT array_agg(DISTINCT n.user_id)
     FROM enterprise_notifications n
     WHERE n.related_id = v_req_id AND n.event_type = 'open_shift_broadcast'),
    '{}'::uuid[]
  )
  WHERE id = v_req_id;

  RETURN v_req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_open_shift_request(uuid,uuid,date,text,uuid,text,uuid,uuid[],numeric,uuid[]) TO authenticated;
