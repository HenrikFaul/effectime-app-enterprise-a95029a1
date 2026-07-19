\set ON_ERROR_STOP on
SET client_min_messages TO warning;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA contract;
CREATE SCHEMA effectime_private;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA contract TO authenticated, service_role;
-- Mirrors the prior HR-workflow migration: authenticated can resolve private
-- helper names, but individual helpers still require an explicit EXECUTE grant.
REVOKE ALL ON SCHEMA effectime_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA effectime_private TO authenticated;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE OR REPLACE FUNCTION contract.assert_true(
  p_condition boolean,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'contract assertion failed: %', p_message;
  END IF;
END;
$function$;

CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.enterprise_role AS ENUM ('owner', 'resourceAssistant', 'member');
CREATE TYPE public.enterprise_membership_status AS ENUM (
  'active', 'invited', 'suspended', 'removed'
);

CREATE TABLE public.enterprise_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  timezone text NOT NULL
);

CREATE TABLE public.enterprise_memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id),
  user_id uuid NOT NULL,
  role public.enterprise_role NOT NULL,
  status public.enterprise_membership_status NOT NULL,
  joined_at timestamptz,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.enterprise_role_permissions (
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id),
  role_key text NOT NULL,
  feature_key text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('none', 'readonly', 'edit')),
  PRIMARY KEY (workspace_id, role_key, feature_key)
);

CREATE TABLE public.fixture_workspace_features (
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id),
  feature_key text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (workspace_id, feature_key)
);

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  is_temporary boolean NOT NULL DEFAULT false,
  temp_access_token text UNIQUE,
  linked_event_id uuid,
  temp_verification_code text,
  preferred_locale text,
  drift_private_note text DEFAULT 'drift-only-secret',
  CONSTRAINT profiles_preferred_locale_check
    CHECK (preferred_locale IS NULL OR preferred_locale IN ('en', 'hu'))
);

CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS user_role
    WHERE user_role.user_id = _user_id
      AND user_role.role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_enterprise_member(
  _workspace_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.user_id = _user_id
      AND membership.status = 'active'::public.enterprise_membership_status
  );
$function$;

-- These reproduce the committed v3.51.3 runtime contracts.  Keeping them in
-- the fixture makes permission and entitlement failure part of this RPC's
-- executable contract rather than an untested assumption.
CREATE OR REPLACE FUNCTION public.has_workspace_permission(
  _workspace_id uuid,
  _user_id uuid,
  _feature_key text,
  _minimum_access text DEFAULT 'readonly'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT COALESCE(
    _user_id = auth.uid()
    AND _minimum_access IN ('readonly', 'edit')
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.workspace_id = _workspace_id
        AND membership.user_id = _user_id
        AND membership.status = 'active'::public.enterprise_membership_status
        AND (
          membership.role = 'owner'::public.enterprise_role
          OR EXISTS (
            SELECT 1
            FROM public.enterprise_role_permissions AS permission
            WHERE permission.workspace_id = membership.workspace_id
              AND permission.role_key = membership.role::text
              AND permission.feature_key = _feature_key
              AND CASE permission.access_level
                    WHEN 'edit' THEN 2
                    WHEN 'readonly' THEN 1
                    ELSE 0
                  END >= CASE _minimum_access WHEN 'edit' THEN 2 ELSE 1 END
          )
        )
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.workspace_has_any_feature(
  _workspace_id uuid,
  _feature_keys text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.is_enterprise_member(_workspace_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fixture_workspace_features AS feature
      WHERE feature.workspace_id = _workspace_id
        AND feature.feature_key = ANY(COALESCE(_feature_keys, ARRAY[]::text[]))
        AND feature.enabled
    );
$function$;

ALTER TABLE public.enterprise_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members view memberships"
  ON public.enterprise_memberships
  FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (temp_access_token IS NULL AND temp_verification_code IS NULL)
  );
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Legacy broad profile updates"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.enterprise_memberships TO authenticated;
GRANT ALL PRIVILEGES ON public.enterprise_memberships TO service_role;
GRANT ALL PRIVILEGES ON public.profiles TO anon, authenticated, service_role;
-- Every login role inherits PUBLIC. Seed both table- and column-level PUBLIC
-- drift so the migration must remove implicit browser access as well.
GRANT SELECT ON public.profiles TO PUBLIC;
-- Simulate an untracked live-only column ACL.  A hard-coded revoke list would
-- leave this secret readable/writable after the table-level grant is removed.
GRANT SELECT (drift_private_note) ON public.profiles TO PUBLIC, anon, authenticated;
GRANT UPDATE (drift_private_note) ON public.profiles TO PUBLIC, authenticated;

INSERT INTO public.enterprise_workspaces(id, name, timezone) VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'Workspace A',
    'Europe/Budapest'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Workspace B',
    'America/New_York'
  );

INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, joined_at
) VALUES
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', 'owner', 'active',     '2020-01-02T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000002', 'member', 'active',    '2021-03-31T22:30:00Z'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000003', 'member', 'removed',   '2019-05-06T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000004', 'member', 'suspended', '2018-07-08T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000005', 'member', 'active',    '2022-09-10T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000006', 'resourceAssistant', 'active', '2023-11-12T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000001', 'member', 'removed',   '2024-01-01T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '20000000-0000-4000-8000-000000000001', 'member', 'active',    '2020-02-03T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '20000000-0000-4000-8000-000000000002', 'member', 'active',    '2021-04-05T00:00:00Z'),
  ('b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', '10000000-0000-4000-8000-000000000002', 'member', 'active',    '2022-06-07T00:00:00Z');

INSERT INTO public.enterprise_role_permissions(
  workspace_id, role_key, feature_key, access_level
) VALUES
  ('11111111-1111-4111-8111-111111111111', 'member', 'calendar', 'readonly'),
  ('11111111-1111-4111-8111-111111111111', 'member', 'members', 'readonly'),
  ('11111111-1111-4111-8111-111111111111', 'resourceAssistant', 'calendar', 'readonly'),
  ('22222222-2222-4222-8222-222222222222', 'member', 'calendar', 'readonly'),
  ('22222222-2222-4222-8222-222222222222', 'member', 'members', 'readonly');

INSERT INTO public.fixture_workspace_features(workspace_id, feature_key, enabled) VALUES
  ('11111111-1111-4111-8111-111111111111', 'birthday_widget', true),
  ('11111111-1111-4111-8111-111111111111', 'members_list', true),
  ('11111111-1111-4111-8111-111111111111', 'member_edit', true),
  ('22222222-2222-4222-8222-222222222222', 'birthday_widget', false),
  ('22222222-2222-4222-8222-222222222222', 'members_list', true),
  ('22222222-2222-4222-8222-222222222222', 'member_edit', true);

INSERT INTO public.user_roles(user_id, role) VALUES
  ('90000000-0000-4000-8000-000000000001', 'admin');

INSERT INTO public.profiles(
  id, user_id, display_name, avatar_url, preferences, is_temporary,
  temp_access_token, linked_event_id, temp_verification_code, preferred_locale
) VALUES
  ('f0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Actor A', NULL, '{"birthday":"1988-01-15","pending_email_activation":{"token":"actor-a-secret"}}', false, NULL, NULL, NULL, 'hu'),
  ('f0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Active A', '/a.png', '{"birthday":"1990-07-19","email":"active-a@example.test"}', true, 'shared-a-secret', NULL, NULL, 'en'),
  ('f0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Removed A', NULL, '{"birthday":"1980-05-20"}', false, NULL, NULL, NULL, 'hu'),
  ('f0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'Suspended A', NULL, '{"birthday":"1981-06-21"}', false, NULL, NULL, NULL, NULL),
  ('f0000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'Invalid Birthday A', NULL, '{"birthday":"2025-02-30"}', false, NULL, NULL, NULL, 'en'),
  ('f0000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'No Permission A', NULL, '{"birthday":"1992-12-31"}', false, NULL, NULL, NULL, 'en'),
  ('f0000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'Actor B', NULL, '{"birthday":"1987-02-14"}', false, NULL, NULL, NULL, 'en'),
  ('f0000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000002', 'Active B', NULL, '{"birthday":"1993-08-09"}', false, NULL, NULL, NULL, 'en'),
  ('f0000000-0000-4000-8000-000000000009', '90000000-0000-4000-8000-000000000001', 'Platform Admin', NULL, '{"birthday":"1970-10-10"}', false, NULL, NULL, NULL, 'en');

CREATE TABLE contract.profiles_before AS TABLE public.profiles;
CREATE TABLE contract.service_table_privileges_before AS
SELECT privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE grantee = 'service_role'
  AND table_schema = 'public'
  AND table_name = 'profiles';
CREATE TABLE contract.service_column_privileges_before AS
SELECT column_name, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE grantee = 'service_role'
  AND table_schema = 'public'
  AND table_name = 'profiles';

-- A forward-only migration must also be safe for retry after an interrupted
-- migration ledger write. Simulate a drifted target with policies present but
-- RLS disabled so the candidate itself must restore enforcement.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
\ir /contract/migration.sql
\ir /contract/migration.sql

SELECT contract.assert_true(
  NOT EXISTS (
    (TABLE contract.profiles_before EXCEPT ALL TABLE public.profiles)
    UNION ALL
    (TABLE public.profiles EXCEPT ALL TABLE contract.profiles_before)
  ),
  'migration or reapply mutated profile data'
);

SELECT contract.assert_true(
  NOT EXISTS (
    (TABLE contract.service_table_privileges_before EXCEPT ALL
      SELECT privilege_type, is_grantable
      FROM information_schema.table_privileges
      WHERE grantee = 'service_role'
        AND table_schema = 'public'
        AND table_name = 'profiles')
    UNION ALL
    ((SELECT privilege_type, is_grantable
      FROM information_schema.table_privileges
      WHERE grantee = 'service_role'
        AND table_schema = 'public'
        AND table_name = 'profiles')
      EXCEPT ALL TABLE contract.service_table_privileges_before)
  ),
  'service_role table privileges changed'
);

SELECT contract.assert_true(
  NOT EXISTS (
    (TABLE contract.service_column_privileges_before EXCEPT ALL
      SELECT column_name, privilege_type, is_grantable
      FROM information_schema.column_privileges
      WHERE grantee = 'service_role'
        AND table_schema = 'public'
        AND table_name = 'profiles')
    UNION ALL
    ((SELECT column_name, privilege_type, is_grantable
      FROM information_schema.column_privileges
      WHERE grantee = 'service_role'
        AND table_schema = 'public'
        AND table_name = 'profiles')
      EXCEPT ALL TABLE contract.service_column_privileges_before)
  ),
  'service_role column privileges changed'
);

-- Policy, index, constraint and routine metadata are public security contracts.
SELECT contract.assert_true(
  (SELECT relrowsecurity
   FROM pg_catalog.pg_class
   WHERE oid = 'public.profiles'::regclass)
  AND
  (SELECT count(*) = 1 AND bool_and(polpermissive) AND bool_and(polcmd = 'r')
   FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.profiles'::regclass
     AND polname = 'Profiles tenant visibility basis')
  AND
  (SELECT count(*) = 1 AND bool_and(NOT polpermissive) AND bool_and(polcmd = 'r')
   FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.profiles'::regclass
     AND polname = 'Profiles tenant visibility guard')
  AND
  (SELECT count(*) = 1 AND bool_and(NOT polpermissive) AND bool_and(polcmd = 'w')
   FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.profiles'::regclass
     AND polname = 'Profiles own update guard')
  AND
  (SELECT count(*) = 1 AND bool_and(polpermissive) AND bool_and(polcmd = 'w')
   FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.profiles'::regclass
     AND polname = 'Legacy broad profile updates')
  AND
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.profiles'::regclass
      AND polname = 'Profiles are viewable by authenticated users'
  )
  AND
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.profiles'::regclass
      AND polname = 'Users can insert own profile'
  ),
  'profile policy catalog contract is not idempotent or restrictive'
);

SELECT contract.assert_true(
  COALESCE((
    SELECT index.indisvalid
       AND index.indisready
       AND pg_catalog.pg_get_indexdef(index.indexrelid) LIKE
         '%(user_id, workspace_id)%'
       AND pg_catalog.pg_get_expr(index.indpred, index.indrelid) LIKE
         '%status = ''active''%'
    FROM pg_catalog.pg_index AS index
    WHERE index.indexrelid =
      'public.idx_enterprise_memberships_active_user_workspace'::regclass
  ), false),
  'active membership lookup index contract changed'
);

SELECT contract.assert_true(
  (SELECT count(*) = 1 AND bool_and(convalidated)
   FROM pg_catalog.pg_constraint
   WHERE conrelid = 'public.profiles'::regclass
     AND conname = 'profiles_preferred_locale_check')
  AND COALESCE((
    SELECT pg_catalog.pg_get_constraintdef(oid) LIKE '%''at''%'
       AND pg_catalog.pg_get_constraintdef(oid) LIKE '%''ro''%'
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_preferred_locale_check'
  ), false),
  'eight-locale validated constraint is missing'
);

SELECT contract.assert_true(
  COALESCE((
    SELECT parser.provolatile = 'i'
       AND parser.proisstrict
       AND NOT parser.prosecdef
       AND parser.proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND parser.proowner = CURRENT_USER::pg_catalog.regrole::oid
    FROM pg_catalog.pg_proc AS parser
    WHERE parser.oid =
      'effectime_private.parse_profile_birthday_month_day_v1(jsonb)'::regprocedure
  ), false)
  AND COALESCE((
    SELECT locale_rpc.provolatile = 's'
       AND locale_rpc.prosecdef
       AND locale_rpc.proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND locale_rpc.proowner = CURRENT_USER::pg_catalog.regrole::oid
    FROM pg_catalog.pg_proc AS locale_rpc
    WHERE locale_rpc.oid =
      'public.get_my_profile_locale_v1()'::regprocedure
  ), false)
  AND COALESCE((
    SELECT rename_rpc.provolatile = 'v'
       AND rename_rpc.prosecdef
       AND rename_rpc.proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND rename_rpc.proowner = CURRENT_USER::pg_catalog.regrole::oid
       AND rename_rpc.proargnames = ARRAY[
         'p_workspace_id', 'p_membership_id', 'p_display_name'
       ]::text[]
    FROM pg_catalog.pg_proc AS rename_rpc
    WHERE rename_rpc.oid =
      'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)'::regprocedure
  ), false)
  AND COALESCE((
    SELECT rpc.provolatile = 's'
       AND rpc.prosecdef
       AND rpc.proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND rpc.proowner = CURRENT_USER::pg_catalog.regrole::oid
       AND rpc.proargnames = ARRAY[
         'p_workspace_id', 'membership_id', 'display_name',
         'milestone_type', 'milestone_month', 'milestone_day'
       ]::text[]
    FROM pg_catalog.pg_proc AS rpc
    WHERE rpc.oid =
      'public.get_workspace_member_milestones_v1(uuid)'::regprocedure
  ), false),
  'profile privacy routine owner, trust, volatility or shape metadata changed'
);

SELECT contract.assert_true(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_my_profile_locale_v1()',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon', 'public.get_my_profile_locale_v1()', 'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role', 'public.get_my_profile_locale_v1()', 'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'authenticated',
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_workspace_member_milestones_v1(uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon', 'public.get_workspace_member_milestones_v1(uuid)', 'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role', 'public.get_workspace_member_milestones_v1(uuid)', 'EXECUTE'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS routine
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
    ) AS acl
    WHERE routine.oid IN (
      'public.get_my_profile_locale_v1()'::regprocedure,
      'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)'::regprocedure,
      'public.get_workspace_member_milestones_v1(uuid)'::regprocedure
    )
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'effectime_private.parse_profile_birthday_month_day_v1(jsonb)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'effectime_private.parse_profile_birthday_month_day_v1(jsonb)',
    'EXECUTE'
  ),
  'routine EXECUTE grants are broader than the runtime contract'
);

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.table_privileges
    WHERE grantee IN ('PUBLIC', 'anon', 'authenticated')
      AND table_schema = 'public'
      AND table_name = 'profiles'
  )
  AND COALESCE((
    SELECT pg_catalog.array_agg(DISTINCT column_name ORDER BY column_name)
      FILTER (WHERE privilege_type = 'SELECT') = ARRAY[
        'avatar_url', 'display_name', 'user_id'
      ]::information_schema.sql_identifier[]
      AND pg_catalog.array_agg(DISTINCT column_name ORDER BY column_name)
      FILTER (WHERE privilege_type = 'UPDATE') = ARRAY[
        'avatar_url', 'display_name', 'preferred_locale'
      ]::information_schema.sql_identifier[]
      AND pg_catalog.count(DISTINCT (column_name, privilege_type)) = 6
    FROM information_schema.column_privileges
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name = 'profiles'
  ), false)
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.column_privileges
    WHERE grantee IN ('PUBLIC', 'anon')
      AND table_schema = 'public'
      AND table_name = 'profiles'
  )
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'DELETE')
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'REFERENCES')
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'TRIGGER'),
  'browser profile column/table grants are not minimal'
);

-- Two-tenant RLS: active viewers see self plus every historical-state target in
-- shared workspaces, including the token-bearing profile rejected by the legacy
-- permissive policy.  They never see another tenant.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
SET TIME ZONE 'Pacific/Honolulu';
SELECT contract.assert_true(
  (SELECT count(*) = 6 FROM public.profiles)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '10000000-0000-4000-8000-000000000002'
      AND display_name = 'Active A'
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '10000000-0000-4000-8000-000000000003'
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '10000000-0000-4000-8000-000000000004'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id IN (
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '90000000-0000-4000-8000-000000000001'
    )
  ),
  'workspace A profile visibility leaked or hid shared history'
);
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false
);
SELECT contract.assert_true(
  (SELECT count(*) = 3 FROM public.profiles)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '10000000-0000-4000-8000-000000000002'
      AND display_name = 'Active A'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id::text LIKE '10000000-%'
      AND user_id <> '10000000-0000-4000-8000-000000000002'
  ),
  'workspace B viewer crossed the shared-identity tenant boundary'
);
RESET ROLE;

-- Directory identity (user_id/display_name/avatar_url) is an explicit
-- collaboration contract for every active coworker, even when the role cannot
-- open the Members feature. It never includes locale or raw preferences.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', false
);
SELECT contract.assert_true(
  (SELECT count(*) = 6 FROM public.profiles)
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = '10000000-0000-4000-8000-000000000002'
      AND display_name = 'Active A'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id::text LIKE '20000000-%'
  ),
  'active coworker directory contract crossed tenants or required member admin permission'
);
DO $directory_excludes_own_locale$
BEGIN
  BEGIN
    PERFORM profile.preferred_locale FROM public.profiles AS profile;
    RAISE EXCEPTION 'directory projection unexpectedly exposed preferred_locale';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$directory_excludes_own_locale$;
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', false
);
SELECT contract.assert_true(
  (SELECT count(*) = 1 FROM public.profiles)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '10000000-0000-4000-8000-000000000004'
  ),
  'suspended viewer received shared-workspace profile visibility'
);
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', false
);
SELECT contract.assert_true(
  (SELECT count(*) = 9 FROM public.profiles),
  'platform admin directory resolution regressed'
);
RESET ROLE;

-- Runtime ACL and own-update behavior are tested as the actual browser role.
SET ROLE anon;
DO $anon_has_no_profile_access$
BEGIN
  BEGIN
    PERFORM profile.display_name FROM public.profiles AS profile;
    RAISE EXCEPTION 'anon unexpectedly selected profiles';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$anon_has_no_profile_access$;
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
DO $sensitive_columns_and_writes_denied$
DECLARE
  v_rows bigint;
  v_name text;
BEGIN
  BEGIN
    PERFORM profile.id FROM public.profiles AS profile;
    RAISE EXCEPTION 'authenticated unexpectedly selected internal profile id';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM profile.preferred_locale FROM public.profiles AS profile;
    RAISE EXCEPTION 'authenticated unexpectedly selected locale directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM profile.preferences FROM public.profiles AS profile;
    RAISE EXCEPTION 'authenticated unexpectedly selected preferences';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM profile.temp_access_token FROM public.profiles AS profile;
    RAISE EXCEPTION 'authenticated unexpectedly selected temp token';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM profile.drift_private_note FROM public.profiles AS profile;
    RAISE EXCEPTION 'authenticated unexpectedly selected drift-only profile data';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles
    SET preferences = '{}'::jsonb
    WHERE user_id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'authenticated unexpectedly updated preferences';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles
    SET user_id = '80000000-0000-4000-8000-000000000001'
    WHERE user_id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'authenticated unexpectedly updated user_id';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.profiles(id, user_id, display_name)
    VALUES (
      'f0000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      'Injected'
    );
    RAISE EXCEPTION 'authenticated unexpectedly inserted a profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.profiles
    WHERE user_id = '10000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'authenticated unexpectedly deleted a profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE public.profiles;
    RAISE EXCEPTION 'authenticated unexpectedly truncated profiles';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF public.get_my_profile_locale_v1() IS DISTINCT FROM 'hu' THEN
    RAISE EXCEPTION 'own-profile locale RPC returned the wrong value';
  END IF;

  v_name := public.update_my_workspace_profile_display_name_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000001',
    '  Actor A RPC  '
  );
  IF v_name IS DISTINCT FROM 'Actor A RPC' THEN
    RAISE EXCEPTION 'self display-name RPC did not normalize its result';
  END IF;

  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002',
      'Shared identity renamed'
    );
    RAISE EXCEPTION 'workspace admin renamed another user global identity';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'b1000000-0000-4000-8000-000000000002',
      'Cross tenant rename'
    );
    RAISE EXCEPTION 'display-name RPC accepted a cross-tenant membership';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000007',
      'Inactive target rename'
    );
    RAISE EXCEPTION 'display-name RPC accepted an inactive target membership';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002',
      E'Invalid\nname'
    );
    RAISE EXCEPTION 'display-name RPC accepted control characters';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  UPDATE public.profiles
  SET display_name = 'Actor A updated', preferred_locale = 'ro'
  WHERE user_id = '10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'own safe profile update changed % rows', v_rows;
  END IF;

  UPDATE public.profiles
  SET display_name = 'Cross-user write'
  WHERE user_id = '10000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'own update policy changed another profile';
  END IF;

  BEGIN
    UPDATE public.profiles
    SET preferred_locale = 'fr'
    WHERE user_id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'unsupported locale unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$sensitive_columns_and_writes_denied$;
RESET ROLE;

SELECT contract.assert_true(
  (SELECT display_name = 'Actor A updated' AND preferred_locale = 'ro'
   FROM public.profiles
   WHERE user_id = '10000000-0000-4000-8000-000000000001')
  AND
  (SELECT display_name = 'Active A'
   FROM public.profiles
   WHERE user_id = '10000000-0000-4000-8000-000000000002'),
  'safe own update or cross-user write guard failed'
);

UPDATE public.fixture_workspace_features
SET enabled = false
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'member_edit';

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
DO $member_edit_entitlement_denied$
BEGIN
  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002',
      'Unentitled rename'
    );
    RAISE EXCEPTION 'workspace without member_edit renamed a coworker';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$member_edit_entitlement_denied$;
RESET ROLE;

UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'member_edit';

SET ROLE service_role;
SELECT contract.assert_true(
  (SELECT count(*) = 9 FROM public.profiles)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE preferences -> 'pending_email_activation' ->> 'token' = 'actor-a-secret'
  ),
  'service_role lost its existing table access or RLS bypass'
);
DO $service_has_no_milestone_execute$
BEGIN
  BEGIN
    PERFORM public.get_my_profile_locale_v1();
    RAISE EXCEPTION 'service_role unexpectedly executed own-locale RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000001',
      'Service rename'
    );
    RAISE EXCEPTION 'service_role unexpectedly executed display-name RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    );
    RAISE EXCEPTION 'service_role unexpectedly executed browser milestone RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$service_has_no_milestone_execute$;
RESET ROLE;

-- Parser is defensive for malformed calendar values and is not a runtime data
-- extraction surface.
SELECT contract.assert_true(
  (SELECT count(*) = 1
   FROM effectime_private.parse_profile_birthday_month_day_v1(
     '{"birthday":"2024-02-29"}'::jsonb
   ))
  AND
  (SELECT count(*) = 0
   FROM effectime_private.parse_profile_birthday_month_day_v1(
     '{"birthday":"2025-02-29"}'::jsonb
   ))
  AND
  (SELECT count(*) = 0
   FROM effectime_private.parse_profile_birthday_month_day_v1(
     '{"birthday":"not-a-date"}'::jsonb
   )),
  'birthday parser did not fail safely for invalid dates'
);

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false
);
DO $parser_runtime_acl_denied$
BEGIN
  BEGIN
    PERFORM 1
    FROM effectime_private.parse_profile_birthday_month_day_v1(
      '{"birthday":"2000-01-01"}'::jsonb
    );
    RAISE EXCEPTION 'authenticated unexpectedly executed private parser';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$parser_runtime_acl_denied$;

SELECT contract.assert_true(
  (SELECT count(*) = 7
   FROM public.get_workspace_member_milestones_v1(
     '11111111-1111-4111-8111-111111111111'
   ))
  AND EXISTS (
    SELECT 1
    FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    ) AS milestone
    WHERE milestone.membership_id = 'a1000000-0000-4000-8000-000000000002'
      AND milestone.display_name = 'Active A'
      AND milestone.milestone_type = 'birthday'
      AND milestone.milestone_month = 7
      AND milestone.milestone_day = 19
  )
  AND EXISTS (
    SELECT 1
    FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    ) AS milestone
    WHERE milestone.membership_id = 'a1000000-0000-4000-8000-000000000002'
      AND milestone.milestone_type = 'anniversary'
      AND milestone.milestone_month = 4
      AND milestone.milestone_day = 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    ) AS milestone
    WHERE milestone.membership_id IN (
      'a1000000-0000-4000-8000-000000000003',
      'a1000000-0000-4000-8000-000000000004',
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    ) AS milestone
    WHERE milestone.membership_id = 'a1000000-0000-4000-8000-000000000005'
      AND milestone.milestone_type = 'birthday'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    ) AS milestone
    WHERE (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.jsonb_object_keys(pg_catalog.to_jsonb(milestone)) AS key
    ) <> 5
       OR pg_catalog.to_jsonb(milestone)::text LIKE '%actor-a-secret%'
       OR pg_catalog.to_jsonb(milestone)::text LIKE '%shared-a-secret%'
       OR pg_catalog.to_jsonb(milestone)::text LIKE '%1990%'
  ),
  'workspace A milestone projection leaked, omitted or crossed tenants'
);
SET TIME ZONE 'Asia/Tokyo';
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    ) AS milestone
    WHERE milestone.membership_id = 'a1000000-0000-4000-8000-000000000002'
      AND milestone.milestone_type = 'anniversary'
      AND milestone.milestone_month = 4
      AND milestone.milestone_day = 1
  ),
  'anniversary changed with the PostgreSQL session timezone'
);
RESET TIME ZONE;
RESET ROLE;

-- A suspended caller, a caller without members permission, and a workspace
-- without the entitlement all fail closed.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', false
);
DO $suspended_milestone_denied$
BEGIN
  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000004',
      'Suspended rename'
    );
    RAISE EXCEPTION 'suspended caller unexpectedly renamed their profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    );
    RAISE EXCEPTION 'suspended caller unexpectedly read milestones';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$suspended_milestone_denied$;
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', false
);
DO $members_permission_denied$
BEGIN
  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002',
      'Unauthorized rename'
    );
    RAISE EXCEPTION 'caller without members edit permission renamed a coworker';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    );
    RAISE EXCEPTION 'caller without members permission read milestones';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$members_permission_denied$;
RESET ROLE;

INSERT INTO public.enterprise_role_permissions(
  workspace_id, role_key, feature_key, access_level
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'resourceAssistant',
  'members',
  'readonly'
);
UPDATE public.enterprise_role_permissions
SET access_level = 'none'
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND role_key = 'resourceAssistant'
  AND feature_key = 'calendar';

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', false
);
DO $calendar_permission_denied$
BEGIN
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    );
    RAISE EXCEPTION 'caller without calendar permission read milestones';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$calendar_permission_denied$;
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false
);
DO $feature_entitlement_denied$
BEGIN
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '22222222-2222-4222-8222-222222222222'
    );
    RAISE EXCEPTION 'workspace without birthday_widget read milestones';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$feature_entitlement_denied$;
RESET ROLE;

UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '22222222-2222-4222-8222-222222222222'
  AND feature_key = 'birthday_widget';

UPDATE public.fixture_workspace_features
SET enabled = false
WHERE workspace_id = '22222222-2222-4222-8222-222222222222'
  AND feature_key = 'members_list';

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false
);
DO $members_entitlement_denied$
BEGIN
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '22222222-2222-4222-8222-222222222222'
    );
    RAISE EXCEPTION 'workspace without members_list read milestones';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$members_entitlement_denied$;
RESET ROLE;

UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '22222222-2222-4222-8222-222222222222'
  AND feature_key = 'members_list';

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false
);
SELECT contract.assert_true(
  (SELECT count(*) = 6
   FROM public.get_workspace_member_milestones_v1(
     '22222222-2222-4222-8222-222222222222'
   ))
  AND NOT EXISTS (
    SELECT 1
    FROM public.get_workspace_member_milestones_v1(
      '22222222-2222-4222-8222-222222222222'
    ) AS milestone
    WHERE milestone.membership_id::text LIKE 'a1000000-%'
  ),
  'entitled workspace B milestone RPC crossed tenant boundary'
);
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', false
);
DO $platform_admin_without_membership_denied$
BEGIN
  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002',
      'Platform rename'
    );
    RAISE EXCEPTION 'platform admin without membership renamed a workspace member';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    );
    RAISE EXCEPTION 'platform admin bypassed workspace milestone gates';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$platform_admin_without_membership_denied$;
RESET ROLE;

SET ROLE anon;
DO $anon_milestone_execute_denied$
BEGIN
  BEGIN
    PERFORM public.get_my_profile_locale_v1();
    RAISE EXCEPTION 'anon unexpectedly executed own-locale RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000001',
      'Anon rename'
    );
    RAISE EXCEPTION 'anon unexpectedly executed display-name RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.get_workspace_member_milestones_v1(
      '11111111-1111-4111-8111-111111111111'
    );
    RAISE EXCEPTION 'anon unexpectedly executed milestone RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$anon_milestone_execute_denied$;
RESET ROLE;

SELECT 'profiles_tenant_migration_contract_passed' AS assertion;
