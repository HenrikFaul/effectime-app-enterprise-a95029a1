\set ON_ERROR_STOP on
SET client_min_messages TO warning;

\if :{?CREATED_IDENTITY_FINALIZER_A}
SET application_name TO 'effectime-created-identity-finalizer';
BEGIN;
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT public.complete_created_enterprise_identity_cleanup_v1(
  contract.created_identity_cleanup_job_id(
    '81000000-0000-4000-8000-000000000008'
  ),
  '80000000-0000-4000-8000-000000000008'
);
SELECT pg_catalog.pg_advisory_xact_lock(734561, 13);
SELECT contract.wait_for_created_identity_cleanup_release(13);
COMMIT;

\elif :{?CREATED_IDENTITY_FINALIZER_B}
SET application_name TO 'effectime-created-identity-finalize-writer';
BEGIN;
DO $late_membership_writer$
DECLARE
  v_membership_denied boolean := false;
  v_profile_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.profiles(user_id, display_name) VALUES (
      '80000000-0000-4000-8000-000000000008',
      'Late finalizer writer'
    );
  EXCEPTION
    WHEN object_not_in_prerequisite_state OR foreign_key_violation THEN
      v_profile_denied := true;
  END;

  BEGIN
    INSERT INTO public.enterprise_memberships(
      id, workspace_id, user_id, role, status, business_role, base_working_hours
    ) VALUES (
      '82000000-0000-4000-8000-000000000018',
      '88888888-8888-4888-8888-888888888888',
      '80000000-0000-4000-8000-000000000008',
      'member', 'active', 'Engineer', 8
    );
  EXCEPTION
    WHEN object_not_in_prerequisite_state OR lock_not_available THEN
      v_membership_denied := true;
  END;

  INSERT INTO contract.created_identity_cleanup_concurrency_results(client, outcome)
  VALUES (
    'late-writer',
    CASE
      WHEN v_membership_denied AND v_profile_denied THEN '55000'
      ELSE 'unexpected-success'
    END
  );
END;
$late_membership_writer$;
COMMIT;

\elif :{?CREATED_IDENTITY_FINALIZER_VERIFY}
SELECT contract.assert_true(
  contract.created_identity_cleanup_job_state(
    contract.created_identity_cleanup_job_id(
      '81000000-0000-4000-8000-000000000008'
    )
  ) ->> 'status' = 'completed'
  AND EXISTS (
    SELECT 1
    FROM contract.created_identity_cleanup_concurrency_results AS result
    WHERE result.client = 'late-writer'
      AND result.outcome = '55000'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.user_id = '80000000-0000-4000-8000-000000000008'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.user_id = '80000000-0000-4000-8000-000000000008'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = '80000000-0000-4000-8000-000000000008'
  ),
  'finalization admitted a concurrent terminal identity ghost'
);
SELECT 'created identity finalizer/write serialization passed' AS result;

\else
\echo 'Set one CREATED_IDENTITY_FINALIZER_* scenario variable.'
\quit 2
\endif
