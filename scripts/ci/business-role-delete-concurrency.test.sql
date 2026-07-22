\set ON_ERROR_STOP on
SET client_min_messages TO warning;

\if :{?BUSINESS_ROLE_WRITER_FIRST_A}
SET application_name TO 'effectime-business-role-writer-first-a';
BEGIN;
UPDATE public.enterprise_memberships
SET business_role = 'ConcurrentRole'
WHERE id = '77000000-0000-4000-8000-000000000002';
UPDATE public.enterprise_member_role_allocations
SET business_role = 'ConcurrentRole'
WHERE id = '77100000-0000-4000-8000-000000000001';
SELECT pg_catalog.pg_advisory_xact_lock(734559, 11);
SELECT contract.wait_for_business_role_delete_release(11);
COMMIT;

\elif :{?BUSINESS_ROLE_WRITER_FIRST_B}
SET application_name TO 'effectime-business-role-writer-first-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000001',
  true
);
DO $delete_after_writer$
DECLARE
  v_response jsonb;
BEGIN
  v_response := public.delete_workspace_business_role_v1(
    '77777777-7777-4777-8777-777777777777',
    'ConcurrentRole'
  );
  INSERT INTO contract.business_role_delete_concurrency_results(
    scenario, client, outcome, response
  ) VALUES ('writer-first', 'delete', 'success', v_response);
END;
$delete_after_writer$;
COMMIT;

\elif :{?BUSINESS_ROLE_WRITER_FIRST_VERIFY}
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.business_role_delete_concurrency_results AS result
    WHERE result.scenario = 'writer-first'
      AND result.client = 'delete'
      AND result.outcome = 'success'
      AND result.response ->> 'changed' = 'true'
      AND (result.response ->> 'affected_membership_count')::integer = 1
      AND (result.response ->> 'deleted_allocation_count')::integer = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE workspace_id = '77777777-7777-4777-8777-777777777777'
      AND business_role = 'ConcurrentRole'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '77777777-7777-4777-8777-777777777777'
      AND business_role = 'ConcurrentRole'
  ),
  'delete did not observe and atomically remove an earlier workspace writer'
);
SELECT 'business-role writer-first serialization passed' AS result;

\elif :{?BUSINESS_ROLE_DELETE_FIRST_A}
SET application_name TO 'effectime-business-role-delete-first-a';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
DO $delete_before_writer$
DECLARE
  v_response jsonb;
BEGIN
  v_response := public.delete_workspace_business_role_v1(
    '66666666-6666-4666-8666-666666666666',
    'RollbackRole'
  );
  INSERT INTO contract.business_role_delete_concurrency_results(
    scenario, client, outcome, response
  ) VALUES ('delete-first', 'delete', 'success', v_response);
END;
$delete_before_writer$;
SELECT pg_catalog.pg_advisory_xact_lock(734559, 12);
SELECT contract.wait_for_business_role_delete_release(12);
COMMIT;

\elif :{?BUSINESS_ROLE_DELETE_FIRST_B}
SET application_name TO 'effectime-business-role-delete-first-b';
BEGIN;
DO $writer_during_delete$
BEGIN
  BEGIN
    UPDATE public.enterprise_memberships
    SET business_role = 'WriterShouldFail'
    WHERE id = '66000000-0000-4000-8000-000000000006';
    INSERT INTO contract.business_role_delete_concurrency_results(
      scenario, client, outcome, response
    ) VALUES ('delete-first', 'writer', 'unexpected-success', NULL);
  EXCEPTION WHEN lock_not_available THEN
    INSERT INTO contract.business_role_delete_concurrency_results(
      scenario, client, outcome, response
    ) VALUES ('delete-first', 'writer', '55P03', NULL);
  END;
END;
$writer_during_delete$;
COMMIT;

\elif :{?BUSINESS_ROLE_DELETE_FIRST_VERIFY}
SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 2
      AND pg_catalog.count(*) FILTER (WHERE outcome = 'success') = 1
      AND pg_catalog.count(*) FILTER (WHERE outcome = '55P03') = 1
    FROM contract.business_role_delete_concurrency_results
    WHERE scenario = 'delete-first'
  )
  AND EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE id = '66000000-0000-4000-8000-000000000006'
      AND business_role = 'Broken'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_member_role_allocations
    WHERE id = '66100000-0000-4000-8000-000000000007'
  ),
  'concurrent direct writer was not rejected while delete held the workspace gate'
);
SELECT 'business-role delete-first serialization passed' AS result;

\else
\echo 'Set one BUSINESS_ROLE_* scenario variable.'
\quit 2
\endif
