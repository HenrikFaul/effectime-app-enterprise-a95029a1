\set ON_ERROR_STOP on
SET client_min_messages TO warning;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid =
      'effectime_private.created_identity_cleanup_jobs'::pg_catalog.regclass
      AND attribute.attname = 'lease_token'
      AND attribute.atttypid = 'uuid'::pg_catalog.regtype
      AND NOT attribute.attisdropped
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid =
      'effectime_private.created_identity_cleanup_jobs'::pg_catalog.regclass
      AND trigger_record.tgname = 'enforce_created_identity_cleanup_lease_v2'
      AND trigger_record.tgfoid =
        'effectime_private.enforce_created_identity_cleanup_lease_v2()'::pg_catalog.regprocedure
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND (
    SELECT pg_catalog.count(*) = 1
    FROM effectime_private.created_identity_cleanup_worker_state AS worker_state
    WHERE worker_state.singleton
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid =
      'effectime_private.created_identity_cleanup_worker_state'::pg_catalog.regclass
      AND constraint_record.conname =
        'created_identity_cleanup_scheduler_installation_check'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid =
      'effectime_private.created_identity_cleanup_worker_state'::pg_catalog.regclass
      AND NOT attribute.attisdropped
      AND attribute.attname ~ '(user|email|workspace|secret|credential)'
  ),
  'fencing column, trigger or PII-free singleton ledger is invalid'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation_record
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = relation_record.relowner
    WHERE relation_record.oid =
      'effectime_private.temporary_profile_cleanup_leases'::pg_catalog.regclass
      AND relation_record.relrowsecurity
      AND owner_role.rolname = 'postgres'
  )
  AND NOT pg_catalog.has_table_privilege(
    'service_role',
    'effectime_private.temporary_profile_cleanup_leases',
    'SELECT,INSERT,UPDATE,DELETE'
  )
  AND NOT pg_catalog.has_table_privilege(
    'authenticated',
    'effectime_private.temporary_profile_cleanup_leases',
    'SELECT,INSERT,UPDATE,DELETE'
  )
  AND NOT pg_catalog.has_table_privilege(
    'anon',
    'effectime_private.temporary_profile_cleanup_leases',
    'SELECT,INSERT,UPDATE,DELETE'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.profiles'::pg_catalog.regclass
      AND trigger_record.tgname = 'zz_guard_temporary_profile_cleanup_lease'
      AND trigger_record.tgfoid =
        'effectime_private.guard_temporary_profile_cleanup_profile_v1()'::pg_catalog.regprocedure
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.events'::pg_catalog.regclass
      AND trigger_record.tgname = 'zz_guard_temporary_event_cleanup_lease'
      AND trigger_record.tgfoid =
        'effectime_private.guard_temporary_profile_cleanup_event_v1()'::pg_catalog.regprocedure
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_record
    JOIN pg_catalog.pg_class AS index_relation
      ON index_relation.oid = index_record.indexrelid
    WHERE index_record.indrelid =
      'effectime_private.temporary_profile_cleanup_leases'::pg_catalog.regclass
      AND index_relation.relname =
        'temporary_profile_cleanup_leases_event_expiry_idx'
      AND index_record.indisvalid
      AND index_record.indisready
      AND index_record.indpred IS NOT NULL
      AND pg_catalog.pg_get_indexdef(index_record.indexrelid) LIKE
        '%(linked_event_id, lease_expires_at)%'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_record
    JOIN pg_catalog.pg_class AS index_relation
      ON index_relation.oid = index_record.indexrelid
    WHERE index_record.indrelid = 'public.profiles'::pg_catalog.regclass
      AND index_relation.relname = 'temporary_profiles_cleanup_candidates_idx'
      AND index_record.indisvalid
      AND index_record.indisready
      AND index_record.indpred IS NOT NULL
      AND pg_catalog.pg_get_indexdef(index_record.indexrelid) LIKE
        '%(created_at, user_id)%'
  ),
  'legacy temporary-profile lease table, RLS, ACL or trigger contract is invalid'
);

SELECT contract.assert_true(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_eligible_temporary_profiles_v1(integer)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.prepare_temporary_profile_cleanup_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.complete_temporary_profile_cleanup_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_eligible_temporary_profiles_v1(integer)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.claim_eligible_temporary_profiles_v1(integer)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.prepare_temporary_profile_cleanup_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.prepare_temporary_profile_cleanup_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.complete_temporary_profile_cleanup_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.complete_temporary_profile_cleanup_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'effectime_private.guard_temporary_profile_cleanup_profile_v1()',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'effectime_private.guard_temporary_profile_cleanup_event_v1()',
    'EXECUTE'
  ),
  'legacy temporary-profile cleanup RPC or guard ACL contract is invalid'
);

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_record
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = procedure_record.proowner
    WHERE procedure_record.oid IN (
      'effectime_private.guard_temporary_profile_cleanup_profile_v1()'::pg_catalog.regprocedure,
      'effectime_private.guard_temporary_profile_cleanup_event_v1()'::pg_catalog.regprocedure,
      'public.claim_eligible_temporary_profiles_v1(integer)'::pg_catalog.regprocedure,
      'public.prepare_temporary_profile_cleanup_v1(uuid,uuid)'::pg_catalog.regprocedure,
      'public.complete_temporary_profile_cleanup_v1(uuid,uuid)'::pg_catalog.regprocedure
    )
      AND (
        NOT procedure_record.prosecdef
        OR owner_role.rolname <> 'postgres'
        OR procedure_record.proconfig IS NULL
        OR NOT procedure_record.proconfig @>
          ARRAY['search_path=pg_catalog', 'lock_timeout=5s']::text[]
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_record
    WHERE procedure_record.oid IN (
      'public.claim_eligible_temporary_profiles_v1(integer)'::pg_catalog.regprocedure,
      'public.prepare_temporary_profile_cleanup_v1(uuid,uuid)'::pg_catalog.regprocedure,
      'public.complete_temporary_profile_cleanup_v1(uuid,uuid)'::pg_catalog.regprocedure
    )
      AND NOT procedure_record.proconfig @>
        ARRAY['statement_timeout=10s']::text[]
  ),
  'legacy temporary-profile cleanup owner, search_path or timeout contract is invalid'
);

SELECT contract.assert_true(
  NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_created_enterprise_identity_cleanup_jobs_v1(integer)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_created_enterprise_identity_cleanup_jobs_v2(integer)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.prepare_created_enterprise_identity_cleanup_v2(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.complete_created_enterprise_identity_cleanup_v2(uuid,uuid,uuid)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.fail_created_enterprise_identity_cleanup_v2(uuid,uuid,text,uuid)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.acquire_created_identity_cleanup_worker_v1(uuid,integer)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.finish_created_identity_cleanup_worker_v1(uuid,text,integer,integer,integer,integer,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_created_enterprise_identity_cleanup_jobs_v2(integer)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.acquire_created_identity_cleanup_worker_v1(uuid,integer)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_table_privilege(
    'service_role',
    'effectime_private.created_identity_cleanup_worker_state',
    'SELECT,INSERT,UPDATE,DELETE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'effectime_private.install_created_identity_cleanup_scheduler_v1(text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'effectime_private.pause_created_identity_cleanup_scheduler_v1()',
    'EXECUTE'
  ),
  'worker RPC or owner-only scheduler ACL contract is invalid'
);

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid IN (
      'public.claim_created_enterprise_identity_cleanup_jobs_v2(integer)'::pg_catalog.regprocedure,
      'public.prepare_created_enterprise_identity_cleanup_v2(uuid,uuid,uuid,uuid)'::pg_catalog.regprocedure,
      'public.complete_created_enterprise_identity_cleanup_v2(uuid,uuid,uuid)'::pg_catalog.regprocedure,
      'public.fail_created_enterprise_identity_cleanup_v2(uuid,uuid,text,uuid)'::pg_catalog.regprocedure,
      'public.acquire_created_identity_cleanup_worker_v1(uuid,integer)'::pg_catalog.regprocedure,
      'public.finish_created_identity_cleanup_worker_v1(uuid,text,integer,integer,integer,integer,text)'::pg_catalog.regprocedure,
      'effectime_private.install_created_identity_cleanup_scheduler_v1(text)'::pg_catalog.regprocedure,
      'effectime_private.pause_created_identity_cleanup_scheduler_v1()'::pg_catalog.regprocedure
    )
      AND (
        NOT procedure.prosecdef
        OR procedure.proconfig IS NULL
        OR NOT procedure.proconfig @> ARRAY['search_path=pg_catalog']::text[]
        OR owner_role.rolname <> 'postgres'
      )
  ),
  'worker or scheduler functions lack fixed search_path, owner or SECURITY DEFINER'
);

DO $scheduler_source_contract$
DECLARE
  v_install_source text;
  v_install_failed_closed boolean := false;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'effectime_private.install_created_identity_cleanup_scheduler_v1(text)'::pg_catalog.regprocedure
  ) INTO v_install_source;

  PERFORM contract.assert_true(
    v_install_source LIKE '%effectime-created-identity-cleanup-v1%'
    AND v_install_source LIKE '%*/5 * * * *%'
    AND v_install_source LIKE '%timeout_milliseconds := 120000%'
    AND v_install_source LIKE '%created_identity_cleanup_anon_key%'
    AND v_install_source LIKE '%created_identity_cleanup_scheduler_secret%'
    AND v_install_source LIKE '%x-effectime-cleanup-secret%'
    AND v_install_source NOT LIKE '%email_queue_service_role_key%'
    AND v_install_source NOT LIKE '%sb_secret_%Bearer%'
    AND v_install_source NOT LIKE '%service_role_key%',
    'scheduler installer does not preserve runtime Vault or timeout invariants'
  );

  BEGIN
    PERFORM effectime_private.install_created_identity_cleanup_scheduler_v1(
      'abcdefghijklmnopqrst'
    );
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN
      v_install_failed_closed := true;
  END;

  PERFORM contract.assert_true(
    v_install_failed_closed,
    'scheduler installation did not fail closed without reviewed extensions and Vault'
  );
END;
$scheduler_source_contract$;

-- A retained profile deliberately sorts before the eligible profile. A limit-1
-- claim must still select the eligible row, proving retained rows are excluded
-- before ORDER/LIMIT and cannot starve the cleanup worker.
INSERT INTO auth.users(id, email)
VALUES
  ('86000000-0000-4000-8000-000000000001', 'retained-temp@example.test'),
  ('86000000-0000-4000-8000-000000000002', 'eligible-temp@example.test');

INSERT INTO public.events(id, created_by, end_date, created_at)
VALUES
  (
    '86100000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    DATE '2099-12-31',
    TIMESTAMPTZ '2020-01-01 00:00:00+00'
  ),
  (
    '86100000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    DATE '2000-01-01',
    TIMESTAMPTZ '2026-01-01 00:00:00+00'
  );

UPDATE public.profiles AS profile
SET is_temporary = true,
    linked_event_id = CASE profile.user_id
      WHEN '86000000-0000-4000-8000-000000000001'::uuid
        THEN '86100000-0000-4000-8000-000000000001'::uuid
      ELSE '86100000-0000-4000-8000-000000000002'::uuid
    END,
    created_at = CASE profile.user_id
      WHEN '86000000-0000-4000-8000-000000000001'::uuid
        THEN TIMESTAMPTZ '2020-01-01 00:00:00+00'
      ELSE TIMESTAMPTZ '2026-01-01 00:00:00+00'
    END
WHERE profile.user_id IN (
  '86000000-0000-4000-8000-000000000001'::uuid,
  '86000000-0000-4000-8000-000000000002'::uuid
);

INSERT INTO public.votes(event_id, user_id)
VALUES (
  '86100000-0000-4000-8000-000000000002',
  '86000000-0000-4000-8000-000000000002'
);
INSERT INTO public.event_participants(event_id, user_id)
VALUES (
  '86100000-0000-4000-8000-000000000002',
  '86000000-0000-4000-8000-000000000002'
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
CREATE TEMP TABLE contract_temporary_profile_claim AS
SELECT claim.user_id, claim.lease_token
FROM public.claim_eligible_temporary_profiles_v1(1) AS claim;

SELECT contract.assert_true(
  (SELECT pg_catalog.count(*) = 1 FROM contract_temporary_profile_claim)
  AND (
    SELECT claim.user_id = '86000000-0000-4000-8000-000000000002'::uuid
      AND claim.lease_token IS NOT NULL
    FROM contract_temporary_profile_claim AS claim
  ),
  'retained temporary profile starved or replaced the eligible claim'
);

RESET ROLE;
CREATE TEMP TABLE contract_temporary_profile_lease_before AS
SELECT cleanup_lease.user_id, cleanup_lease.lease_expires_at
FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000002';

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $temporary_profile_prepare_contract$
DECLARE
  v_user_id uuid;
  v_token uuid;
  v_prepare jsonb;
  v_wrong_token_denied boolean := false;
  v_early_complete_denied boolean := false;
BEGIN
  SELECT claim.user_id, claim.lease_token
  INTO v_user_id, v_token
  FROM contract_temporary_profile_claim AS claim;

  BEGIN
    PERFORM public.prepare_temporary_profile_cleanup_v1(
      v_user_id,
      'ffffffff-ffff-4fff-8fff-ffffffffffff'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_wrong_token_denied := true;
  END;

  v_prepare := public.prepare_temporary_profile_cleanup_v1(v_user_id, v_token);

  BEGIN
    PERFORM public.complete_temporary_profile_cleanup_v1(v_user_id, v_token);
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    v_early_complete_denied := true;
  END;

  PERFORM contract.assert_true(
    v_prepare = pg_catalog.jsonb_build_object(
      'ok', true,
      'user_id', v_user_id,
      'lease_token', v_token,
      'mode', 'eligible_profile'
    )
    AND v_wrong_token_denied
    AND v_early_complete_denied,
    'temporary profile cleanup prepare, token or Auth-first contract failed'
  );
END;
$temporary_profile_prepare_contract$;
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT cleanup_lease.lease_expires_at >= before_lease.lease_expires_at
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    JOIN contract_temporary_profile_lease_before AS before_lease
      ON before_lease.user_id = cleanup_lease.user_id
    WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000002'
  ),
  'temporary profile cleanup prepare did not renew the exact lease'
);

DO $temporary_profile_mutation_fence_contract$
DECLARE
  v_user_id uuid := '86000000-0000-4000-8000-000000000002';
  v_upgrade_denied boolean := false;
  v_event_extension_denied boolean := false;
  v_event_delete_denied boolean := false;
  v_direct_profile_delete_denied boolean := false;
BEGIN
  -- These unrelated columns are outside the eligibility fence and remain
  -- writable while the exact identity/event decision is frozen.
  UPDATE public.profiles AS profile
  SET display_name = 'eligible-temp-renamed'
  WHERE profile.user_id = v_user_id;
  UPDATE public.events AS linked_event
  SET created_at = linked_event.created_at + interval '1 second'
  WHERE linked_event.id = '86100000-0000-4000-8000-000000000002';

  BEGIN
    UPDATE public.profiles AS profile
    SET is_temporary = false
    WHERE profile.user_id = v_user_id;
  EXCEPTION WHEN serialization_failure THEN
    v_upgrade_denied := true;
  END;

  BEGIN
    UPDATE public.events AS linked_event
    SET end_date = DATE '2099-12-31'
    WHERE linked_event.id = '86100000-0000-4000-8000-000000000002';
  EXCEPTION WHEN serialization_failure THEN
    v_event_extension_denied := true;
  END;

  BEGIN
    DELETE FROM public.events AS linked_event
    WHERE linked_event.id = '86100000-0000-4000-8000-000000000002';
  EXCEPTION WHEN serialization_failure THEN
    v_event_delete_denied := true;
  END;

  BEGIN
    DELETE FROM public.profiles AS profile WHERE profile.user_id = v_user_id;
  EXCEPTION WHEN serialization_failure THEN
    v_direct_profile_delete_denied := true;
  END;

  PERFORM contract.assert_true(
    v_upgrade_denied
    AND v_event_extension_denied
    AND v_event_delete_denied
    AND v_direct_profile_delete_denied,
    'temporary profile or event cleanup mutation fence failed'
  );
END;
$temporary_profile_mutation_fence_contract$;

DELETE FROM auth.users AS auth_user
WHERE auth_user.id = '86000000-0000-4000-8000-000000000002';

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $temporary_profile_complete_contract$
DECLARE
  v_user_id uuid;
  v_token uuid;
  v_complete jsonb;
BEGIN
  SELECT claim.user_id, claim.lease_token
  INTO v_user_id, v_token
  FROM contract_temporary_profile_claim AS claim;
  v_complete := public.complete_temporary_profile_cleanup_v1(v_user_id, v_token);
  PERFORM contract.assert_true(
    v_complete = pg_catalog.jsonb_build_object(
      'ok', true,
      'user_id', v_user_id,
      'lease_token', v_token,
      'status', 'completed'
    ),
    'temporary profile cleanup completion receipt is not exact'
  );
END;
$temporary_profile_complete_contract$;
RESET ROLE;

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1 FROM auth.users AS auth_user
    WHERE auth_user.id = '86000000-0000-4000-8000-000000000002'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.user_id = '86000000-0000-4000-8000-000000000002'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.votes AS vote
    WHERE vote.user_id = '86000000-0000-4000-8000-000000000002'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.event_participants AS participant
    WHERE participant.user_id = '86000000-0000-4000-8000-000000000002'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000002'
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.user_id = '86000000-0000-4000-8000-000000000001'
      AND profile.is_temporary
  )
  AND NOT EXISTS (
    SELECT 1
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000001'
  ),
  'temporary profile completion leaked rows or claimed a retained profile'
);

-- Auth owns the expired linked event in this case. The exact Auth cascade may
-- delete that sole event/profile pair; direct event deletion above remains
-- fenced.
INSERT INTO auth.users(id, email)
VALUES ('86000000-0000-4000-8000-000000000003', 'owner-temp@example.test');
INSERT INTO public.events(id, created_by, end_date)
VALUES (
  '86100000-0000-4000-8000-000000000003',
  '86000000-0000-4000-8000-000000000003',
  DATE '2000-01-01'
);
UPDATE public.profiles AS profile
SET is_temporary = true,
    linked_event_id = '86100000-0000-4000-8000-000000000003'
WHERE profile.user_id = '86000000-0000-4000-8000-000000000003';
INSERT INTO public.event_participants(event_id, user_id)
VALUES (
  '86100000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002'
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
CREATE TEMP TABLE contract_owner_temporary_profile_claim AS
SELECT claim.user_id, claim.lease_token
FROM public.claim_eligible_temporary_profiles_v1(1) AS claim;
SELECT contract.assert_true(
  (SELECT pg_catalog.count(*) = 1 FROM contract_owner_temporary_profile_claim)
  AND (
    SELECT claim.user_id = '86000000-0000-4000-8000-000000000003'::uuid
    FROM contract_owner_temporary_profile_claim AS claim
  ),
  'same-owner temporary profile was not claimed exactly once'
);
DO $owner_temporary_profile_prepare_contract$
DECLARE
  v_claim record;
BEGIN
  SELECT * INTO v_claim FROM contract_owner_temporary_profile_claim;
  PERFORM public.prepare_temporary_profile_cleanup_v1(
    v_claim.user_id,
    v_claim.lease_token
  );
END;
$owner_temporary_profile_prepare_contract$;
RESET ROLE;

DO $owner_cascade_collateral_denial_contract$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    DELETE FROM auth.users AS auth_user
    WHERE auth_user.id = '86000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN serialization_failure THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(
    v_denied
    AND EXISTS (
      SELECT 1 FROM auth.users AS auth_user
      WHERE auth_user.id = '86000000-0000-4000-8000-000000000003'
    ),
    'same-owner Auth cascade accepted another participant data loss'
  );
END;
$owner_cascade_collateral_denial_contract$;
DELETE FROM public.event_participants AS participant
WHERE participant.event_id = '86100000-0000-4000-8000-000000000003'
  AND participant.user_id = '10000000-0000-4000-8000-000000000002';

DELETE FROM auth.users AS auth_user
WHERE auth_user.id = '86000000-0000-4000-8000-000000000003';

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1 FROM auth.users AS auth_user
    WHERE auth_user.id = '86000000-0000-4000-8000-000000000003'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.events AS linked_event
    WHERE linked_event.id = '86100000-0000-4000-8000-000000000003'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.user_id = '86000000-0000-4000-8000-000000000003'
  ),
  'same-owner Auth cascade was blocked or left identity rows behind'
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $owner_temporary_profile_complete_contract$
DECLARE
  v_claim record;
  v_complete jsonb;
BEGIN
  SELECT * INTO v_claim FROM contract_owner_temporary_profile_claim;
  v_complete := public.complete_temporary_profile_cleanup_v1(
    v_claim.user_id,
    v_claim.lease_token
  );
  PERFORM contract.assert_true(
    v_complete ->> 'status' = 'completed'
      AND v_complete ->> 'user_id' = v_claim.user_id::text
      AND v_complete ->> 'lease_token' = v_claim.lease_token::text,
    'same-owner Auth cascade did not complete its fenced receipt'
  );
END;
$owner_temporary_profile_complete_contract$;
RESET ROLE;

INSERT INTO auth.users(id, email)
VALUES ('86000000-0000-4000-8000-000000000004', 'orphan-temp@example.test');
INSERT INTO public.events(id, created_by, end_date)
VALUES (
  '86100000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  DATE '2000-01-01'
);
UPDATE public.profiles AS profile
SET is_temporary = true,
    linked_event_id = '86100000-0000-4000-8000-000000000004'
WHERE profile.user_id = '86000000-0000-4000-8000-000000000004';

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
CREATE TEMP TABLE contract_orphan_old_claim AS
SELECT claim.user_id, claim.lease_token
FROM public.claim_eligible_temporary_profiles_v1(1) AS claim;
RESET ROLE;

DELETE FROM auth.users AS auth_user
WHERE auth_user.id = '86000000-0000-4000-8000-000000000004';
UPDATE effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
SET claimed_at = pg_catalog.now() - interval '3 minutes',
    lease_expires_at = pg_catalog.now() - interval '1 minute'
WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000004';

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $expired_orphan_token_contract$
DECLARE
  v_old_claim record;
  v_denied boolean := false;
BEGIN
  SELECT * INTO v_old_claim FROM contract_orphan_old_claim;
  BEGIN
    PERFORM public.complete_temporary_profile_cleanup_v1(
      v_old_claim.user_id,
      v_old_claim.lease_token
    );
  EXCEPTION WHEN serialization_failure THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(
    v_denied,
    'expired orphan cleanup token retained completion authority'
  );
END;
$expired_orphan_token_contract$;

CREATE TEMP TABLE contract_orphan_reclaimed AS
SELECT claim.user_id, claim.lease_token
FROM public.claim_eligible_temporary_profiles_v1(1) AS claim;
DO $reclaimed_orphan_token_contract$
DECLARE
  v_old_claim record;
  v_new_claim record;
  v_prepare jsonb;
  v_complete jsonb;
BEGIN
  SELECT * INTO v_old_claim FROM contract_orphan_old_claim;
  SELECT * INTO v_new_claim FROM contract_orphan_reclaimed;
  v_prepare := public.prepare_temporary_profile_cleanup_v1(
    v_new_claim.user_id,
    v_new_claim.lease_token
  );
  v_complete := public.complete_temporary_profile_cleanup_v1(
    v_new_claim.user_id,
    v_new_claim.lease_token
  );
  PERFORM contract.assert_true(
    v_new_claim.user_id = v_old_claim.user_id
    AND v_new_claim.lease_token IS DISTINCT FROM v_old_claim.lease_token
    AND v_prepare ->> 'mode' = 'orphan_recovery'
    AND v_complete ->> 'status' = 'completed',
    'expired orphan lease was not rotated and completed by its new fence'
  );
END;
$reclaimed_orphan_token_contract$;
RESET ROLE;

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000004'
  ),
  'reclaimed orphan lease was not removed after exact completion'
);
DELETE FROM public.events AS linked_event
WHERE linked_event.id = '86100000-0000-4000-8000-000000000004';

DO $legacy_anon_jwt_contract$
DECLARE
  v_payload text;
  v_payload_without_ref text;
  v_key text;
  v_key_without_ref text;
BEGIN
  v_payload := pg_catalog.rtrim(
    pg_catalog.translate(
      pg_catalog.replace(
        pg_catalog.replace(
          pg_catalog.encode(
            pg_catalog.convert_to(
              '{"role":"anon","ref":"abcdefghijklmnopqrst"}',
              'UTF8'
            ),
            'base64'
          ),
          E'\n',
          ''
        ),
        E'\r',
        ''
      ),
      '+/',
      '-_'
    ),
    '='
  );
  v_key := 'eyJhbGciOiJIUzI1NiJ9.' || v_payload
    || '.0123456789abcdefghijklmnopqrstuv';
  v_payload_without_ref := pg_catalog.rtrim(
    pg_catalog.translate(
      pg_catalog.replace(
        pg_catalog.replace(
          pg_catalog.encode(
            pg_catalog.convert_to('{"role":"anon"}', 'UTF8'),
            'base64'
          ),
          E'\n',
          ''
        ),
        E'\r',
        ''
      ),
      '+/',
      '-_'
    ),
    '='
  );
  v_key_without_ref := 'eyJhbGciOiJIUzI1NiJ9.' || v_payload_without_ref
    || '.0123456789abcdefghijklmnopqrstuv';

  PERFORM contract.assert_true(
    effectime_private.is_created_identity_cleanup_anon_key_v1(
      v_key,
      'abcdefghijklmnopqrst'
    )
    AND NOT effectime_private.is_created_identity_cleanup_anon_key_v1(
      v_key,
      'tsrqponmlkjihgfedcba'
    )
    AND NOT effectime_private.is_created_identity_cleanup_anon_key_v1(
      v_key_without_ref,
      'abcdefghijklmnopqrst'
    )
    AND NOT effectime_private.is_created_identity_cleanup_anon_key_v1(
      'sb_publishable_0123456789abcdefghijklmnopqrstuv',
      'abcdefghijklmnopqrst'
    ),
    'legacy anon JWT or exact project-ref validation is invalid'
  );
END;
$legacy_anon_jwt_contract$;

-- No migration statement invokes the owner-only installer. In the isolated
-- contract database pg_cron is absent, which also proves no job was created as
-- a side effect of applying the migration.
SELECT contract.assert_true(
  pg_catalog.to_regclass('cron.job') IS NULL,
  'contract environment unexpectedly contains a scheduler job registry'
);

-- Minimal isolated extension/Vault doubles exercise the owner-only installer
-- without contacting a network or persisting a real credential.
CREATE SCHEMA cron;
CREATE SCHEMA net;
CREATE SCHEMA vault;
CREATE TABLE cron.job (
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jobname text NOT NULL UNIQUE,
  schedule text NOT NULL,
  command text NOT NULL
);
CREATE TABLE vault.decrypted_secrets (
  name text NOT NULL,
  decrypted_secret text
);
CREATE OR REPLACE FUNCTION cron.schedule(
  p_jobname text,
  p_schedule text,
  p_command text
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  v_job_id bigint;
BEGIN
  INSERT INTO cron.job(jobname, schedule, command)
  VALUES (p_jobname, p_schedule, p_command)
  RETURNING jobid INTO v_job_id;
  RETURN v_job_id;
END;
$function$;
CREATE OR REPLACE FUNCTION cron.unschedule(p_jobname text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM cron.job AS job WHERE job.jobname = p_jobname;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted = 1;
END;
$function$;
CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 1000
)
RETURNS bigint
LANGUAGE sql
SET search_path = pg_catalog
AS $function$
  SELECT 1::bigint;
$function$;

DO $scheduler_installer_contract$
DECLARE
  v_missing_config_denied boolean := false;
  v_payload text;
  v_anon_key text;
  v_trigger_secret text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
  v_result jsonb;
  v_pause jsonb;
  v_command text;
  v_duplicate_denied boolean := false;
BEGIN
  BEGIN
    PERFORM effectime_private.install_created_identity_cleanup_scheduler_v1(
      'abcdefghijklmnopqrst'
    );
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    v_missing_config_denied := true;
  END;
  PERFORM contract.assert_true(
    v_missing_config_denied,
    'scheduler installer accepted missing Vault configuration'
  );

  v_payload := pg_catalog.rtrim(
    pg_catalog.translate(
      pg_catalog.encode(
        pg_catalog.convert_to(
          '{"role":"anon","ref":"abcdefghijklmnopqrst"}',
          'UTF8'
        ),
        'base64'
      ),
      '+/',
      '-_'
    ),
    '='
  );
  v_anon_key := 'eyJhbGciOiJIUzI1NiJ9.' || v_payload
    || '.0123456789abcdefghijklmnopqrstuv';

  INSERT INTO vault.decrypted_secrets(name, decrypted_secret) VALUES
    ('supabase_function_base_url', 'https://abcdefghijklmnopqrst.supabase.co'),
    ('created_identity_cleanup_anon_key', v_anon_key),
    ('created_identity_cleanup_scheduler_secret', v_trigger_secret);

  v_result := effectime_private.install_created_identity_cleanup_scheduler_v1(
    'abcdefghijklmnopqrst'
  );
  SELECT job.command
  INTO v_command
  FROM cron.job AS job
  WHERE job.jobname = 'effectime-created-identity-cleanup-v1';

  PERFORM contract.assert_true(
    v_result ->> 'ok' = 'true'
    AND v_result ->> 'job_name' = 'effectime-created-identity-cleanup-v1'
    AND v_result ->> 'schedule' = '*/5 * * * *'
    AND v_command LIKE '%vault.decrypted_secrets%'
    AND v_command LIKE '%timeout_milliseconds := 120000%'
    AND pg_catalog.strpos(v_command, v_anon_key) = 0
    AND pg_catalog.strpos(v_command, v_trigger_secret) = 0
    AND pg_catalog.strpos(
      v_command,
      'https://abcdefghijklmnopqrst.supabase.co'
    ) = 0,
    'scheduler install persisted a secret/URL or violated the stable schedule contract'
  );

  v_pause := effectime_private.pause_created_identity_cleanup_scheduler_v1();
  PERFORM contract.assert_true(
    v_pause ->> 'ok' = 'true'
    AND v_pause ->> 'unscheduled' = 'true'
    AND NOT EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'effectime-created-identity-cleanup-v1'
    )
    AND (
      SELECT worker_state.scheduler_job_id IS NULL
        AND worker_state.scheduler_project_ref IS NULL
        AND worker_state.scheduler_installed_at IS NULL
      FROM effectime_private.created_identity_cleanup_worker_state AS worker_state
      WHERE worker_state.singleton
    ),
    'scheduler pause did not remove the stable job and installation receipt'
  );

  INSERT INTO vault.decrypted_secrets(name, decrypted_secret)
  VALUES (
    'created_identity_cleanup_scheduler_secret',
    'qrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY0123456789_-'
  );
  BEGIN
    PERFORM effectime_private.install_created_identity_cleanup_scheduler_v1(
      'abcdefghijklmnopqrst'
    );
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    v_duplicate_denied := true;
  END;
  PERFORM contract.assert_true(
    v_duplicate_denied
    AND NOT EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'effectime-created-identity-cleanup-v1'
    ),
    'duplicate scheduler Vault name did not fail closed before scheduling'
  );
END;
$scheduler_installer_contract$;

DROP SCHEMA vault CASCADE;
DROP SCHEMA net CASCADE;
DROP SCHEMA cron CASCADE;

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $worker_singleflight_contract$
DECLARE
  v_first jsonb;
  v_overlap jsonb;
  v_finish jsonb;
  v_wrong_owner_denied boolean := false;
BEGIN
  v_first := public.acquire_created_identity_cleanup_worker_v1(
    '84000000-0000-4000-8000-000000000001',
    120
  );
  v_overlap := public.acquire_created_identity_cleanup_worker_v1(
    '84000000-0000-4000-8000-000000000002',
    120
  );

  BEGIN
    PERFORM public.finish_created_identity_cleanup_worker_v1(
      '84000000-0000-4000-8000-000000000002',
      'failed', 0, 0, 0, 0, 'invocation_failed'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_wrong_owner_denied := true;
  END;

  v_finish := public.finish_created_identity_cleanup_worker_v1(
    '84000000-0000-4000-8000-000000000001',
    'succeeded', 3, 2, 1, 0, NULL
  );

  PERFORM contract.assert_true(
    v_first ->> 'ok' = 'true'
    AND v_first ->> 'acquired' = 'true'
    AND v_first ->> 'run_id' = '84000000-0000-4000-8000-000000000001'
    AND v_first ->> 'lease_expires_at' IS NOT NULL
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_first)) = 4
    AND v_overlap ->> 'ok' = 'true'
    AND v_overlap ->> 'acquired' = 'false'
    AND v_overlap ->> 'run_id' = '84000000-0000-4000-8000-000000000002'
    AND v_overlap -> 'lease_expires_at' = 'null'::jsonb
    AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_overlap)) = 4
    AND v_wrong_owner_denied
    AND v_finish = pg_catalog.jsonb_build_object(
      'ok', true,
      'run_id', '84000000-0000-4000-8000-000000000001'::uuid,
      'status', 'succeeded'
    ),
    'worker single-flight, redaction, owner or finish receipt contract failed'
  );
END;
$worker_singleflight_contract$;
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT worker_state.last_status = 'succeeded'
      AND worker_state.last_claimed = 3
      AND worker_state.last_completed = 2
      AND worker_state.last_pending = 1
      AND worker_state.last_receipt_failures = 0
      AND worker_state.last_error_code IS NULL
      AND worker_state.overlap_count = 1
    FROM effectime_private.created_identity_cleanup_worker_state AS worker_state
    WHERE worker_state.singleton
  ),
  'worker aggregate ledger receipt is invalid'
);

-- Crash expiry is reclaimable, while the expired run can no longer finish.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.acquire_created_identity_cleanup_worker_v1(
  '84000000-0000-4000-8000-000000000003',
  120
);
RESET ROLE;
UPDATE effectime_private.created_identity_cleanup_worker_state AS worker_state
SET lease_expires_at = pg_catalog.now() - interval '1 second'
WHERE worker_state.singleton;
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $worker_crash_reclaim_contract$
DECLARE
  v_reclaimed jsonb;
  v_expired_owner_denied boolean := false;
BEGIN
  v_reclaimed := public.acquire_created_identity_cleanup_worker_v1(
    '84000000-0000-4000-8000-000000000004',
    120
  );
  BEGIN
    PERFORM public.finish_created_identity_cleanup_worker_v1(
      '84000000-0000-4000-8000-000000000003',
      'failed', 0, 0, 0, 0, 'worker_deadline_exceeded'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_expired_owner_denied := true;
  END;

  PERFORM contract.assert_true(
    v_reclaimed ->> 'acquired' = 'true'
    AND v_expired_owner_denied,
    'expired worker was not reclaimed or retained finish authority'
  );

  PERFORM public.finish_created_identity_cleanup_worker_v1(
    '84000000-0000-4000-8000-000000000004',
    'failed', 0, 0, 0, 0, 'invocation_failed'
  );
END;
$worker_crash_reclaim_contract$;
RESET ROLE;

CREATE OR REPLACE FUNCTION contract.created_identity_cleanup_lease_state(
  p_cleanup_job_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'status', cleanup_job.status,
    'lease_token', cleanup_job.lease_token,
    'lease_expires_at', cleanup_job.lease_expires_at
  )
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id;
$function$;
GRANT EXECUTE ON FUNCTION contract.created_identity_cleanup_lease_state(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION contract.delete_created_identity_cleanup_auth_user(
  p_user_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  DELETE FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id;
$function$;
GRANT EXECUTE ON FUNCTION contract.delete_created_identity_cleanup_auth_user(uuid)
  TO service_role;

-- A worker-owned prepare preserves its token and deadline. Direct v1 cleanup
-- receipts cannot mutate the leased saga.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000021'
);
RESET ROLE;
INSERT INTO auth.users(id, email, raw_app_meta_data) VALUES (
  '80000000-0000-4000-8000-000000000021',
  'fenced-worker@example.test',
  pg_catalog.jsonb_build_object(
    'effectime_identity_kind', 'enterprise_instant_member',
    'effectime_workspace_id', '88888888-8888-4888-8888-888888888888',
    'effectime_cleanup_intent_id', '81000000-0000-4000-8000-000000000021'
  )
);
INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES (
  '82000000-0000-4000-8000-000000000021',
  '88888888-8888-4888-8888-888888888888',
  '80000000-0000-4000-8000-000000000021',
  'member', 'active', 'Engineer', 8
);
INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES (
  '83000000-0000-4000-8000-000000000021',
  '88888888-8888-4888-8888-888888888888',
  '82000000-0000-4000-8000-000000000021',
  'Engineer', 100, true
);
SELECT contract.force_created_identity_cleanup_due(
  contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000021'
  )
);
UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
SET next_attempt_at = pg_catalog.now() - interval '1 day'
WHERE cleanup_job.id = contract.created_identity_cleanup_job_id(
  '81000000-0000-4000-8000-000000000021'
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $fenced_prepare_contract$
DECLARE
  v_job_id uuid;
  v_claim record;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_v1_prepare_denied boolean := false;
  v_v1_fail_denied boolean := false;
  v_v1_complete_denied boolean := false;
  v_repeat jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000021'
  );
  SELECT * INTO v_claim
  FROM public.claim_created_enterprise_identity_cleanup_jobs_v2(1)
  WHERE cleanup_job_id = v_job_id;
  v_before := contract.created_identity_cleanup_lease_state(v_job_id);

  BEGIN
    PERFORM public.prepare_created_enterprise_identity_cleanup_v1(
      v_job_id,
      '80000000-0000-4000-8000-000000000021',
      '82000000-0000-4000-8000-000000000021'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_v1_prepare_denied := true;
  END;

  v_result := public.prepare_created_enterprise_identity_cleanup_v2(
    v_job_id,
    '80000000-0000-4000-8000-000000000021',
    '82000000-0000-4000-8000-000000000021',
    v_claim.lease_token
  );
  v_after := contract.created_identity_cleanup_lease_state(v_job_id);

  BEGIN
    PERFORM public.fail_created_enterprise_identity_cleanup_v1(
      v_job_id,
      '80000000-0000-4000-8000-000000000021',
      'auth_delete_failed'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_v1_fail_denied := true;
  END;

  PERFORM contract.delete_created_identity_cleanup_auth_user(
    '80000000-0000-4000-8000-000000000021'
  );

  BEGIN
    PERFORM public.complete_created_enterprise_identity_cleanup_v1(
      v_job_id,
      '80000000-0000-4000-8000-000000000021'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_v1_complete_denied := true;
  END;

  PERFORM contract.assert_true(
    v_claim.lease_token IS NOT NULL
    AND v_v1_prepare_denied
    AND v_v1_fail_denied
    AND v_v1_complete_denied
    AND v_result ->> 'lease_token' = v_claim.lease_token::text
    AND v_before ->> 'lease_token' = v_after ->> 'lease_token'
    AND v_before ->> 'lease_expires_at' = v_after ->> 'lease_expires_at',
    'worker prepare did not retain its fence or v1 bypass remained active'
  );

  v_result := public.complete_created_enterprise_identity_cleanup_v2(
    v_job_id,
    '80000000-0000-4000-8000-000000000021',
    v_claim.lease_token
  );
  v_repeat := public.complete_created_enterprise_identity_cleanup_v2(
    v_job_id,
    '80000000-0000-4000-8000-000000000021',
    v_claim.lease_token
  );
  PERFORM contract.assert_true(
    v_result = pg_catalog.jsonb_build_object(
      'ok', true,
      'cleanup_job_id', v_job_id,
      'status', 'completed',
      'lease_token', v_claim.lease_token
    )
    AND v_repeat = v_result,
    'fenced completion receipt is invalid'
  );
END;
$fenced_prepare_contract$;
RESET ROLE;

-- Reclaiming an expired job issues a new token. The late token cannot record a
-- failure after ownership changes; the current token can.
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.register_created_enterprise_identity_provisioning_v1(
  '88888888-8888-4888-8888-888888888888',
  '81000000-0000-4000-8000-000000000022'
);
RESET ROLE;
SELECT contract.force_created_identity_cleanup_due(
  contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000022'
  )
);
UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
SET next_attempt_at = pg_catalog.now() - interval '1 day'
WHERE cleanup_job.id = contract.created_identity_cleanup_job_id(
  '81000000-0000-4000-8000-000000000022'
);
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
CREATE TEMP TABLE contract_scheduler_first_claim AS
SELECT claim.*
FROM public.claim_created_enterprise_identity_cleanup_jobs_v2(1) AS claim
WHERE claim.cleanup_job_id = contract.created_identity_cleanup_job_id(
  '81000000-0000-4000-8000-000000000022'
);
RESET ROLE;
ALTER TABLE effectime_private.created_identity_cleanup_jobs
  DISABLE TRIGGER enforce_created_identity_cleanup_lease_v2;
UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
SET lease_expires_at = pg_catalog.now() - interval '1 second'
WHERE cleanup_job.id = contract.created_identity_cleanup_job_id(
  '81000000-0000-4000-8000-000000000022'
);
ALTER TABLE effectime_private.created_identity_cleanup_jobs
  ENABLE TRIGGER enforce_created_identity_cleanup_lease_v2;
SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $late_token_denial_contract$
DECLARE
  v_job_id uuid;
  v_first_token uuid;
  v_second_claim record;
  v_late_denied boolean := false;
  v_result jsonb;
BEGIN
  v_job_id := contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000022'
  );
  SELECT first_claim.lease_token
  INTO v_first_token
  FROM contract_scheduler_first_claim AS first_claim;
  SELECT * INTO v_second_claim
  FROM public.claim_created_enterprise_identity_cleanup_jobs_v2(1)
  WHERE cleanup_job_id = v_job_id;

  BEGIN
    PERFORM public.fail_created_enterprise_identity_cleanup_v2(
      v_job_id,
      NULL,
      'identity_not_visible',
      v_first_token
    );
  EXCEPTION WHEN serialization_failure THEN
    v_late_denied := true;
  END;

  v_result := public.fail_created_enterprise_identity_cleanup_v2(
    v_job_id,
    NULL,
    'identity_not_visible',
    v_second_claim.lease_token
  );

  PERFORM contract.assert_true(
    v_first_token IS NOT NULL
    AND v_second_claim.lease_token IS NOT NULL
    AND v_second_claim.lease_token IS DISTINCT FROM v_first_token
    AND v_late_denied
    AND v_result ->> 'lease_token' = v_second_claim.lease_token::text,
    'late cleanup token retained mutation authority after lease reclaim'
  );
END;
$late_token_denial_contract$;
RESET ROLE;

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DO $unfenced_claim_denial$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.claim_created_enterprise_identity_cleanup_jobs_v1(1);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'stale v1 claimant retained execution access');
END;
$unfenced_claim_denial$;
RESET ROLE;

CREATE TABLE contract.created_identity_cleanup_scheduler_concurrency_gate (
  id integer PRIMARY KEY,
  released boolean NOT NULL
);
INSERT INTO contract.created_identity_cleanup_scheduler_concurrency_gate(id, released)
VALUES (21, false);

CREATE TABLE contract.created_identity_cleanup_scheduler_concurrency_results (
  client text PRIMARY KEY,
  outcome text NOT NULL
);
GRANT INSERT ON TABLE contract.created_identity_cleanup_scheduler_concurrency_results
  TO service_role;

CREATE OR REPLACE FUNCTION contract.wait_for_created_identity_cleanup_scheduler_release(
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
    FROM contract.created_identity_cleanup_scheduler_concurrency_gate AS gate
    WHERE gate.id = p_id;
    IF v_released THEN
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
  RAISE EXCEPTION 'Timed out waiting for created identity scheduler release';
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.wait_for_created_identity_cleanup_scheduler_release(integer)
  TO service_role;

CREATE TABLE contract.temporary_profile_cleanup_concurrency_gate (
  id integer PRIMARY KEY,
  released boolean NOT NULL
);
INSERT INTO contract.temporary_profile_cleanup_concurrency_gate(id, released)
VALUES (31, false), (32, false);

CREATE TABLE contract.temporary_profile_cleanup_concurrency_results (
  scenario text NOT NULL,
  client text NOT NULL,
  outcome text NOT NULL,
  PRIMARY KEY (scenario, client)
);
GRANT INSERT ON TABLE contract.temporary_profile_cleanup_concurrency_results
  TO service_role;

CREATE OR REPLACE FUNCTION contract.wait_for_temporary_profile_cleanup_release(
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
    FROM contract.temporary_profile_cleanup_concurrency_gate AS gate
    WHERE gate.id = p_id;
    IF v_released THEN
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
  RAISE EXCEPTION 'Timed out waiting for temporary profile cleanup release';
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.wait_for_temporary_profile_cleanup_release(integer)
  TO service_role;

INSERT INTO auth.users(id, email)
VALUES
  ('86000000-0000-4000-8000-000000000011', 'event-race-temp@example.test'),
  ('86000000-0000-4000-8000-000000000012', 'upgrade-race-temp@example.test');
INSERT INTO public.events(id, created_by, end_date, created_at)
VALUES
  (
    '86100000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    DATE '2000-01-01',
    TIMESTAMPTZ '2026-02-01 00:00:00+00'
  ),
  (
    '86100000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000001',
    DATE '2000-01-01',
    TIMESTAMPTZ '2026-03-01 00:00:00+00'
  );
UPDATE public.profiles AS profile
SET is_temporary = true,
    linked_event_id = CASE profile.user_id
      WHEN '86000000-0000-4000-8000-000000000011'::uuid
        THEN '86100000-0000-4000-8000-000000000011'::uuid
      ELSE '86100000-0000-4000-8000-000000000012'::uuid
    END,
    created_at = CASE profile.user_id
      WHEN '86000000-0000-4000-8000-000000000011'::uuid
        THEN TIMESTAMPTZ '2026-02-01 00:00:00+00'
      ELSE TIMESTAMPTZ '2026-03-01 00:00:00+00'
    END
WHERE profile.user_id IN (
  '86000000-0000-4000-8000-000000000011'::uuid,
  '86000000-0000-4000-8000-000000000012'::uuid
);

SELECT 'created identity cleanup scheduler assertions passed' AS result;
