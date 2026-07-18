-- v3.51.3 — invitation acceptance is one database transaction.
--
-- The Edge function previously created/reactivated membership first, then
-- wrote allocations and skills, and only afterwards consumed the invitation.
-- A later failure therefore left an active member behind with a reusable
-- invitation. This RPC locks the invitation, workspace and membership in a
-- fixed order and commits every acceptance side effect together.

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_invitations_token_key
  ON public.enterprise_invitations(token);

-- Create, renew or safely replace one workspace/email invitation. Reissuing
-- rotates the token and clears accepted_at only after the caller and target
-- state are validated. The invitation row is locked before workspace settings,
-- matching the acceptance lock order and preventing orphaned/stale prefills.
CREATE OR REPLACE FUNCTION public.issue_enterprise_invitation(
  _workspace_id uuid,
  _email text,
  _role public.enterprise_role,
  _expires_at timestamptz,
  _prefill jsonb DEFAULT '{}'::jsonb,
  _actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_email text := lower(btrim(_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_invitation public.enterprise_invitations%ROWTYPE;
  v_settings jsonb;
  v_prefills jsonb;
  v_target_user_id uuid;
  v_actor_is_owner boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_actor := _actor_id;
  ELSE
    v_actor := auth.uid();
    IF _actor_id IS NOT NULL AND _actor_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Invitation actor mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_actor IS NULL OR NOT public.has_enterprise_role(
    _workspace_id,
    v_actor,
    ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Workspace administrator role required' USING ERRCODE = '42501';
  END IF;
  v_actor_is_owner := public.has_enterprise_role(
    _workspace_id,
    v_actor,
    ARRAY['owner'::public.enterprise_role]
  );
  IF NOT v_actor_is_owner AND _role <> 'member'::public.enterprise_role THEN
    RAISE EXCEPTION 'Only a workspace owner may issue elevated invitations'
      USING ERRCODE = '42501';
  END IF;
  IF v_email IS NULL OR length(v_email) > 320
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid invitation email' USING ERRCODE = '22023';
  END IF;
  IF _expires_at IS NULL OR _expires_at <= now()
     OR _expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Invalid invitation expiry' USING ERRCODE = '22023';
  END IF;
  IF _prefill IS NULL OR jsonb_typeof(_prefill) <> 'object'
     OR octet_length(_prefill::text) > 65536 THEN
    RAISE EXCEPTION 'Invalid invitation prefill' USING ERRCODE = '22023';
  END IF;

  -- Fast negative check for the usual already-member case. The same check is
  -- repeated after the invitation row lock to close the accept/reissue race.
  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email::text) = v_email
  LIMIT 1;
  IF v_target_user_id IS NOT NULL AND public.is_enterprise_member(
    _workspace_id,
    v_target_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_MEMBER');
  END IF;

  INSERT INTO public.enterprise_invitations (
    workspace_id, email, role, token, invited_by, expires_at, accepted_at, created_at
  ) VALUES (
    _workspace_id, v_email, _role, v_token, v_actor, _expires_at, NULL, now()
  )
  ON CONFLICT (workspace_id, email) DO UPDATE SET
    role = EXCLUDED.role,
    token = EXCLUDED.token,
    invited_by = EXCLUDED.invited_by,
    expires_at = EXCLUDED.expires_at,
    accepted_at = NULL,
    created_at = now()
  -- A resource assistant may renew an ordinary invitation, but must not
  -- rotate, downgrade or otherwise invalidate an existing elevated invite.
  -- Keeping this predicate on the atomic upsert also closes the concurrent
  -- "row was absent during a preceding SELECT" race.
  WHERE v_actor_is_owner
     OR public.enterprise_invitations.role = 'member'::public.enterprise_role
  RETURNING * INTO v_invitation;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a workspace owner may replace an elevated invitation'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email::text) = v_email
  LIMIT 1;
  IF v_target_user_id IS NOT NULL AND public.is_enterprise_member(
    _workspace_id,
    v_target_user_id
  ) THEN
    RAISE EXCEPTION 'Target user is already an active workspace member'
      USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM public.enterprise_workspaces
  WHERE id = _workspace_id AND NOT is_archived
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace is unavailable' USING ERRCODE = '55000';
  END IF;

  v_prefills := CASE
    WHEN jsonb_typeof(v_settings -> 'invitation_prefills') = 'object'
      THEN v_settings -> 'invitation_prefills'
    ELSE '{}'::jsonb
  END;
  IF _prefill = '{}'::jsonb THEN
    v_prefills := v_prefills - v_invitation.id::text;
  ELSE
    v_prefills := v_prefills || jsonb_build_object(v_invitation.id::text, _prefill);
  END IF;
  v_settings := CASE WHEN v_prefills = '{}'::jsonb
    THEN v_settings - 'invitation_prefills'
    ELSE jsonb_set(v_settings, '{invitation_prefills}', v_prefills, true)
  END;
  UPDATE public.enterprise_workspaces
  SET settings = v_settings
  WHERE id = _workspace_id;

  RETURN jsonb_build_object(
    'ok', true,
    'invitation_id', v_invitation.id,
    'token', v_invitation.token,
    'expires_at', v_invitation.expires_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_enterprise_invitation(
  uuid, text, public.enterprise_role, timestamptz, jsonb, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_enterprise_invitation(
  uuid, text, public.enterprise_role, timestamptz, jsonb, uuid
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_enterprise_invitation(
  _invitation_token text,
  _user_id uuid,
  _prefill_override jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_invitation public.enterprise_invitations%ROWTYPE;
  v_workspace public.enterprise_workspaces%ROWTYPE;
  v_membership public.enterprise_memberships%ROWTYPE;
  v_membership_found boolean := false;
  v_membership_id uuid;
  v_user_email text;
  v_settings jsonb;
  v_prefills jsonb;
  v_prefill jsonb := '{}'::jsonb;
  v_warnings jsonb := '[]'::jsonb;

  v_team text;
  v_business_role text;
  v_office_id uuid;
  v_city text;
  v_location text;
  v_org_unit_id uuid;
  v_manager_id uuid;
  v_contract_type_id uuid;
  v_leadership_level_id uuid;
  v_leadership_category text;
  v_employer_rights boolean := false;
  v_has_employer_rights boolean := false;
  v_seniority public.enterprise_experience_level;

  v_position_input text;
  v_position_source text;
  v_workspace_role_id uuid;
  v_position_name text;
  v_catalog_role_id uuid;
  v_catalog_category_id uuid;
  v_catalog_category_name text;
  v_workspace_category_id uuid;

  v_allocation jsonb;
  v_allocation_role text;
  v_allocation_percentage numeric;
  v_allocation_priority boolean;
  v_allocations_have_priority boolean;
  v_allocation_index integer;
  v_skill_input text;
  v_skill_name text;
  v_catalog_skill_id uuid;
  v_workspace_skill_id uuid;
  v_legacy_skill_id uuid;
  v_skill_required boolean;
  v_skill_min_experience public.enterprise_experience_level;
  v_catalog_role_skill record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR NULLIF(btrim(_invitation_token), '') IS NULL
     OR octet_length(_invitation_token) > 512 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVITE_NOT_FOUND');
  END IF;

  SELECT * INTO v_invitation
  FROM public.enterprise_invitations
  WHERE token = btrim(_invitation_token)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVITE_NOT_FOUND');
  END IF;

  SELECT lower(email::text) INTO v_user_email
  FROM auth.users
  WHERE id = _user_id;
  IF NOT FOUND OR NULLIF(btrim(v_user_email), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'USER_EMAIL_MISSING');
  END IF;
  IF lower(btrim(v_invitation.email)) <> lower(btrim(v_user_email)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_MISMATCH');
  END IF;

  SELECT * INTO v_workspace
  FROM public.enterprise_workspaces
  WHERE id = v_invitation.workspace_id
  FOR UPDATE;
  IF NOT FOUND OR v_workspace.is_archived THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WORKSPACE_UNAVAILABLE');
  END IF;

  SELECT * INTO v_membership
  FROM public.enterprise_memberships
  WHERE workspace_id = v_invitation.workspace_id
    AND user_id = _user_id
  FOR UPDATE;
  v_membership_found := FOUND;

  v_settings := COALESCE(v_workspace.settings, '{}'::jsonb);
  v_prefills := CASE
    WHEN jsonb_typeof(v_settings -> 'invitation_prefills') = 'object'
      THEN v_settings -> 'invitation_prefills'
    ELSE '{}'::jsonb
  END;
  v_prefill := CASE
    WHEN jsonb_typeof(v_prefills -> v_invitation.id::text) = 'object'
      THEN v_prefills -> v_invitation.id::text
    ELSE '{}'::jsonb
  END;
  IF _prefill_override IS NOT NULL THEN
    IF jsonb_typeof(_prefill_override) <> 'object' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
    END IF;
    v_prefill := _prefill_override;
  END IF;

  -- A used token is idempotent only while the same account is still active.
  -- It must never reactivate a membership revoked after the original accept.
  IF v_invitation.accepted_at IS NOT NULL THEN
    IF v_membership_found
       AND v_membership.status = 'active'::public.enterprise_membership_status THEN
      v_prefills := v_prefills - v_invitation.id::text;
      v_settings := CASE WHEN v_prefills = '{}'::jsonb
        THEN v_settings - 'invitation_prefills'
        ELSE jsonb_set(v_settings, '{invitation_prefills}', v_prefills, true)
      END;
      UPDATE public.enterprise_workspaces
      SET settings = v_settings
      WHERE id = v_workspace.id;
      RETURN jsonb_build_object(
        'ok', true,
        'already_member', true,
        'workspace_id', v_workspace.id,
        'membership_id', v_membership.id,
        'warnings', v_warnings
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_USED');
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVITE_EXPIRED');
  END IF;

  -- If an active membership already exists, consume the still-open invitation
  -- without overwriting the administrator's current role/member metadata.
  IF v_membership_found
     AND v_membership.status = 'active'::public.enterprise_membership_status THEN
    UPDATE public.enterprise_invitations
    SET accepted_at = now()
    WHERE id = v_invitation.id;
    v_prefills := v_prefills - v_invitation.id::text;
    v_settings := CASE WHEN v_prefills = '{}'::jsonb
      THEN v_settings - 'invitation_prefills'
      ELSE jsonb_set(v_settings, '{invitation_prefills}', v_prefills, true)
    END;
    UPDATE public.enterprise_workspaces
    SET settings = v_settings
    WHERE id = v_workspace.id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_member', true,
      'workspace_id', v_workspace.id,
      'membership_id', v_membership.id,
      'warnings', v_warnings
    );
  END IF;

  IF octet_length(v_prefill::text) > 65536 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
  END IF;
  IF v_prefill ? 'role_allocations' THEN
    IF jsonb_typeof(v_prefill -> 'role_allocations') <> 'array' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
    END IF;
    IF jsonb_array_length(v_prefill -> 'role_allocations') > 20 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
    END IF;
  END IF;
  IF v_prefill ? 'position_skills' THEN
    IF jsonb_typeof(v_prefill -> 'position_skills') <> 'array' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
    END IF;
    IF jsonb_array_length(v_prefill -> 'position_skills') > 100 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
    END IF;
  END IF;
  IF v_prefill ? 'position_skills' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_prefill -> 'position_skills') AS skill(value)
    WHERE jsonb_typeof(skill.value) <> 'string'
      OR length(skill.value #>> '{}') > 100
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
  END IF;
  IF v_prefill ? 'role_allocations' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_prefill -> 'role_allocations') AS allocation(value)
    WHERE jsonb_typeof(allocation.value) <> 'object'
      OR NULLIF(btrim(allocation.value ->> 'business_role'), '') IS NULL
      OR length(btrim(allocation.value ->> 'business_role')) > 160
      OR (
        allocation.value ? 'percentage'
        AND jsonb_typeof(allocation.value -> 'percentage') <> 'number'
      )
      OR (
        allocation.value ? 'is_priority'
        AND jsonb_typeof(allocation.value -> 'is_priority') <> 'boolean'
      )
      OR COALESCE(
        CASE
          WHEN NOT (allocation.value ? 'percentage') THEN 100
          WHEN jsonb_typeof(allocation.value -> 'percentage') = 'number'
            THEN (allocation.value ->> 'percentage')::numeric
          ELSE NULL
        END,
        -1
      ) NOT BETWEEN 0 AND 100
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
  END IF;
  IF v_prefill ? 'role_allocations' AND (
    SELECT count(*)
    FROM jsonb_array_elements(v_prefill -> 'role_allocations') AS allocation(value)
    WHERE allocation.value @> '{"is_priority": true}'::jsonb
  ) > 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
  END IF;
  IF v_prefill ? 'role_allocations'
     AND jsonb_array_length(v_prefill -> 'role_allocations') > 0
     AND abs((
       SELECT sum(COALESCE((allocation.value ->> 'percentage')::numeric, 100))
       FROM jsonb_array_elements(v_prefill -> 'role_allocations') AS allocation(value)
     ) - 100) > 0.01 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
  END IF;
  IF v_prefill ? 'role_allocations' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_prefill -> 'role_allocations') AS allocation(value)
    GROUP BY lower(btrim(allocation.value ->> 'business_role'))
    HAVING count(*) > 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
  END IF;

  v_position_source := NULLIF(btrim(v_prefill ->> 'position_source'), '');
  IF v_position_source IS NOT NULL
     AND v_position_source NOT IN ('workspace', 'catalog') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
  END IF;

  v_team := NULLIF(btrim(v_prefill ->> 'team'), '');
  v_business_role := NULLIF(btrim(v_prefill ->> 'business_role'), '');
  v_city := NULLIF(btrim(v_prefill ->> 'city'), '');
  v_location := NULLIF(btrim(v_prefill ->> 'location'), '');

  IF v_prefill ? 'office_id' THEN
    SELECT id INTO v_office_id
    FROM public.enterprise_offices
    WHERE id::text = v_prefill ->> 'office_id'
      AND workspace_id = v_workspace.id;
    IF NOT FOUND THEN
      v_warnings := v_warnings || jsonb_build_array('office_reference_ignored');
    END IF;
  END IF;
  IF v_prefill ? 'org_unit_id' THEN
    SELECT id INTO v_org_unit_id
    FROM public.enterprise_org_units
    WHERE id::text = v_prefill ->> 'org_unit_id'
      AND workspace_id = v_workspace.id;
    IF NOT FOUND THEN
      v_warnings := v_warnings || jsonb_build_array('org_unit_reference_ignored');
    END IF;
  END IF;
  IF v_prefill ? 'manager_id' THEN
    SELECT id INTO v_manager_id
    FROM public.enterprise_memberships
    WHERE id::text = v_prefill ->> 'manager_id'
      AND workspace_id = v_workspace.id
      AND status = 'active'::public.enterprise_membership_status;
    IF NOT FOUND THEN
      v_warnings := v_warnings || jsonb_build_array('manager_reference_ignored');
    END IF;
  END IF;
  IF v_prefill ? 'contract_type_id' THEN
    SELECT id INTO v_contract_type_id
    FROM public.enterprise_contract_types
    WHERE id::text = v_prefill ->> 'contract_type_id'
      AND workspace_id = v_workspace.id;
    IF NOT FOUND THEN
      v_warnings := v_warnings || jsonb_build_array('contract_type_reference_ignored');
    END IF;
  END IF;
  IF v_prefill ? 'leadership_level_id' THEN
    SELECT id INTO v_leadership_level_id
    FROM public.enterprise_leadership_levels
    WHERE id::text = v_prefill ->> 'leadership_level_id'
      AND workspace_id = v_workspace.id;
    IF NOT FOUND THEN
      v_warnings := v_warnings || jsonb_build_array('leadership_level_reference_ignored');
    END IF;
  END IF;

  IF v_prefill ->> 'leadership_category' IN (
    'strategic', 'operational', 'technical', 'execution', 'none'
  ) THEN
    v_leadership_category := v_prefill ->> 'leadership_category';
  ELSIF v_prefill ? 'leadership_category' THEN
    v_warnings := v_warnings || jsonb_build_array('leadership_category_ignored');
  END IF;
  IF v_prefill ? 'employer_rights' THEN
    IF jsonb_typeof(v_prefill -> 'employer_rights') = 'boolean' THEN
      v_employer_rights := (v_prefill ->> 'employer_rights')::boolean;
      v_has_employer_rights := true;
    ELSE
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PREFILL');
    END IF;
  END IF;
  IF v_prefill ->> 'seniority' IN ('junior', 'medior', 'senior', 'lead', 'principal') THEN
    v_seniority := (v_prefill ->> 'seniority')::public.enterprise_experience_level;
  ELSIF v_prefill ? 'seniority' THEN
    v_warnings := v_warnings || jsonb_build_array('seniority_ignored');
  END IF;
  IF NULLIF(btrim(v_prefill ->> 'display_name'), '') IS NOT NULL THEN
    v_warnings := v_warnings || jsonb_build_array('workspace_display_name_not_supported');
  END IF;

  -- Resolve a workspace role first for legacy prefills; otherwise resolve and
  -- materialize the selected global catalog role into the customization layer.
  v_position_input := NULLIF(btrim(v_prefill ->> 'position_catalog_id'), '');
  IF v_position_input IS NOT NULL
     AND (v_position_source IS NULL OR v_position_source = 'workspace') THEN
    SELECT id, name INTO v_workspace_role_id, v_position_name
    FROM public.enterprise_workspace_roles
    WHERE id::text = v_position_input
      AND workspace_id = v_workspace.id
      AND is_active = true;
    IF FOUND THEN
      v_position_source := 'workspace';
    END IF;
  END IF;
  IF v_position_input IS NOT NULL
     AND v_workspace_role_id IS NULL
     AND (v_position_source IS NULL OR v_position_source = 'catalog') THEN
    SELECT role.id, role.name, category.id, category.name
    INTO v_catalog_role_id, v_position_name, v_catalog_category_id, v_catalog_category_name
    FROM public.enterprise_catalog_roles AS role
    JOIN public.enterprise_catalog_categories AS category
      ON category.id = role.category_id
    WHERE role.id::text = v_position_input
      AND role.is_active = true
      AND category.is_active = true;
    IF FOUND THEN
      v_position_source := 'catalog';
      INSERT INTO public.enterprise_workspace_role_categories (
        workspace_id, catalog_category_id, name, is_active
      ) VALUES (
        v_workspace.id, v_catalog_category_id, v_catalog_category_name, true
      )
      ON CONFLICT (workspace_id, name) DO UPDATE SET
        catalog_category_id = COALESCE(
          enterprise_workspace_role_categories.catalog_category_id,
          EXCLUDED.catalog_category_id
        ),
        is_active = true
      RETURNING id INTO v_workspace_category_id;

      INSERT INTO public.enterprise_workspace_roles (
        workspace_id, category_id, catalog_role_id, name, is_active
      ) VALUES (
        v_workspace.id, v_workspace_category_id, v_catalog_role_id, v_position_name, true
      )
      ON CONFLICT (workspace_id, category_id, name) DO UPDATE SET
        catalog_role_id = COALESCE(
          enterprise_workspace_roles.catalog_role_id,
          EXCLUDED.catalog_role_id
        ),
        is_active = true
      RETURNING id INTO v_workspace_role_id;

      -- Materializing a catalog role creates its complete workspace role
      -- definition. The member-specific selection below remains a subset and
      -- must not silently delete optional (or deselected required) role skills.
      FOR v_catalog_role_skill IN
        SELECT skill.id AS catalog_skill_id,
               skill.name,
               role_skill.required,
               role_skill.min_experience_level
        FROM public.enterprise_catalog_role_skills AS role_skill
        JOIN public.enterprise_catalog_skills AS skill
          ON skill.id = role_skill.skill_id
        WHERE role_skill.role_id = v_catalog_role_id
          AND skill.is_active = true
      LOOP
        INSERT INTO public.enterprise_skills (workspace_id, name)
        VALUES (v_workspace.id, v_catalog_role_skill.name)
        ON CONFLICT (workspace_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_legacy_skill_id;

        INSERT INTO public.enterprise_workspace_skills (
          workspace_id, catalog_skill_id, skill_id, name, is_active
        ) VALUES (
          v_workspace.id, v_catalog_role_skill.catalog_skill_id,
          v_legacy_skill_id, v_catalog_role_skill.name, true
        )
        ON CONFLICT (workspace_id, name) DO UPDATE SET
          catalog_skill_id = COALESCE(
            enterprise_workspace_skills.catalog_skill_id,
            EXCLUDED.catalog_skill_id
          ),
          -- Always re-correlate the bridge to the legacy skill materialized in
          -- this workspace; retaining an arbitrary existing FK can cross
          -- workspace domains even though the FK itself is globally valid.
          skill_id = EXCLUDED.skill_id,
          is_active = true
        RETURNING id INTO v_workspace_skill_id;

        INSERT INTO public.enterprise_workspace_role_skills (
          workspace_id, role_id, workspace_skill_id,
          required, approved, min_experience_level
        ) VALUES (
          v_workspace.id, v_workspace_role_id, v_workspace_skill_id,
          v_catalog_role_skill.required, true,
          v_catalog_role_skill.min_experience_level
        )
        ON CONFLICT (role_id, workspace_skill_id) DO UPDATE SET
          required = EXCLUDED.required,
          approved = true,
          min_experience_level = EXCLUDED.min_experience_level,
          updated_at = now();
      END LOOP;
    END IF;
  END IF;
  IF v_position_input IS NOT NULL AND v_workspace_role_id IS NULL THEN
    v_warnings := v_warnings || jsonb_build_array('position_reference_ignored');
  ELSIF v_business_role IS NULL AND v_position_name IS NOT NULL THEN
    v_business_role := v_position_name;
  END IF;

  IF NOT v_membership_found THEN
    INSERT INTO public.enterprise_memberships (
      workspace_id, user_id, role, status, joined_at,
      team, business_role, office_id, city, location,
      org_unit_id, manager_id, contract_type_id, leadership_level_id,
      leadership_category, employer_rights, position_catalog_id,
      business_role_id, seniority
    ) VALUES (
      v_workspace.id, _user_id, v_invitation.role, 'active', now(),
      v_team, v_business_role, v_office_id, v_city, v_location,
      v_org_unit_id, v_manager_id, v_contract_type_id, v_leadership_level_id,
      v_leadership_category, v_employer_rights, v_workspace_role_id,
      v_workspace_role_id, v_seniority
    )
    RETURNING id INTO v_membership_id;
  ELSE
    UPDATE public.enterprise_memberships
    SET role = v_invitation.role,
        status = 'active'::public.enterprise_membership_status,
        joined_at = now(),
        updated_at = now(),
        team = COALESCE(v_team, team),
        business_role = COALESCE(v_business_role, business_role),
        office_id = COALESCE(v_office_id, office_id),
        city = COALESCE(v_city, city),
        location = COALESCE(v_location, location),
        org_unit_id = COALESCE(v_org_unit_id, org_unit_id),
        manager_id = COALESCE(v_manager_id, manager_id),
        contract_type_id = COALESCE(v_contract_type_id, contract_type_id),
        leadership_level_id = COALESCE(v_leadership_level_id, leadership_level_id),
        leadership_category = COALESCE(v_leadership_category, leadership_category),
        employer_rights = CASE WHEN v_has_employer_rights
          THEN v_employer_rights ELSE employer_rights END,
        position_catalog_id = COALESCE(v_workspace_role_id, position_catalog_id),
        business_role_id = COALESCE(v_workspace_role_id, business_role_id),
        seniority = COALESCE(v_seniority, seniority)
    WHERE id = v_membership.id
    RETURNING id INTO v_membership_id;
  END IF;

  IF v_prefill ? 'role_allocations' THEN
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_prefill -> 'role_allocations') AS allocation(value)
      WHERE allocation.value @> '{"is_priority": true}'::jsonb
    ) INTO v_allocations_have_priority;
    v_allocation_index := 0;

    -- The editor sends a complete 100% allocation snapshot. Replace that
    -- snapshot atomically so reactivating a member cannot retain omitted old
    -- roles and inflate Capacity DNA above 100%. An explicit empty array clears
    -- the allocations; an absent key preserves them.
    DELETE FROM public.enterprise_member_role_allocations
    WHERE membership_id = v_membership_id;

    FOR v_allocation IN
      SELECT value
      FROM jsonb_array_elements(v_prefill -> 'role_allocations') AS allocation(value)
    LOOP
      v_allocation_index := v_allocation_index + 1;
      v_allocation_role := btrim(v_allocation ->> 'business_role');
      v_allocation_percentage := COALESCE((v_allocation ->> 'percentage')::numeric, 100);
      v_allocation_priority := CASE
        WHEN v_allocations_have_priority
          THEN COALESCE((v_allocation ->> 'is_priority')::boolean, false)
        ELSE v_allocation_index = 1
      END;
      INSERT INTO public.enterprise_member_role_allocations (
        workspace_id, membership_id, business_role, percentage, is_priority
      ) VALUES (
        v_workspace.id, v_membership_id, v_allocation_role,
        v_allocation_percentage, v_allocation_priority
      )
      ON CONFLICT (membership_id, business_role) DO UPDATE SET
        percentage = EXCLUDED.percentage,
        is_priority = EXCLUDED.is_priority,
        updated_at = now();
    END LOOP;
  END IF;

  IF v_prefill ? 'position_skills' THEN
    FOR v_skill_input IN
      SELECT DISTINCT value
      FROM jsonb_array_elements_text(v_prefill -> 'position_skills') AS skill(value)
    LOOP
      v_skill_name := NULL;
      v_catalog_skill_id := NULL;
      v_workspace_skill_id := NULL;
      v_legacy_skill_id := NULL;
      v_skill_required := false;
      v_skill_min_experience := NULL;

      IF v_position_source = 'workspace' THEN
        SELECT skill.id, skill.name, skill.catalog_skill_id, skill.skill_id,
               role_skill.required, role_skill.min_experience_level
        INTO v_workspace_skill_id, v_skill_name, v_catalog_skill_id, v_legacy_skill_id,
             v_skill_required, v_skill_min_experience
        FROM public.enterprise_workspace_skills AS skill
        JOIN public.enterprise_workspace_role_skills AS role_skill
          ON role_skill.workspace_skill_id = skill.id
         AND role_skill.workspace_id = v_workspace.id
         AND role_skill.role_id = v_workspace_role_id
         AND role_skill.approved = true
        WHERE skill.id::text = v_skill_input
          AND skill.workspace_id = v_workspace.id
          AND skill.is_active = true;
        IF NOT FOUND THEN
          v_warnings := v_warnings || jsonb_build_array('workspace_skill_reference_ignored');
          CONTINUE;
        END IF;

        IF v_legacy_skill_id IS NOT NULL AND NOT EXISTS (
          SELECT 1
          FROM public.enterprise_skills AS legacy_skill
          WHERE legacy_skill.id = v_legacy_skill_id
            AND legacy_skill.workspace_id = v_workspace.id
        ) THEN
          v_warnings := v_warnings || jsonb_build_array('workspace_skill_domain_repaired');
          v_legacy_skill_id := NULL;
        END IF;
        IF v_legacy_skill_id IS NULL THEN
          INSERT INTO public.enterprise_skills (workspace_id, name)
          VALUES (v_workspace.id, v_skill_name)
          ON CONFLICT (workspace_id, name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id INTO v_legacy_skill_id;
          UPDATE public.enterprise_workspace_skills
          SET skill_id = v_legacy_skill_id
          WHERE id = v_workspace_skill_id;
        END IF;
      ELSIF v_position_source = 'catalog' THEN
        SELECT skill.id, skill.name, role_skill.required, role_skill.min_experience_level
        INTO v_catalog_skill_id, v_skill_name, v_skill_required, v_skill_min_experience
        FROM public.enterprise_catalog_skills AS skill
        JOIN public.enterprise_catalog_role_skills AS role_skill
          ON role_skill.skill_id = skill.id
         AND role_skill.role_id = v_catalog_role_id
        WHERE skill.id::text = v_skill_input
          AND skill.is_active = true;
        IF NOT FOUND THEN
          v_warnings := v_warnings || jsonb_build_array('catalog_skill_reference_ignored');
          CONTINUE;
        END IF;

        INSERT INTO public.enterprise_skills (workspace_id, name)
        VALUES (v_workspace.id, v_skill_name)
        ON CONFLICT (workspace_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_legacy_skill_id;

        INSERT INTO public.enterprise_workspace_skills (
          workspace_id, catalog_skill_id, skill_id, name, is_active
        ) VALUES (
          v_workspace.id, v_catalog_skill_id, v_legacy_skill_id, v_skill_name, true
        )
        ON CONFLICT (workspace_id, name) DO UPDATE SET
          catalog_skill_id = COALESCE(
            enterprise_workspace_skills.catalog_skill_id,
            EXCLUDED.catalog_skill_id
          ),
          skill_id = EXCLUDED.skill_id,
          is_active = true
        RETURNING id INTO v_workspace_skill_id;

        INSERT INTO public.enterprise_workspace_role_skills (
          workspace_id, role_id, workspace_skill_id,
          required, approved, min_experience_level
        ) VALUES (
          v_workspace.id, v_workspace_role_id, v_workspace_skill_id,
          v_skill_required, true, v_skill_min_experience
        )
        ON CONFLICT (role_id, workspace_skill_id) DO UPDATE SET
          required = EXCLUDED.required,
          approved = true,
          min_experience_level = EXCLUDED.min_experience_level,
          updated_at = now();
      ELSE
        v_warnings := v_warnings || jsonb_build_array('skill_source_missing');
        CONTINUE;
      END IF;

      INSERT INTO public.enterprise_member_skills (
        workspace_id, membership_id, skill_id, level
      ) VALUES (
        v_workspace.id, v_membership_id, v_legacy_skill_id, 3
      )
      ON CONFLICT (membership_id, skill_id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        level = EXCLUDED.level;
    END LOOP;
  END IF;

  UPDATE public.enterprise_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;

  v_prefills := v_prefills - v_invitation.id::text;
  v_settings := CASE WHEN v_prefills = '{}'::jsonb
    THEN v_settings - 'invitation_prefills'
    ELSE jsonb_set(v_settings, '{invitation_prefills}', v_prefills, true)
  END;
  UPDATE public.enterprise_workspaces
  SET settings = v_settings
  WHERE id = v_workspace.id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_member', false,
    'workspace_id', v_workspace.id,
    'membership_id', v_membership_id,
    'warnings', v_warnings
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_enterprise_invitation(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_enterprise_invitation(text, uuid, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
