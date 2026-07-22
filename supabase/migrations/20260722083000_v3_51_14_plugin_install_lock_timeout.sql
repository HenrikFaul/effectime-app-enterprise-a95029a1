-- v3.51.14 — bound plugin-install lock waits
--
-- marketplace_install_plugin writes the public installation and its private
-- configuration before it acquires the marketplace-plugin row lock used for
-- the final publication recheck and install_count refresh. PostgreSQL rolls
-- those earlier writes back atomically when a statement fails, but without a
-- routine-local lock_timeout a conflicting catalog transaction could leave an
-- API request waiting indefinitely. Attach a five-second timeout to the
-- existing SECURITY DEFINER routine without replacing its body or changing its
-- public API, owner, OID or ACL.
--
-- SET LOCAL also bounds the DDL lock needed by ALTER FUNCTION. A timeout aborts
-- the migration transaction before any catalog change; operators can release
-- the blocker and safely retry the same forward-only migration.

SET LOCAL lock_timeout = '5s';

DO $plugin_install_lock_timeout_preflight$
DECLARE
  v_install_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'
  );
  v_public_schema_oid oid := pg_catalog.to_regnamespace('public');
  v_extensions_schema_oid oid := pg_catalog.to_regnamespace('extensions');
  v_digest_oid oid := pg_catalog.to_regprocedure(
    'extensions.digest(bytea,text)'
  );
  v_pgcrypto_oid oid;
  v_executor_oid oid := CURRENT_USER::pg_catalog.regrole::oid;
  v_owner record;
  v_source_hash text;
  v_install_acl text;
BEGIN
  IF pg_catalog.to_regrole('postgres') IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL
     OR pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION
      'Plugin install lock-timeout boundary requires canonical Supabase roles'
      USING ERRCODE = '55000';
  END IF;

  -- The source hash is meaningful only while public cannot be shadowed and the
  -- qualified digest primitive is still the trusted pgcrypto extension member.
  IF v_public_schema_oid IS NULL OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        namespace.nspacl,
        pg_catalog.acldefault('n', namespace.nspowner)
      )
    ) AS acl
    WHERE namespace.oid = v_public_schema_oid
      AND acl.grantee = 0
      AND acl.privilege_type = 'CREATE'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(
      ARRAY['anon', 'authenticated', 'service_role']
    ) AS role_name(name)
    WHERE pg_catalog.has_schema_privilege(
      role_name.name,
      v_public_schema_oid,
      'CREATE'
    )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname <> 'postgres'
      AND role.rolname <> 'pg_database_owner'
      AND NOT role.rolsuper
      AND NOT role.rolbypassrls
      AND NOT role.rolcreaterole
      AND pg_catalog.has_schema_privilege(
        role.oid,
        v_public_schema_oid,
        'CREATE'
      )
  ) THEN
    RAISE EXCEPTION
      'Plugin install lock-timeout public schema trust contract is unsafe'
      USING ERRCODE = '55000';
  END IF;

  SELECT extension.oid
  INTO v_pgcrypto_oid
  FROM pg_catalog.pg_extension AS extension
  WHERE extension.extname = 'pgcrypto'
    AND extension.extnamespace = v_extensions_schema_oid;

  IF v_extensions_schema_oid IS NULL
     OR v_pgcrypto_oid IS NULL
     OR v_digest_oid IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_depend AS dependency
       WHERE dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
         AND dependency.objid = v_digest_oid
         AND dependency.objsubid = 0
         AND dependency.refclassid =
             'pg_catalog.pg_extension'::pg_catalog.regclass
         AND dependency.refobjid = v_pgcrypto_oid
         AND dependency.deptype = 'e'
     ) THEN
    RAISE EXCEPTION 'Trusted pgcrypto digest contract is required'
      USING ERRCODE = '55000';
  END IF;

  FOR v_owner IN
    SELECT *
    FROM (VALUES
      (
        'extensions schema',
        (
          SELECT namespace.nspowner
          FROM pg_catalog.pg_namespace AS namespace
          WHERE namespace.oid = v_extensions_schema_oid
        )
      ),
      (
        'pgcrypto extension',
        (
          SELECT extension.extowner
          FROM pg_catalog.pg_extension AS extension
          WHERE extension.oid = v_pgcrypto_oid
        )
      ),
      (
        'extensions.digest(bytea,text)',
        (
          SELECT procedure.proowner
          FROM pg_catalog.pg_proc AS procedure
          WHERE procedure.oid = v_digest_oid
        )
      )
    ) AS expected(owner_label, owner_oid)
  LOOP
    IF v_owner.owner_oid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles AS owner_role
      WHERE owner_role.oid = v_owner.owner_oid
        AND (owner_role.oid = v_executor_oid OR owner_role.rolsuper)
    ) THEN
      RAISE EXCEPTION '% owner is not trusted by the migration executor',
        v_owner.owner_label
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_schema_privilege(
       v_executor_oid, v_extensions_schema_oid, 'USAGE'
     ) OR NOT pg_catalog.has_function_privilege(
       v_executor_oid, v_digest_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Migration executor cannot use trusted pgcrypto digest'
      USING ERRCODE = '55000';
  END IF;

  -- Accept only the exact v3.51.13 state or this migration's exact applied
  -- state. Any unrelated routine setting is drift, not something to overwrite.
  IF v_install_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_install_oid
      AND procedure.pronamespace = v_public_schema_oid
      AND procedure.proname = 'marketplace_install_plugin'
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'uuid'::pg_catalog.regtype
      AND procedure.pronargs = 3
      AND procedure.proargtypes[0] = 'uuid'::pg_catalog.regtype::oid
      AND procedure.proargtypes[1] = 'uuid'::pg_catalog.regtype::oid
      AND procedure.proargtypes[2] = 'jsonb'::pg_catalog.regtype::oid
      AND procedure.proargnames =
          ARRAY['_workspace_id', '_plugin_id', '_config']::text[]
      AND procedure.proallargtypes IS NULL
      AND procedure.proargmodes IS NULL
      AND NOT procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.procost = 100
      AND procedure.prorows = 0
      AND procedure.provariadic = 0
      AND procedure.pronargdefaults = 1
      AND pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) =
          '''{}''::jsonb'
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin install RPC contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = v_install_oid
      AND procedure.proconfig IN (
        ARRAY['search_path=pg_catalog']::text[],
        ARRAY['search_path=pg_catalog', 'lock_timeout=5s']::text[]
      )
  ) THEN
    RAISE EXCEPTION 'Plugin install RPC timeout contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  SELECT pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(
               pg_catalog.replace(procedure.prosrc, E'\r\n', E'\n'),
               'UTF8'
             ),
             'sha256'
           ),
           'hex'
         ),
         procedure.proacl::text
  INTO v_source_hash, v_install_acl
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_install_oid;

  IF v_source_hash <>
     '7a3a8c82b510c0f71de0219bf703aac8385e7ce6ca78b48f591840ff89ab7da7' THEN
    RAISE EXCEPTION 'Plugin install RPC source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  IF v_install_acl IS NULL OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_install_oid
      AND (
        acl.privilege_type <> 'EXECUTE'
        OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
        OR acl.grantee NOT IN (
          'postgres'::pg_catalog.regrole::oid,
          'authenticated'::pg_catalog.regrole::oid,
          'service_role'::pg_catalog.regrole::oid
        )
        OR (
          acl.grantee <> 'postgres'::pg_catalog.regrole::oid
          AND acl.is_grantable
        )
      )
  ) OR pg_catalog.has_function_privilege(
       'anon', v_install_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_install_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_install_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin install RPC ACL contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_14_install_oid',
    v_install_oid::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_14_install_acl',
    v_install_acl,
    true
  );
END;
$plugin_install_lock_timeout_preflight$;

ALTER FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb)
  SET lock_timeout = '5s';

DO $plugin_install_lock_timeout_postcondition$
DECLARE
  v_install_oid oid :=
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'::
      pg_catalog.regprocedure::oid;
  v_expected_oid oid := pg_catalog.current_setting(
    'effectime_migration.v3_51_14_install_oid'
  )::oid;
  v_expected_acl text := pg_catalog.current_setting(
    'effectime_migration.v3_51_14_install_acl'
  );
  v_source_hash text;
BEGIN
  IF v_install_oid <> v_expected_oid THEN
    RAISE EXCEPTION 'Plugin install RPC OID changed unexpectedly'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_install_oid
      AND procedure.pronamespace = 'public'::pg_catalog.regnamespace::oid
      AND procedure.proname = 'marketplace_install_plugin'
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'uuid'::pg_catalog.regtype
      AND procedure.pronargs = 3
      AND procedure.proargtypes[0] = 'uuid'::pg_catalog.regtype::oid
      AND procedure.proargtypes[1] = 'uuid'::pg_catalog.regtype::oid
      AND procedure.proargtypes[2] = 'jsonb'::pg_catalog.regtype::oid
      AND procedure.proargnames =
          ARRAY['_workspace_id', '_plugin_id', '_config']::text[]
      AND procedure.proallargtypes IS NULL
      AND procedure.proargmodes IS NULL
      AND NOT procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.procost = 100
      AND procedure.prorows = 0
      AND procedure.provariadic = 0
      AND procedure.pronargdefaults = 1
      AND pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) =
          '''{}''::jsonb'
      AND procedure.proconfig =
          ARRAY['search_path=pg_catalog', 'lock_timeout=5s']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin install RPC postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF (
    SELECT procedure.proacl::text
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = v_install_oid
  ) IS DISTINCT FROM v_expected_acl OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_install_oid
      AND (
        acl.privilege_type <> 'EXECUTE'
        OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
        OR acl.grantee NOT IN (
          'postgres'::pg_catalog.regrole::oid,
          'authenticated'::pg_catalog.regrole::oid,
          'service_role'::pg_catalog.regrole::oid
        )
        OR (
          acl.grantee <> 'postgres'::pg_catalog.regrole::oid
          AND acl.is_grantable
        )
      )
  ) OR pg_catalog.has_function_privilege(
       'anon', v_install_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_install_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_install_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin install RPC ACL postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  SELECT pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(
               pg_catalog.replace(procedure.prosrc, E'\r\n', E'\n'),
               'UTF8'
             ),
             'sha256'
           ),
           'hex'
         )
  INTO v_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_install_oid;

  IF v_source_hash <>
     '7a3a8c82b510c0f71de0219bf703aac8385e7ce6ca78b48f591840ff89ab7da7' THEN
    RAISE EXCEPTION 'Plugin install RPC source changed unexpectedly'
      USING ERRCODE = '55000';
  END IF;
END;
$plugin_install_lock_timeout_postcondition$;
