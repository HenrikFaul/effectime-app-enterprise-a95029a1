\set ON_ERROR_STOP on
SET client_min_messages TO warning;

\if :{?CREATED_IDENTITY_SCHEDULER_WORKER_A}
SET application_name TO 'effectime-created-identity-worker-a';
BEGIN;
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
DO $worker_a$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.acquire_created_identity_cleanup_worker_v1(
    '84000000-0000-4000-8000-000000000021',
    150
  );
  INSERT INTO contract.created_identity_cleanup_scheduler_concurrency_results(
    client,
    outcome
  ) VALUES (
    'worker-a',
    CASE
      WHEN v_result ->> 'acquired' = 'true'
       AND v_result ->> 'run_id' = '84000000-0000-4000-8000-000000000021'
      THEN 'acquired'
      ELSE 'unexpected-result'
    END
  );
END;
$worker_a$;
SELECT pg_catalog.pg_advisory_xact_lock(734562, 21);
SELECT contract.wait_for_created_identity_cleanup_scheduler_release(21);
COMMIT;

\elif :{?CREATED_IDENTITY_SCHEDULER_WORKER_B}
SET application_name TO 'effectime-created-identity-worker-b';
BEGIN;
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
DO $worker_b$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.acquire_created_identity_cleanup_worker_v1(
    '84000000-0000-4000-8000-000000000022',
    150
  );
  INSERT INTO contract.created_identity_cleanup_scheduler_concurrency_results(
    client,
    outcome
  ) VALUES (
    'worker-b',
    CASE
      WHEN v_result ->> 'acquired' = 'false'
       AND v_result ->> 'run_id' = '84000000-0000-4000-8000-000000000022'
       AND v_result -> 'lease_expires_at' = 'null'::jsonb
      THEN 'overlap-redacted'
      WHEN v_result ->> 'acquired' = 'true' THEN 'unexpected-acquired'
      ELSE 'overlap-leaked'
    END
  );
END;
$worker_b$;
COMMIT;

\elif :{?CREATED_IDENTITY_SCHEDULER_VERIFY}
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.created_identity_cleanup_scheduler_concurrency_results AS result
    WHERE result.client = 'worker-a'
      AND result.outcome = 'acquired'
  )
  AND EXISTS (
    SELECT 1
    FROM contract.created_identity_cleanup_scheduler_concurrency_results AS result
    WHERE result.client = 'worker-b'
      AND result.outcome = 'overlap-redacted'
  )
  AND (
    SELECT worker_state.active_run_id =
      '84000000-0000-4000-8000-000000000021'::uuid
      AND worker_state.lease_expires_at > pg_catalog.now()
    FROM effectime_private.created_identity_cleanup_worker_state AS worker_state
    WHERE worker_state.singleton
  ),
  'concurrent scheduler invocation bypassed or leaked the single-flight lease'
);

SET ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.finish_created_identity_cleanup_worker_v1(
  '84000000-0000-4000-8000-000000000021',
  'succeeded',
  0,
  0,
  0,
  0,
  NULL
);
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT worker_state.active_run_id IS NULL
      AND worker_state.lease_expires_at IS NULL
      AND worker_state.last_run_id =
        '84000000-0000-4000-8000-000000000021'::uuid
      AND worker_state.last_status = 'succeeded'
      AND worker_state.overlap_count >= 2
    FROM effectime_private.created_identity_cleanup_worker_state AS worker_state
    WHERE worker_state.singleton
  ),
  'concurrent scheduler winner was not finalized exactly once'
);
SELECT 'created identity cleanup scheduler concurrency passed' AS result;

\elif :{?TEMPORARY_PROFILE_EVENT_CLAIMER}
SET application_name TO 'effectime-temp-cleanup-event-claimer';
BEGIN;
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
DO $event_claimer$
DECLARE
  v_claim record;
BEGIN
  SELECT * INTO v_claim
  FROM public.claim_eligible_temporary_profiles_v1(1);
  INSERT INTO contract.temporary_profile_cleanup_concurrency_results(
    scenario,
    client,
    outcome
  ) VALUES (
    'event-extension',
    'claimer',
    CASE
      WHEN v_claim.user_id = '86000000-0000-4000-8000-000000000011'::uuid
       AND v_claim.lease_token IS NOT NULL
      THEN 'claimed'
      ELSE 'unexpected-claim'
    END
  );
END;
$event_claimer$;
SELECT pg_catalog.pg_advisory_xact_lock(734563, 31);
SELECT contract.wait_for_temporary_profile_cleanup_release(31);
COMMIT;

\elif :{?TEMPORARY_PROFILE_EVENT_WRITER}
SET application_name TO 'effectime-temp-cleanup-event-writer';
BEGIN;
DO $event_writer$
DECLARE
  v_outcome text := 'unexpected-write';
BEGIN
  BEGIN
    UPDATE public.events AS linked_event
    SET end_date = DATE '2099-12-31'
    WHERE linked_event.id = '86100000-0000-4000-8000-000000000011';
  EXCEPTION WHEN serialization_failure THEN
    v_outcome := 'fenced';
  END;
  INSERT INTO contract.temporary_profile_cleanup_concurrency_results(
    scenario,
    client,
    outcome
  ) VALUES ('event-extension', 'writer', v_outcome);
END;
$event_writer$;
COMMIT;

\elif :{?TEMPORARY_PROFILE_EVENT_VERIFY}
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.temporary_profile_cleanup_concurrency_results AS result
    WHERE result.scenario = 'event-extension'
      AND result.client = 'claimer'
      AND result.outcome = 'claimed'
  )
  AND EXISTS (
    SELECT 1
    FROM contract.temporary_profile_cleanup_concurrency_results AS result
    WHERE result.scenario = 'event-extension'
      AND result.client = 'writer'
      AND result.outcome = 'fenced'
  )
  AND EXISTS (
    SELECT 1
    FROM public.events AS linked_event
    WHERE linked_event.id = '86100000-0000-4000-8000-000000000011'
      AND linked_event.end_date = DATE '2000-01-01'
  )
  AND EXISTS (
    SELECT 1
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000011'
      AND cleanup_lease.lease_expires_at > pg_catalog.now()
  ),
  'event extension crossed the temporary-profile cleanup claim fence'
);
DELETE FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000011';
DELETE FROM auth.users AS auth_user
WHERE auth_user.id = '86000000-0000-4000-8000-000000000011';
DELETE FROM public.events AS linked_event
WHERE linked_event.id = '86100000-0000-4000-8000-000000000011';
SELECT 'temporary profile event-extension race passed' AS result;

\elif :{?TEMPORARY_PROFILE_UPGRADE_CLAIMER}
SET application_name TO 'effectime-temp-cleanup-upgrade-claimer';
BEGIN;
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
DO $upgrade_claimer$
DECLARE
  v_claim record;
BEGIN
  SELECT * INTO v_claim
  FROM public.claim_eligible_temporary_profiles_v1(1);
  INSERT INTO contract.temporary_profile_cleanup_concurrency_results(
    scenario,
    client,
    outcome
  ) VALUES (
    'temporary-upgrade',
    'claimer',
    CASE
      WHEN v_claim.user_id = '86000000-0000-4000-8000-000000000012'::uuid
       AND v_claim.lease_token IS NOT NULL
      THEN 'claimed'
      ELSE 'unexpected-claim'
    END
  );
END;
$upgrade_claimer$;
SELECT pg_catalog.pg_advisory_xact_lock(734563, 32);
SELECT contract.wait_for_temporary_profile_cleanup_release(32);
COMMIT;

\elif :{?TEMPORARY_PROFILE_UPGRADE_WRITER}
SET application_name TO 'effectime-temp-cleanup-upgrade-writer';
BEGIN;
DO $upgrade_writer$
DECLARE
  v_outcome text := 'unexpected-write';
BEGIN
  BEGIN
    UPDATE public.profiles AS profile
    SET is_temporary = false
    WHERE profile.user_id = '86000000-0000-4000-8000-000000000012';
  EXCEPTION WHEN serialization_failure THEN
    v_outcome := 'fenced';
  END;
  INSERT INTO contract.temporary_profile_cleanup_concurrency_results(
    scenario,
    client,
    outcome
  ) VALUES ('temporary-upgrade', 'writer', v_outcome);
END;
$upgrade_writer$;
COMMIT;

\elif :{?TEMPORARY_PROFILE_UPGRADE_VERIFY}
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.temporary_profile_cleanup_concurrency_results AS result
    WHERE result.scenario = 'temporary-upgrade'
      AND result.client = 'claimer'
      AND result.outcome = 'claimed'
  )
  AND EXISTS (
    SELECT 1
    FROM contract.temporary_profile_cleanup_concurrency_results AS result
    WHERE result.scenario = 'temporary-upgrade'
      AND result.client = 'writer'
      AND result.outcome = 'fenced'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.user_id = '86000000-0000-4000-8000-000000000012'
      AND profile.is_temporary
  )
  AND EXISTS (
    SELECT 1
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000012'
      AND cleanup_lease.lease_expires_at > pg_catalog.now()
  ),
  'temporary-to-permanent upgrade crossed the cleanup claim fence'
);
DELETE FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
WHERE cleanup_lease.user_id = '86000000-0000-4000-8000-000000000012';
DELETE FROM auth.users AS auth_user
WHERE auth_user.id = '86000000-0000-4000-8000-000000000012';
DELETE FROM public.events AS linked_event
WHERE linked_event.id = '86100000-0000-4000-8000-000000000012';
SELECT 'temporary profile upgrade race passed' AS result;

\else
\echo 'Set one CREATED_IDENTITY_SCHEDULER_* scenario variable.'
\quit 2
\endif
