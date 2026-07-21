\set ON_ERROR_STOP on
SET client_min_messages TO warning;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA contract;
GRANT USAGE ON SCHEMA auth, contract TO authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

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
GRANT EXECUTE ON FUNCTION contract.assert_true(boolean, text) TO authenticated, service_role;

CREATE TYPE public.enterprise_role AS ENUM ('owner', 'resourceAssistant', 'member');
CREATE TYPE public.enterprise_membership_status AS ENUM (
  'active', 'invited', 'suspended', 'removed'
);

CREATE TABLE public.enterprise_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.enterprise_memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.enterprise_role NOT NULL,
  status public.enterprise_membership_status NOT NULL,
  business_role text,
  location text,
  city text,
  office_id uuid,
  base_working_hours numeric NOT NULL DEFAULT 8 CHECK (
    base_working_hours >= 0 AND base_working_hours <= 24
  ),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.enterprise_offices (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL
);
ALTER TABLE public.enterprise_memberships
  ADD CONSTRAINT enterprise_memberships_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES public.enterprise_offices(id) ON DELETE SET NULL;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text
);

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'assistant-a@example.test'),
  ('10000000-0000-4000-8000-000000000003', 'target-a@example.test'),
  ('10000000-0000-4000-8000-000000000004', 'readonly-a@example.test'),
  ('10000000-0000-4000-8000-000000000005', 'suspended-actor-a@example.test'),
  ('10000000-0000-4000-8000-000000000006', 'suspended-target-a@example.test'),
  ('10000000-0000-4000-8000-000000000007', 'invited-target-a@example.test'),
  ('10000000-0000-4000-8000-000000000008', 'removed-target-a@example.test'),
  ('20000000-0000-4000-8000-000000000001', 'owner-b@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'target-b@example.test');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.enterprise_member_role_allocations (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  percentage numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  is_priority boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (membership_id, business_role)
);
CREATE UNIQUE INDEX enterprise_member_role_allocations_priority_unique
  ON public.enterprise_member_role_allocations(membership_id)
  WHERE is_priority;

CREATE TABLE public.enterprise_audit_events (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  affected_user_id uuid,
  prev_state jsonb,
  new_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'exported')),
  locked_by uuid,
  locked_at timestamptz,
  exported_at timestamptz,
  exported_to text,
  calculation_snapshot jsonb,
  calculation_hash text,
  calculation_version integer
);

CREATE TABLE public.enterprise_role_permissions (
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id),
  role_key text NOT NULL,
  feature_key text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('none', 'readonly', 'edit')),
  PRIMARY KEY (workspace_id, role_key, feature_key)
);

CREATE TABLE public.fixture_workspace_features (
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (workspace_id, feature_key)
);

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

-- Existing v3.51.5 self-only global identity rename contract. The v3.51.6
-- save RPC must delegate to this path instead of acquiring broader profile
-- write authority.
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
  IF v_display_name IS NULL OR v_display_name = ''
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

  IF v_target_user_id IS NULL OR v_target_user_id <> v_actor THEN
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

-- Reproduce the coarse legacy direct-write policies. The candidate migration
-- must intersect these without disabling still-authorized legacy clients.
ALTER TABLE public.enterprise_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fixture membership select"
  ON public.enterprise_memberships FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Fixture coarse membership update"
  ON public.enterprise_memberships FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.enterprise_member_role_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fixture allocation select"
  ON public.enterprise_member_role_allocations FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Fixture coarse allocation insert"
  ON public.enterprise_member_role_allocations FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Fixture coarse allocation update"
  ON public.enterprise_member_role_allocations FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Fixture coarse allocation delete"
  ON public.enterprise_member_role_allocations FOR DELETE TO authenticated
  USING (true);

GRANT SELECT ON public.enterprise_memberships, public.enterprise_offices,
  public.enterprise_member_role_allocations, public.profiles TO authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;
GRANT UPDATE ON public.enterprise_memberships TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.enterprise_member_role_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.enterprise_audit_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods TO authenticated, service_role;
GRANT SELECT, DELETE ON public.enterprise_workspaces TO authenticated, service_role;

INSERT INTO public.enterprise_workspaces(id, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Workspace A'),
  ('22222222-2222-4222-8222-222222222222', 'Workspace B');

INSERT INTO public.enterprise_offices(id, workspace_id, name) VALUES
  ('0a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Office A'),
  ('0b000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Office B');

INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, location, city,
  office_id, base_working_hours
) VALUES
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', 'owner', 'active', NULL, NULL, NULL, NULL, 8),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000002', 'resourceAssistant', 'active', NULL, NULL, NULL, NULL, 8),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000003', 'member', 'active', 'Engineer', 'Old location', 'Old city', '0a000000-0000-4000-8000-000000000001', 8),
  ('a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000004', 'member', 'active', NULL, NULL, NULL, NULL, 8),
  ('a1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000005', 'resourceAssistant', 'suspended', NULL, NULL, NULL, NULL, 8),
  ('a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000006', 'member', 'suspended', NULL, NULL, NULL, NULL, 8),
  ('a1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000007', 'member', 'invited', NULL, NULL, NULL, NULL, 8),
  ('a1000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000008', 'member', 'removed', NULL, NULL, NULL, NULL, 8),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '20000000-0000-4000-8000-000000000001', 'owner', 'active', NULL, NULL, NULL, NULL, 8),
  ('b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '20000000-0000-4000-8000-000000000002', 'member', 'active', NULL, NULL, NULL, NULL, 8);

INSERT INTO public.profiles(id, user_id, display_name) VALUES
  ('f0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Owner A'),
  ('f0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Assistant A'),
  ('f0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Target A'),
  ('f0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'Readonly A'),
  ('f0000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'Suspended actor A'),
  ('f0000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'Suspended target A'),
  ('f0000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', 'Invited target A'),
  ('f0000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008', 'Removed target A'),
  ('f0000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', 'Owner B'),
  ('f0000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 'Target B');

INSERT INTO public.enterprise_role_permissions(
  workspace_id, role_key, feature_key, access_level
) VALUES
  ('11111111-1111-4111-8111-111111111111', 'resourceAssistant', 'members', 'edit'),
  ('11111111-1111-4111-8111-111111111111', 'member', 'members', 'readonly');

INSERT INTO public.fixture_workspace_features(workspace_id, feature_key, enabled) VALUES
  ('11111111-1111-4111-8111-111111111111', 'members_list', true),
  ('22222222-2222-4222-8222-222222222222', 'members_list', true);

INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES
  ('aa000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000003', 'Engineer', 100, true),
  -- Legacy editor output: readable for remediation, but not valid as a new
  -- atomic save snapshot because it neither totals 100 nor has one priority.
  ('ab000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000007', 'Legacy partial', 90, false),
  -- Deliberate legacy cross-tenant mismatch. The runner first proves that the
  -- migration rejects it, then removes this known fixture-only row and retries.
  ('dead0000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000004', 'Legacy mismatch', 100, true);

CREATE TABLE contract.member_profile_save_concurrency_gate (
  id integer PRIMARY KEY,
  released boolean NOT NULL
);
INSERT INTO contract.member_profile_save_concurrency_gate(id, released)
VALUES (1, false);

CREATE TABLE contract.member_profile_save_concurrency_results (
  client text PRIMARY KEY,
  outcome text NOT NULL,
  expected_revision integer NOT NULL,
  response jsonb
);
GRANT SELECT, INSERT ON contract.member_profile_save_concurrency_results TO authenticated;

CREATE OR REPLACE FUNCTION contract.wait_for_member_profile_save_release()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_attempt integer;
BEGIN
  FOR v_attempt IN 1..600 LOOP
    IF EXISTS (
      SELECT 1
      FROM contract.member_profile_save_concurrency_gate AS gate
      WHERE gate.id = 1 AND gate.released
    ) THEN
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
  RAISE EXCEPTION 'Timed out waiting for member profile save concurrency release';
END;
$function$;
REVOKE ALL ON FUNCTION contract.wait_for_member_profile_save_release() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contract.wait_for_member_profile_save_release() TO authenticated;
