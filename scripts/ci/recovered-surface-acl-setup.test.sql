\set ON_ERROR_STOP on

-- Minimal, production-shaped Supabase prerequisites for the byte-attested
-- clock-in and marketplace migrations. The three mounted historical files are
-- applied unchanged below; this fixture only supplies their dependencies.
DO $roles$
BEGIN
  IF pg_catalog.to_regrole('anon') IS NULL THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF pg_catalog.to_regrole('authenticated') IS NULL THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF pg_catalog.to_regrole('service_role') IS NULL THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF pg_catalog.to_regrole('contract_acl_parent') IS NULL THEN
    CREATE ROLE contract_acl_parent NOLOGIN;
  END IF;
  IF pg_catalog.to_regrole('contract_untrusted_owner') IS NULL THEN
    CREATE ROLE contract_untrusted_owner NOLOGIN;
  END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS contract AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS effectime_private AUTHORIZATION postgres;
REVOKE CREATE ON SCHEMA public, extensions FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA contract TO anon, authenticated, service_role;
-- Production already contains unrelated helpers in this schema. The plugin
-- migration must preserve their identity and the existing schema ACL while
-- still denying every direct table/column path to raw plugin config.
GRANT USAGE ON SCHEMA effectime_private TO authenticated;

CREATE FUNCTION effectime_private.contract_existing_helper()
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT true
$$;
GRANT EXECUTE ON FUNCTION effectime_private.contract_existing_helper()
  TO authenticated;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.enterprise_role AS ENUM (
  'owner',
  'resourceAssistant',
  'member'
);
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE
);

CREATE TABLE public.enterprise_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.enterprise_memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.enterprise_role NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.enterprise_offices (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL
);

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE public.features (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  name text NOT NULL,
  module text NOT NULL,
  description text,
  status text NOT NULL,
  dependencies text[] NOT NULL DEFAULT '{}'::text[],
  route_path text,
  menu_path text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.tiers (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  tier_key text NOT NULL UNIQUE
);

CREATE TABLE public.tier_features (
  tier_id uuid NOT NULL REFERENCES public.tiers(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  PRIMARY KEY (tier_id, feature_id)
);

INSERT INTO public.tiers (tier_key) VALUES ('pro'), ('enterprise');
INSERT INTO public.features (
  feature_key, name, module, description, status, dependencies, route_path, menu_path, sort_order
) VALUES (
  'attendance_log', 'Attendance log', 'attendance', 'Contract dependency', 'active',
  '{}'::text[], '/w/:workspaceId', ARRAY['Time & Attendance'], 1
);

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), '')
$$;

CREATE FUNCTION public.has_enterprise_role(
  _workspace_id uuid,
  _user_id uuid,
  _roles public.enterprise_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.user_id = _user_id
      AND membership.status = 'active'
      AND membership.role = ANY (_roles)
  )
$$;

CREATE FUNCTION public.is_enterprise_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.user_id = _user_id
      AND membership.status = 'active'
  )
$$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS role_record
    WHERE role_record.user_id = _user_id
      AND role_record.role = _role
  )
$$;

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

-- The recovered clock_events SELECT policy reads memberships directly under
-- the caller role, matching the existing Supabase browser read contract.
GRANT SELECT ON TABLE public.enterprise_memberships TO authenticated;

\ir /contract/clock-migration.sql
\ir /contract/marketplace-migration.sql
\ir /contract/clockout-migration.sql

-- Canonical post-v3.33.3 production state. That later search_path migration is
-- outside this contract's six-file mount allowlist, so reproduce its exact
-- haversine metadata without changing the recovered historical source.
ALTER FUNCTION public.haversine_km(numeric, numeric, numeric, numeric)
  SET search_path = public;

-- Deterministic two-tenant fixture. Every recovered table is non-empty so the
-- data-stability assertion detects accidental DML, not only DDL drift.
INSERT INTO auth.users (id, email) VALUES
  ('10000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'member-a@example.test'),
  ('10000000-0000-4000-8000-000000000003', 'developer-admin@example.test'),
  ('10000000-0000-4000-8000-000000000004', 'outsider@example.test'),
  ('10000000-0000-4000-8000-000000000005', 'owner-b@example.test'),
  ('10000000-0000-4000-8000-000000000006', 'assistant-a@example.test');

INSERT INTO public.profiles (user_id, display_name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Owner A'),
  ('10000000-0000-4000-8000-000000000002', 'Member A'),
  ('10000000-0000-4000-8000-000000000003', 'Developer Admin'),
  ('10000000-0000-4000-8000-000000000004', 'Outsider'),
  ('10000000-0000-4000-8000-000000000005', 'Owner B'),
  ('10000000-0000-4000-8000-000000000006', 'Assistant A');

INSERT INTO public.enterprise_workspaces (id, name) VALUES
  ('20000000-0000-4000-8000-000000000001', 'Workspace A'),
  ('20000000-0000-4000-8000-000000000002', 'Workspace B');

INSERT INTO public.enterprise_memberships (id, workspace_id, user_id, role, status) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'member', 'active'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'owner', 'active'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'resourceAssistant', 'active');

INSERT INTO public.enterprise_offices (
  id, workspace_id, name, geofence_lat, geofence_lng, geofence_radius_m, clock_in_nfc_tag
) VALUES
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Office A', 47.4979, 19.0402, 200, 'office-a-nfc'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Office B', 47.5316, 21.6273, 200, 'office-b-nfc');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('10000000-0000-4000-8000-000000000003', 'admin');

INSERT INTO public.clock_events (
  id, workspace_id, membership_id, event_type, method, office_id, verified, raw_data, created_at
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'clock_in', 'manual', '40000000-0000-4000-8000-000000000001', false,
  '{"fixture":"pre-hardening"}'::jsonb, '2026-07-22 04:00:00+00'
);

INSERT INTO public.qr_clock_sessions (
  id, office_id, workspace_id, code, created_by, expires_at, created_at
) VALUES (
  '51000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'fixture-expired-code',
  '10000000-0000-4000-8000-000000000001',
  '2026-07-22 04:01:00+00', '2026-07-22 04:00:00+00'
);

INSERT INTO public.workspace_installed_plugins (
  id, workspace_id, plugin_id, config, enabled, installed_by, installed_at, updated_at
)
SELECT
  '52000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  plugin.id,
  '{"fixture":true}'::jsonb,
  true,
  '10000000-0000-4000-8000-000000000001',
  '2026-07-22 04:00:00+00', '2026-07-22 04:00:00+00'
FROM public.marketplace_plugins AS plugin
WHERE plugin.slug = 'birthday-bot';

INSERT INTO public.plugin_webhook_events (
  id, workspace_id, installed_plugin_id, event_type, payload, created_at
) VALUES (
  '53000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  'contract.fixture', '{"fixture":true}'::jsonb, '2026-07-22 04:00:00+00'
);

-- Deliberately broad historical drift. The hardening migration must remove it
-- for browser roles while preserving service_role's effective table, column,
-- and function privileges (including privileges inherited through PUBLIC).
GRANT ALL PRIVILEGES ON TABLE
  public.clock_events,
  public.qr_clock_sessions,
  public.marketplace_plugins,
  public.workspace_installed_plugins,
  public.plugin_webhook_events
TO PUBLIC;
GRANT UPDATE (raw_data) ON public.clock_events TO anon, authenticated;
GRANT UPDATE (code) ON public.qr_clock_sessions TO anon, authenticated;
GRANT UPDATE (manifest) ON public.marketplace_plugins TO anon, authenticated;
GRANT UPDATE (config) ON public.workspace_installed_plugins TO anon, authenticated;
GRANT UPDATE (payload) ON public.plugin_webhook_events TO anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.haversine_km(numeric, numeric, numeric, numeric),
  public.clock_generate_qr(uuid, integer),
  public.clock_event(uuid, text, text, numeric, numeric, text, text, uuid),
  public.marketplace_submit_plugin(text, text, text, text, jsonb, text, text),
  public.marketplace_set_plugin_status(uuid, text),
  public.marketplace_install_plugin(uuid, uuid, jsonb),
  public.marketplace_uninstall_plugin(uuid)
TO PUBLIC;

-- A hostile public-schema shadow must never be resolved by clock_generate_qr.
CREATE FUNCTION public.gen_random_bytes(integer)
RETURNS bytea
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'malicious public.gen_random_bytes executed';
END;
$$;

CREATE TABLE contract.object_baseline (
  object_kind text NOT NULL,
  identity text PRIMARY KEY,
  object_oid oid NOT NULL,
  prosrc text
);
CREATE TABLE contract.policy_baseline (
  table_identity text NOT NULL,
  policy_name text NOT NULL,
  policy_oid oid NOT NULL,
  policy_shape text NOT NULL,
  PRIMARY KEY (table_identity, policy_name)
);
CREATE TABLE contract.data_baseline (
  table_identity text PRIMARY KEY,
  row_count bigint NOT NULL,
  content_digest text NOT NULL
);
CREATE TABLE contract.state_baseline (
  state_name text PRIMARY KEY,
  state_value jsonb NOT NULL
);

INSERT INTO contract.object_baseline (object_kind, identity, object_oid, prosrc)
SELECT 'table', identity, identity::pg_catalog.regclass::oid, NULL
FROM pg_catalog.unnest(ARRAY[
  'public.clock_events',
  'public.qr_clock_sessions',
  'public.marketplace_plugins',
  'public.workspace_installed_plugins',
  'public.plugin_webhook_events'
]) AS table_identity(identity);

INSERT INTO contract.object_baseline (object_kind, identity, object_oid, prosrc)
SELECT
  'function',
  identity,
  identity::pg_catalog.regprocedure::oid,
  procedure.prosrc
FROM pg_catalog.unnest(ARRAY[
  'public.haversine_km(numeric,numeric,numeric,numeric)',
  'public.clock_generate_qr(uuid,integer)',
  'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
  'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
  'public.marketplace_set_plugin_status(uuid,text)',
  'public.marketplace_install_plugin(uuid,uuid,jsonb)',
  'public.marketplace_uninstall_plugin(uuid)'
]) AS function_identity(identity)
JOIN pg_catalog.pg_proc AS procedure
  ON procedure.oid = identity::pg_catalog.regprocedure::oid;

INSERT INTO contract.policy_baseline (table_identity, policy_name, policy_oid, policy_shape)
SELECT
  pg_catalog.format('%I.%I', namespace.nspname, relation.relname),
  policy.polname,
  policy.oid,
  pg_catalog.concat_ws(
    '|',
    policy.polcmd,
    policy.polpermissive::text,
    policy.polroles::text,
    COALESCE(pg_catalog.pg_get_expr(policy.polqual, policy.polrelid), ''),
    COALESCE(pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid), '')
  )
FROM pg_catalog.pg_policy AS policy
JOIN pg_catalog.pg_class AS relation ON relation.oid = policy.polrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname = ANY (ARRAY[
    'clock_events',
    'qr_clock_sessions',
    'marketplace_plugins',
    'workspace_installed_plugins',
    'plugin_webhook_events'
  ]);

CREATE FUNCTION contract.table_state(_table pg_catalog.regclass)
RETURNS TABLE(row_count bigint, content_digest text)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $$
BEGIN
  RETURN QUERY EXECUTE pg_catalog.format(
    'SELECT count(*)::bigint, md5(COALESCE(string_agg(to_jsonb(row_record)::text, %L ORDER BY to_jsonb(row_record)::text), %L)) FROM %s AS row_record',
    '|',
    '',
    _table
  );
END;
$$;

INSERT INTO contract.data_baseline (table_identity, row_count, content_digest)
SELECT identity, state.row_count, state.content_digest
FROM pg_catalog.unnest(ARRAY[
  'public.clock_events',
  'public.qr_clock_sessions',
  'public.marketplace_plugins',
  'public.workspace_installed_plugins',
  'public.plugin_webhook_events'
]) AS table_identity(identity)
CROSS JOIN LATERAL contract.table_state(identity::pg_catalog.regclass) AS state;

CREATE FUNCTION contract.mutable_surface_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'tables', (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'identity', table_identity.identity,
          'acl', COALESCE(relation.relacl::text, '<null>'),
          'columns', (
            SELECT COALESCE(
              pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'name', attribute.attname,
                  'acl', COALESCE(attribute.attacl::text, '<null>')
                ) ORDER BY attribute.attnum
              ),
              '[]'::jsonb
            )
            FROM pg_catalog.pg_attribute AS attribute
            WHERE attribute.attrelid = relation.oid
              AND attribute.attnum > 0
              AND NOT attribute.attisdropped
          )
        ) ORDER BY table_identity.identity
      )
      FROM pg_catalog.unnest(ARRAY[
        'public.clock_events',
        'public.qr_clock_sessions',
        'public.marketplace_plugins',
        'public.workspace_installed_plugins',
        'public.plugin_webhook_events'
      ]) AS table_identity(identity)
      JOIN pg_catalog.pg_class AS relation
        ON relation.oid = table_identity.identity::pg_catalog.regclass::oid
    ),
    'functions', (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'identity', function_identity.identity,
          'acl', COALESCE(procedure.proacl::text, '<null>'),
          'config', COALESCE(procedure.proconfig::text, '<null>'),
          'security_definer', procedure.prosecdef
        ) ORDER BY function_identity.identity
      )
      FROM pg_catalog.unnest(ARRAY[
        'public.haversine_km(numeric,numeric,numeric,numeric)',
        'public.clock_generate_qr(uuid,integer)',
        'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
        'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
        'public.marketplace_set_plugin_status(uuid,text)',
        'public.marketplace_install_plugin(uuid,uuid,jsonb)',
        'public.marketplace_uninstall_plugin(uuid)'
      ]) AS function_identity(identity)
      JOIN pg_catalog.pg_proc AS procedure
        ON procedure.oid = function_identity.identity::pg_catalog.regprocedure::oid
    )
  )
$$;

CREATE FUNCTION contract.service_role_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'tables', (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'identity', identity,
          'select', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'SELECT'),
          'insert', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'INSERT'),
          'update', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'UPDATE'),
          'delete', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'DELETE'),
          'truncate', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'TRUNCATE'),
          'references', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'REFERENCES'),
          'trigger', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'TRIGGER'),
          'maintain', pg_catalog.has_table_privilege('service_role', identity::pg_catalog.regclass, 'MAINTAIN')
        ) ORDER BY identity
      )
      FROM pg_catalog.unnest(ARRAY[
        'public.clock_events',
        'public.qr_clock_sessions',
        'public.marketplace_plugins',
        'public.workspace_installed_plugins',
        'public.plugin_webhook_events'
      ]) AS table_identity(identity)
    ),
    'functions', (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'identity', identity,
          'execute', pg_catalog.has_function_privilege(
            'service_role', identity::pg_catalog.regprocedure, 'EXECUTE'
          )
        ) ORDER BY identity
      )
      FROM pg_catalog.unnest(ARRAY[
        'public.haversine_km(numeric,numeric,numeric,numeric)',
        'public.clock_generate_qr(uuid,integer)',
        'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
        'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
        'public.marketplace_set_plugin_status(uuid,text)',
        'public.marketplace_install_plugin(uuid,uuid,jsonb)',
        'public.marketplace_uninstall_plugin(uuid)'
      ]) AS function_identity(identity)
    )
  )
$$;

CREATE FUNCTION contract.pgcrypto_trust_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'schema_oid', namespace.oid,
    'schema_owner', namespace.nspowner,
    'extension_oid', extension.oid,
    'extension_owner', extension.extowner,
    'extension_schema', extension.extnamespace,
    'gen_random_bytes_oid', generator.oid,
    'gen_random_bytes_owner', generator.proowner,
    'gen_random_bytes_member', EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend AS dependency
      WHERE dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        AND dependency.objid = generator.oid
        AND dependency.objsubid = 0
        AND dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
        AND dependency.refobjid = extension.oid
        AND dependency.deptype = 'e'
    ),
    'digest_oid', digest.oid,
    'digest_owner', digest.proowner,
    'digest_member', EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend AS dependency
      WHERE dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        AND dependency.objid = digest.oid
        AND dependency.objsubid = 0
        AND dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
        AND dependency.refobjid = extension.oid
        AND dependency.deptype = 'e'
    )
  )
  FROM pg_catalog.pg_namespace AS namespace
  JOIN pg_catalog.pg_extension AS extension
    ON extension.extname = 'pgcrypto'
   AND extension.extnamespace = namespace.oid
  JOIN pg_catalog.pg_proc AS generator
    ON generator.oid = 'extensions.gen_random_bytes(integer)'::pg_catalog.regprocedure::oid
  JOIN pg_catalog.pg_proc AS digest
    ON digest.oid = 'extensions.digest(bytea,text)'::pg_catalog.regprocedure::oid
  WHERE namespace.nspname = 'extensions'
$$;

CREATE FUNCTION contract.assert_core_unchanged(
  _allow_hardened_qr_source boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_baseline record;
  v_state record;
  v_policy_count integer;
BEGIN
  FOR v_baseline IN SELECT * FROM contract.object_baseline ORDER BY identity LOOP
    IF v_baseline.object_kind = 'table' THEN
      IF pg_catalog.to_regclass(v_baseline.identity)::oid IS DISTINCT FROM v_baseline.object_oid THEN
        RAISE EXCEPTION 'Recovered table OID drift: %', v_baseline.identity;
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid = pg_catalog.to_regprocedure(v_baseline.identity)::oid
        AND procedure.oid = v_baseline.object_oid
        AND (
          procedure.prosrc = v_baseline.prosrc
          OR (
            _allow_hardened_qr_source
            AND v_baseline.identity = 'public.clock_generate_qr(uuid,integer)'
            AND procedure.prosrc = (
              SELECT state_value->>'prosrc'
              FROM contract.state_baseline
              WHERE state_name = 'hardened_qr_source'
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Recovered function OID/source drift: %', v_baseline.identity;
    END IF;
  END LOOP;

  FOR v_baseline IN SELECT * FROM contract.policy_baseline ORDER BY table_identity, policy_name LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS relation ON relation.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE pg_catalog.format('%I.%I', namespace.nspname, relation.relname) =
            v_baseline.table_identity
        AND policy.polname = v_baseline.policy_name
        AND policy.oid = v_baseline.policy_oid
        AND pg_catalog.concat_ws(
          '|', policy.polcmd, policy.polpermissive::text, policy.polroles::text,
          COALESCE(pg_catalog.pg_get_expr(policy.polqual, policy.polrelid), ''),
          COALESCE(pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid), '')
        ) = v_baseline.policy_shape
    ) THEN
      RAISE EXCEPTION 'Recovered RLS policy drift: %.%',
        v_baseline.table_identity,
        v_baseline.policy_name;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_policy_count
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS relation ON relation.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (ARRAY[
      'clock_events', 'qr_clock_sessions', 'marketplace_plugins',
      'workspace_installed_plugins', 'plugin_webhook_events'
    ]);
  IF v_policy_count IS DISTINCT FROM (SELECT count(*) FROM contract.policy_baseline) THEN
    RAISE EXCEPTION 'Recovered RLS policy count drift: %', v_policy_count;
  END IF;

  FOR v_baseline IN SELECT * FROM contract.data_baseline ORDER BY table_identity LOOP
    SELECT * INTO v_state
    FROM contract.table_state(v_baseline.table_identity::pg_catalog.regclass);
    IF v_state.row_count IS DISTINCT FROM v_baseline.row_count
       OR v_state.content_digest IS DISTINCT FROM v_baseline.content_digest THEN
      RAISE EXCEPTION 'Recovered table data drift: %', v_baseline.table_identity;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION contract.assert_preflight_left_no_partial_mutation()
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM contract.assert_core_unchanged(false);
  IF contract.mutable_surface_state() IS DISTINCT FROM (
    SELECT state_value FROM contract.state_baseline WHERE state_name = 'pre_hardening_mutable'
  ) THEN
    RAISE EXCEPTION 'Failed hardening preflight left partial ACL/search_path mutation';
  END IF;
  IF contract.pgcrypto_trust_state() IS DISTINCT FROM (
    SELECT state_value FROM contract.state_baseline WHERE state_name = 'pgcrypto_trust'
  ) THEN
    RAISE EXCEPTION 'Failed hardening preflight left pgcrypto trust metadata drift';
  END IF;
END;
$$;

CREATE FUNCTION contract.expect_insufficient_privilege(_statement text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  EXECUTE _statement;
  RAISE EXCEPTION 'Expected insufficient_privilege, statement succeeded: %', _statement;
EXCEPTION
  WHEN insufficient_privilege THEN
    RETURN;
END;
$$;
GRANT EXECUTE ON FUNCTION contract.expect_insufficient_privilege(text)
  TO anon, authenticated, service_role;

INSERT INTO contract.state_baseline (state_name, state_value) VALUES
  ('pre_hardening_mutable', contract.mutable_surface_state()),
  ('service_role', contract.service_role_state()),
  ('pgcrypto_trust', contract.pgcrypto_trust_state());

SELECT contract.assert_core_unchanged(false);
