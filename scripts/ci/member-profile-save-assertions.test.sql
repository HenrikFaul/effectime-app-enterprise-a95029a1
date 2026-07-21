\set ON_ERROR_STOP on
SET client_min_messages TO warning;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND attribute.attname = 'profile_revision'
      AND attribute.atttypid = 'pg_catalog.int4'::pg_catalog.regtype
      AND attribute.attnotnull
      AND NOT attribute.attisdropped
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_profile_revision_nonnegative_check'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.profile_revision <> 0
  ),
  'profile revision column, constraint or existing-row baseline is invalid'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid =
        'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.confrelid =
        'public.enterprise_workspaces'::pg_catalog.regclass
      AND constraint_record.conname =
        'enterprise_memberships_workspace_id_fkey'
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND constraint_record.confdeltype = 'c'
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.conkey)
          WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['workspace_id']::text[]
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.confkey)
          WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.confrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['id']::text[]
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid =
        'public.enterprise_offices'::pg_catalog.regclass
      AND constraint_record.confrelid =
        'public.enterprise_workspaces'::pg_catalog.regclass
      AND constraint_record.conname =
        'enterprise_offices_workspace_id_fkey'
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND constraint_record.confdeltype = 'c'
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.conkey)
          WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['workspace_id']::text[]
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.confkey)
          WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.confrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['id']::text[]
  ),
  'workspace membership or office cascade FK is not production-faithful'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.handle_new_user()'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.proconfig = ARRAY['search_path=""']::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'auth.users'::pg_catalog.regclass
      AND trigger_record.tgname = 'on_auth_user_created'
      AND trigger_record.tgfoid = 'public.handle_new_user()'::pg_catalog.regprocedure
      AND trigger_record.tgtype = 5
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_trigger AS bootstrap_trigger
    WHERE bootstrap_trigger.tgrelid = 'auth.users'::pg_catalog.regclass
      AND bootstrap_trigger.tgfoid = 'public.handle_new_user()'::pg_catalog.regprocedure
      AND NOT bootstrap_trigger.tgisinternal
  ) = 1
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.handle_new_user()',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.handle_new_user()',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.handle_new_user()',
    'EXECUTE'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT procedure.proacl
          FROM pg_catalog.pg_proc AS procedure
          WHERE procedure.oid = 'public.handle_new_user()'::pg_catalog.regprocedure
        ),
        '{}'::aclitem[]
      )
    ) AS acl
    WHERE acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ),
  'auth profile bootstrap owner, search_path, trigger or ACL contract changed'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid =
      'effectime_private.canonicalize_profile_display_name_v1(text)'::pg_catalog.regprocedure
      AND NOT procedure.prosecdef
      AND procedure.provolatile = 'i'
      AND procedure.proparallel = 's'
      AND procedure.proisstrict
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND pg_catalog.has_function_privilege(
    'authenticated',
    'effectime_private.canonicalize_profile_display_name_v1(text)',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'effectime_private.canonicalize_profile_display_name_v1(text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'effectime_private.canonicalize_profile_display_name_v1(text)',
    'EXECUTE'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_record.confrelid = 'auth.users'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND constraint_record.confdeltype = 'c'
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.conkey)
          WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['user_id']::text[]
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.confkey)
          WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.confrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['id']::text[]
  ),
  'display-name canonicalizer or production profile/auth FK contract changed'
);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    'ada-bootstrap@example.test',
    pg_catalog.jsonb_build_object('display_name', '  Ada Bootstrap  ')
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    'oauth-bootstrap@example.test',
    '{}'::jsonb
  ),
  (
    '95000000-0000-4000-8000-000000000003',
    pg_catalog.repeat('a', 201) || '@example.test',
    '{}'::jsonb
  ),
  (
    '95000000-0000-4000-8000-000000000004',
    'unicode-bootstrap@example.test',
    pg_catalog.jsonb_build_object(
      'display_name',
      pg_catalog.repeat(pg_catalog.chr(128512), 200)
    )
  ),
  (
    '95000000-0000-4000-8000-000000000005',
    'unicode-trim-bootstrap@example.test',
    pg_catalog.jsonb_build_object(
      'display_name',
      pg_catalog.chr(160) || pg_catalog.chr(65279) || 'Unicode Trim'
        || pg_catalog.chr(65279) || pg_catalog.chr(160)
    )
  );

SELECT contract.assert_true(
  (SELECT profile.display_name FROM public.profiles AS profile
   WHERE profile.user_id = '95000000-0000-4000-8000-000000000001') = 'Ada Bootstrap'
  AND (SELECT profile.display_name FROM public.profiles AS profile
       WHERE profile.user_id = '95000000-0000-4000-8000-000000000002') =
      'oauth-bootstrap@example.test'
  AND (SELECT profile.display_name FROM public.profiles AS profile
       WHERE profile.user_id = '95000000-0000-4000-8000-000000000003') IS NULL
  AND pg_catalog.char_length(
    (SELECT profile.display_name FROM public.profiles AS profile
     WHERE profile.user_id = '95000000-0000-4000-8000-000000000004')
  ) = 200
  AND (SELECT profile.display_name FROM public.profiles AS profile
       WHERE profile.user_id = '95000000-0000-4000-8000-000000000005') =
      'Unicode Trim',
  'auth profile bootstrap did not canonicalize metadata or preserve safe fallback behavior'
);

DO $invalid_auth_display_name$
DECLARE
  invalid_case record;
BEGIN
  FOR invalid_case IN
    SELECT *
    FROM (
      VALUES
        ('95000000-0000-4000-8000-000000000101'::uuid, pg_catalog.to_jsonb('   '::text)),
        ('95000000-0000-4000-8000-000000000102'::uuid, pg_catalog.to_jsonb('Ada' || pg_catalog.chr(127) || 'Lovelace')),
        ('95000000-0000-4000-8000-000000000103'::uuid, pg_catalog.to_jsonb(pg_catalog.repeat('x', 201))),
        ('95000000-0000-4000-8000-000000000104'::uuid, '42'::jsonb),
        ('95000000-0000-4000-8000-000000000105'::uuid, pg_catalog.to_jsonb('Ada' || pg_catalog.chr(133) || 'Lovelace'))
    ) AS invalid_fixture(user_id, display_name_json)
  LOOP
    BEGIN
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES (
        invalid_case.user_id,
        'invalid-bootstrap@example.test',
        pg_catalog.jsonb_build_object('display_name', invalid_case.display_name_json)
      );
      RAISE EXCEPTION 'invalid auth display name was accepted for %', invalid_case.user_id;
    EXCEPTION
      WHEN SQLSTATE '22023' THEN NULL;
    END;
  END LOOP;
END;
$invalid_auth_display_name$;

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id BETWEEN
      '95000000-0000-4000-8000-000000000101'::uuid
      AND '95000000-0000-4000-8000-000000000105'::uuid
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.user_id BETWEEN
      '95000000-0000-4000-8000-000000000101'::uuid
      AND '95000000-0000-4000-8000-000000000105'::uuid
  ),
  'invalid auth display-name metadata escaped the trigger subtransaction'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_id_workspace_key'
      AND constraint_record.contype = 'u'
      AND constraint_record.convalidated
  ),
  'membership/workspace unique key is missing'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_member_role_allocations_membership_workspace_fkey'
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND constraint_record.confdeltype = 'c'
  ),
  'validated allocation tenant foreign key is missing'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.save_workspace_member_profile_v1(uuid,uuid,integer,text,text,uuid,numeric,jsonb,text,text)'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.proconfig = ARRAY[
        'search_path=pg_catalog',
        'lock_timeout=5s'
      ]::text[]
      AND owner_role.rolname = 'postgres'
  ),
  'save RPC owner, SECURITY DEFINER or search_path contract changed'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.guard_member_profile_save_audit_mutation()'::pg_catalog.regprocedure
      AND NOT procedure.prosecdef
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND owner_role.rolname = 'postgres'
  ),
  'audit guard owner, invoker or search_path contract changed'
);

SELECT contract.assert_true(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.save_workspace_member_profile_v1(uuid,uuid,integer,text,text,uuid,numeric,jsonb,text,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.save_workspace_member_profile_v1(uuid,uuid,integer,text,text,uuid,numeric,jsonb,text,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.save_workspace_member_profile_v1(uuid,uuid,integer,text,text,uuid,numeric,jsonb,text,text)',
    'EXECUTE'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT procedure.proacl
          FROM pg_catalog.pg_proc AS procedure
          WHERE procedure.oid = 'public.save_workspace_member_profile_v1(uuid,uuid,integer,text,text,uuid,numeric,jsonb,text,text)'::pg_catalog.regprocedure
        ),
        '{}'::aclitem[]
      )
    ) AS acl
    WHERE acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  )
  AND pg_catalog.to_regprocedure(
    'public.save_workspace_member_profile_v1(uuid,uuid,text,text,uuid,numeric,jsonb,text)'
  ) IS NULL
  AND pg_catalog.to_regprocedure(
    'public.save_workspace_member_profile_v1(uuid,uuid,integer,text,text,uuid,numeric,jsonb,text)'
  ) IS NULL,
  'save RPC must be authenticated-only'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.enterprise_audit_events'::pg_catalog.regclass
      AND trigger_record.tgname = 'guard_member_profile_save_audit_mutation'
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.enterprise_audit_events', 'TRUNCATE')
  AND NOT pg_catalog.has_table_privilege('service_role', 'public.enterprise_audit_events', 'TRUNCATE'),
  'reserved audit action guard or TRUNCATE revocation is missing'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.bump_workspace_member_profile_revision_from_allocation()'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND trigger_record.tgname = 'bump_workspace_member_profile_revision_from_allocation'
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
      AND (trigger_record.tgtype & 2) = 2
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.bump_workspace_member_profile_revision_from_allocation()',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_table_privilege(
    'authenticated',
    'public.enterprise_member_role_allocations',
    'TRUNCATE'
  )
  AND NOT pg_catalog.has_table_privilege(
    'service_role',
    'public.enterprise_member_role_allocations',
    'TRUNCATE'
  ),
  'allocation revision bump trigger, owner, ACL or BEFORE timing contract is incomplete'
);

SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.count(*) FILTER (WHERE policy.polcmd = 'a') = 1
      AND pg_catalog.count(*) FILTER (WHERE policy.polcmd = 'w') = 1
      AND pg_catalog.count(*) FILTER (WHERE policy.polcmd = 'd') = 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND NOT policy.polpermissive
      AND policy.polname IN (
        'Role allocations members edit insert guard',
        'Role allocations members edit update guard',
        'Role allocations members edit delete guard'
      )
      AND 'authenticated'::pg_catalog.regrole::oid = ANY(policy.polroles)
  ),
  'authenticated allocation write restrictive policies are incomplete'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.guard_workspace_member_profile_metadata_update()'::pg_catalog.regprocedure
      AND NOT procedure.prosecdef
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND trigger_record.tgname = 'guard_workspace_member_profile_metadata_update'
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.guard_workspace_member_profile_metadata_update()',
    'EXECUTE'
  ),
  'membership profile metadata direct-write guard contract is incomplete'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.get_workspace_member_profile_edit_snapshot_v1(uuid,uuid)'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_workspace_member_profile_edit_snapshot_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.get_workspace_member_profile_edit_snapshot_v1(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.get_workspace_member_profile_edit_snapshot_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'atomic edit snapshot read RPC owner, ACL or search_path contract is incomplete'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.proconfig = ARRAY[
        'search_path=pg_catalog',
        'lock_timeout=5s'
      ]::text[]
      AND owner_role.rolname = 'postgres'
  )
  AND pg_catalog.has_function_privilege(
    'authenticated',
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon',
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)',
    'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)',
    'EXECUTE'
  ),
  'legacy self rename owner, ACL, locking or bounded timeout contract is incomplete'
);

SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.bool_and(NOT procedure.prosecdef)
      AND pg_catalog.bool_and(procedure.proconfig = ARRAY['search_path=pg_catalog']::text[])
      AND pg_catalog.bool_and(owner_role.rolname = 'postgres')
      AND pg_catalog.bool_and(NOT pg_catalog.has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      ))
      AND pg_catalog.bool_and(NOT pg_catalog.has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      ))
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid IN (
      'public.guard_member_profile_save_audit_mutation()'::pg_catalog.regprocedure,
      'public.guard_admin_leave_override_audit_mutation()'::pg_catalog.regprocedure,
      'public.guard_payroll_transition_audit_mutation()'::pg_catalog.regprocedure
    )
  )
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = procedure.proowner
    WHERE procedure.oid = 'public.workspace_parent_exists_for_cascade_guard(uuid)'::pg_catalog.regprocedure
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND owner_role.rolname = 'postgres'
      AND NOT pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE')
  )
  AND (
    SELECT pg_catalog.count(*) = 3
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.enterprise_audit_events'::pg_catalog.regclass
      AND trigger_record.tgname IN (
        'guard_member_profile_save_audit_mutation',
        'guard_admin_leave_override_audit_mutation',
        'guard_payroll_transition_audit_mutation'
      )
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  ),
  'reserved audit lifecycle guard owner, ACL, helper or trigger contract is incomplete'
);

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  false
);
DO $atomic_edit_snapshot_read$
DECLARE
  v_snapshot jsonb;
  v_denied boolean := false;
  v_legacy_invalid_rejected boolean := false;
BEGIN
  v_snapshot := public.get_workspace_member_profile_edit_snapshot_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003'
  );
  PERFORM contract.assert_true(
    v_snapshot ?& ARRAY[
      'ok', 'workspace_id', 'membership_id', 'status', 'business_role',
      'location', 'city', 'office_id', 'base_working_hours',
      'profile_revision', 'display_name', 'role_allocations'
    ]::text[]
    AND v_snapshot - ARRAY[
      'ok', 'workspace_id', 'membership_id', 'status', 'business_role',
      'location', 'city', 'office_id', 'base_working_hours',
      'profile_revision', 'display_name', 'role_allocations'
    ]::text[] = '{}'::jsonb
    AND (v_snapshot ->> 'ok')::boolean
    AND v_snapshot ->> 'status' = 'active'
    AND (v_snapshot ->> 'profile_revision')::integer = 0
    AND v_snapshot -> 'display_name' = 'null'::jsonb
    AND v_snapshot -> 'role_allocations' =
      '[{"business_role":"Engineer","percentage":100,"is_priority":true}]'::jsonb,
    'readonly viewer did not receive the exact atomic edit snapshot'
  );

  v_snapshot := public.get_workspace_member_profile_edit_snapshot_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000007'
  );
  PERFORM contract.assert_true(
    (v_snapshot ->> 'profile_revision')::integer = 0
    AND v_snapshot -> 'role_allocations' =
      '[{"business_role":"Legacy partial","percentage":90,"is_priority":false}]'::jsonb,
    'atomic read hid or rejected a bounded legacy-invalid allocation snapshot'
  );

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000001',
    false
  );
  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000007',
      0,
      NULL, NULL, NULL, 8,
      '[{"business_role":"Legacy partial","percentage":90,"is_priority":false}]'::jsonb,
      NULL,
      NULL
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    v_legacy_invalid_rejected := true;
  END;
  PERFORM contract.assert_true(
    v_legacy_invalid_rejected,
    'atomic save accepted a legacy-invalid allocation snapshot without remediation'
  );

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000004',
    false
  );

  BEGIN
    PERFORM public.get_workspace_member_profile_edit_snapshot_v1(
      '22222222-2222-4222-8222-222222222222',
      'b1000000-0000-4000-8000-000000000002'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'cross-tenant atomic snapshot read was not denied');

  v_denied := false;
  BEGIN
    PERFORM public.get_workspace_member_profile_edit_snapshot_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000008'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM contract.assert_true(v_denied, 'removed target atomic snapshot read was not denied');
END;
$atomic_edit_snapshot_read$;
RESET ROLE;

UPDATE public.enterprise_role_permissions
SET access_level = 'none'
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND role_key = 'member'
  AND feature_key = 'members';
UPDATE public.fixture_workspace_features
SET enabled = false
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'members_list';
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  false
);
DO $self_snapshot_without_directory_entitlement$
DECLARE
  v_snapshot jsonb;
  v_other_denied boolean := false;
BEGIN
  v_snapshot := public.get_workspace_member_profile_edit_snapshot_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000004'
  );
  PERFORM contract.assert_true(
    (v_snapshot ->> 'membership_id')::uuid =
      'a1000000-0000-4000-8000-000000000004'::uuid
    AND v_snapshot ->> 'display_name' = 'Readonly A',
    'active self profile was hidden without directory permission/entitlement'
  );

  BEGIN
    PERFORM public.get_workspace_member_profile_edit_snapshot_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000003'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_other_denied := true;
  END;
  PERFORM contract.assert_true(
    v_other_denied,
    'member without directory permission/entitlement read another profile'
  );
END;
$self_snapshot_without_directory_entitlement$;
RESET ROLE;
UPDATE public.enterprise_role_permissions
SET access_level = 'readonly'
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND role_key = 'member'
  AND feature_key = 'members';
UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'members_list';

-- The new composite FK rejects any future cross-tenant allocation correlation.
DO $composite_fk_guard$
DECLARE
  v_rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_member_role_allocations(
      id, workspace_id, membership_id, business_role, percentage, is_priority
    ) VALUES (
      'dead0000-0000-4000-8000-000000000002',
      '22222222-2222-4222-8222-222222222222',
      'a1000000-0000-4000-8000-000000000004',
      'Forbidden mismatch',
      100,
      true
    );
  EXCEPTION WHEN foreign_key_violation THEN
    v_rejected := true;
  END;
  PERFORM contract.assert_true(v_rejected, 'composite tenant FK accepted a mismatch');
END;
$composite_fk_guard$;

CREATE OR REPLACE FUNCTION contract.save_failed_with(
  p_actor uuid,
  p_workspace_id uuid,
  p_membership_id uuid,
  p_location text,
  p_city text,
  p_office_id uuid,
  p_base_working_hours numeric,
  p_role_allocations jsonb,
  p_display_name text,
  p_expected_sqlstate text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_expected_profile_revision integer;
  v_expected_display_name text;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, false);
  SELECT membership.profile_revision, profile.display_name
  INTO v_expected_profile_revision, v_expected_display_name
  FROM public.enterprise_memberships AS membership
  LEFT JOIN public.profiles AS profile
    ON profile.user_id = membership.user_id
  WHERE membership.id = p_membership_id
    AND membership.workspace_id = p_workspace_id;

  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      p_workspace_id,
      p_membership_id,
      COALESCE(v_expected_profile_revision, 0),
      p_location,
      p_city,
      p_office_id,
      p_base_working_hours,
      p_role_allocations,
      p_display_name,
      v_expected_display_name
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLSTATE = p_expected_sqlstate;
  END;
  RETURN false;
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.save_failed_with(
  uuid, uuid, uuid, text, text, uuid, numeric, jsonb, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION contract.direct_profile_mutations_blocked()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_insert_blocked boolean := false;
  v_update_blocked boolean := false;
  v_delete_blocked boolean := false;
  v_membership_blocked boolean := false;
  v_rows integer;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_member_role_allocations(
      id, workspace_id, membership_id, business_role, percentage, is_priority
    ) VALUES (
      'dd000000-0000-4000-8000-000000000001',
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000004',
      'Direct blocked', 100, true
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_insert_blocked := true;
  END;

  UPDATE public.enterprise_member_role_allocations AS allocation
  SET percentage = 99
  WHERE allocation.id = 'aa000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_update_blocked := v_rows = 0;

  DELETE FROM public.enterprise_member_role_allocations AS allocation
  WHERE allocation.id = 'aa000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_delete_blocked := v_rows = 0;

  BEGIN
    UPDATE public.enterprise_memberships AS membership
    SET location = 'Direct blocked'
    WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  EXCEPTION WHEN insufficient_privilege THEN
    v_membership_blocked := true;
  END;

  RETURN pg_catalog.jsonb_build_object(
    'insert', v_insert_blocked,
    'update', v_update_blocked,
    'delete', v_delete_blocked,
    'membership', v_membership_blocked
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.direct_profile_mutations_blocked() TO authenticated;

SET ROLE authenticated;

-- Cross-tenant targets, offices, inactive actors and removed targets all fail
-- closed without revealing whether the supplied foreign UUID otherwise exists.
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'b1000000-0000-4000-8000-000000000002',
    NULL, NULL, NULL, 8, '[]'::jsonb, NULL, '42501'
  ),
  'cross-tenant target was not denied'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, '0b000000-0000-4000-8000-000000000001', 8,
    '[{"business_role":"Engineer","percentage":100,"is_priority":true}]'::jsonb,
    NULL, '22023'
  ),
  'cross-tenant office was not denied'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000005',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Engineer","percentage":100,"is_priority":true}]'::jsonb,
    NULL, '42501'
  ),
  'suspended actor was not denied'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000008',
    NULL, NULL, NULL, 8, '[]'::jsonb, NULL, '42501'
  ),
  'removed target was not denied'
);

-- Read-only members cannot save another profile.
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000004',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Engineer","percentage":100,"is_priority":true}]'::jsonb,
    NULL, '42501'
  ),
  'members readonly permission satisfied the edit contract'
);
DO $unauthorized_revision_oracle_closed$
DECLARE
  v_forbidden boolean := false;
BEGIN
  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000003',
      999,
      NULL, NULL, NULL, 8,
      '[{"business_role":"Engineer","percentage":100,"is_priority":true}]'::jsonb,
      NULL, NULL
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_forbidden := true;
  END;
  PERFORM contract.assert_true(
    v_forbidden,
    'unauthorized stale caller observed a revision-conflict oracle'
  );
END;
$unauthorized_revision_oracle_closed$;

RESET ROLE;
UPDATE public.enterprise_role_permissions
SET access_level = 'readonly'
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND role_key = 'resourceAssistant'
  AND feature_key = 'members';
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);
SELECT contract.assert_true(
  contract.direct_profile_mutations_blocked() =
    '{"insert":true,"update":true,"delete":true,"membership":true}'::jsonb,
  'readonly resourceAssistant bypassed a direct profile/allocation write guard'
);
DO $unrelated_membership_update_unchanged$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.enterprise_memberships AS membership
  SET updated_at = membership.updated_at
  WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM contract.assert_true(
    v_rows = 1,
    'profile metadata guard changed an unrelated membership update'
  );
END;
$unrelated_membership_update_unchanged$;
RESET ROLE;

UPDATE public.enterprise_role_permissions
SET access_level = 'edit'
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND role_key = 'resourceAssistant'
  AND feature_key = 'members';
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);
DO $authorized_legacy_direct_writes$
DECLARE
  v_rows integer;
  v_identity_move_blocked boolean := false;
  v_revision_manipulation_blocked boolean := false;
  v_revision integer;
BEGIN
  INSERT INTO public.enterprise_member_role_allocations(
    id, workspace_id, membership_id, business_role, percentage, is_priority
  ) VALUES (
    'dd000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000004',
    'Authorized direct', 100, true
  );
  SELECT membership.profile_revision INTO v_revision
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  PERFORM contract.assert_true(v_revision = 1, 'direct allocation INSERT did not advance revision');

  UPDATE public.enterprise_member_role_allocations AS allocation
  SET percentage = 90
  WHERE allocation.id = 'dd000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM contract.assert_true(v_rows = 1, 'authorized allocation UPDATE was blocked');
  SELECT membership.profile_revision INTO v_revision
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  PERFORM contract.assert_true(v_revision = 2, 'direct allocation UPDATE did not advance revision');

  BEGIN
    UPDATE public.enterprise_member_role_allocations AS allocation
    SET membership_id = 'a1000000-0000-4000-8000-000000000003'
    WHERE allocation.id = 'dd000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN insufficient_privilege THEN
    v_identity_move_blocked := true;
  END;
  PERFORM contract.assert_true(
    v_identity_move_blocked,
    'allocation identity move bypassed the immutable identity contract'
  );

  UPDATE public.enterprise_memberships AS membership
  SET location = 'Authorized direct'
  WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM contract.assert_true(v_rows = 1, 'authorized membership profile UPDATE was blocked');
  SELECT membership.profile_revision INTO v_revision
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  PERFORM contract.assert_true(v_revision = 3, 'direct membership UPDATE did not advance revision');

  BEGIN
    UPDATE public.enterprise_memberships AS membership
    SET profile_revision = 99
    WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  EXCEPTION WHEN insufficient_privilege THEN
    v_revision_manipulation_blocked := true;
  END;
  PERFORM contract.assert_true(
    v_revision_manipulation_blocked,
    'authenticated caller manipulated the server-managed profile revision'
  );

  DELETE FROM public.enterprise_member_role_allocations AS allocation
  WHERE allocation.id = 'dd000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM contract.assert_true(v_rows = 1, 'authorized allocation DELETE was blocked');
  SELECT membership.profile_revision INTO v_revision
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = 'a1000000-0000-4000-8000-000000000004';
  PERFORM contract.assert_true(v_revision = 4, 'direct allocation DELETE did not advance revision');
END;
$authorized_legacy_direct_writes$;

DO $stale_after_legacy_write_then_retry$
DECLARE
  v_stale_rejected boolean := false;
  v_before_audits bigint;
  v_result jsonb;
BEGIN
  SELECT pg_catalog.count(*) INTO v_before_audits
  FROM public.enterprise_audit_events
  WHERE action = 'membership.profile_updated'
    AND target_id = 'a1000000-0000-4000-8000-000000000004';

  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000004',
      0,
      'Stale overwrite', NULL, NULL, 8, '[]'::jsonb, NULL, NULL
    );
  EXCEPTION WHEN serialization_failure THEN
    v_stale_rejected := true;
  END;

  PERFORM contract.assert_true(v_stale_rejected, 'stale expected revision was accepted');
  PERFORM contract.assert_true(
    EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000004'
        AND membership.location = 'Authorized direct'
        AND membership.profile_revision = 4
    )
    AND v_before_audits = (
      SELECT pg_catalog.count(*)
      FROM public.enterprise_audit_events
      WHERE action = 'membership.profile_updated'
        AND target_id = 'a1000000-0000-4000-8000-000000000004'
    ),
    'stale save mutated membership, revision or audit state'
  );

  v_result := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000004',
    4,
    'Fresh retry', NULL, NULL, 8, '[]'::jsonb, NULL, NULL
  );
  PERFORM contract.assert_true(
    (v_result ->> 'changed')::boolean
    AND (v_result ->> 'profile_revision')::integer = 5
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000004'
        AND membership.location = 'Fresh retry'
        AND membership.profile_revision = 5
    ),
    'fresh retry after a legacy mutation did not commit monotonically'
  );
END;
$stale_after_legacy_write_then_retry$;
RESET ROLE;

UPDATE public.fixture_workspace_features
SET enabled = false
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'members_list';
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);
SELECT contract.assert_true(
  contract.direct_profile_mutations_blocked() =
    '{"insert":true,"update":true,"delete":true,"membership":true}'::jsonb,
  'missing members_list entitlement bypassed a direct write guard'
);
RESET ROLE;
UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'members_list';
SET ROLE authenticated;

-- Exact snapshot validation: shape, bounds, one priority, total, and canonical
-- trim/NFKC/case-insensitive uniqueness are server-enforced.
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8, '{}'::jsonb, NULL, '22023'
  ),
  'non-array allocation snapshot was accepted'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Engineer","percentage":100,"is_priority":true,"locked":false}]'::jsonb,
    NULL, '22023'
  ),
  'extra allocation key was accepted'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Developer","percentage":50,"is_priority":true},{"business_role":" developer ","percentage":50,"is_priority":false}]'::jsonb,
    NULL, '22023'
  ),
  'trim/case duplicate allocation was accepted'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Engineer","percentage":50,"is_priority":true},{"business_role":"Ｅｎｇｉｎｅｅｒ","percentage":50,"is_priority":false}]'::jsonb,
    NULL, '22023'
  ),
  'NFKC-equivalent duplicate allocation was accepted'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Engineer","percentage":100,"is_priority":false}]'::jsonb,
    NULL, '22023'
  ),
  'allocation snapshot without one priority was accepted'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Engineer","percentage":99.99,"is_priority":true}]'::jsonb,
    NULL, '22023'
  ),
  'allocation snapshot not totaling 100 was accepted'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'business_role', 'Role ' || item.number,
          'percentage', CASE WHEN item.number = 1 THEN 100 ELSE 0 END,
          'is_priority', item.number = 1
        ) ORDER BY item.number
      )
      FROM pg_catalog.generate_series(1, 21) AS item(number)
    ),
    NULL, '22023'
  ),
  'allocation snapshot above the 20-row bound was accepted'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    E'bad\nlocation', NULL, NULL, 8.001,
    '[{"business_role":"Engineer","percentage":100,"is_priority":true}]'::jsonb,
    NULL, '22023'
  ),
  'invalid text/hour bounds were accepted'
);

RESET ROLE;

-- `members_list` is the shipped entitlement backing the members workspace tab.
UPDATE public.fixture_workspace_features
SET enabled = false
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'members_list';
SET ROLE authenticated;
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    NULL, NULL, NULL, 8,
    '[{"business_role":"Engineer","percentage":100,"is_priority":true}]'::jsonb,
    NULL, '42501'
  ),
  'missing members_list entitlement was not denied'
);
RESET ROLE;
UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND feature_key = 'members_list';

-- The shipped v3.51.5 self-rename RPC remains callable, but now participates in
-- the same lock/revision contract. A legacy commit invalidates a stale atomic
-- snapshot; a fresh retry succeeds and returns the final monotonic revision.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
DO $legacy_rename_revision_contract$
DECLARE
  v_stale_rejected boolean := false;
  v_response jsonb;
BEGIN
  PERFORM public.update_my_workspace_profile_display_name_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000001',
    'Legacy Owner Rename'
  );
  PERFORM contract.assert_true(
    EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000001'
        AND membership.profile_revision = 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.user_id = '10000000-0000-4000-8000-000000000001'
        AND profile.display_name = 'Legacy Owner Rename'
    ),
    'legacy self rename did not advance the membership revision'
  );

  PERFORM public.update_my_workspace_profile_display_name_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000001',
    'Legacy Owner Rename'
  );
  PERFORM contract.assert_true(
    EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000001'
        AND membership.profile_revision = 1
    ),
    'legacy self rename no-op advanced the revision'
  );

  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000001',
      0,
      NULL, NULL, NULL, 8, '[]'::jsonb,
      'Stale Owner Rename', 'Owner A'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_stale_rejected := true;
  END;
  PERFORM contract.assert_true(
    v_stale_rejected
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.user_id = '10000000-0000-4000-8000-000000000001'
        AND profile.display_name = 'Legacy Owner Rename'
    ),
    'legacy rename did not invalidate a stale atomic save'
  );

  v_response := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000001',
    1,
    NULL, NULL, NULL, 8, '[]'::jsonb,
    'Fresh Owner Rename', 'Legacy Owner Rename'
  );
  PERFORM contract.assert_true(
    (v_response ->> 'changed')::boolean
    AND (v_response ->> 'display_name_updated')::boolean
    AND (v_response ->> 'profile_revision')::integer = 2,
    'fresh atomic retry after legacy rename did not commit monotonically'
  );
END;
$legacy_rename_revision_contract$;
RESET ROLE;

-- Owner semantics remain centralized in has_workspace_permission. Save one
-- active target and verify the exact minimal receipt and canonical full
-- allocation snapshot.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
DO $active_target_success$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    0,
    '  Hybrid  ',
    ' Budapest ',
    '0a000000-0000-4000-8000-000000000001',
    7.5,
    '[{"business_role":"Developer","percentage":60,"is_priority":true},{"business_role":"QA","percentage":40,"is_priority":false}]'::jsonb,
    NULL,
    NULL
  );

  PERFORM contract.assert_true(
    v_result ?& ARRAY[
      'ok', 'workspace_id', 'membership_id', 'changed', 'allocation_count',
      'display_name_updated', 'profile_revision', 'audit_event_id'
    ]::text[]
    AND v_result - ARRAY[
      'ok', 'workspace_id', 'membership_id', 'changed', 'allocation_count',
      'display_name_updated', 'profile_revision', 'audit_event_id'
    ]::text[] = '{}'::jsonb,
    'save receipt shape drifted'
  );
  PERFORM contract.assert_true(
    (v_result ->> 'ok')::boolean
    AND (v_result ->> 'changed')::boolean
    AND (v_result ->> 'allocation_count')::integer = 2
    AND (v_result ->> 'profile_revision')::integer = 4
    AND NOT (v_result ->> 'display_name_updated')::boolean
    AND (v_result ->> 'workspace_id')::uuid = '11111111-1111-4111-8111-111111111111'::uuid
    AND (v_result ->> 'membership_id')::uuid = 'a1000000-0000-4000-8000-000000000003'::uuid
    AND (v_result ->> 'audit_event_id')::uuid IS NOT NULL,
    'changed save receipt values are invalid'
  );
END;
$active_target_success$;
RESET ROLE;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.id = 'a1000000-0000-4000-8000-000000000003'
      AND membership.business_role = 'Developer'
      AND membership.location = 'Hybrid'
      AND membership.city = 'Budapest'
      AND membership.office_id = '0a000000-0000-4000-8000-000000000001'
      AND membership.base_working_hours = 7.5
      AND membership.profile_revision = 4
  ),
  'active membership state was not saved canonically'
);
SELECT contract.assert_true(
  (
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'business_role', allocation.business_role,
        'percentage', allocation.percentage,
        'is_priority', allocation.is_priority
      ) ORDER BY allocation.business_role
    )
    FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.membership_id = 'a1000000-0000-4000-8000-000000000003'
  ) = '[{"business_role":"Developer","percentage":60,"is_priority":true},{"business_role":"QA","percentage":40,"is_priority":false}]'::jsonb,
  'full allocation snapshot was not replaced canonically'
);
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_audit_events AS event
    WHERE event.action = 'membership.profile_updated'
      AND event.workspace_id = '11111111-1111-4111-8111-111111111111'
      AND event.actor_id = '10000000-0000-4000-8000-000000000001'
      AND event.target_id = 'a1000000-0000-4000-8000-000000000003'
      AND event.metadata ?& ARRAY[
        'changed_fields', 'previous_allocation_count', 'allocation_count'
      ]::text[]
      AND event.metadata - ARRAY[
        'changed_fields', 'previous_allocation_count', 'allocation_count'
      ]::text[] = '{}'::jsonb
      AND event.prev_state = '{"allocation_count":1}'::jsonb
      AND event.new_state = '{"allocation_count":2}'::jsonb
      AND event.metadata::text NOT LIKE '%Budapest%'
      AND event.metadata::text NOT LIKE '%Developer%'
  ),
  'atomic audit event is missing or contains profile values'
);

-- The same canonical state is a true no-op: no audit row and a null receipt ID.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
DO $noop_receipt$
DECLARE
  v_before bigint;
  v_after bigint;
  v_result jsonb;
BEGIN
  SELECT pg_catalog.count(*) INTO v_before
  FROM public.enterprise_audit_events
  WHERE action = 'membership.profile_updated';

  v_result := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    (
      SELECT membership.profile_revision
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000003'
    ),
    'Hybrid', 'Budapest',
    '0a000000-0000-4000-8000-000000000001', 7.5,
    '[{"business_role":"QA","percentage":40,"is_priority":false},{"business_role":"Developer","percentage":60,"is_priority":true}]'::jsonb,
    NULL,
    NULL
  );

  SELECT pg_catalog.count(*) INTO v_after
  FROM public.enterprise_audit_events
  WHERE action = 'membership.profile_updated';

  PERFORM contract.assert_true(
    NOT (v_result ->> 'changed')::boolean
    AND NOT (v_result ->> 'display_name_updated')::boolean
    AND (v_result ->> 'profile_revision')::integer = (
      SELECT membership.profile_revision
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000003'
    )
    AND v_result -> 'audit_event_id' = 'null'::jsonb
    AND v_after = v_before,
    'no-op receipt or audit behavior is invalid'
  );
END;
$noop_receipt$;
RESET ROLE;

-- Invited and suspended targets remain editable by an active authorized actor;
-- removed targets above remain fail-closed.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
DO $non_active_target_states$
DECLARE
  v_invited jsonb;
  v_suspended jsonb;
BEGIN
  v_invited := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000007',
    0,
    NULL, 'Invited city', NULL, 8, '[]'::jsonb, NULL, NULL
  );
  v_suspended := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000006',
    0,
    NULL, 'Suspended city', NULL, 8, '[]'::jsonb, NULL, NULL
  );
  PERFORM contract.assert_true(
    (v_invited ->> 'changed')::boolean
    AND (v_invited ->> 'profile_revision')::integer = 2
    AND (v_suspended ->> 'changed')::boolean
    AND (v_suspended ->> 'profile_revision')::integer = 1,
    'invited or suspended target save was rejected'
  );
END;
$non_active_target_states$;
RESET ROLE;

-- A display name can only be changed for the active actor's own membership,
-- and the update is delegated to the existing self-only v1 RPC.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);
DO $self_display_name$
DECLARE
  v_result jsonb;
  v_noop_result jsonb;
BEGIN
  v_result := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000002',
    0,
    NULL, NULL, NULL, 8, '[]'::jsonb,
    '  Renamed Assistant  ', 'Assistant A'
  );
  PERFORM contract.assert_true(
    (v_result ->> 'changed')::boolean
    AND (v_result ->> 'display_name_updated')::boolean
    AND (v_result ->> 'profile_revision')::integer = 1
    AND (v_result ->> 'audit_event_id')::uuid IS NOT NULL,
    'self display-name receipt is invalid'
  );

  v_noop_result := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000002',
    (v_result ->> 'profile_revision')::integer,
    NULL, NULL, NULL, 8, '[]'::jsonb,
    'Renamed Assistant', 'Renamed Assistant'
  );
  PERFORM contract.assert_true(
    NOT (v_noop_result ->> 'changed')::boolean
    AND NOT (v_noop_result ->> 'display_name_updated')::boolean
    AND (v_noop_result ->> 'profile_revision')::integer = 1
    AND v_noop_result -> 'audit_event_id' = 'null'::jsonb,
    'unchanged requested display name did not return the exact no-op receipt'
  );
END;
$self_display_name$;
SELECT contract.assert_true(
  EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.user_id = '10000000-0000-4000-8000-000000000002'
      AND profile.display_name = 'Renamed Assistant'
  ),
  'self display name was not delegated and committed'
);
SELECT contract.assert_true(
  contract.save_failed_with(
    '10000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000003',
    'Hybrid', 'Budapest', '0a000000-0000-4000-8000-000000000001', 7.5,
    '[{"business_role":"Developer","percentage":60,"is_priority":true},{"business_role":"QA","percentage":40,"is_priority":false}]'::jsonb,
    'Forged name', '42501'
  ),
  'another user global display name was not denied'
);
RESET ROLE;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);
SELECT contract.assert_true(
  (
    public.get_workspace_member_profile_edit_snapshot_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002'
    ) ->> 'display_name'
  ) = 'Renamed Assistant',
  'self display-name conflict fixture did not start from an authoritative snapshot'
);
UPDATE public.profiles AS profile
SET display_name = 'Concurrent Direct Rename'
WHERE profile.user_id = '10000000-0000-4000-8000-000000000002';
DO $direct_profile_rename_conflict$
DECLARE
  v_stale_rejected boolean := false;
  v_before_audits bigint;
  v_snapshot jsonb;
  v_no_name_response jsonb;
BEGIN
  SELECT pg_catalog.count(*) INTO v_before_audits
  FROM public.enterprise_audit_events AS event
  WHERE event.action = 'membership.profile_updated'
    AND event.target_id = 'a1000000-0000-4000-8000-000000000002';

  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002',
      1,
      NULL, NULL, NULL, 8, '[]'::jsonb,
      'Stale Sheet Rename', 'Renamed Assistant'
    );
  EXCEPTION WHEN serialization_failure THEN
    v_stale_rejected := true;
  END;
  PERFORM contract.assert_true(
    v_stale_rejected
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.user_id = '10000000-0000-4000-8000-000000000002'
        AND profile.display_name = 'Concurrent Direct Rename'
    )
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000002'
        AND membership.profile_revision = 1
    )
    AND v_before_audits = (
      SELECT pg_catalog.count(*)
      FROM public.enterprise_audit_events AS event
      WHERE event.action = 'membership.profile_updated'
        AND event.target_id = 'a1000000-0000-4000-8000-000000000002'
    ),
    'stale expected display name overwrote a direct self rename or mutated audit/revision'
  );

  v_snapshot := public.get_workspace_member_profile_edit_snapshot_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000002'
  );
  PERFORM contract.assert_true(
    v_snapshot ->> 'display_name' = 'Concurrent Direct Rename'
    AND (v_snapshot ->> 'profile_revision')::integer = 1,
    'conflict reload did not expose the latest raw self display name'
  );

  v_no_name_response := public.save_workspace_member_profile_v1(
    '11111111-1111-4111-8111-111111111111',
    'a1000000-0000-4000-8000-000000000002',
    1,
    NULL, NULL, NULL, 8, '[]'::jsonb,
    NULL, 'Renamed Assistant'
  );
  PERFORM contract.assert_true(
    NOT (v_no_name_response ->> 'changed')::boolean
    AND (v_no_name_response ->> 'profile_revision')::integer = 1
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.user_id = '10000000-0000-4000-8000-000000000002'
        AND profile.display_name = 'Concurrent Direct Rename'
    ),
    'null desired display name did not preserve the concurrent global name'
  );
END;
$direct_profile_rename_conflict$;
RESET ROLE;

-- Force the final audit insert to fail and prove membership/allocation writes
-- roll back with it. NOT VALID avoids rewriting prior fixture audit rows while
-- still checking every new row.
ALTER TABLE public.enterprise_audit_events
  ADD CONSTRAINT fixture_reject_profile_audit
  CHECK (action <> 'membership.profile_updated') NOT VALID;
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
DO $audit_failure_rolls_back$
DECLARE
  v_failed boolean := false;
  v_audit_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_audit_count
  FROM public.enterprise_audit_events
  WHERE action = 'membership.profile_updated';

  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000003',
      (
        SELECT membership.profile_revision
        FROM public.enterprise_memberships AS membership
        WHERE membership.id = 'a1000000-0000-4000-8000-000000000003'
      ),
      'Rollback location', 'Rollback city', NULL, 8,
      '[{"business_role":"Rollback role","percentage":100,"is_priority":true}]'::jsonb,
      NULL,
      NULL
    );
  EXCEPTION WHEN check_violation THEN
    v_failed := true;
  END;

  PERFORM contract.assert_true(v_failed, 'forced audit failure did not surface');
  PERFORM contract.assert_true(
    EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = 'a1000000-0000-4000-8000-000000000003'
        AND membership.location = 'Hybrid'
        AND membership.city = 'Budapest'
        AND membership.business_role = 'Developer'
    ),
    'membership write survived a failed audit insert'
  );
  PERFORM contract.assert_true(
    NOT EXISTS (
      SELECT 1 FROM public.enterprise_member_role_allocations AS allocation
      WHERE allocation.membership_id = 'a1000000-0000-4000-8000-000000000003'
        AND allocation.business_role = 'Rollback role'
    ),
    'allocation replacement survived a failed audit insert'
  );
  PERFORM contract.assert_true(
    v_audit_count = (
      SELECT pg_catalog.count(*)
      FROM public.enterprise_audit_events
      WHERE action = 'membership.profile_updated'
    ),
    'failed atomic save inserted an audit row'
  );
END;
$audit_failure_rolls_back$;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);
DO $audit_failure_rolls_back_display_name$
DECLARE
  v_failed boolean := false;
  v_audit_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_audit_count
  FROM public.enterprise_audit_events
  WHERE action = 'membership.profile_updated';

  BEGIN
    PERFORM public.save_workspace_member_profile_v1(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000002',
      (
        SELECT membership.profile_revision
        FROM public.enterprise_memberships AS membership
        WHERE membership.id = 'a1000000-0000-4000-8000-000000000002'
      ),
      NULL, NULL, NULL, 8, '[]'::jsonb,
      'Rollback Assistant', 'Concurrent Direct Rename'
    );
  EXCEPTION WHEN check_violation THEN
    v_failed := true;
  END;

  PERFORM contract.assert_true(
    v_failed,
    'forced self-profile audit failure did not surface'
  );
  PERFORM contract.assert_true(
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.user_id = '10000000-0000-4000-8000-000000000002'
        AND profile.display_name = 'Concurrent Direct Rename'
    ),
    'delegated global display-name update survived a failed audit insert'
  );
  PERFORM contract.assert_true(
    v_audit_count = (
      SELECT pg_catalog.count(*)
      FROM public.enterprise_audit_events
      WHERE action = 'membership.profile_updated'
    ),
    'failed self-profile atomic save inserted an audit row'
  );
END;
$audit_failure_rolls_back_display_name$;
RESET ROLE;
ALTER TABLE public.enterprise_audit_events
  DROP CONSTRAINT fixture_reject_profile_audit;

-- Seed each reserved action through the migration owner. Runtime roles must not
-- be able to forge or mutate any of them directly.
INSERT INTO public.enterprise_audit_events(
  workspace_id, actor_id, action, target_type, target_id
) VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '10000000-0000-4000-8000-000000000001',
    'leave_request.admin_override', 'leave_request',
    'a1000000-0000-4000-8000-000000000003'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '10000000-0000-4000-8000-000000000001',
    'payroll.period_locked', 'payroll_period',
    'a1000000-0000-4000-8000-000000000003'
  );

CREATE OR REPLACE FUNCTION contract.reserved_audit_mutations_denied(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_insert_denied boolean := false;
  v_update_denied boolean := false;
  v_delete_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_audit_events(
      workspace_id, actor_id, action, target_type, target_id
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      '10000000-0000-4000-8000-000000000001',
      p_action,
      'contract_probe',
      'a1000000-0000-4000-8000-000000000003'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_insert_denied := true;
  END;

  BEGIN
    UPDATE public.enterprise_audit_events AS event
    SET metadata = pg_catalog.jsonb_build_object('forged', true)
    WHERE event.id = (
      SELECT candidate.id
      FROM public.enterprise_audit_events AS candidate
      WHERE candidate.action = p_action
      ORDER BY candidate.created_at
      LIMIT 1
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_update_denied := true;
  END;

  BEGIN
    DELETE FROM public.enterprise_audit_events AS event
    WHERE event.id = (
      SELECT candidate.id
      FROM public.enterprise_audit_events AS candidate
      WHERE candidate.action = p_action
      ORDER BY candidate.created_at
      LIMIT 1
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_delete_denied := true;
  END;

  RETURN pg_catalog.jsonb_build_object(
    'insert', v_insert_denied,
    'update', v_update_denied,
    'delete', v_delete_denied
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.reserved_audit_mutations_denied(text)
  TO authenticated, service_role;

SET ROLE authenticated;
SELECT contract.assert_true(
  pg_catalog.bool_and(
    contract.reserved_audit_mutations_denied(action_name) =
      '{"insert":true,"update":true,"delete":true}'::jsonb
  ),
  'authenticated could forge or mutate a reserved audit action'
)
FROM pg_catalog.unnest(ARRAY[
  'membership.profile_updated',
  'leave_request.admin_override',
  'payroll.period_locked'
]::text[]) AS reserved(action_name);
RESET ROLE;

SET ROLE service_role;
SELECT contract.assert_true(
  pg_catalog.bool_and(
    contract.reserved_audit_mutations_denied(action_name) =
      '{"insert":true,"update":true,"delete":true}'::jsonb
  ),
  'service_role could forge or mutate a reserved audit action'
)
FROM pg_catalog.unnest(ARRAY[
  'membership.profile_updated',
  'leave_request.admin_override',
  'payroll.period_locked'
]::text[]) AS reserved(action_name);
RESET ROLE;

-- Reproduce the production workspace cascade graph with an authenticated
-- atomic profile save, every reserved audit guard class and a locked payroll
-- period. The control tenant has the same complete row shape so exact counts
-- prove that neither authenticated nor service-role deletion crosses tenants.
INSERT INTO public.enterprise_workspaces(id, name) VALUES
  ('33333333-3333-4333-8333-333333333333', 'Cascade Auth Target'),
  ('44444444-4444-4444-8444-444444444444', 'Cascade Control'),
  ('55555555-5555-4555-8555-555555555555', 'Cascade Service Target');

INSERT INTO public.enterprise_offices(id, workspace_id, name) VALUES
  (
    '33000000-0000-4000-8000-000000000020',
    '33333333-3333-4333-8333-333333333333',
    'Auth cascade office'
  ),
  (
    '44000000-0000-4000-8000-000000000020',
    '44444444-4444-4444-8444-444444444444',
    'Control cascade office'
  ),
  (
    '55000000-0000-4000-8000-000000000020',
    '55555555-5555-4555-8555-555555555555',
    'Service cascade office'
  );

INSERT INTO public.enterprise_memberships(
  id, workspace_id, user_id, role, status, base_working_hours
) VALUES
  (
    '33000000-0000-4000-8000-000000000021',
    '33333333-3333-4333-8333-333333333333',
    '30000000-0000-4000-8000-000000000001',
    'owner', 'active', 8
  ),
  (
    '44000000-0000-4000-8000-000000000021',
    '44444444-4444-4444-8444-444444444444',
    '40000000-0000-4000-8000-000000000001',
    'owner', 'active', 8
  ),
  (
    '55000000-0000-4000-8000-000000000021',
    '55555555-5555-4555-8555-555555555555',
    '50000000-0000-4000-8000-000000000001',
    'owner', 'active', 8
  );

INSERT INTO public.fixture_workspace_features(workspace_id, feature_key, enabled)
VALUES
  ('33333333-3333-4333-8333-333333333333', 'members_list', true),
  ('44444444-4444-4444-8444-444444444444', 'members_list', true),
  ('55555555-5555-4555-8555-555555555555', 'members_list', true);

INSERT INTO public.enterprise_audit_events(
  workspace_id, actor_id, action, target_type, target_id
)
SELECT fixture.workspace_id, fixture.actor_id, action_name, 'cascade_probe', fixture.target_id
FROM (
  VALUES
    (
      '33333333-3333-4333-8333-333333333333'::uuid,
      '30000000-0000-4000-8000-000000000001'::uuid,
      '33000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      '44444444-4444-4444-8444-444444444444'::uuid,
      '40000000-0000-4000-8000-000000000001'::uuid,
      '44000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      '55555555-5555-4555-8555-555555555555'::uuid,
      '50000000-0000-4000-8000-000000000001'::uuid,
      '55000000-0000-4000-8000-000000000001'::uuid
    )
) AS fixture(workspace_id, actor_id, target_id)
CROSS JOIN pg_catalog.unnest(ARRAY[
  'membership.profile_updated',
  'leave_request.admin_override',
  'payroll.period_locked'
]::text[]) AS reserved(action_name);

INSERT INTO public.payroll_periods(
  id, workspace_id, name, start_date, end_date
) VALUES
  (
    '33000000-0000-4000-8000-000000000010',
    '33333333-3333-4333-8333-333333333333',
    'Auth cascade locked period', '2026-01-01', '2026-02-01'
  ),
  (
    '44000000-0000-4000-8000-000000000010',
    '44444444-4444-4444-8444-444444444444',
    'Control locked period', '2026-01-01', '2026-02-01'
  ),
  (
    '55000000-0000-4000-8000-000000000010',
    '55555555-5555-4555-8555-555555555555',
    'Service cascade locked period', '2026-01-01', '2026-02-01'
  );

UPDATE public.payroll_periods AS period
SET status = 'locked',
    locked_by = CASE period.workspace_id
      WHEN '33333333-3333-4333-8333-333333333333'::uuid
        THEN '30000000-0000-4000-8000-000000000001'::uuid
      WHEN '44444444-4444-4444-8444-444444444444'::uuid
        THEN '40000000-0000-4000-8000-000000000001'::uuid
      ELSE '50000000-0000-4000-8000-000000000001'::uuid
    END,
    locked_at = pg_catalog.now(),
    calculation_snapshot = '{}'::jsonb,
    calculation_hash = pg_catalog.repeat('a', 64),
    calculation_version = 1
WHERE period.workspace_id IN (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555'
);

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000001',
  false
);
DO $auth_cascade_profile_save$
DECLARE
  v_receipt jsonb;
BEGIN
  v_receipt := public.save_workspace_member_profile_v1(
    '33333333-3333-4333-8333-333333333333',
    '33000000-0000-4000-8000-000000000021',
    0,
    'Auth location', 'Auth city',
    '33000000-0000-4000-8000-000000000020',
    7.25,
    '[{"business_role":"Auth role","percentage":100,"is_priority":true}]'::jsonb,
    NULL, NULL
  );
  PERFORM contract.assert_true(
    (v_receipt ->> 'changed')::boolean
    AND (v_receipt ->> 'profile_revision')::integer = 2
    AND (v_receipt ->> 'allocation_count')::integer = 1
    AND (v_receipt ->> 'audit_event_id')::uuid IS NOT NULL,
    'authenticated cascade fixture profile save did not create exact side effects'
  );
END;
$auth_cascade_profile_save$;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '40000000-0000-4000-8000-000000000001',
  false
);
DO $control_cascade_profile_save$
DECLARE
  v_receipt jsonb;
BEGIN
  v_receipt := public.save_workspace_member_profile_v1(
    '44444444-4444-4444-8444-444444444444',
    '44000000-0000-4000-8000-000000000021',
    0,
    'Control location', 'Control city',
    '44000000-0000-4000-8000-000000000020',
    7.5,
    '[{"business_role":"Control role","percentage":100,"is_priority":true}]'::jsonb,
    NULL, NULL
  );
  PERFORM contract.assert_true(
    (v_receipt ->> 'changed')::boolean
    AND (v_receipt ->> 'profile_revision')::integer = 2
    AND (v_receipt ->> 'allocation_count')::integer = 1
    AND (v_receipt ->> 'audit_event_id')::uuid IS NOT NULL,
    'control cascade fixture profile save did not create exact side effects'
  );
END;
$control_cascade_profile_save$;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000001',
  false
);
DO $service_cascade_profile_save$
DECLARE
  v_receipt jsonb;
BEGIN
  v_receipt := public.save_workspace_member_profile_v1(
    '55555555-5555-4555-8555-555555555555',
    '55000000-0000-4000-8000-000000000021',
    0,
    'Service location', 'Service city',
    '55000000-0000-4000-8000-000000000020',
    7.75,
    '[{"business_role":"Service role","percentage":100,"is_priority":true}]'::jsonb,
    NULL, NULL
  );
  PERFORM contract.assert_true(
    (v_receipt ->> 'changed')::boolean
    AND (v_receipt ->> 'profile_revision')::integer = 2
    AND (v_receipt ->> 'allocation_count')::integer = 1
    AND (v_receipt ->> 'audit_event_id')::uuid IS NOT NULL,
    'service cascade fixture profile save did not create exact side effects'
  );
END;
$service_cascade_profile_save$;
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 3
    FROM public.enterprise_workspaces
    WHERE id IN (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    )
  )
  AND (
    SELECT pg_catalog.count(*) = 3
    FROM public.enterprise_offices
    WHERE workspace_id IN (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    )
  )
  AND (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.bool_and(
        profile_revision = 2
        AND office_id IS NOT NULL
        AND business_role IS NOT NULL
        AND location IS NOT NULL
        AND city IS NOT NULL
      )
    FROM public.enterprise_memberships
    WHERE workspace_id IN (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    )
  )
  AND (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.bool_and(percentage = 100 AND is_priority)
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id IN (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    )
  )
  AND (
    SELECT pg_catalog.count(*) = 12
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'membership.profile_updated'
      ) = 6
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'leave_request.admin_override'
      ) = 3
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'payroll.period_locked'
      ) = 3
    FROM public.enterprise_audit_events
    WHERE workspace_id IN (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    )
  )
  AND (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.bool_and(status = 'locked')
    FROM public.payroll_periods
    WHERE workspace_id IN (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    )
  )
  AND (
    SELECT pg_catalog.count(*) = 3
      AND pg_catalog.bool_and(feature_key = 'members_list' AND enabled)
    FROM public.fixture_workspace_features
    WHERE workspace_id IN (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555'
    )
  ),
  'workspace cascade fixtures do not have exact production-shaped side effects'
);

CREATE OR REPLACE FUNCTION contract.locked_payroll_direct_delete_denied()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  BEGIN
    DELETE FROM public.payroll_periods AS period
    WHERE period.id = '44000000-0000-4000-8000-000000000010';
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN true;
  END;
  RETURN false;
END;
$function$;
GRANT EXECUTE ON FUNCTION contract.locked_payroll_direct_delete_denied()
  TO authenticated, service_role;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000001',
  false
);
SELECT contract.assert_true(
  contract.locked_payroll_direct_delete_denied(),
  'authenticated directly deleted a locked payroll period'
);
DELETE FROM public.enterprise_workspaces
WHERE id = '33333333-3333-4333-8333-333333333333';
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_workspaces
    WHERE id = '33333333-3333-4333-8333-333333333333'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_offices
    WHERE workspace_id = '33333333-3333-4333-8333-333333333333'
       OR id = '33000000-0000-4000-8000-000000000020'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_memberships
    WHERE workspace_id = '33333333-3333-4333-8333-333333333333'
       OR id = '33000000-0000-4000-8000-000000000021'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '33333333-3333-4333-8333-333333333333'
       OR membership_id = '33000000-0000-4000-8000-000000000021'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_audit_events
    WHERE workspace_id = '33333333-3333-4333-8333-333333333333'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.payroll_periods
    WHERE workspace_id = '33333333-3333-4333-8333-333333333333'
       OR id = '33000000-0000-4000-8000-000000000010'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.fixture_workspace_features
    WHERE workspace_id = '33333333-3333-4333-8333-333333333333'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
    FROM public.enterprise_workspaces
    WHERE id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        id = '44000000-0000-4000-8000-000000000020'
      )
    FROM public.enterprise_offices
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        id = '44000000-0000-4000-8000-000000000021'
        AND business_role = 'Control role'
        AND location = 'Control location'
        AND city = 'Control city'
        AND office_id = '44000000-0000-4000-8000-000000000020'
        AND base_working_hours = 7.5
        AND profile_revision = 2
      )
    FROM public.enterprise_memberships
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        membership_id = '44000000-0000-4000-8000-000000000021'
        AND business_role = 'Control role'
        AND percentage = 100
        AND is_priority
      )
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 4
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'membership.profile_updated'
      ) = 2
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'leave_request.admin_override'
      ) = 1
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'payroll.period_locked'
      ) = 1
    FROM public.enterprise_audit_events
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        id = '44000000-0000-4000-8000-000000000010'
        AND status = 'locked'
      )
    FROM public.payroll_periods
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(feature_key = 'members_list' AND enabled)
    FROM public.fixture_workspace_features
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  ),
  'authenticated workspace cascade left profile side effects or changed control rows'
);

SET ROLE service_role;
SELECT contract.assert_true(
  contract.locked_payroll_direct_delete_denied(),
  'service_role directly deleted a locked payroll period'
);
DELETE FROM public.enterprise_workspaces
WHERE id = '55555555-5555-4555-8555-555555555555';
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_workspaces
    WHERE id = '55555555-5555-4555-8555-555555555555'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_offices
    WHERE workspace_id = '55555555-5555-4555-8555-555555555555'
       OR id = '55000000-0000-4000-8000-000000000020'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_memberships
    WHERE workspace_id = '55555555-5555-4555-8555-555555555555'
       OR id = '55000000-0000-4000-8000-000000000021'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '55555555-5555-4555-8555-555555555555'
       OR membership_id = '55000000-0000-4000-8000-000000000021'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.enterprise_audit_events
    WHERE workspace_id = '55555555-5555-4555-8555-555555555555'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.payroll_periods
    WHERE workspace_id = '55555555-5555-4555-8555-555555555555'
       OR id = '55000000-0000-4000-8000-000000000010'
  )
  AND (
    SELECT pg_catalog.count(*) = 0
    FROM public.fixture_workspace_features
    WHERE workspace_id = '55555555-5555-4555-8555-555555555555'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
    FROM public.enterprise_workspaces
    WHERE id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        id = '44000000-0000-4000-8000-000000000020'
      )
    FROM public.enterprise_offices
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        id = '44000000-0000-4000-8000-000000000021'
        AND business_role = 'Control role'
        AND location = 'Control location'
        AND city = 'Control city'
        AND office_id = '44000000-0000-4000-8000-000000000020'
        AND base_working_hours = 7.5
        AND profile_revision = 2
      )
    FROM public.enterprise_memberships
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        membership_id = '44000000-0000-4000-8000-000000000021'
        AND business_role = 'Control role'
        AND percentage = 100
        AND is_priority
      )
    FROM public.enterprise_member_role_allocations
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 4
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'membership.profile_updated'
      ) = 2
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'leave_request.admin_override'
      ) = 1
      AND pg_catalog.count(*) FILTER (
        WHERE action = 'payroll.period_locked'
      ) = 1
    FROM public.enterprise_audit_events
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(
        id = '44000000-0000-4000-8000-000000000010'
        AND status = 'locked'
      )
    FROM public.payroll_periods
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND (
    SELECT pg_catalog.count(*) = 1
      AND pg_catalog.bool_and(feature_key = 'members_list' AND enabled)
    FROM public.fixture_workspace_features
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  ),
  'service-role workspace cascade left profile side effects or changed control rows'
);

SELECT 'member profile atomic save contract passed' AS result;
