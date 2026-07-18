\set ON_ERROR_STOP on
SET client_min_messages TO notice;

-- The same contract file drives concurrent lock and break-glass reopen clients
-- after the base fixture has been applied. For each transition, the runner
-- starts session B only after session A exposes its transaction-scoped advisory
-- barrier. Session A then waits on an explicit database gate, so the runner can
-- prove session B is blocked on the period row before releasing A; no wall-clock
-- sleep is used for ordering.
\if :{?PAYROLL_CONCURRENCY_A}
SET application_name TO 'effectime-payroll-contract-a';
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.fixture_lock_valid_payroll_period(
  '44444444-4444-4444-8444-444444444449',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);
SELECT pg_advisory_xact_lock(734551, 1);
SELECT public.fixture_wait_for_payroll_concurrency_release();
COMMIT;
\elif :{?PAYROLL_CONCURRENCY_B}
SET application_name TO 'effectime-payroll-contract-b';
SET ROLE service_role;
DO $concurrent_second_lock$
BEGIN
  BEGIN
    PERFORM public.fixture_lock_valid_payroll_period(
      '44444444-4444-4444-8444-444444444449',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    );
    RAISE EXCEPTION 'Second concurrent payroll lock unexpectedly succeeded';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'Payroll period is no longer open%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS concurrent second lock serialized and rejected: %', SQLERRM;
  END;
END;
$concurrent_second_lock$;
RESET ROLE;
\elif :{?PAYROLL_CONCURRENCY_VERIFY}
DO $verify_concurrent_lock$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
BEGIN
  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444449';

  IF v_period.status <> 'locked'
     OR v_period.calculation_snapshot IS NULL
     OR v_period.calculation_hash IS NULL
     OR (
       SELECT count(*)
       FROM public.enterprise_audit_events
       WHERE target_id = v_period.id
         AND action = 'payroll.period_locked'
     ) <> 1 THEN
    RAISE EXCEPTION 'Concurrent payroll lock did not produce exactly one snapshot and audit';
  END IF;
  RAISE NOTICE 'PASS concurrent lock has one winner and one audit';
END;
$verify_concurrent_lock$;
SELECT 'payroll_snapshot_concurrency_contract_passed' AS assertion;
\elif :{?PAYROLL_REOPEN_CONCURRENCY_A}
SET application_name TO 'effectime-payroll-reopen-contract-a';
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.reopen_payroll_period_break_glass(
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444453',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'Concurrent reopen session A approved incident'
);
SELECT pg_advisory_xact_lock(734551, 2);
SELECT public.fixture_wait_for_payroll_concurrency_release();
COMMIT;
\elif :{?PAYROLL_REOPEN_CONCURRENCY_B}
SET application_name TO 'effectime-payroll-reopen-contract-b';
SET ROLE service_role;
DO $concurrent_second_reopen$
BEGIN
  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444453',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'Concurrent reopen session B must lose after waiting'
    );
    RAISE EXCEPTION 'Second concurrent payroll reopen unexpectedly succeeded';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'Payroll period is not locked or exported%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS concurrent second reopen serialized and rejected: %', SQLERRM;
  END;
END;
$concurrent_second_reopen$;
RESET ROLE;
\elif :{?PAYROLL_REOPEN_CONCURRENCY_VERIFY}
DO $verify_concurrent_reopen$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
  v_audit public.enterprise_audit_events%ROWTYPE;
  v_expected_open_state constant jsonb := jsonb_build_object(
    'status', 'open',
    'calculation_snapshot', NULL,
    'calculation_hash', NULL,
    'calculation_version', NULL,
    'locked_by', NULL,
    'locked_at', NULL,
    'exported_at', NULL,
    'exported_to', NULL
  );
BEGIN
  SELECT * INTO STRICT v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444453';

  IF v_period.status <> 'open'
     OR v_period.calculation_snapshot IS NOT NULL
     OR v_period.calculation_hash IS NOT NULL
     OR v_period.calculation_version IS NOT NULL
     OR v_period.locked_by IS NOT NULL
     OR v_period.locked_at IS NOT NULL
     OR v_period.exported_at IS NOT NULL
     OR v_period.exported_to IS NOT NULL
     OR v_period.name <> 'Concurrent reopen' THEN
    RAISE EXCEPTION 'Concurrent payroll reopen did not persist the exact open state';
  END IF;

  SELECT * INTO STRICT v_audit
  FROM public.enterprise_audit_events
  WHERE target_id = v_period.id
    AND action = 'payroll.period_reopened_break_glass';
  IF (
       SELECT count(*)
       FROM public.enterprise_audit_events
       WHERE target_id = v_period.id
         AND action = 'payroll.period_reopened_break_glass'
     ) <> 1
     OR v_audit.workspace_id <> v_period.workspace_id
     OR v_audit.actor_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
     OR v_audit.target_type <> 'payroll_period'
     OR v_audit.prev_state->>'status' IS DISTINCT FROM 'locked'
     OR v_audit.prev_state->'calculation_snapshot' IS NULL
     OR v_audit.prev_state->>'calculation_hash' IS NULL
     OR v_audit.prev_state->>'calculation_version' IS DISTINCT FROM '1'
     OR v_audit.prev_state->>'locked_by' IS DISTINCT FROM
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
     OR v_audit.prev_state->>'locked_at' IS NULL
     OR v_audit.prev_state->'exported_at' IS DISTINCT FROM 'null'::jsonb
     OR v_audit.prev_state->'exported_to' IS DISTINCT FROM 'null'::jsonb
     OR v_audit.new_state IS DISTINCT FROM v_expected_open_state
     OR v_audit.metadata IS DISTINCT FROM jsonb_build_object(
       'reason', 'Concurrent reopen session A approved incident',
       'break_glass', true
     ) THEN
    RAISE EXCEPTION 'Concurrent payroll reopen audit is not unique or exact: %',
      row_to_json(v_audit);
  END IF;
  RAISE NOTICE 'PASS concurrent reopen has one winner, exact open state and one audit';
END;
$verify_concurrent_reopen$;
SELECT 'payroll_reopen_concurrency_contract_passed' AS assertion;
\elif :{?PAYROLL_DEMOTION_CONCURRENCY_A}
SET application_name TO 'effectime-payroll-demotion-contract-a';
BEGIN;
DO $demote_payroll_actor$
BEGIN
  UPDATE public.enterprise_memberships
  SET role = 'member',
      status = 'inactive'
  WHERE id = '10000000-0000-4000-8000-000000000005'
    AND workspace_id = '11111111-1111-4111-8111-111111111111'
    AND user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
    AND role = 'owner'
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dedicated payroll admin was not active before concurrent demotion';
  END IF;
END;
$demote_payroll_actor$;
SELECT pg_advisory_xact_lock(734551, 3);
SELECT public.fixture_wait_for_payroll_concurrency_release();
COMMIT;
\elif :{?PAYROLL_DEMOTION_REOPEN_CONCURRENCY_B}
SET application_name TO 'effectime-payroll-demotion-reopen-contract-b';
SET ROLE service_role;
DO $reopen_after_concurrent_actor_demotion$
BEGIN
  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444454',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
      'Concurrent demotion must invalidate break-glass authority'
    );
    RAISE EXCEPTION 'Payroll reopen unexpectedly authorized a concurrently demoted actor';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Active payroll admin membership required%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS concurrent actor demotion invalidated break-glass authority: %',
      SQLERRM;
  END;
END;
$reopen_after_concurrent_actor_demotion$;
RESET ROLE;
\elif :{?PAYROLL_DEMOTION_CONCURRENCY_VERIFY}
DO $verify_actor_demotion_reopen_race$
DECLARE
  v_membership public.enterprise_memberships%ROWTYPE;
  v_period public.payroll_periods%ROWTYPE;
  v_baseline jsonb;
BEGIN
  SELECT * INTO STRICT v_membership
  FROM public.enterprise_memberships
  WHERE id = '10000000-0000-4000-8000-000000000005';
  IF v_membership.role <> 'member'
     OR v_membership.status <> 'inactive' THEN
    RAISE EXCEPTION 'Concurrent payroll actor demotion did not persist: %',
      row_to_json(v_membership);
  END IF;

  SELECT * INTO STRICT v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444454';
  SELECT period_state INTO STRICT v_baseline
  FROM public.fixture_payroll_concurrency_baselines
  WHERE scenario = 'actor-demotion-reopen'
    AND period_id = v_period.id;
  IF to_jsonb(v_period) IS DISTINCT FROM v_baseline
     OR v_period.status <> 'locked'
     OR v_period.calculation_snapshot IS NULL
     OR v_period.calculation_hash IS NULL
     OR v_period.calculation_version <> 1
     OR (
       SELECT count(*)
       FROM public.enterprise_audit_events
       WHERE target_id = v_period.id
         AND action = 'payroll.period_reopened_break_glass'
     ) <> 0 THEN
    RAISE EXCEPTION 'Rejected demoted-actor reopen changed period state or audit evidence';
  END IF;
  RAISE NOTICE 'PASS demotion race is fail-closed with bit-identical locked period and no reopen audit';
END;
$verify_actor_demotion_reopen_race$;
SELECT 'payroll_actor_demotion_reopen_concurrency_contract_passed' AS assertion;
\else

-- ---------------------------------------------------------------------------
-- Minimal pre-migration Supabase-compatible schema and runtime roles.
-- Policies are intentionally permissive so trigger assertions cannot pass only
-- because the fixture accidentally denied the table operation first.
-- ---------------------------------------------------------------------------
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE fixture_untrusted_extensions_owner NOLOGIN;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE TYPE public.enterprise_role AS ENUM ('owner', 'resourceAssistant', 'member');
CREATE TYPE public.enterprise_membership_status AS ENUM ('active', 'inactive');

CREATE TABLE public.enterprise_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.enterprise_memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.enterprise_role NOT NULL,
  status public.enterprise_membership_status NOT NULL,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.tenant_workspaces (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id),
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, workspace_id)
);

CREATE TABLE public.fixture_tenant_features (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  feature_key text NOT NULL,
  source text NOT NULL DEFAULT 'fixture',
  PRIMARY KEY (tenant_id, feature_key)
);

CREATE OR REPLACE FUNCTION public.tenant_id_for_workspace(_workspace_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT tenant_id
  FROM public.tenant_workspaces
  WHERE workspace_id = _workspace_id
  ORDER BY is_primary DESC, created_at
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.tenant_enabled_features(_tenant_id uuid)
RETURNS TABLE(feature_key text, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT feature_key, source
  FROM public.fixture_tenant_features
  WHERE tenant_id = _tenant_id;
$function$;

CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'exported')),
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at timestamptz,
  exported_at timestamptz,
  exported_to text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_periods_dates_check CHECK (end_date > start_date)
);

CREATE TABLE public.enterprise_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  affected_user_id uuid,
  prev_state jsonb,
  new_state jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fixture_payroll_concurrency_gate (
  id integer PRIMARY KEY CHECK (id = 1),
  released boolean NOT NULL
);
INSERT INTO public.fixture_payroll_concurrency_gate(id, released) VALUES (1, false);

CREATE TABLE public.fixture_payroll_concurrency_baselines (
  scenario text PRIMARY KEY,
  period_id uuid NOT NULL,
  period_state jsonb NOT NULL
);

CREATE OR REPLACE FUNCTION public.fixture_wait_for_payroll_concurrency_release()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_deadline timestamptz := clock_timestamp() + interval '45 seconds';
BEGIN
  LOOP
    IF COALESCE((
      SELECT gate.released
      FROM public.fixture_payroll_concurrency_gate AS gate
      WHERE gate.id = 1
    ), false) THEN
      RETURN;
    END IF;
    IF clock_timestamp() >= v_deadline THEN
      RAISE EXCEPTION 'Timed out waiting for payroll concurrency gate release';
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.fixture_wait_for_payroll_concurrency_release() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fixture_wait_for_payroll_concurrency_release() TO service_role;

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_payroll_select ON public.payroll_periods
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY fixture_payroll_insert ON public.payroll_periods
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY fixture_payroll_update ON public.payroll_periods
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY fixture_payroll_delete ON public.payroll_periods
  FOR DELETE TO anon, authenticated USING (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods
  TO anon, authenticated, service_role;
GRANT SELECT ON public.enterprise_memberships, public.enterprise_workspaces,
  public.tenant_workspaces, public.fixture_tenant_features
  TO service_role;
GRANT SELECT, INSERT ON public.enterprise_audit_events
  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_audit_events
  TO service_role;
-- Prove that the production migration removes any historical/runtime
-- TRUNCATE grants instead of relying on the fixture's owner-only defaults.
GRANT TRUNCATE ON public.payroll_periods, public.enterprise_audit_events
  TO anon, authenticated, service_role;

INSERT INTO auth.users(id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5');

INSERT INTO public.enterprise_workspaces(id, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Workspace One'),
  ('22222222-2222-4222-8222-222222222222', 'Workspace Two');

INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'owner',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'member',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'owner',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    'member',
    'inactive'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    'owner',
    'inactive'
  );

INSERT INTO public.tenants(id, name) VALUES
  ('33333333-3333-4333-8333-333333333333', 'Tenant One');
INSERT INTO public.tenant_workspaces(tenant_id, workspace_id) VALUES
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111');
INSERT INTO public.fixture_tenant_features(tenant_id, feature_key) VALUES
  ('33333333-3333-4333-8333-333333333333', 'payroll_engine'),
  ('33333333-3333-4333-8333-333333333333', 'payroll_export');

-- This row predates the immutable snapshot migration. It must remain readable
-- and locked, but exporting it must fail explicitly instead of recalculating.
INSERT INTO public.payroll_periods(
  id, workspace_id, name, start_date, end_date, status, locked_by, locked_at
) VALUES (
  '44444444-4444-4444-8444-444444444442',
  '11111111-1111-4111-8111-111111111111',
  'Legacy June 2026',
  '2026-06-01',
  '2026-06-30',
  'locked',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  now()
);

-- Exercise the actual production migration in isolated child transactions.
-- Each manipulated pgcrypto/schema state must abort before any payroll DDL can
-- commit; the final include below then proves the restored/fresh positive path.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA public;
\! psql -X --username postgres --dbname effectime_payroll_contract --set ON_ERROR_STOP=1 --single-transaction --file /contract/migration.sql
\if :SHELL_ERROR
  \echo 'PASS production migration rejects pgcrypto outside the extensions schema'
\else
  \echo 'FAIL production migration accepted pgcrypto outside the extensions schema'
  \quit 1
\endif
DROP EXTENSION pgcrypto;

CREATE EXTENSION pgcrypto WITH SCHEMA extensions;

ALTER EXTENSION pgcrypto
  DROP FUNCTION extensions.digest(bytea, text);
\! psql -X --username postgres --dbname effectime_payroll_contract --set ON_ERROR_STOP=1 --single-transaction --file /contract/migration.sql
\if :SHELL_ERROR
  \echo 'PASS production migration rejects a non-extension-owned digest function'
\else
  \echo 'FAIL production migration accepted a non-extension-owned digest function'
  \quit 1
\endif
ALTER EXTENSION pgcrypto
  ADD FUNCTION extensions.digest(bytea, text);

GRANT CREATE ON SCHEMA extensions TO authenticated;
\! psql -X --username postgres --dbname effectime_payroll_contract --set ON_ERROR_STOP=1 --single-transaction --file /contract/migration.sql
\if :SHELL_ERROR
  \echo 'PASS production migration rejects untrusted extensions CREATE privilege'
\else
  \echo 'FAIL production migration accepted untrusted extensions CREATE privilege'
  \quit 1
\endif
REVOKE CREATE ON SCHEMA extensions FROM authenticated;

ALTER SCHEMA extensions OWNER TO fixture_untrusted_extensions_owner;
\! psql -X --username postgres --dbname effectime_payroll_contract --set ON_ERROR_STOP=1 --single-transaction --file /contract/migration.sql
\if :SHELL_ERROR
  \echo 'PASS production migration rejects an untrusted extensions schema owner'
\else
  \echo 'FAIL production migration accepted an untrusted extensions schema owner'
  \quit 1
\endif
ALTER SCHEMA extensions OWNER TO postgres;

DO $negative_pgcrypto_rollback_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payroll_periods'
      AND column_name IN (
        'calculation_snapshot', 'calculation_hash', 'calculation_version'
      )
  ) THEN
    RAISE EXCEPTION 'A rejected pgcrypto trust migration committed payroll DDL';
  END IF;
  RAISE NOTICE 'PASS rejected pgcrypto trust migrations rolled back all payroll DDL';
END;
$negative_pgcrypto_rollback_contract$;

DROP EXTENSION pgcrypto;
DROP SCHEMA extensions;

-- Apply the production migration itself from its dedicated read-only mount;
-- no business DDL is duplicated here.
\ir /contract/migration.sql

-- ---------------------------------------------------------------------------
-- Compile, extension, ACL, trigger and search-path contracts.
-- ---------------------------------------------------------------------------
DO $migration_contract$
DECLARE
  v_lock regprocedure :=
    'public.lock_payroll_period_snapshot(uuid,uuid,uuid,jsonb,text,integer,text)'::regprocedure;
  v_export regprocedure :=
    'public.mark_payroll_period_exported(uuid,uuid,uuid,text)'::regprocedure;
  v_reopen regprocedure :=
    'public.reopen_payroll_period_break_glass(uuid,uuid,uuid,text)'::regprocedure;
  v_lock_config text[];
  v_export_config text[];
  v_reopen_config text[];
  v_extension_oid oid;
  v_digest_oid oid := to_regprocedure('extensions.digest(bytea,text)')::oid;
  v_schema_oid oid;
  v_schema_owner_oid oid;
  v_untrusted_creators text;
BEGIN
  IF current_setting('server_version') NOT LIKE '18.4%' THEN
    RAISE EXCEPTION 'Expected PostgreSQL 18.4, got %', current_setting('server_version');
  END IF;
  SELECT extension.oid, namespace.oid, namespace.nspowner
  INTO v_extension_oid, v_schema_oid, v_schema_owner_oid
  FROM pg_extension AS extension
  JOIN pg_namespace AS namespace ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'pgcrypto'
    AND namespace.nspname = 'extensions';
  IF NOT FOUND OR v_digest_oid IS NULL THEN
    RAISE EXCEPTION 'pgcrypto digest contract is missing from extensions schema';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_depend AS dependency
    WHERE dependency.classid = 'pg_proc'::regclass
      AND dependency.objid = v_digest_oid
      AND dependency.objsubid = 0
      AND dependency.refclassid = 'pg_extension'::regclass
      AND dependency.refobjid = v_extension_oid
      AND dependency.deptype = 'e'
  ) THEN
    RAISE EXCEPTION 'digest(bytea,text) is not owned by the pgcrypto extension';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles AS owner_role
    WHERE owner_role.oid = v_schema_owner_oid
      AND (
        owner_role.oid = to_regrole(current_user)::oid
        OR owner_role.rolsuper
      )
  ) THEN
    RAISE EXCEPTION 'extensions schema owner is not trusted';
  END IF;
  SELECT string_agg(quote_ident(candidate.rolname), ', ' ORDER BY candidate.rolname)
  INTO v_untrusted_creators
  FROM pg_roles AS candidate
  WHERE has_schema_privilege(candidate.oid, v_schema_oid, 'CREATE')
    AND candidate.oid <> v_schema_owner_oid
    AND candidate.oid <> to_regrole(current_user)::oid
    AND NOT candidate.rolsuper
    AND NOT pg_has_role(candidate.oid, v_schema_owner_oid, 'MEMBER')
    AND NOT pg_has_role(candidate.oid, to_regrole(current_user)::oid, 'MEMBER');
  IF v_untrusted_creators IS NOT NULL THEN
    RAISE EXCEPTION 'extensions schema has untrusted CREATE role(s): %',
      v_untrusted_creators;
  END IF;
  IF encode(
    extensions.digest(convert_to('abc', 'UTF8'), 'sha256'),
    'hex'
  ) <> 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' THEN
    RAISE EXCEPTION 'pgcrypto SHA-256 digest returned an unexpected value';
  END IF;
  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payroll_periods'
      AND column_name IN (
        'calculation_snapshot', 'calculation_hash', 'calculation_version'
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'Payroll snapshot columns were not applied';
  END IF;
  IF has_function_privilege('anon', v_lock, 'EXECUTE')
     OR has_function_privilege('authenticated', v_lock, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_lock, 'EXECUTE')
     OR has_function_privilege('anon', v_export, 'EXECUTE')
     OR has_function_privilege('authenticated', v_export, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_export, 'EXECUTE')
     OR has_function_privilege('anon', v_reopen, 'EXECUTE')
     OR has_function_privilege('authenticated', v_reopen, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_reopen, 'EXECUTE') THEN
    RAISE EXCEPTION 'Payroll transition RPC ACL mismatch';
  END IF;
  IF has_table_privilege('anon', 'public.payroll_periods', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.payroll_periods', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.payroll_periods', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.enterprise_audit_events', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.enterprise_audit_events', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.enterprise_audit_events', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Payroll financial tables retain a runtime TRUNCATE privilege';
  END IF;
  SELECT proconfig INTO v_lock_config FROM pg_proc WHERE oid = v_lock;
  SELECT proconfig INTO v_export_config FROM pg_proc WHERE oid = v_export;
  SELECT proconfig INTO v_reopen_config FROM pg_proc WHERE oid = v_reopen;
  IF v_lock_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']
     OR v_export_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']
     OR v_reopen_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_lock)
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_export)
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_reopen) THEN
    RAISE EXCEPTION 'Payroll RPC SECURITY DEFINER/search_path contract mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.payroll_periods'::regclass
      AND tgname = 'guard_payroll_period_mutation'
      AND tgenabled = 'O'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Payroll period mutation guard trigger is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.enterprise_audit_events'::regclass
      AND tgname = 'guard_payroll_transition_audit_mutation'
      AND tgenabled = 'O'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Payroll transition audit guard trigger is missing';
  END IF;
  RAISE NOTICE 'PASS migration compile, pgcrypto digest, ACL and fixed search_path';
END;
$migration_contract$;

-- ---------------------------------------------------------------------------
-- Test-only canonical payload helpers. They build inputs for the production
-- RPC; they do not reproduce its validation or state-transition logic.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fixture_payroll_canonical_for_members(
  _period_id uuid,
  _membership_ids uuid[]
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH period AS (
    SELECT *
    FROM public.payroll_periods
    WHERE id = _period_id
  ), selected_members AS (
    SELECT membership.id
    FROM public.enterprise_memberships AS membership
    CROSS JOIN period
    WHERE membership.workspace_id = period.workspace_id
      AND membership.id = ANY(COALESCE(_membership_ids, ARRAY[]::uuid[]))
  ), members AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'membership_id', id,
          'display_name', 'Member ' || left(id::text, 8),
          'regular_hours', 80,
          'overtime_hours', 2,
          'leave_days', 1,
          'gross_estimate', 8200,
          'currency', 'EUR'
        ) ORDER BY (id::text) COLLATE "C"
      ),
      '[]'::jsonb
    ) AS payload,
    count(*) AS member_count
    FROM selected_members
  )
  SELECT jsonb_build_object(
    'version', 1,
    'period', jsonb_build_object(
      'id', period.id,
      'workspace_id', period.workspace_id,
      'name', period.name,
      'start_date', period.start_date,
      'end_date', period.end_date,
      'status', 'locked'
    ),
    'members', members.payload,
    'totals', jsonb_build_object(
      'total_hours', members.member_count * 82,
      'total_overtime', members.member_count * 2,
      'total_gross', members.member_count * 8200,
      'member_count', members.member_count
    )
  )::text
  FROM period CROSS JOIN members;
$function$;

CREATE OR REPLACE FUNCTION public.fixture_payroll_canonical(_period_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT public.fixture_payroll_canonical_for_members(
    _period_id,
    COALESCE(
      array_agg(membership.id ORDER BY (membership.id::text) COLLATE "C"),
      ARRAY[]::uuid[]
    )
  )
  FROM public.payroll_periods AS period
  LEFT JOIN public.enterprise_memberships AS membership
    ON membership.workspace_id = period.workspace_id
   AND membership.status = 'active'::public.enterprise_membership_status
  WHERE period.id = _period_id
  GROUP BY period.id;
$function$;

CREATE OR REPLACE FUNCTION public.fixture_payroll_hash(_canonical text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT encode(
    extensions.digest(convert_to(_canonical, 'UTF8'), 'sha256'),
    'hex'
  );
$function$;

CREATE OR REPLACE FUNCTION public.fixture_payroll_snapshot(_canonical text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT _canonical::jsonb || jsonb_build_object(
    'hash', public.fixture_payroll_hash(_canonical)
  );
$function$;

CREATE OR REPLACE FUNCTION public.fixture_lock_valid_payroll_period(
  _period_id uuid,
  _actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
  v_canonical text;
  v_hash text;
BEGIN
  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = _period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fixture payroll period not found';
  END IF;
  v_canonical := public.fixture_payroll_canonical(_period_id);
  v_hash := public.fixture_payroll_hash(v_canonical);
  RETURN public.lock_payroll_period_snapshot(
    v_period.workspace_id,
    v_period.id,
    _actor_id,
    public.fixture_payroll_snapshot(v_canonical),
    v_hash,
    1,
    v_canonical
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fixture_payroll_canonical_for_members(uuid, uuid[])
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fixture_payroll_canonical(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fixture_payroll_hash(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fixture_payroll_snapshot(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fixture_lock_valid_payroll_period(uuid, uuid)
  TO service_role;

INSERT INTO public.payroll_periods(
  id, workspace_id, name, start_date, end_date, status
) VALUES
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', 'July 2026', '2026-07-01', '2026-07-31', 'open'),
  ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', 'Rollback August', '2026-08-01', '2026-08-31', 'open'),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Atomic lock failure', '2026-09-01', '2026-09-30', 'open'),
  ('44444444-4444-4444-8444-444444444445', '11111111-1111-4111-8111-111111111111', 'Atomic export failure', '2026-10-01', '2026-10-31', 'open'),
  ('44444444-4444-4444-8444-444444444446', '11111111-1111-4111-8111-111111111111', 'Invalid actor', '2026-11-01', '2026-11-30', 'open'),
  ('44444444-4444-4444-8444-444444444447', '22222222-2222-4222-8222-222222222222', 'No feature', '2026-12-01', '2026-12-31', 'open'),
  ('44444444-4444-4444-8444-444444444448', '11111111-1111-4111-8111-111111111111', 'Malformed null member', '2027-01-01', '2027-01-31', 'open'),
  ('44444444-4444-4444-8444-444444444449', '11111111-1111-4111-8111-111111111111', 'Concurrent lock', '2027-02-01', '2027-02-28', 'open'),
  ('44444444-4444-4444-8444-444444444450', '11111111-1111-4111-8111-111111111111', 'Malformed totals', '2027-03-01', '2027-03-31', 'open'),
  ('44444444-4444-4444-8444-444444444451', '11111111-1111-4111-8111-111111111111', 'Arbitrary hash', '2027-04-01', '2027-04-30', 'open'),
  ('44444444-4444-4444-8444-444444444452', '11111111-1111-4111-8111-111111111111', 'Membership drift', '2027-05-01', '2027-05-31', 'open'),
  ('44444444-4444-4444-8444-444444444453', '11111111-1111-4111-8111-111111111111', 'Concurrent reopen', '2027-06-01', '2027-06-30', 'open'),
  ('44444444-4444-4444-8444-444444444454', '11111111-1111-4111-8111-111111111111', 'Demotion race reopen', '2027-07-01', '2027-07-31', 'open');

-- ---------------------------------------------------------------------------
-- Runtime-role direct mutation boundaries.
-- ---------------------------------------------------------------------------
SET ROLE anon;
DO $anon_direct_contract$
BEGIN
  BEGIN
    PERFORM public.lock_payroll_period_snapshot(NULL, NULL, NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'anon unexpectedly executed payroll lock RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS anon lock RPC denied';
  END;

  BEGIN
    UPDATE public.payroll_periods
    SET status = 'locked', locked_at = now()
    WHERE id = '44444444-4444-4444-8444-444444444441';
    RAISE EXCEPTION 'anon protected payroll update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Payroll protected state%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS anon protected update denied';
  END;

  BEGIN
    INSERT INTO public.payroll_periods(
      id, workspace_id, name, start_date, end_date, status
    ) VALUES (
      '49999999-9999-4999-8999-999999999999',
      '11111111-1111-4111-8111-111111111111',
      'Direct locked insert',
      '2028-01-01',
      '2028-01-31',
      'locked'
    );
    RAISE EXCEPTION 'anon locked payroll insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'New payroll periods%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS anon locked insert denied';
  END;
END;
$anon_direct_contract$;
RESET ROLE;

SET ROLE authenticated;
DO $authenticated_direct_contract$
BEGIN
  BEGIN
    PERFORM public.mark_payroll_period_exported(NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'authenticated unexpectedly executed payroll export RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated export RPC denied';
  END;

  BEGIN
    UPDATE public.payroll_periods
    SET name = 'Tampered legacy name'
    WHERE id = '44444444-4444-4444-8444-444444444442';
    RAISE EXCEPTION 'authenticated legacy locked mutation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Locked payroll periods%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS authenticated locked row immutable';
  END;

  BEGIN
    DELETE FROM public.payroll_periods
    WHERE id = '44444444-4444-4444-8444-444444444442';
    RAISE EXCEPTION 'authenticated locked delete unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Locked payroll periods%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS authenticated locked delete denied';
  END;
END;
$authenticated_direct_contract$;
RESET ROLE;

SET ROLE service_role;
DO $service_direct_open_contract$
BEGIN
  BEGIN
    UPDATE public.payroll_periods
    SET status = 'locked', locked_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', locked_at = now()
    WHERE id = '44444444-4444-4444-8444-444444444443';
    RAISE EXCEPTION 'service_role direct lock unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'service_role payroll updates%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role direct open-to-locked transition denied';
  END;
END;
$service_direct_open_contract$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Malformed snapshots, hash verification, actor/feature checks and drift.
-- ---------------------------------------------------------------------------
SET ROLE service_role;
DO $negative_lock_contract$
DECLARE
  v_workspace constant uuid := '11111111-1111-4111-8111-111111111111';
  v_owner constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_member constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_canonical text;
  v_payload jsonb;
  v_hash text;
  v_snapshot jsonb;
BEGIN
  BEGIN
    PERFORM public.fixture_lock_valid_payroll_period(
      '44444444-4444-4444-8444-444444444446',
      v_member
    );
    RAISE EXCEPTION 'Non-admin member unexpectedly locked payroll';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Active payroll admin%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS invalid lock actor denied';
  END;

  BEGIN
    PERFORM public.fixture_lock_valid_payroll_period(
      '44444444-4444-4444-8444-444444444447',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
    );
    RAISE EXCEPTION 'Workspace without payroll feature unexpectedly locked';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Payroll engine feature%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS missing payroll-engine feature denied';
  END;

  v_payload := public.fixture_payroll_canonical(
    '44444444-4444-4444-8444-444444444448'
  )::jsonb;
  v_payload := jsonb_set(v_payload, '{members}', '[null]'::jsonb);
  v_payload := jsonb_set(
    v_payload,
    '{totals}',
    '{"total_hours":0,"total_overtime":0,"total_gross":0,"member_count":1}'::jsonb
  );
  v_canonical := v_payload::text;
  v_hash := public.fixture_payroll_hash(v_canonical);
  v_snapshot := v_payload || jsonb_build_object('hash', v_hash);
  BEGIN
    PERFORM public.lock_payroll_period_snapshot(
      v_workspace,
      '44444444-4444-4444-8444-444444444448',
      v_owner,
      v_snapshot,
      v_hash,
      1,
      v_canonical
    );
    RAISE EXCEPTION 'Null payroll member unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Payroll snapshot members must%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS null member snapshot denied';
  END;

  v_payload := public.fixture_payroll_canonical(
    '44444444-4444-4444-8444-444444444450'
  )::jsonb;
  v_payload := jsonb_set(v_payload, '{totals}', '{"member_count":2}'::jsonb);
  v_canonical := v_payload::text;
  v_hash := public.fixture_payroll_hash(v_canonical);
  v_snapshot := v_payload || jsonb_build_object('hash', v_hash);
  BEGIN
    PERFORM public.lock_payroll_period_snapshot(
      v_workspace,
      '44444444-4444-4444-8444-444444444450',
      v_owner,
      v_snapshot,
      v_hash,
      1,
      v_canonical
    );
    RAISE EXCEPTION 'Malformed payroll totals unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Payroll snapshot totals have%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS malformed totals denied';
  END;

  v_canonical := public.fixture_payroll_canonical(
    '44444444-4444-4444-8444-444444444451'
  );
  v_snapshot := v_canonical::jsonb || jsonb_build_object('hash', repeat('0', 64));
  BEGIN
    PERFORM public.lock_payroll_period_snapshot(
      v_workspace,
      '44444444-4444-4444-8444-444444444451',
      v_owner,
      v_snapshot,
      repeat('0', 64),
      1,
      v_canonical
    );
    RAISE EXCEPTION 'Arbitrary 64-zero payroll hash unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Payroll calculation snapshot hash mismatch%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS arbitrary 64-zero hash denied by digest comparison';
  END;
END;
$negative_lock_contract$;
RESET ROLE;

UPDATE public.enterprise_memberships
SET status = 'active'
WHERE id = '10000000-0000-4000-8000-000000000004';

SET ROLE service_role;
DO $membership_drift_contract$
DECLARE
  v_canonical text;
  v_hash text;
BEGIN
  v_canonical := public.fixture_payroll_canonical_for_members(
    '44444444-4444-4444-8444-444444444452',
    ARRAY[
      '10000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid
    ]
  );
  v_hash := public.fixture_payroll_hash(v_canonical);
  BEGIN
    PERFORM public.lock_payroll_period_snapshot(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444452',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      public.fixture_payroll_snapshot(v_canonical),
      v_hash,
      1,
      v_canonical
    );
    RAISE EXCEPTION 'Stale active-member snapshot unexpectedly locked';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'Active workspace membership changed%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS active membership set drift denied';
  END;
END;
$membership_drift_contract$;
RESET ROLE;

UPDATE public.enterprise_memberships
SET status = 'inactive'
WHERE id = '10000000-0000-4000-8000-000000000004';

DO $negative_lock_state_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payroll_periods
    WHERE id IN (
      '44444444-4444-4444-8444-444444444446',
      '44444444-4444-4444-8444-444444444448',
      '44444444-4444-4444-8444-444444444450',
      '44444444-4444-4444-8444-444444444451',
      '44444444-4444-4444-8444-444444444452'
    )
      AND (
        status <> 'open'
        OR calculation_snapshot IS NOT NULL
        OR calculation_hash IS NOT NULL
        OR calculation_version IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Rejected payroll lock changed persisted state';
  END IF;
  RAISE NOTICE 'PASS rejected payroll locks leave periods open without snapshots';
END;
$negative_lock_state_contract$;

-- ---------------------------------------------------------------------------
-- Audit failure injection and valid lock paths.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fixture_reject_selected_payroll_audits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF (
    NEW.target_id = '44444444-4444-4444-8444-444444444444'::uuid
    AND NEW.action = 'payroll.period_locked'
  ) OR (
    NEW.target_id = '44444444-4444-4444-8444-444444444445'::uuid
    AND NEW.action = 'payroll.period_exported'
  ) OR (
    NEW.target_id = '44444444-4444-4444-8444-444444444445'::uuid
    AND NEW.action = 'payroll.period_reopened_break_glass'
  ) THEN
    RAISE EXCEPTION 'fixture forced payroll audit failure';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER fixture_reject_selected_payroll_audits
  BEFORE INSERT ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.fixture_reject_selected_payroll_audits();

SET ROLE service_role;
DO $lock_atomicity_contract$
DECLARE
  -- This literal follows the Edge canonicalizer's recursively sorted keys and
  -- whitespace-free JSON output, proving compatibility beyond jsonb::text.
  v_edge_canonical constant text :=
    '{"members":[{"currency":"EUR","display_name":"Member 10000000","gross_estimate":8200,"leave_days":1,"membership_id":"10000000-0000-4000-8000-000000000001","overtime_hours":2,"regular_hours":80},{"currency":"EUR","display_name":"Member 10000000","gross_estimate":8200,"leave_days":1,"membership_id":"10000000-0000-4000-8000-000000000002","overtime_hours":2,"regular_hours":80}],"period":{"end_date":"2026-07-31","id":"44444444-4444-4444-8444-444444444441","name":"July 2026","start_date":"2026-07-01","status":"locked","workspace_id":"11111111-1111-4111-8111-111111111111"},"totals":{"member_count":2,"total_gross":16400,"total_hours":164,"total_overtime":4},"version":1}';
  v_edge_hash text;
BEGIN
  BEGIN
    PERFORM public.fixture_lock_valid_payroll_period(
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    );
    RAISE EXCEPTION 'Forced lock audit failure unexpectedly committed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'fixture forced%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS lock audit failure raised';
  END;

  v_edge_hash := public.fixture_payroll_hash(v_edge_canonical);
  PERFORM public.lock_payroll_period_snapshot(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444441',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    public.fixture_payroll_snapshot(v_edge_canonical),
    v_edge_hash,
    1,
    v_edge_canonical
  );
  RAISE NOTICE 'PASS Edge-canonical snapshot hash locked';

  PERFORM public.fixture_lock_valid_payroll_period(
    '44444444-4444-4444-8444-444444444443',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );
  PERFORM public.fixture_lock_valid_payroll_period(
    '44444444-4444-4444-8444-444444444445',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );
  PERFORM public.fixture_lock_valid_payroll_period(
    '44444444-4444-4444-8444-444444444453',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );
  PERFORM public.fixture_lock_valid_payroll_period(
    '44444444-4444-4444-8444-444444444454',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );
END;
$lock_atomicity_contract$;
RESET ROLE;

DO $lock_persistence_contract$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
BEGIN
  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444444';
  IF v_period.status <> 'open'
     OR v_period.calculation_snapshot IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.enterprise_audit_events
       WHERE target_id = v_period.id AND action = 'payroll.period_locked'
     ) THEN
    RAISE EXCEPTION 'Lock audit failure did not rollback snapshot/state';
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444441';
  IF v_period.status <> 'locked'
     OR v_period.calculation_snapshot IS NULL
     OR v_period.calculation_hash IS NULL
     OR v_period.calculation_version <> 1
     OR v_period.locked_by <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
     OR (
       SELECT count(*) FROM public.enterprise_audit_events
       WHERE target_id = v_period.id AND action = 'payroll.period_locked'
     ) <> 1 THEN
    RAISE EXCEPTION 'Valid payroll lock snapshot/audit mismatch';
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444453';
  IF v_period.status <> 'locked'
     OR v_period.calculation_snapshot IS NULL
     OR v_period.calculation_hash IS NULL
     OR v_period.calculation_version <> 1
     OR v_period.locked_by <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
     OR EXISTS (
       SELECT 1 FROM public.enterprise_audit_events
       WHERE target_id = v_period.id
         AND action = 'payroll.period_reopened_break_glass'
     ) THEN
    RAISE EXCEPTION 'Concurrent reopen fixture is not in its required locked state';
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444454';
  IF v_period.status <> 'locked'
     OR v_period.calculation_snapshot IS NULL
     OR v_period.calculation_hash IS NULL
     OR v_period.calculation_version <> 1
     OR v_period.locked_by <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
     OR EXISTS (
       SELECT 1 FROM public.enterprise_audit_events
       WHERE target_id = v_period.id
         AND action = 'payroll.period_reopened_break_glass'
     ) THEN
    RAISE EXCEPTION 'Demotion race fixture is not in its required locked state';
  END IF;
  INSERT INTO public.fixture_payroll_concurrency_baselines(
    scenario, period_id, period_state
  ) VALUES (
    'actor-demotion-reopen',
    v_period.id,
    to_jsonb(v_period)
  );
  RAISE NOTICE 'PASS lock snapshot and audit are atomic';
END;
$lock_persistence_contract$;

-- Direct service-role writes are forbidden. Break-glass reopen requires the
-- attributed, reason-bound RPC and must commit its audit row atomically.
SET ROLE service_role;
DO $service_reopen_contract$
DECLARE
  v_result jsonb;
  v_previous_hash text;
  v_previous_state jsonb;
  v_expected_new_state jsonb := jsonb_build_object(
    'status', 'open',
    'calculation_snapshot', NULL,
    'calculation_hash', NULL,
    'calculation_version', NULL,
    'locked_by', NULL,
    'locked_at', NULL,
    'exported_at', NULL,
    'exported_to', NULL
  );
  v_audit public.enterprise_audit_events%ROWTYPE;
BEGIN
  BEGIN
    UPDATE public.payroll_periods
    SET calculation_hash = repeat('b', 64),
        calculation_snapshot = jsonb_set(
          calculation_snapshot,
          '{hash}',
          to_jsonb(repeat('b', 64))
        )
    WHERE id = '44444444-4444-4444-8444-444444444443';
    RAISE EXCEPTION 'service_role locked snapshot tamper unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'service_role payroll updates%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role locked snapshot/hash immutable';
  END;

  BEGIN
    UPDATE public.payroll_periods
    SET status = 'exported', exported_at = now(), exported_to = 'generic'
    WHERE id = '44444444-4444-4444-8444-444444444443';
    RAISE EXCEPTION 'service_role direct export unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'service_role payroll updates%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role direct export denied';
  END;

  BEGIN
    UPDATE public.payroll_periods
    SET status = 'open',
        calculation_snapshot = NULL,
        calculation_hash = NULL,
        calculation_version = NULL,
        locked_by = NULL,
        locked_at = NULL,
        exported_at = NULL,
        exported_to = NULL
    WHERE id = '44444444-4444-4444-8444-444444444443';
    RAISE EXCEPTION 'service_role direct exact rollback unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'service_role payroll updates%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role direct exact rollback denied';
  END;

  BEGIN
    UPDATE public.payroll_periods
    SET name = 'Direct service metadata tamper'
    WHERE id = '44444444-4444-4444-8444-444444444446';
    RAISE EXCEPTION 'service_role direct open-period update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'service_role payroll updates%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role direct open-period update denied';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '1234567'
    );
    RAISE EXCEPTION 'Short break-glass reason unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Break-glass payroll reopen reason%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS short break-glass reason denied';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      NULL::text
    );
    RAISE EXCEPTION 'NULL break-glass reason unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Break-glass payroll reopen reason%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS NULL break-glass reason denied';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '        '
    );
    RAISE EXCEPTION 'space-only break-glass reason unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Break-glass payroll reopen reason%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS space-only break-glass reason denied';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      E'\t\n\r\f\t\n\r\f'
    );
    RAISE EXCEPTION 'non-space whitespace-only break-glass reason unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Break-glass payroll reopen reason%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS non-space whitespace-only break-glass reason denied';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      repeat('x', 1001)
    );
    RAISE EXCEPTION '1001-character break-glass reason unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Break-glass payroll reopen reason%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS 1001-character break-glass reason denied';
  END;

  -- Accepted boundary calls are deliberately rolled back by the sentinel
  -- exception so this one locked period can prove both limits independently.
  BEGIN
    v_result := public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      E'\t12345678\n'
    );
    SELECT * INTO STRICT v_audit
    FROM public.enterprise_audit_events
    WHERE id = (v_result->>'audit_event_id')::uuid;
    IF v_audit.metadata->>'reason' IS DISTINCT FROM '12345678' THEN
      RAISE EXCEPTION '8-character reason was not whitespace-normalized';
    END IF;
    RAISE EXCEPTION 'fixture accepted normalized 8-character reason';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IS DISTINCT FROM 'fixture accepted normalized 8-character reason' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS normalized 8-character break-glass reason accepted';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      repeat('x', 1000)
    );
    RAISE EXCEPTION 'fixture accepted 1000-character reason';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IS DISTINCT FROM 'fixture accepted 1000-character reason' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS 1000-character break-glass reason accepted';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'Ordinary members cannot perform break-glass reopen'
    );
    RAISE EXCEPTION 'Non-admin break-glass actor unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Active payroll admin%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS non-admin break-glass actor denied';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444445',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'Forced audit failure must rollback the entire reopen'
    );
    RAISE EXCEPTION 'Forced reopen audit failure unexpectedly committed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'fixture forced%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS reopen audit failure raised';
  END;

  SELECT calculation_hash,
         jsonb_build_object(
           'status', status,
           'calculation_snapshot', calculation_snapshot,
           'calculation_hash', calculation_hash,
           'calculation_version', calculation_version,
           'locked_by', locked_by,
           'locked_at', locked_at,
           'exported_at', exported_at,
           'exported_to', exported_to
         )
  INTO v_previous_hash, v_previous_state
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444443';

  v_result := public.reopen_payroll_period_break_glass(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444443',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '  Incident INC-2026-0718 approved break-glass reopen  '
  );
  IF NOT (v_result ?& ARRAY[
       'ok', 'period_id', 'status', 'previous_status',
       'previous_snapshot_hash', 'audit_event_id'
     ])
     OR (v_result - ARRAY[
       'ok', 'period_id', 'status', 'previous_status',
       'previous_snapshot_hash', 'audit_event_id'
     ]::text[]) <> '{}'::jsonb
     OR v_result->>'ok' IS DISTINCT FROM 'true'
     OR v_result->>'period_id' IS DISTINCT FROM '44444444-4444-4444-8444-444444444443'
     OR v_result->>'status' IS DISTINCT FROM 'open'
     OR v_result->>'previous_status' IS DISTINCT FROM 'locked'
     OR v_result->>'previous_snapshot_hash' IS DISTINCT FROM v_previous_hash
     OR (v_result->>'audit_event_id')::uuid IS NULL THEN
    RAISE EXCEPTION 'Break-glass reopen returned an invalid response: %', v_result;
  END IF;
  SELECT * INTO STRICT v_audit
  FROM public.enterprise_audit_events
  WHERE id = (v_result->>'audit_event_id')::uuid;
  IF v_audit.workspace_id <> '11111111-1111-4111-8111-111111111111'
     OR v_audit.actor_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
     OR v_audit.action <> 'payroll.period_reopened_break_glass'
     OR v_audit.target_type <> 'payroll_period'
     OR v_audit.target_id <> '44444444-4444-4444-8444-444444444443'
     OR v_audit.prev_state IS DISTINCT FROM v_previous_state
     OR v_audit.new_state IS DISTINCT FROM v_expected_new_state
     OR v_audit.metadata IS DISTINCT FROM jsonb_build_object(
       'reason', 'Incident INC-2026-0718 approved break-glass reopen',
       'break_glass', true
     ) THEN
    RAISE EXCEPTION 'Break-glass response audit evidence mismatch: %', row_to_json(v_audit);
  END IF;

  BEGIN
    EXECUTE 'TRUNCATE TABLE public.payroll_periods';
    RAISE EXCEPTION 'service_role payroll TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS service_role payroll TRUNCATE denied';
  END;

  BEGIN
    EXECUTE 'TRUNCATE TABLE public.enterprise_audit_events';
    RAISE EXCEPTION 'service_role audit TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS service_role audit TRUNCATE denied';
  END;

  BEGIN
    PERFORM public.reopen_payroll_period_break_glass(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444443',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'Repeated break-glass reopen must not create another audit'
    );
    RAISE EXCEPTION 'Repeated break-glass reopen unexpectedly succeeded';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'Payroll period is not locked or exported%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS repeated break-glass reopen denied';
  END;

  BEGIN
    INSERT INTO public.enterprise_audit_events(
      workspace_id, actor_id, action, target_type, target_id
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'payroll.period_locked',
      'payroll_period',
      '44444444-4444-4444-8444-444444444443'
    );
    RAISE EXCEPTION 'service_role forged payroll transition audit unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Payroll transition audit events%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role reserved audit forgery denied';
  END;

  BEGIN
    UPDATE public.enterprise_audit_events
    SET metadata = '{"tampered":true}'::jsonb
    WHERE target_id = '44444444-4444-4444-8444-444444444443'
      AND action = 'payroll.period_reopened_break_glass';
    RAISE EXCEPTION 'service_role payroll transition audit tamper unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Payroll transition audit events%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role reserved audit update denied';
  END;

  BEGIN
    DELETE FROM public.enterprise_audit_events
    WHERE target_id = '44444444-4444-4444-8444-444444444443'
      AND action = 'payroll.period_reopened_break_glass';
    RAISE EXCEPTION 'service_role payroll transition audit delete unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Payroll transition audit events%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS service_role reserved audit delete denied';
  END;
END;
$service_reopen_contract$;
RESET ROLE;

DO $service_reopen_persistence_contract$
DECLARE
  v_audit public.enterprise_audit_events%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payroll_periods
    WHERE id = '44444444-4444-4444-8444-444444444443'
      AND (
        status <> 'open'
        OR calculation_snapshot IS NOT NULL
        OR calculation_hash IS NOT NULL
        OR calculation_version IS NOT NULL
        OR locked_by IS NOT NULL
        OR locked_at IS NOT NULL
        OR exported_at IS NOT NULL
        OR exported_to IS NOT NULL
        OR name <> 'Rollback August'
      )
  ) THEN
    RAISE EXCEPTION 'Audited payroll reopen did not persist correctly';
  END IF;

  SELECT * INTO STRICT v_audit
  FROM public.enterprise_audit_events
  WHERE target_id = '44444444-4444-4444-8444-444444444443'
    AND action = 'payroll.period_reopened_break_glass';
  IF v_audit.workspace_id <> '11111111-1111-4111-8111-111111111111'
     OR v_audit.actor_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
     OR v_audit.prev_state->>'status' IS DISTINCT FROM 'locked'
     OR v_audit.prev_state->'calculation_snapshot' IS NULL
     OR v_audit.prev_state->>'calculation_hash' IS NULL
     OR v_audit.prev_state->>'calculation_version' IS DISTINCT FROM '1'
     OR v_audit.new_state->>'status' IS DISTINCT FROM 'open'
     OR v_audit.new_state->'calculation_snapshot' IS DISTINCT FROM 'null'::jsonb
     OR v_audit.metadata->>'reason' IS DISTINCT FROM
       'Incident INC-2026-0718 approved break-glass reopen'
     OR v_audit.metadata->>'break_glass' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Audited payroll reopen evidence is incomplete: %', row_to_json(v_audit);
  END IF;

  IF (SELECT status FROM public.payroll_periods
      WHERE id = '44444444-4444-4444-8444-444444444445') <> 'locked'
     OR (SELECT calculation_snapshot FROM public.payroll_periods
         WHERE id = '44444444-4444-4444-8444-444444444445') IS NULL
     OR (SELECT calculation_hash FROM public.payroll_periods
         WHERE id = '44444444-4444-4444-8444-444444444445') IS NULL
     OR (SELECT calculation_version FROM public.payroll_periods
         WHERE id = '44444444-4444-4444-8444-444444444445') <> 1
     OR EXISTS (
       SELECT 1 FROM public.enterprise_audit_events
       WHERE target_id = '44444444-4444-4444-8444-444444444445'
         AND action = 'payroll.period_reopened_break_glass'
     ) THEN
    RAISE EXCEPTION 'Reopen audit failure did not rollback period state';
  END IF;
  RAISE NOTICE 'PASS attributed break-glass reopen and audit are atomic';
END;
$service_reopen_persistence_contract$;

SET ROLE authenticated;
DO $authenticated_audit_forgery_contract$
BEGIN
  BEGIN
    INSERT INTO public.enterprise_audit_events(
      workspace_id, actor_id, action, target_type, target_id
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'payroll.period_exported',
      'payroll_period',
      '44444444-4444-4444-8444-444444444443'
    );
    RAISE EXCEPTION 'authenticated forged payroll transition audit unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Payroll transition audit events%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS authenticated reserved audit forgery denied';
  END;
END;
$authenticated_audit_forgery_contract$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Export validation and audit atomicity.
-- ---------------------------------------------------------------------------
SET ROLE service_role;
DO $export_contract$
BEGIN
  BEGIN
    PERFORM public.mark_payroll_period_exported(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444445',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '../../evil'
    );
    RAISE EXCEPTION 'Invalid payroll provider unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'Unsupported payroll%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS invalid export provider denied';
  END;

  BEGIN
    PERFORM public.mark_payroll_period_exported(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444445',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'generic'
    );
    RAISE EXCEPTION 'Invalid payroll export actor unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Active payroll admin%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS invalid export actor denied';
  END;

  BEGIN
    PERFORM public.mark_payroll_period_exported(
      '22222222-2222-4222-8222-222222222222',
      '44444444-4444-4444-8444-444444444447',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      'generic'
    );
    RAISE EXCEPTION 'Missing payroll-export feature unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Payroll export feature%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS missing payroll-export feature denied';
  END;

  BEGIN
    PERFORM public.mark_payroll_period_exported(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444442',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'generic'
    );
    RAISE EXCEPTION 'Legacy snapshotless payroll export unexpectedly accepted';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'Locked payroll period has no%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS legacy snapshotless export fails explicitly';
  END;

  BEGIN
    PERFORM public.mark_payroll_period_exported(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444445',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'generic'
    );
    RAISE EXCEPTION 'Forced export audit failure unexpectedly committed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'fixture forced%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS export audit failure raised';
  END;

  PERFORM public.mark_payroll_period_exported(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444441',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '  DATEV  '
  );
  RAISE NOTICE 'PASS valid export provider normalized and persisted';
END;
$export_contract$;
RESET ROLE;

DO $export_persistence_contract$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
BEGIN
  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444445';
  IF v_period.status <> 'locked'
     OR v_period.exported_at IS NOT NULL
     OR v_period.exported_to IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.enterprise_audit_events
       WHERE target_id = v_period.id AND action = 'payroll.period_exported'
     ) THEN
    RAISE EXCEPTION 'Export audit failure did not rollback state';
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = '44444444-4444-4444-8444-444444444441';
  IF v_period.status <> 'exported'
     OR v_period.exported_to <> 'datev'
     OR v_period.exported_at IS NULL
     OR v_period.calculation_snapshot IS NULL
     OR (
       SELECT count(*) FROM public.enterprise_audit_events
       WHERE target_id = v_period.id AND action = 'payroll.period_exported'
     ) <> 1 THEN
    RAISE EXCEPTION 'Valid payroll export state/audit mismatch';
  END IF;

  IF (SELECT status FROM public.payroll_periods
      WHERE id = '44444444-4444-4444-8444-444444444442') <> 'locked' THEN
    RAISE EXCEPTION 'Legacy snapshotless export changed period state';
  END IF;
  RAISE NOTICE 'PASS export state/provider/audit atomic and legacy unchanged';
END;
$export_persistence_contract$;

SET ROLE authenticated;
DO $authenticated_snapshot_immutability_contract$
BEGIN
  BEGIN
    UPDATE public.payroll_periods
    SET calculation_hash = repeat('c', 64),
        calculation_snapshot = jsonb_set(
          calculation_snapshot,
          '{hash}',
          to_jsonb(repeat('c', 64))
        ),
        calculation_version = 1
    WHERE id = '44444444-4444-4444-8444-444444444441';
    RAISE EXCEPTION 'authenticated snapshot/hash/version tamper unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Locked payroll periods%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS authenticated snapshot/hash/version immutable';
  END;
END;
$authenticated_snapshot_immutability_contract$;
RESET ROLE;

SET ROLE service_role;
DO $exported_and_legacy_reopen_contract$
DECLARE
  v_exported_result jsonb;
  v_legacy_result jsonb;
BEGIN
  v_exported_result := public.reopen_payroll_period_break_glass(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444441',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'Exported period reopened by approved incident procedure'
  );
  IF v_exported_result->>'previous_status' IS DISTINCT FROM 'exported'
     OR v_exported_result->>'previous_snapshot_hash' IS NULL THEN
    RAISE EXCEPTION 'Exported payroll reopen response is invalid: %', v_exported_result;
  END IF;

  v_legacy_result := public.reopen_payroll_period_break_glass(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444442',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'Legacy snapshotless period remediated by approved incident procedure'
  );
  IF v_legacy_result->>'previous_status' IS DISTINCT FROM 'locked'
     OR v_legacy_result->'previous_snapshot_hash' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Legacy payroll reopen response is invalid: %', v_legacy_result;
  END IF;
END;
$exported_and_legacy_reopen_contract$;
RESET ROLE;

DO $exported_and_legacy_reopen_persistence_contract$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payroll_periods
    WHERE id IN (
      '44444444-4444-4444-8444-444444444441',
      '44444444-4444-4444-8444-444444444442'
    )
      AND (
        status <> 'open'
        OR calculation_snapshot IS NOT NULL
        OR calculation_hash IS NOT NULL
        OR calculation_version IS NOT NULL
        OR locked_by IS NOT NULL
        OR locked_at IS NOT NULL
        OR exported_at IS NOT NULL
        OR exported_to IS NOT NULL
      )
  ) OR (
    SELECT count(*) FROM public.enterprise_audit_events
    WHERE target_id IN (
      '44444444-4444-4444-8444-444444444441',
      '44444444-4444-4444-8444-444444444442'
    )
      AND action = 'payroll.period_reopened_break_glass'
  ) <> 2 OR NOT EXISTS (
    SELECT 1 FROM public.enterprise_audit_events
    WHERE target_id = '44444444-4444-4444-8444-444444444441'
      AND action = 'payroll.period_reopened_break_glass'
      AND prev_state->>'status' = 'exported'
      AND prev_state->'calculation_snapshot' IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.enterprise_audit_events
    WHERE target_id = '44444444-4444-4444-8444-444444444442'
      AND action = 'payroll.period_reopened_break_glass'
      AND prev_state->>'status' = 'locked'
      AND prev_state->'calculation_snapshot' = 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'Exported or legacy payroll reopen persistence mismatch';
  END IF;
  RAISE NOTICE 'PASS exported and legacy snapshotless reopen are audited';
END;
$exported_and_legacy_reopen_persistence_contract$;

-- Activate the dedicated break-glass actor only after all ordinary snapshot
-- fixtures have completed, so existing canonical member-set contracts remain
-- unchanged. The concurrent demotion scenario owns this actor and period.
UPDATE public.enterprise_memberships
SET status = 'active'
WHERE id = '10000000-0000-4000-8000-000000000005'
  AND role = 'owner'
  AND status = 'inactive';
DO $demotion_race_fixture_readiness$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships
    WHERE id = '10000000-0000-4000-8000-000000000005'
      AND workspace_id = '11111111-1111-4111-8111-111111111111'
      AND user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
      AND role = 'owner'
      AND status = 'active'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.fixture_payroll_concurrency_baselines AS baseline
    JOIN public.payroll_periods AS period ON period.id = baseline.period_id
    WHERE baseline.scenario = 'actor-demotion-reopen'
      AND period.id = '44444444-4444-4444-8444-444444444454'
      AND to_jsonb(period) = baseline.period_state
      AND period.status = 'locked'
      AND period.calculation_snapshot IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.enterprise_audit_events
    WHERE target_id = '44444444-4444-4444-8444-444444444454'
      AND action = 'payroll.period_reopened_break_glass'
  ) THEN
    RAISE EXCEPTION 'Actor-demotion reopen concurrency fixture is not ready';
  END IF;
  RAISE NOTICE 'PASS actor-demotion reopen race fixture is isolated and ready';
END;
$demotion_race_fixture_readiness$;

SELECT
  'payroll_snapshot_migration_contract_passed' AS assertion,
  current_setting('server_version') AS postgres_version,
  (
    SELECT count(*) FROM public.enterprise_audit_events
    WHERE action = 'payroll.period_locked'
  ) AS lock_audits,
  (
    SELECT count(*) FROM public.enterprise_audit_events
    WHERE action = 'payroll.period_exported'
  ) AS export_audits,
  (
    SELECT count(*) FROM public.enterprise_audit_events
    WHERE action = 'payroll.period_reopened_break_glass'
  ) AS reopen_audits;

\endif
