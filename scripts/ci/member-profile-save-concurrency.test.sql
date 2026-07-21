\set ON_ERROR_STOP on
SET client_min_messages TO warning;

\if :{?MEMBER_PROFILE_SAVE_A}
SET application_name TO 'effectime-member-profile-save-a';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
DO $client_a$
DECLARE
  v_response jsonb;
BEGIN
  v_response := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    4,
    'Concurrent A', 'Concurrent A', NULL, 8,
    '[{"business_role":"Concurrent A","percentage":100,"is_priority":true}]'::jsonb,
    NULL,
    NULL
  );
  INSERT INTO contract.member_profile_save_concurrency_results(
    client, outcome, expected_revision, response
  ) VALUES ('a', 'success', 4, v_response);
END;
$client_a$;
-- The barrier is acquired only after the RPC returned while its transaction-
-- scoped member save advisory lock is still held.
SELECT pg_catalog.pg_advisory_xact_lock(734556, 1);
SELECT contract.wait_for_member_profile_save_release();
COMMIT;

\elif :{?MEMBER_PROFILE_SAVE_B}
SET application_name TO 'effectime-member-profile-save-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
DO $client_b$
DECLARE
  v_response jsonb;
BEGIN
  BEGIN
    v_response := public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000003',
      4,
      'Concurrent B', 'Concurrent B', NULL, 8,
      '[{"business_role":"Concurrent B","percentage":100,"is_priority":true}]'::jsonb,
      NULL,
      NULL
    );
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES ('b', 'unexpected-success', 4, v_response);
  EXCEPTION WHEN serialization_failure THEN
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES ('b', '40001', 4, NULL);
  END;
END;
$client_b$;
COMMIT;

\elif :{?MEMBER_PROFILE_SAVE_VERIFY}
SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 2
      AND pg_catalog.count(*) FILTER (WHERE result.outcome = 'success') = 1
      AND pg_catalog.count(*) FILTER (WHERE result.outcome = '40001') = 1
      AND pg_catalog.count(*) FILTER (
        WHERE result.outcome = 'success'
          AND (result.response ->> 'changed')::boolean
          AND (result.response ->> 'profile_revision')::integer > result.expected_revision
          AND (result.response ->> 'audit_event_id')::uuid IS NOT NULL
      ) = 1
    FROM contract.member_profile_save_concurrency_results AS result
  ),
  'same-revision concurrent saves did not yield exactly one commit and one 40001'
);
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.id = 'a1000000-0000-4000-8000-000000000003'
      AND membership.location = 'Concurrent A'
      AND membership.city = 'Concurrent A'
      AND membership.business_role = 'Concurrent A'
      AND membership.profile_revision > 4
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.membership_id = 'a1000000-0000-4000-8000-000000000003'
      AND allocation.workspace_id = '11111111-1111-4111-8111-111111111111'
      AND allocation.business_role = 'Concurrent A'
      AND allocation.percentage = 100
      AND allocation.is_priority
  )
  AND (
    SELECT pg_catalog.count(*) = 1
    FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.membership_id = 'a1000000-0000-4000-8000-000000000003'
  ),
  'winning concurrent snapshot was not committed atomically'
);
SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 1
    FROM public.enterprise_audit_events AS event
    JOIN contract.member_profile_save_concurrency_results AS result
      ON result.response ->> 'audit_event_id' = event.id::text
    WHERE result.outcome = 'success'
      AND event.action = 'membership.profile_updated'
      AND event.target_id = 'a1000000-0000-4000-8000-000000000003'
  ),
  'the sole committed concurrent snapshot is not paired with one exact audit event'
);
SELECT 'member profile optimistic concurrency contract passed' AS result;

\elif :{?MEMBER_PROFILE_LOCK_HOLDER}
SET application_name TO 'effectime-member-profile-lock-holder';
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    '11111111-1111-4111-8111-111111111111:a1000000-0000-4000-8000-000000000006',
    734554
  )
);
SELECT pg_catalog.pg_advisory_xact_lock(734556, 2);
SELECT contract.wait_for_member_profile_save_release();
COMMIT;

\elif :{?MEMBER_PROFILE_LOCK_TIMEOUT}
SET application_name TO 'effectime-member-profile-lock-timeout';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
DO $lock_timeout_client$
DECLARE
  v_started_at timestamptz := pg_catalog.clock_timestamp();
  v_response jsonb;
BEGIN
  BEGIN
    v_response := public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000006',
      1,
      NULL, 'Timeout must not commit', NULL, 8, '[]'::jsonb, NULL, NULL
    );
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES ('timeout', 'unexpected-success', 1, v_response);
  EXCEPTION WHEN lock_not_available THEN
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES (
      'timeout',
      '55P03',
      1,
      pg_catalog.jsonb_build_object(
        'elapsed_ms',
        EXTRACT(epoch FROM (pg_catalog.clock_timestamp() - v_started_at)) * 1000
      )
    );
  END;
END;
$lock_timeout_client$;
COMMIT;

\elif :{?MEMBER_PROFILE_LOCK_VERIFY}
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.member_profile_save_concurrency_results AS result
    WHERE result.client = 'timeout'
      AND result.outcome = '55P03'
      AND (result.response ->> 'elapsed_ms')::numeric >= 4500
      AND (result.response ->> 'elapsed_ms')::numeric < 8000
  ),
  'function-scoped lock_timeout did not return bounded SQLSTATE 55P03'
);
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.id = 'a1000000-0000-4000-8000-000000000006'
      AND membership.city = 'Suspended city'
      AND membership.profile_revision = 1
  )
  AND (
    SELECT pg_catalog.count(*) = 1
    FROM public.enterprise_audit_events AS event
    WHERE event.action = 'membership.profile_updated'
      AND event.target_id = 'a1000000-0000-4000-8000-000000000006'
  ),
  'timed-out lock wait mutated membership, revision or audit state'
);
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
DO $fresh_retry$
DECLARE
  v_response jsonb;
BEGIN
  v_response := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000006',
    1,
    NULL, 'Fresh after timeout', NULL, 8, '[]'::jsonb, NULL, NULL
  );
  PERFORM contract.assert_true(
    (v_response ->> 'changed')::boolean
    AND (v_response ->> 'profile_revision')::integer = 2,
    'fresh retry after bounded lock timeout did not commit'
  );
END;
$fresh_retry$;
RESET ROLE;
SELECT 'member profile bounded lock timeout contract passed' AS result;

\elif :{?MEMBER_PROFILE_MIXED_RPC}
SET application_name TO 'effectime-member-profile-mixed-rpc';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
-- Reproduce the RPC's parent-first order, then pause before the function reaches
-- the allocation tuple held by the direct writer.
SELECT membership.id
FROM public.enterprise_memberships AS membership
WHERE membership.id = 'a1000000-0000-4000-8000-000000000003'
  AND membership.workspace_id = '11111111-1111-4111-8111-111111111111'
FOR UPDATE;
SELECT pg_catalog.pg_advisory_xact_lock(734556, 4);
SELECT contract.wait_for_member_profile_save_release();
DO $mixed_rpc$
DECLARE
  v_response jsonb;
BEGIN
  BEGIN
    v_response := public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000003',
      8,
      'Mixed RPC winner', 'Mixed RPC winner', NULL, 8,
      '[{"business_role":"Mixed RPC winner","percentage":100,"is_priority":true}]'::jsonb,
      NULL,
      NULL
    );
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES ('mixed-rpc', 'success', 8, v_response);
  EXCEPTION WHEN deadlock_detected THEN
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES ('mixed-rpc', '40P01', 8, NULL);
  END;
END;
$mixed_rpc$;
COMMIT;

\elif :{?MEMBER_PROFILE_MIXED_DIRECT}
SET application_name TO 'effectime-member-profile-mixed-direct';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
DO $mixed_direct$
BEGIN
  BEGIN
    UPDATE public.enterprise_member_role_allocations AS allocation
    SET percentage = 99
    WHERE allocation.membership_id = 'a1000000-0000-4000-8000-000000000003'
      AND allocation.workspace_id = '11111111-1111-4111-8111-111111111111';
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES ('mixed-direct', 'success', 8, NULL);
  EXCEPTION WHEN deadlock_detected THEN
    INSERT INTO contract.member_profile_save_concurrency_results(
      client, outcome, expected_revision, response
    ) VALUES ('mixed-direct', '40P01', 8, NULL);
  END;
END;
$mixed_direct$;
COMMIT;

\elif :{?MEMBER_PROFILE_MIXED_VERIFY}
SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 2
      AND pg_catalog.count(*) FILTER (WHERE result.outcome = 'success') = 1
      AND pg_catalog.count(*) FILTER (WHERE result.outcome = '40P01') = 1
    FROM contract.member_profile_save_concurrency_results AS result
    WHERE result.client IN ('mixed-rpc', 'mixed-direct')
  ),
  'mixed allocation/RPC lock order did not produce one commit and one bounded 40P01 abort'
);
SELECT contract.assert_true(
  (
    EXISTS (
      SELECT 1
      FROM contract.member_profile_save_concurrency_results AS result
      JOIN public.enterprise_memberships AS membership
        ON membership.id = 'a1000000-0000-4000-8000-000000000003'
      WHERE result.client = 'mixed-rpc'
        AND result.outcome = 'success'
        AND (result.response ->> 'profile_revision')::integer = membership.profile_revision
        AND membership.location = 'Mixed RPC winner'
        AND membership.city = 'Mixed RPC winner'
        AND EXISTS (
          SELECT 1
          FROM public.enterprise_member_role_allocations AS allocation
          WHERE allocation.membership_id = membership.id
            AND allocation.business_role = 'Mixed RPC winner'
            AND allocation.percentage = 100
            AND allocation.is_priority
        )
        AND EXISTS (
          SELECT 1
          FROM public.enterprise_audit_events AS event
          WHERE event.id = (result.response ->> 'audit_event_id')::uuid
            AND event.target_id = membership.id
        )
    )
    OR EXISTS (
      SELECT 1
      FROM contract.member_profile_save_concurrency_results AS result
      JOIN public.enterprise_memberships AS membership
        ON membership.id = 'a1000000-0000-4000-8000-000000000003'
      WHERE result.client = 'mixed-direct'
        AND result.outcome = 'success'
        AND membership.profile_revision = 9
        AND membership.location = 'Concurrent A'
        AND membership.city = 'Concurrent A'
        AND EXISTS (
          SELECT 1
          FROM public.enterprise_member_role_allocations AS allocation
          WHERE allocation.membership_id = membership.id
            AND allocation.business_role = 'Concurrent A'
            AND allocation.percentage = 99
            AND allocation.is_priority
        )
        AND (
          SELECT pg_catalog.count(*) = 2
          FROM public.enterprise_audit_events AS event
          WHERE event.action = 'membership.profile_updated'
            AND event.target_id = membership.id
        )
    )
  ),
  'mixed-writer survivor committed partial or unaudited RPC state'
);
SELECT 'member profile mixed-writer bounded abort contract passed' AS result;

\elif :{?MEMBER_PROFILE_READ_WRITER}
SET application_name TO 'effectime-member-profile-read-writer';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES (
  '66000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'a1000000-0000-4000-8000-000000000004',
  'MVCC committed snapshot', 100, true
);
SELECT pg_catalog.pg_advisory_xact_lock(734556, 3);
SELECT contract.wait_for_member_profile_save_release();
COMMIT;

\elif :{?MEMBER_PROFILE_READ_DURING}
SET application_name TO 'effectime-member-profile-read-during';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);
INSERT INTO contract.member_profile_save_concurrency_results(
  client, outcome, expected_revision, response
)
SELECT
  'read-during',
  'success',
  5,
  public.get_workspace_member_profile_edit_snapshot_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000004'
  );
COMMIT;

\elif :{?MEMBER_PROFILE_READ_VERIFY}
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.member_profile_save_concurrency_results AS result
    WHERE result.client = 'read-during'
      AND result.outcome = 'success'
      AND (result.response ->> 'profile_revision')::integer = 5
      AND result.response -> 'role_allocations' = '[]'::jsonb
  ),
  'atomic read mixed an uncommitted allocation with the prior revision'
);
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  false
);
DO $committed_atomic_snapshot$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_workspace_member_profile_edit_snapshot_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000004'
  );
  PERFORM contract.assert_true(
    (v_snapshot ->> 'profile_revision')::integer = 6
    AND v_snapshot -> 'role_allocations' =
      '[{"business_role":"MVCC committed snapshot","percentage":100,"is_priority":true}]'::jsonb,
    'atomic read did not expose the committed revision/allocation pair together'
  );
END;
$committed_atomic_snapshot$;
RESET ROLE;
SELECT 'member profile one-statement MVCC read contract passed' AS result;
\endif
