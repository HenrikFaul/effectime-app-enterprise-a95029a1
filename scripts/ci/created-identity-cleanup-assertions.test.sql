\set ON_ERROR_STOP on
SET client_min_messages TO warning;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid =
      'public.register_created_enterprise_identity_provisioning_v1(uuid,uuid)'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.proconfig @> ARRAY[
        'search_path=pg_catalog',
        'lock_timeout=5s'
      ]::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid =
      'public.prepare_created_enterprise_identity_cleanup_v1(uuid,uuid,uuid)'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.proconfig @> ARRAY[
        'search_path=pg_catalog',
        'lock_timeout=5s',
        'statement_timeout=30s'
      ]::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid =
      'effectime_private.guard_created_identity_cleanup_write_v1()'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.proconfig @> ARRAY[
        'search_path=pg_catalog',
        'lock_timeout=5s'
      ]::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND (
    SELECT pg_catalog.count(*) = 2
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgname IN (
      'zz_guard_created_identity_cleanup_membership_write',
      'zz_guard_created_identity_cleanup_profile_write'
    )
      AND trigger_record.tgfoid =
        'effectime_private.guard_created_identity_cleanup_write_v1()'::pg_catalog.regprocedure
      AND trigger_record.tgrelid IN (
        'public.enterprise_memberships'::pg_catalog.regclass,
        'public.profiles'::pg_catalog.regclass
      )
      AND trigger_record.tgtype = 23
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid =
      'public.complete_created_enterprise_identity_provisioning_v1(uuid,uuid,uuid)'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.proconfig @> ARRAY[
        'search_path=pg_catalog',
        'lock_timeout=5s',
        'statement_timeout=30s'
      ]::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.register_created_enterprise_identity_provisioning_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.prepare_created_enterprise_identity_cleanup_v1(uuid,uuid,uuid)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.complete_created_enterprise_identity_provisioning_v1(uuid,uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.register_created_enterprise_identity_provisioning_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.prepare_created_enterprise_identity_cleanup_v1(uuid,uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'effectime_private.guard_created_identity_cleanup_write_v1()',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_table_privilege(
    'service_role',
    'effectime_private.created_identity_cleanup_jobs',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'created identity saga owner, config, ACL or private outbox contract is invalid'
);

CREATE OR REPLACE FUNCTION contract.created_identity_cleanup_job_id(p_cleanup_intent_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT cleanup_job.id
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.cleanup_intent_id = p_cleanup_intent_id;
$function$;

CREATE OR REPLACE FUNCTION contract.created_identity_cleanup_job_state(p_cleanup_job_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'status', cleanup_job.status,
    'user_id', cleanup_job.user_id,
    'membership_id', cleanup_job.membership_id,
    'attempt_count', cleanup_job.attempt_count,
    'last_error_code', cleanup_job.last_error_code
  )
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id;
$function$;

CREATE OR REPLACE FUNCTION contract.force_created_identity_cleanup_due(p_cleanup_job_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
  SET next_attempt_at = pg_catalog.now() - interval '1 second',
      lease_expires_at = NULL
  WHERE cleanup_job.id = p_cleanup_job_id;
$function$;

GRANT EXECUTE ON FUNCTION contract.created_identity_cleanup_job_id(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION contract.created_identity_cleanup_job_state(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION contract.force_created_identity_cleanup_due(uuid)
  TO service_role;

INSERT INTO public.enterprise_workspaces(id, name) VALUES
  ('88888888-8888-4888-8888-888888888888', 'Identity cleanup contract'),
  ('99999999-9999-4999-8999-999999999999', 'Identity cleanup control');

SET ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', false);
DO $authenticated_denial$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.register_created_enterprise_identity_provisioning_v1(
      '88888888-8888-4888-8888-888888888888',
      '81000000-0000-4000-8000-000000000099'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'authenticated role registered a provisioning saga');
END;
$authenticated_denial$;
RESET ROLE;

-- The durable saga is committed before Auth creation.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $register_before_auth$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.register_created_enterprise_identity_provisioning_v1(
    '88888888-8888-4888-8888-888888888888',
    '81000000-0000-4000-8000-000000000001'
  );
  PERFORM contract.assert_true(
    v_result ->> 'ok' = 'true'
    AND v_result ->> 'cleanup_intent_id' = '81000000-0000-4000-8000-000000000001'
    AND v_result ->> 'workspace_id' = '88888888-8888-4888-8888-888888888888'
    AND v_result ->> 'status' = 'provisioning'
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_result)) = 5,
    'pre-Auth provisioning receipt is invalid'
  );
END;
$register_before_auth$;
RESET ROLE;

SELECT contract.assert_true(
  contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000001'
  ) IS NOT NULL,
  'pre-Auth provisioning saga was not durable'
);

INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES
  (
    '80000000-0000-4000-8000-000000000001',
    'instant-cleanup@example.test',
    pg_catalog.jsonb_build_object(
      'effectime_identity_kind', 'enterprise_instant_member',
      'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
      'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000001'
    )
  );

INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000001',
  '88888888-8888-4888-8888-888888888888',
  '80000000-0000-4000-8000-000000000001',
  'member', 'active', 'Engineer', 8
);
INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES (
  '83000000-0000-4000-8000-000000000001',
  '88888888-8888-4888-8888-888888888888',
  '82000000-0000-4000-8000-000000000001',
  'Engineer', 100, true
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $prepare_cleanup$
DECLARE
  v_job_id uuid;
  v_result jsonb;
  v_repeat jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000001'
  );
  v_result := public.prepare_created_enterprise_identity_cleanup_v1(
    v_job_id,
    '80000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001'
  );
  v_repeat := public.prepare_created_enterprise_identity_cleanup_v1(
    v_job_id,
    '80000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001'
  );
  PERFORM contract.assert_true(
    v_result ->> 'ok' = 'true'
    AND v_result ->> 'status' = 'pending_auth'
    AND v_result ->> 'user_id' = '80000000-0000-4000-8000-000000000001'
    AND (v_result ->> 'deleted_membership_count')::integer = 1
    AND (v_result ->> 'deleted_profile_count')::integer = 1
    AND (v_result ->> 'remaining_membership_count')::integer = 0
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_result)) = 7
    AND v_repeat ->> 'cleanup_job_id' = v_result ->> 'cleanup_job_id'
    AND (v_repeat ->> 'deleted_membership_count')::integer = 0
    AND (v_repeat ->> 'deleted_profile_count')::integer = 0,
    'database-first cleanup receipt or idempotency contract failed'
  );
END;
$prepare_cleanup$;
RESET ROLE;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1 FROM auth.users WHERE id = '80000000-0000-4000-8000-000000000001'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE user_id = '80000000-0000-4000-8000-000000000001'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_member_role_allocations
    WHERE membership_id = '82000000-0000-4000-8000-000000000001'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '80000000-0000-4000-8000-000000000001'
  ),
  'database-first cleanup left tenant-visible rows or deleted Auth prematurely'
);

-- Normal writers cannot resurrect a pending identity. The second prepare below
-- also proves recovery from privileged/legacy drift which bypassed triggers.
DO $pending_write_guard$
DECLARE
  v_membership_denied boolean := false;
  v_profile_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_memberships(
      id, workspace_id, user_id, role, status, business_role, base_working_hours
    ) VALUES (
      '82000000-0000-4000-8000-000000000001',
      '88888888-8888-4888-8888-888888888888',
      '80000000-0000-4000-8000-000000000001',
      'member', 'active', 'Engineer', 8
    );
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    v_membership_denied := true;
  END;

  BEGIN
    INSERT INTO public.profiles(user_id, display_name) VALUES (
      '80000000-0000-4000-8000-000000000001',
      'Pending identity should fail'
    );
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    v_profile_denied := true;
  END;

  PERFORM contract.assert_true(
    v_membership_denied AND v_profile_denied,
    'pending cleanup identity accepted a tenant-visible write'
  );
END;
$pending_write_guard$;

SET session_replication_role = replica;
INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000001',
  '88888888-8888-4888-8888-888888888888',
  '80000000-0000-4000-8000-000000000001',
  'member', 'active', 'Engineer', 8
);
INSERT INTO public.profiles(user_id, display_name) VALUES (
  '80000000-0000-4000-8000-000000000001',
  'Privileged drift fixture'
);
SET session_replication_role = origin;

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $pending_reprepare$
DECLARE
  v_job_id uuid;
  v_result jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000001'
  );
  v_result := public.prepare_created_enterprise_identity_cleanup_v1(
    v_job_id,
    '80000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001'
  );
  PERFORM contract.assert_true(
    v_result ->> 'status' = 'pending_auth'
    AND (v_result ->> 'deleted_membership_count')::integer = 1
    AND (v_result ->> 'deleted_profile_count')::integer = 1
    AND (v_result ->> 'remaining_membership_count')::integer = 0,
    'pending cleanup retry did not remove resurrected database rows'
  );
END;
$pending_reprepare$;
RESET ROLE;

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE user_id = '80000000-0000-4000-8000-000000000001'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '80000000-0000-4000-8000-000000000001'
  ),
  'pending cleanup retry left resurrected database rows'
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $premature_completion_denial$
DECLARE
  v_job_id uuid;
  v_denied boolean := false;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000001'
  );
  BEGIN
    PERFORM public.complete_created_enterprise_identity_cleanup_v1(
      v_job_id,
      '80000000-0000-4000-8000-000000000001'
    );
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'cleanup completed while Auth user still existed');
END;
$premature_completion_denial$;
RESET ROLE;

DELETE FROM auth.users WHERE id = '80000000-0000-4000-8000-000000000001';
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $complete_cleanup$
DECLARE
  v_job_id uuid;
  v_result jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000001'
  );
  v_result := public.complete_created_enterprise_identity_cleanup_v1(
    v_job_id,
    '80000000-0000-4000-8000-000000000001'
  );
  PERFORM contract.assert_true(
    v_result ->> 'ok' = 'true'
    AND v_result ->> 'status' = 'completed'
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_result)) = 3,
    'verified Auth absence did not complete cleanup job'
  );
END;
$complete_cleanup$;
RESET ROLE;

-- A process interruption after Auth/database writes is recovered from only the
-- pre-Auth intent. The worker claim carries no user ID until prepare resolves
-- the exact server-controlled app_metadata.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000002'
);
RESET ROLE;
INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES (
  '80000000-0000-4000-8000-000000000002',
  'interrupted@example.test',
  pg_catalog.jsonb_build_object(
    'effectime_identity_kind', 'enterprise_instant_member',
    'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
    'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000002'
  )
);
INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000002',
  '88888888-8888-4888-8888-888888888888',
  '80000000-0000-4000-8000-000000000002',
  'member', 'active', 'Engineer', 8
);
INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES (
  '83000000-0000-4000-8000-000000000002',
  '88888888-8888-4888-8888-888888888888',
  '82000000-0000-4000-8000-000000000002',
  'Engineer', 100, true
);
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $interrupted_writer_recovery$
DECLARE
  v_job_id uuid;
  v_claim record;
  v_result jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000002'
  );
  PERFORM contract.force_created_identity_cleanup_due(v_job_id);
  SELECT * INTO v_claim
  FROM public.claim_created_enterprise_identity_cleanup_jobs_v1(25)
  WHERE cleanup_job_id = v_job_id;
  PERFORM contract.assert_true(
    v_claim.cleanup_job_id = v_job_id
    AND v_claim.status = 'provisioning'
    AND v_claim.user_id IS NULL,
    'interrupted provisioning saga was not claimable before binding'
  );
  v_result := public.prepare_created_enterprise_identity_cleanup_v1(
    v_job_id,
    NULL,
    NULL
  );
  PERFORM contract.assert_true(
    v_result ->> 'status' = 'pending_auth'
    AND v_result ->> 'user_id' = '80000000-0000-4000-8000-000000000002'
    AND (v_result ->> 'deleted_membership_count')::integer = 1,
    'interrupted writer identity was not recovered from Auth metadata'
  );
END;
$interrupted_writer_recovery$;
RESET ROLE;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1 FROM auth.users WHERE id = '80000000-0000-4000-8000-000000000002'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE user_id = '80000000-0000-4000-8000-000000000002'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '80000000-0000-4000-8000-000000000002'
  ),
  'interrupted writer recovery did not stop at pending Auth cleanup'
);

-- A late database failure rolls back the row deletes but not the saga that was
-- committed before Auth. The same job can be claimed and retried afterwards.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000004'
);
RESET ROLE;
INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES (
  '80000000-0000-4000-8000-000000000004',
  'late-failure@example.test',
  pg_catalog.jsonb_build_object(
    'effectime_identity_kind', 'enterprise_instant_member',
    'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
    'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000004'
  )
);
INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000004',
  '88888888-8888-4888-8888-888888888888',
  '80000000-0000-4000-8000-000000000004',
  'member', 'active', 'Engineer', 8
);
INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES (
  '83000000-0000-4000-8000-000000000004',
  '88888888-8888-4888-8888-888888888888',
  '82000000-0000-4000-8000-000000000004',
  'Engineer', 100, true
);
CREATE OR REPLACE FUNCTION contract.fail_created_identity_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.user_id = '80000000-0000-4000-8000-000000000004'::uuid THEN
    RAISE EXCEPTION 'forced cleanup rollback';
  END IF;
  RETURN OLD;
END;
$function$;
CREATE TRIGGER fail_created_identity_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION contract.fail_created_identity_profile_delete();
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $late_failure_rollback$
DECLARE
  v_job_id uuid;
  v_failed boolean := false;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000004'
  );
  BEGIN
    PERFORM public.prepare_created_enterprise_identity_cleanup_v1(
      v_job_id,
      '80000000-0000-4000-8000-000000000004',
      '82000000-0000-4000-8000-000000000004'
    );
  EXCEPTION WHEN raise_exception THEN
    v_failed := true;
  END;
  PERFORM contract.assert_true(v_failed, 'forced late database cleanup failure was hidden');
END;
$late_failure_rollback$;
RESET ROLE;
DROP TRIGGER fail_created_identity_profile_delete ON public.profiles;
DROP FUNCTION contract.fail_created_identity_profile_delete();

SELECT contract.assert_true(
  EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE id = '82000000-0000-4000-8000-000000000004'
  )
  AND EXISTS (
    SELECT 1 FROM public.enterprise_member_role_allocations
    WHERE id = '83000000-0000-4000-8000-000000000004'
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '80000000-0000-4000-8000-000000000004'
  )
  AND contract.created_identity_cleanup_job_state(
    contract.created_identity_cleanup_job_id(
      '81000000-0000-4000-8000-000000000004'
    )
  ) ->> 'status' = 'provisioning',
  'late database failure did not preserve both data and the durable saga'
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $late_failure_retry$
DECLARE
  v_job_id uuid;
  v_claim record;
  v_result jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000004'
  );
  PERFORM contract.force_created_identity_cleanup_due(v_job_id);
  SELECT * INTO v_claim
  FROM public.claim_created_enterprise_identity_cleanup_jobs_v1(25)
  WHERE cleanup_job_id = v_job_id;
  PERFORM contract.assert_true(
    v_claim.status = 'provisioning',
    'failed database cleanup saga was not retryable'
  );
  v_result := public.prepare_created_enterprise_identity_cleanup_v1(
    v_job_id,
    NULL,
    NULL
  );
  PERFORM contract.assert_true(
    v_result ->> 'status' = 'pending_auth'
    AND (v_result ->> 'deleted_membership_count')::integer = 1,
    'database cleanup retry did not commit'
  );
END;
$late_failure_retry$;
RESET ROLE;

-- Successful provisioning becomes terminal only after server-side Auth,
-- membership, profile and role-allocation postconditions all hold.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000006'
);
RESET ROLE;
INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES (
  '80000000-0000-4000-8000-000000000006',
  'provisioned@example.test',
  pg_catalog.jsonb_build_object(
    'effectime_identity_kind', 'enterprise_instant_member',
    'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
    'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000006'
  )
);
INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000006',
  '88888888-8888-4888-8888-888888888888',
  '80000000-0000-4000-8000-000000000006',
  'member', 'active', 'Engineer', 8
);
INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES (
  '83000000-0000-4000-8000-000000000006',
  '88888888-8888-4888-8888-888888888888',
  '82000000-0000-4000-8000-000000000006',
  'Engineer', 100, true
);
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $complete_provisioning$
DECLARE
  v_job_id uuid;
  v_result jsonb;
  v_repeat jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000006'
  );
  v_result := public.complete_created_enterprise_identity_provisioning_v1(
    v_job_id,
    '80000000-0000-4000-8000-000000000006',
    '82000000-0000-4000-8000-000000000006'
  );
  v_repeat := public.complete_created_enterprise_identity_provisioning_v1(
    v_job_id,
    '80000000-0000-4000-8000-000000000006',
    '82000000-0000-4000-8000-000000000006'
  );
  PERFORM contract.assert_true(
    v_result ->> 'ok' = 'true'
    AND v_result ->> 'status' = 'provisioned'
    AND v_result ->> 'user_id' = '80000000-0000-4000-8000-000000000006'
    AND v_result ->> 'membership_id' = '82000000-0000-4000-8000-000000000006'
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_result)) = 5
    AND v_repeat = v_result,
    'successful provisioning receipt or idempotency contract failed'
  );
  PERFORM contract.force_created_identity_cleanup_due(v_job_id);
  PERFORM contract.assert_true(
    NOT EXISTS (
      SELECT 1
      FROM public.claim_created_enterprise_identity_cleanup_jobs_v1(25)
      WHERE cleanup_job_id = v_job_id
    ),
    'successfully provisioned identity was claimable for cleanup'
  );
END;
$complete_provisioning$;
RESET ROLE;

-- An intent with no visible Auth identity remains retryable and records only a
-- bounded error enum. No unverified absence is treated as completion.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $missing_identity_retry$
DECLARE
  v_job_id uuid;
  v_claim record;
  v_missing boolean := false;
  v_result jsonb;
BEGIN
  PERFORM public.register_created_enterprise_identity_provisioning_v1(
    '88888888-8888-4888-8888-888888888888',
    '81000000-0000-4000-8000-000000000007'
  );
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000007'
  );
  PERFORM contract.force_created_identity_cleanup_due(v_job_id);
  SELECT * INTO v_claim
  FROM public.claim_created_enterprise_identity_cleanup_jobs_v1(25)
  WHERE cleanup_job_id = v_job_id;
  BEGIN
    PERFORM public.prepare_created_enterprise_identity_cleanup_v1(v_job_id, NULL, NULL);
  EXCEPTION WHEN no_data_found THEN
    v_missing := true;
  END;
  PERFORM contract.assert_true(v_missing, 'missing Auth identity was treated as cleaned');
  v_result := public.fail_created_enterprise_identity_cleanup_v1(
    v_job_id,
    NULL,
    'identity_not_visible'
  );
  PERFORM contract.assert_true(
    v_claim.status = 'provisioning'
    AND v_claim.user_id IS NULL
    AND v_result ->> 'status' = 'provisioning'
    AND v_result ->> 'error_code' = 'identity_not_visible'
    AND (v_result ->> 'attempt_count')::integer = 1,
    'unbound provisioning retry receipt is invalid'
  );
END;
$missing_identity_retry$;
RESET ROLE;

-- Auth app_metadata, not mutable user metadata or caller-provided IDs, is the
-- exact binding proof. A mismatched identity leaves the pre-existing saga and
-- all rows untouched.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000003'
);
RESET ROLE;
INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES (
  '80000000-0000-4000-8000-000000000003',
  'wrong-metadata@example.test',
  pg_catalog.jsonb_build_object(
    'effectime_identity_kind', 'regular_user',
    'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
    'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000003'
  )
);
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $metadata_denial$
DECLARE
  v_job_id uuid;
  v_denied boolean := false;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000003'
  );
  BEGIN
    PERFORM public.prepare_created_enterprise_identity_cleanup_v1(
      v_job_id,
      '80000000-0000-4000-8000-000000000003',
      NULL
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'non-instant Auth app_metadata was accepted');
  PERFORM contract.assert_true(
    contract.created_identity_cleanup_job_state(v_job_id) ->> 'status' = 'provisioning',
    'metadata denial destroyed the durable saga'
  );
END;
$metadata_denial$;
RESET ROLE;

-- A matching Auth identity which already owns data in another workspace must
-- never be deleted by a cleanup intent scoped to this workspace.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000005'
);
RESET ROLE;
INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES (
  '80000000-0000-4000-8000-000000000005',
  'cross-tenant@example.test',
  pg_catalog.jsonb_build_object(
    'effectime_identity_kind', 'enterprise_instant_member',
    'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
    'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000005'
  )
);
INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000005',
  '99999999-9999-4999-8999-999999999999',
  '80000000-0000-4000-8000-000000000005',
  'member', 'active', 'Engineer', 8
);
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $cross_workspace_denial$
DECLARE
  v_job_id uuid;
  v_denied boolean := false;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000005'
  );
  BEGIN
    PERFORM public.prepare_created_enterprise_identity_cleanup_v1(
      v_job_id,
      '80000000-0000-4000-8000-000000000005',
      NULL
    );
  EXCEPTION WHEN foreign_key_violation THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'cross-workspace identity cleanup was accepted');
END;
$cross_workspace_denial$;
RESET ROLE;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1 FROM auth.users WHERE id = '80000000-0000-4000-8000-000000000005'
  )
  AND EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE id = '82000000-0000-4000-8000-000000000005'
  ),
  'cross-workspace denial mutated the protected identity'
);

-- Leave one exact pending_auth fixture with proven Auth absence for the
-- two-session finalizer/write serialization contract.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000008'
);
RESET ROLE;
INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES (
  '80000000-0000-4000-8000-000000000008',
  'finalizer-race@example.test',
  pg_catalog.jsonb_build_object(
    'effectime_identity_kind', 'enterprise_instant_member',
    'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
    'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000008'
  )
);
INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000008',
  '88888888-8888-4888-8888-888888888888',
  '80000000-0000-4000-8000-000000000008',
  'member', 'active', 'Engineer', 8
);
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.prepare_created_enterprise_identity_cleanup_v1(
  contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000008'
  ),
  '80000000-0000-4000-8000-000000000008',
  '82000000-0000-4000-8000-000000000008'
);
RESET ROLE;
DELETE FROM auth.users WHERE id = '80000000-0000-4000-8000-000000000008';

CREATE TABLE contract.created_identity_cleanup_concurrency_gate (
  id integer PRIMARY KEY,
  released boolean NOT NULL
);
INSERT INTO contract.created_identity_cleanup_concurrency_gate(id, released)
VALUES (13, false);

CREATE TABLE contract.created_identity_cleanup_concurrency_results (
  client text NOT NULL,
  outcome text NOT NULL
);

CREATE OR REPLACE FUNCTION contract.wait_for_created_identity_cleanup_release(
  p_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_released boolean;
BEGIN
  FOR v_attempt IN 1..300 LOOP
    SELECT gate.released
    INTO v_released
    FROM contract.created_identity_cleanup_concurrency_gate AS gate
    WHERE gate.id = p_id;
    IF v_released THEN
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
  RAISE EXCEPTION 'Timed out waiting for created identity cleanup release';
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.wait_for_created_identity_cleanup_release(integer)
  TO service_role;

SELECT 'created identity provisioning saga contract passed' AS result;
