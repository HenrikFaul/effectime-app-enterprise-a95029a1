\set ON_ERROR_STOP on
SET client_min_messages TO warning;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid =
      'public.delete_workspace_business_role_v1(uuid,text)'::pg_catalog.regprocedure
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
    'authenticated',
    'public.delete_workspace_business_role_v1(uuid,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.delete_workspace_business_role_v1(uuid,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.delete_workspace_business_role_v1(uuid,text)',
    'EXECUTE'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid =
      'public.enterprise_audit_events'::pg_catalog.regclass
      AND trigger_record.tgname = 'guard_business_role_delete_audit_mutation'
      AND trigger_record.tgfoid =
        'public.guard_business_role_delete_audit_mutation()'::pg_catalog.regprocedure
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid =
      'public.enterprise_memberships'::pg_catalog.regclass
      AND trigger_record.tgname = 'guard_workspace_business_role_membership_mutation'
      AND trigger_record.tgfoid =
        'public.guard_workspace_business_role_mutation()'::pg_catalog.regprocedure
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid =
      'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND trigger_record.tgname = 'guard_workspace_business_role_allocation_mutation'
      AND trigger_record.tgfoid =
        'public.guard_workspace_business_role_mutation()'::pg_catalog.regprocedure
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  ),
  'business-role delete owner, function ACL, config or audit trigger is invalid'
);

CREATE OR REPLACE FUNCTION contract.capture_business_role_delete_sqlstate(
  p_actor uuid,
  p_workspace_id uuid,
  p_business_role text
)
RETURNS text
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, false);
  PERFORM public.delete_workspace_business_role_v1(
    p_workspace_id,
    p_business_role
  );
  RETURN '00000';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.capture_business_role_delete_sqlstate(
  uuid, uuid, text
) TO authenticated;

INSERT INTO public.enterprise_workspaces(id, name) VALUES
  ('66666666-6666-4666-8666-666666666666', 'Business role contract'),
  ('77777777-7777-4777-8777-777777777777', 'Business role control');

INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, business_role, base_working_hours
) VALUES
  ('66000000-0000-4000-8000-000000000001', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000001', 'owner', 'active', NULL, 8),
  ('66000000-0000-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000003', 'member', 'active', 'DeleteMe', 8),
  ('66000000-0000-4000-8000-000000000003', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000006', 'member', 'suspended', 'DeleteMe', 8),
  ('66000000-0000-4000-8000-000000000004', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000008', 'member', 'removed', 'DeleteMe', 8),
  ('66000000-0000-4000-8000-000000000005', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000007', 'member', 'invited', 'Keep', 8),
  ('66000000-0000-4000-8000-000000000006', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000004', 'member', 'active', 'Broken', 8),
  ('66000000-0000-4000-8000-000000000007', '66666666-6666-4666-8666-666666666666', '20000000-0000-4000-8000-000000000002', 'member', 'active', 'RollbackRole', 8),
  ('66000000-0000-4000-8000-000000000008', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000005', 'member', 'active', 'Manager', 8),
  ('66000000-0000-4000-8000-000000000009', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000002', 'member', 'active', 'KeepA', 8),
  ('66000000-0000-4000-8000-000000000010', '66666666-6666-4666-8666-666666666666', '20000000-0000-4000-8000-000000000001', 'member', 'active', 'DeleteZero', 8),
  ('77000000-0000-4000-8000-000000000001', '77777777-7777-4777-8777-777777777777', '20000000-0000-4000-8000-000000000001', 'owner', 'active', NULL, 8),
  ('77000000-0000-4000-8000-000000000002', '77777777-7777-4777-8777-777777777777', '20000000-0000-4000-8000-000000000002', 'member', 'active', 'DeleteMe', 8);

INSERT INTO public.fixture_workspace_features(workspace_id, feature_key, enabled) VALUES
  ('66666666-6666-4666-8666-666666666666', 'members_list', true),
  ('66666666-6666-4666-8666-666666666666', 'business_roles', true),
  ('77777777-7777-4777-8777-777777777777', 'members_list', true),
  ('77777777-7777-4777-8777-777777777777', 'business_roles', true);

INSERT INTO public.enterprise_member_role_allocations(
  id, workspace_id, membership_id, business_role, percentage, is_priority
) VALUES
  ('66100000-0000-4000-8000-000000000001', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000002', 'DeleteMe', 60, true),
  ('66100000-0000-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000002', 'Keep', 40, false),
  ('66100000-0000-4000-8000-000000000003', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000003', 'DeleteMe', 100, true),
  ('66100000-0000-4000-8000-000000000004', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000005', 'DeleteMe', 25, false),
  ('66100000-0000-4000-8000-000000000005', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000005', 'Keep', 75, true),
  ('66100000-0000-4000-8000-000000000006', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000006', 'Broken', 90, false),
  ('66100000-0000-4000-8000-000000000007', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000007', 'RollbackRole', 100, true),
  ('66100000-0000-4000-8000-000000000008', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000008', 'Engineer', 60, true),
  ('66100000-0000-4000-8000-000000000009', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000008', 'MismatchDelete', 40, false),
  ('66100000-0000-4000-8000-000000000010', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000009', 'DeleteRound', 10, false),
  ('66100000-0000-4000-8000-000000000011', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000009', 'KeepA', 30, true),
  ('66100000-0000-4000-8000-000000000012', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000009', 'KeepB', 30, false),
  ('66100000-0000-4000-8000-000000000013', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000009', 'KeepC', 30, false),
  ('66100000-0000-4000-8000-000000000014', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000010', 'DeleteZero', 100, true),
  ('66100000-0000-4000-8000-000000000015', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000010', 'ZeroA', 0, false),
  ('66100000-0000-4000-8000-000000000016', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000010', 'ZeroB', 0, false),
  ('66100000-0000-4000-8000-000000000017', '66666666-6666-4666-8666-666666666666', '66000000-0000-4000-8000-000000000010', 'ZeroC', 0, false),
  ('77100000-0000-4000-8000-000000000001', '77777777-7777-4777-8777-777777777777', '77000000-0000-4000-8000-000000000002', 'DeleteMe', 100, true);

SET ROLE authenticated;

SELECT contract.assert_true(
  contract.capture_business_role_delete_sqlstate(
    '10000000-0000-4000-8000-000000000004',
    '66666666-6666-4666-8666-666666666666',
    'DeleteMe'
  ) = '42501',
  'readonly member executed workspace business-role delete'
);

SELECT contract.assert_true(
  contract.capture_business_role_delete_sqlstate(
    '10000000-0000-4000-8000-000000000001',
    '66666666-6666-4666-8666-666666666666',
    ' Broken '
  ) = '22023',
  'non-canonical business-role input was accepted'
);

SELECT contract.assert_true(
  contract.capture_business_role_delete_sqlstate(
    '10000000-0000-4000-8000-000000000001',
    '66666666-6666-4666-8666-666666666666',
    'Broken'
  ) = '23514',
  'malformed historical allocation snapshot was silently repaired'
);

SELECT contract.assert_true(
  contract.capture_business_role_delete_sqlstate(
    '10000000-0000-4000-8000-000000000001',
    '66666666-6666-4666-8666-666666666666',
    'MismatchDelete'
  ) = '23514',
  'primary-role and priority-allocation mismatch was silently repaired'
);

RESET ROLE;
UPDATE public.fixture_workspace_features
SET enabled = false
WHERE workspace_id = '66666666-6666-4666-8666-666666666666'
  AND feature_key = 'business_roles';
SET ROLE authenticated;
SELECT contract.assert_true(
  contract.capture_business_role_delete_sqlstate(
    '10000000-0000-4000-8000-000000000001',
    '66666666-6666-4666-8666-666666666666',
    'DeleteMe'
  ) = '42501',
  'disabled business_roles entitlement was bypassed'
);
RESET ROLE;
UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '66666666-6666-4666-8666-666666666666'
  AND feature_key = 'business_roles';
SET ROLE authenticated;

RESET ROLE;
CREATE OR REPLACE FUNCTION contract.fail_business_role_delete_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.action = 'membership.business_role_deleted' THEN
    RAISE EXCEPTION 'forced business-role audit failure';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER fail_business_role_delete_audit
  BEFORE INSERT ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION contract.fail_business_role_delete_audit();
SET ROLE authenticated;
SELECT contract.assert_true(
  contract.capture_business_role_delete_sqlstate(
    '10000000-0000-4000-8000-000000000001',
    '66666666-6666-4666-8666-666666666666',
    'RollbackRole'
  ) = 'P0001',
  'forced late audit failure did not surface from the atomic delete'
);
RESET ROLE;
DROP TRIGGER fail_business_role_delete_audit ON public.enterprise_audit_events;
DROP FUNCTION contract.fail_business_role_delete_audit();
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_member_role_allocations
    WHERE id = '66100000-0000-4000-8000-000000000007'
      AND business_role = 'RollbackRole'
      AND percentage = 100
      AND is_priority
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_memberships
    WHERE id = '66000000-0000-4000-8000-000000000007'
      AND business_role = 'RollbackRole'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.enterprise_audit_events
    WHERE workspace_id = '66666666-6666-4666-8666-666666666666'
      AND action = 'membership.business_role_deleted'
  ),
  'late audit failure left a partial business-role delete commit'
);
SET ROLE authenticated;

DO $assert_atomic_delete$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000001',
    false
  );
  v_result := public.delete_workspace_business_role_v1(
    '66666666-6666-4666-8666-666666666666',
    'DeleteMe'
  );
  PERFORM contract.assert_true(
    v_result ->> 'ok' = 'true'
    AND v_result ->> 'workspace_id' = '66666666-6666-4666-8666-666666666666'
    AND v_result ->> 'business_role' = 'DeleteMe'
    AND v_result ->> 'changed' = 'true'
    AND (v_result ->> 'affected_membership_count')::integer = 4
    AND (v_result ->> 'deleted_allocation_count')::integer = 3
    AND (v_result ->> 'audit_event_id')::uuid IS NOT NULL,
    'atomic workspace business-role delete receipt is invalid'
  );
END;
$assert_atomic_delete$;

RESET ROLE;

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '66666666-6666-4666-8666-666666666666'
      AND business_role = 'DeleteMe'
  )
  AND (
    SELECT pg_catalog.count(*) = 2
      AND pg_catalog.bool_and(percentage = 100 AND is_priority)
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '66666666-6666-4666-8666-666666666666'
      AND business_role = 'Keep'
      AND membership_id IN (
        '66000000-0000-4000-8000-000000000002',
        '66000000-0000-4000-8000-000000000005'
      )
  )
  AND (
    SELECT pg_catalog.count(*) = 4
      AND pg_catalog.bool_and(business_role IS NOT DISTINCT FROM expected_role)
    FROM (
      SELECT membership.id, membership.business_role,
        CASE membership.id
          WHEN '66000000-0000-4000-8000-000000000002'::uuid THEN 'Keep'
          WHEN '66000000-0000-4000-8000-000000000005'::uuid THEN 'Keep'
          ELSE NULL
        END AS expected_role
      FROM public.enterprise_memberships AS membership
      WHERE membership.id IN (
        '66000000-0000-4000-8000-000000000002',
        '66000000-0000-4000-8000-000000000003',
        '66000000-0000-4000-8000-000000000004',
        '66000000-0000-4000-8000-000000000005'
      )
    ) AS result
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        business_role = 'DeleteMe' AND percentage = 100 AND is_priority
      )
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '77777777-7777-4777-8777-777777777777'
  ),
  'workspace-wide delete missed a membership status, broke totals, or crossed tenant boundary'
);

SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        target_type = 'enterprise_workspace'
        AND target_id = '66666666-6666-4666-8666-666666666666'
        AND affected_user_id IS NULL
        AND metadata = pg_catalog.jsonb_build_object(
          'affected_membership_count', 4,
          'deleted_allocation_count', 3
        )
        AND prev_state = pg_catalog.jsonb_build_object(
          'affected_membership_count', 4,
          'deleted_allocation_count', 3
        )
        AND new_state = pg_catalog.jsonb_build_object(
          'affected_membership_count', 4,
          'deleted_allocation_count', 0
        )
        AND NOT metadata ? 'business_role'
        AND NOT prev_state ? 'business_role'
        AND NOT new_state ? 'business_role'
      )
    FROM public.enterprise_audit_events
    WHERE workspace_id = '66666666-6666-4666-8666-666666666666'
      AND action = 'membership.business_role_deleted'
  ),
  'business-role delete audit receipt is missing, forgeable, or over-broad'
);

SET ROLE authenticated;
DO $assert_reserved_audit$
DECLARE
  v_denied boolean := false;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000001',
    false
  );
  BEGIN
    INSERT INTO public.enterprise_audit_events(
      workspace_id, actor_id, action, target_type, target_id
    ) VALUES (
      '66666666-6666-4666-8666-666666666666',
      '10000000-0000-4000-8000-000000000001',
      'membership.business_role_deleted',
      'enterprise_workspace',
      '66666666-6666-4666-8666-666666666666'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'reserved business-role audit action was forgeable');
END;
$assert_reserved_audit$;

DO $assert_noop$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.delete_workspace_business_role_v1(
    '66666666-6666-4666-8666-666666666666',
    'MissingRole'
  );
  PERFORM contract.assert_true(
    v_result ->> 'changed' = 'false'
    AND (v_result ->> 'affected_membership_count')::integer = 0
    AND (v_result ->> 'deleted_allocation_count')::integer = 0
    AND v_result -> 'audit_event_id' = 'null'::jsonb,
    'no-op business-role delete returned a false mutation receipt'
  );
END;
$assert_noop$;
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
DO $assert_deterministic_rebalancing$
DECLARE
  v_rounding_result jsonb;
  v_zero_result jsonb;
BEGIN
  v_rounding_result := public.delete_workspace_business_role_v1(
    '66666666-6666-4666-8666-666666666666',
    'DeleteRound'
  );
  v_zero_result := public.delete_workspace_business_role_v1(
    '66666666-6666-4666-8666-666666666666',
    'DeleteZero'
  );
  PERFORM contract.assert_true(
    v_rounding_result ->> 'changed' = 'true'
    AND (v_rounding_result ->> 'deleted_allocation_count')::integer = 1
    AND v_zero_result ->> 'changed' = 'true'
    AND (v_zero_result ->> 'deleted_allocation_count')::integer = 1,
    'deterministic rebalancing mutations returned invalid receipts'
  );
END;
$assert_deterministic_rebalancing$;
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.sum(percentage) = 100
      AND pg_catalog.count(*) FILTER (WHERE is_priority) = 1
      AND pg_catalog.max(percentage) FILTER (WHERE business_role = 'KeepA') = 33.34
      AND pg_catalog.max(percentage) FILTER (WHERE business_role = 'KeepB') = 33.33
      AND pg_catalog.max(percentage) FILTER (WHERE business_role = 'KeepC') = 33.33
    FROM public.enterprise_member_role_allocations
    WHERE membership_id = '66000000-0000-4000-8000-000000000009'
  )
  AND EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE id = '66000000-0000-4000-8000-000000000009'
      AND business_role = 'KeepA'
  )
  AND (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.sum(percentage) = 100
      AND pg_catalog.count(*) FILTER (WHERE is_priority) = 1
      AND pg_catalog.max(percentage) FILTER (WHERE business_role = 'ZeroA') = 33.34
      AND pg_catalog.max(percentage) FILTER (WHERE business_role = 'ZeroB') = 33.33
      AND pg_catalog.max(percentage) FILTER (WHERE business_role = 'ZeroC') = 33.33
    FROM public.enterprise_member_role_allocations
    WHERE membership_id = '66000000-0000-4000-8000-000000000010'
  )
  AND EXISTS (
    SELECT 1 FROM public.enterprise_memberships
    WHERE id = '66000000-0000-4000-8000-000000000010'
      AND business_role = 'ZeroA'
  ),
  'largest-remainder or zero-weight rebalancing was not exact and deterministic'
);

SELECT 'atomic business-role delete contract passed' AS result;
