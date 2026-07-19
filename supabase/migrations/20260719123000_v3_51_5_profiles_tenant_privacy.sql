-- v3.51.5 - tenant-bound, data-minimised profile visibility.
--
-- `public.profiles` is a global identity table and intentionally remains the
-- canonical source for web, Android and iOS.  Tenant visibility is derived
-- from enterprise memberships; sensitive preference/authentication fields are
-- never granted to browser roles and are exposed through no public RPC.

-- An active viewer is looked up by user first.  The existing
-- UNIQUE(workspace_id, user_id) constraint covers the historical target side
-- of the shared-workspace join.
CREATE INDEX IF NOT EXISTS idx_enterprise_memberships_active_user_workspace
  ON public.enterprise_memberships (user_id, workspace_id)
  WHERE status = 'active'::public.enterprise_membership_status;

-- Historical drift must not make policy creation look effective while RLS is
-- disabled.  Re-enable it idempotently before replacing the visibility basis.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove the legacy global policy, provide a tenant-safe permissive basis and
-- intersect every authenticated SELECT with the same expression through a
-- restrictive guard.  The target
-- membership is deliberately not status-filtered: active viewers may resolve
-- historical/suspended members of their own workspace for audit/history UI.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles tenant visibility basis" ON public.profiles;
CREATE POLICY "Profiles tenant visibility basis"
  ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS viewer_membership
      JOIN public.enterprise_memberships AS target_membership
        ON target_membership.workspace_id = viewer_membership.workspace_id
      WHERE viewer_membership.user_id = (SELECT auth.uid())
        AND viewer_membership.status = 'active'::public.enterprise_membership_status
        AND target_membership.user_id = profiles.user_id
    )
  );

DROP POLICY IF EXISTS "Profiles tenant visibility guard" ON public.profiles;
CREATE POLICY "Profiles tenant visibility guard"
  ON public.profiles
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS viewer_membership
      JOIN public.enterprise_memberships AS target_membership
        ON target_membership.workspace_id = viewer_membership.workspace_id
      WHERE viewer_membership.user_id = (SELECT auth.uid())
        AND viewer_membership.status = 'active'::public.enterprise_membership_status
        AND target_membership.user_id = profiles.user_id
    )
  );

-- A profile owner may update only their own row.  Column grants below narrow
-- this further to public presentation and locale fields.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- A restrictive guard keeps an unknown drift-only permissive UPDATE policy
-- from broadening the safe self-service column grants to another profile.
DROP POLICY IF EXISTS "Profiles own update guard" ON public.profiles;
CREATE POLICY "Profiles own update guard"
  ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Profile creation is owned by the auth-user trigger and privileged backend
-- workflows.  Retaining a browser INSERT policy would be misleading after the
-- explicit privilege cut below.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Remove both table-level and any previously-created column-level browser
-- grants, including privileges inherited through PostgreSQL PUBLIC, then
-- expose the minimal stable public profile projection. Direct service_role
-- and owner grants are intentionally preserved.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
DO $revoke_profile_columns$
DECLARE
  v_columns text;
BEGIN
  SELECT pg_catalog.string_agg(
    pg_catalog.format('%I', attribute.attname),
    ', ' ORDER BY attribute.attnum
  )
  INTO v_columns
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.profiles'::pg_catalog.regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_columns IS NULL THEN
    RAISE EXCEPTION 'profiles column inventory is empty'
      USING ERRCODE = '55000';
  END IF;

  -- Column ACLs are independent from table ACLs.  Build the revoke from the
  -- live catalog so an untracked drift-only column cannot retain browser access,
  -- including through the implicit PUBLIC role membership.
  EXECUTE pg_catalog.format(
    'REVOKE ALL PRIVILEGES (%s) ON TABLE public.profiles FROM PUBLIC, anon, authenticated',
    v_columns
  );
END;
$revoke_profile_columns$;

GRANT SELECT (
  user_id,
  display_name,
  avatar_url
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
  display_name,
  avatar_url,
  preferred_locale
) ON TABLE public.profiles TO authenticated;

-- The runtime supports eight locales.  Recreate and validate the constraint in
-- the same transaction so unexpected live drift fails closed.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (
    preferred_locale IS NULL
    OR preferred_locale IN ('en', 'hu', 'cs', 'sk', 'pl', 'de', 'at', 'ro')
  ) NOT VALID;
ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_preferred_locale_check;

-- Locale is an own-profile preference, not a workspace directory attribute.
-- Keep it outside the shared column projection and expose only the current
-- authenticated user's value through a no-argument RPC.
CREATE OR REPLACE FUNCTION public.get_my_profile_locale_v1()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT profile.preferred_locale
  FROM public.profiles AS profile
  WHERE profile.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.get_my_profile_locale_v1()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_profile_locale_v1()
  TO authenticated;

-- A display name belongs to the global user profile, not to one workspace.
-- Permit only the authenticated user to rename their own global identity and
-- require an active membership matching the supplied workspace context. This
-- prevents one tenant administrator from changing the name rendered in every
-- other tenant. Missing profile rows fail closed because auth lifecycle code
-- remains their sole creator.
CREATE OR REPLACE FUNCTION public.update_my_workspace_profile_display_name_v1(
  p_workspace_id uuid,
  p_membership_id uuid,
  p_display_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_target_user_id uuid;
  v_display_name text := pg_catalog.btrim(p_display_name);
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF v_display_name IS NULL
     OR v_display_name = ''
     OR pg_catalog.char_length(v_display_name) > 200
     OR v_display_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid display name' USING ERRCODE = '22023';
  END IF;

  SELECT membership.user_id
  INTO v_target_user_id
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = p_membership_id
    AND membership.workspace_id = p_workspace_id
    AND membership.status = 'active'::public.enterprise_membership_status
  FOR KEY SHARE;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_target_user_id <> v_actor THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles AS profile
  SET display_name = v_display_name
  WHERE profile.user_id = v_target_user_id
  RETURNING profile.display_name INTO v_display_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile missing' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_display_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_workspace_profile_display_name_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_workspace_profile_display_name_v1(uuid, uuid, text)
  TO authenticated;

CREATE SCHEMA IF NOT EXISTS effectime_private;

-- Strict, fail-safe parser used only by the public, data-minimised milestone
-- RPC.  Invalid/missing values return no row.  Runtime roles receive no EXECUTE
-- privilege and therefore cannot use it to inspect raw profile preferences.
CREATE OR REPLACE FUNCTION effectime_private.parse_profile_birthday_month_day_v1(
  p_preferences jsonb
)
RETURNS TABLE (
  birthday_month smallint,
  birthday_day smallint
)
LANGUAGE plpgsql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_raw text;
  v_date date;
BEGIN
  v_raw := p_preferences ->> 'birthday';
  IF v_raw IS NULL OR v_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN;
  END IF;

  BEGIN
    v_date := pg_catalog.make_date(
      pg_catalog.substring(v_raw, 1, 4)::integer,
      pg_catalog.substring(v_raw, 6, 2)::integer,
      pg_catalog.substring(v_raw, 9, 2)::integer
    );
  EXCEPTION
    WHEN datetime_field_overflow OR invalid_text_representation THEN
      RETURN;
  END;

  birthday_month := pg_catalog.date_part('month', v_date)::smallint;
  birthday_day := pg_catalog.date_part('day', v_date)::smallint;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION effectime_private.parse_profile_birthday_month_day_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Workspace milestones are the only tenant-wide path that reads birthday data.
-- It returns month/day only, never the birth year, raw preferences, e-mail,
-- activation state or temporary-access material.
CREATE OR REPLACE FUNCTION public.get_workspace_member_milestones_v1(
  p_workspace_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  display_name text,
  milestone_type text,
  milestone_month smallint,
  milestone_day smallint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_workspace_timezone text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(
       public.is_enterprise_member(p_workspace_id, auth.uid()),
       false
     )
     OR NOT COALESCE(
       public.has_workspace_permission(
         p_workspace_id,
         auth.uid(),
         'calendar',
         'readonly'
       ),
       false
     )
     OR NOT COALESCE(
       public.has_workspace_permission(
         p_workspace_id,
         auth.uid(),
         'members',
         'readonly'
       ),
       false
     )
     OR NOT COALESCE(
       public.workspace_has_any_feature(
         p_workspace_id,
         ARRAY['birthday_widget']::text[]
       ),
       false
     )
     OR NOT COALESCE(
       public.workspace_has_any_feature(
         p_workspace_id,
         ARRAY['members_list']::text[]
       ),
       false
     ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT workspace.timezone
  INTO v_workspace_timezone
  FROM public.enterprise_workspaces AS workspace
  WHERE workspace.id = p_workspace_id;

  IF v_workspace_timezone IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_timezone_names AS timezone
       WHERE timezone.name = v_workspace_timezone
     ) THEN
    RAISE EXCEPTION 'Invalid workspace timezone' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    membership.id,
    profile.display_name,
    'birthday'::text,
    parsed.birthday_month,
    parsed.birthday_day
  FROM public.enterprise_memberships AS membership
  LEFT JOIN public.profiles AS profile
    ON profile.user_id = membership.user_id
  CROSS JOIN LATERAL
    effectime_private.parse_profile_birthday_month_day_v1(profile.preferences) AS parsed
  WHERE membership.workspace_id = p_workspace_id
    AND membership.status = 'active'::public.enterprise_membership_status

  UNION ALL

  SELECT
    membership.id,
    profile.display_name,
    'anniversary'::text,
    pg_catalog.date_part(
      'month',
      membership.joined_at AT TIME ZONE v_workspace_timezone
    )::smallint,
    pg_catalog.date_part(
      'day',
      membership.joined_at AT TIME ZONE v_workspace_timezone
    )::smallint
  FROM public.enterprise_memberships AS membership
  LEFT JOIN public.profiles AS profile
    ON profile.user_id = membership.user_id
  WHERE membership.workspace_id = p_workspace_id
    AND membership.status = 'active'::public.enterprise_membership_status
    AND membership.joined_at IS NOT NULL

  ORDER BY 4, 5, 3, 1;
END;
$function$;

-- CREATE OR REPLACE preserves a pre-existing owner.  Under the proven schema-
-- drift risk, fail the migration instead of leaving either SECURITY DEFINER
-- endpoint or its private parser owned by an unexpected role.
DO $routine_owner_contract$
DECLARE
  v_expected_owner oid := CURRENT_USER::pg_catalog.regrole::oid;
  v_locale_oid oid := pg_catalog.to_regprocedure('public.get_my_profile_locale_v1()')::oid;
  v_display_name_oid oid := pg_catalog.to_regprocedure(
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)'
  )::oid;
  v_parser_oid oid := pg_catalog.to_regprocedure(
    'effectime_private.parse_profile_birthday_month_day_v1(jsonb)'
  )::oid;
  v_milestone_oid oid := pg_catalog.to_regprocedure(
    'public.get_workspace_member_milestones_v1(uuid)'
  )::oid;
BEGIN
  IF v_locale_oid IS NULL
     OR v_display_name_oid IS NULL
     OR v_parser_oid IS NULL
     OR v_milestone_oid IS NULL THEN
    RAISE EXCEPTION 'Profile privacy routine contract is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid IN (
      v_locale_oid,
      v_display_name_oid,
      v_parser_oid,
      v_milestone_oid
    )
      AND procedure.proowner <> v_expected_owner
  ) THEN
    RAISE EXCEPTION 'Profile privacy routines require the migration owner';
  END IF;
END;
$routine_owner_contract$;

REVOKE ALL ON FUNCTION public.get_workspace_member_milestones_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_member_milestones_v1(uuid)
  TO authenticated;
