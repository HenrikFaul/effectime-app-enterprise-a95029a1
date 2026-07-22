-- v3.51.12 — plugin installation policy boundary
--
-- Future installs and reinstalls must be both entitled and sourced from the
-- published marketplace. Existing installations are intentionally left
-- untouched and remain uninstallable through the unchanged uninstall RPC.
-- The marketplace row is first checked without a lock, then locked and
-- revalidated after the installation upsert. This installation -> plugin lock
-- order matches uninstall and avoids an install-vs-uninstall lock inversion.
-- FOR NO KEY UPDATE is deliberately compatible with the FK KEY SHARE lock held
-- by concurrent installation inserts, while still serializing status/count
-- updates. Any failed revalidation rolls the public and private writes back.

DO $plugin_install_policy_preflight$
DECLARE
  v_install_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'
  );
  v_uninstall_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_uninstall_plugin(uuid)'
  );
  v_status_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_set_plugin_status(uuid,text)'
  );
  v_feature_gate_oid oid := pg_catalog.to_regprocedure(
    'public.workspace_has_any_feature(uuid,text[])'
  );
  v_membership_oid oid := pg_catalog.to_regprocedure(
    'public.is_enterprise_member(uuid,uuid)'
  );
  v_owner_helper_oid oid := pg_catalog.to_regprocedure(
    'public.has_enterprise_role(uuid,uuid,public.enterprise_role[])'
  );
  v_tenant_features_oid oid := pg_catalog.to_regprocedure(
    'public.tenant_enabled_features(uuid)'
  );
  v_marketplace_oid oid := pg_catalog.to_regclass(
    'public.marketplace_plugins'
  );
  v_workspaces_oid oid := pg_catalog.to_regclass(
    'public.enterprise_workspaces'
  );
  v_installations_oid oid := pg_catalog.to_regclass(
    'public.workspace_installed_plugins'
  );
  v_private_configs_oid oid := pg_catalog.to_regclass(
    'effectime_private.workspace_plugin_configs'
  );
  v_public_schema_oid oid := pg_catalog.to_regnamespace('public');
  v_extensions_schema_oid oid := pg_catalog.to_regnamespace('extensions');
  v_pgcrypto_oid oid;
  v_digest_oid oid := pg_catalog.to_regprocedure(
    'extensions.digest(bytea,text)'
  );
  v_executor_oid oid := CURRENT_USER::pg_catalog.regrole::oid;
  v_owner record;
  v_column record;
  v_source_hash text;
BEGIN
  IF pg_catalog.to_regrole('postgres') IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL
     OR pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'Plugin install policy requires canonical Supabase roles'
      USING ERRCODE = '55000';
  END IF;

  -- SECURITY DEFINER helpers in the entitlement chain use public in their
  -- fixed search_path. Refuse the migration if a browser/service principal,
  -- PUBLIC, or another non-administrative role can create shadow objects there.
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
      'Plugin install policy public schema trust contract is unsafe'
      USING ERRCODE = '55000';
  END IF;

  -- Every source attestation below depends on this exact extension-owned
  -- digest primitive. Check the schema, extension membership and all owners
  -- before invoking it, rather than trusting a same-named replacement.
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

  IF v_marketplace_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_marketplace_oid
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::pg_catalog.regrole::oid
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_marketplace_oid
      AND attribute.attname = 'id'
      AND attribute.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute.attnotnull
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_marketplace_oid
      AND constraint_record.contype = 'p'
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_marketplace_oid
            AND attribute.attname = 'id'
        )
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Plugin marketplace table contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = v_marketplace_oid
      AND attribute.attname = 'status'
      AND attribute.atttypid = 'text'::pg_catalog.regtype
      AND attribute.attnotnull
      AND pg_catalog.pg_get_expr(
        default_value.adbin,
        default_value.adrelid,
        true
      ) = '''pending''::text'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_marketplace_oid
      AND constraint_record.conname = 'marketplace_plugins_status_check'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
      AND NOT constraint_record.connoinherit
      AND pg_catalog.pg_get_expr(
        constraint_record.conbin,
        constraint_record.conrelid,
        true
      ) =
        'status = ANY (ARRAY[''pending''::text, ''approved''::text, ''published''::text, ''rejected''::text, ''archived''::text])'
  ) THEN
    RAISE EXCEPTION 'Plugin marketplace status contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = v_marketplace_oid
      AND attribute.attname = 'install_count'
      AND attribute.atttypid = 'integer'::pg_catalog.regtype
      AND attribute.attnotnull
      AND pg_catalog.pg_get_expr(
        default_value.adbin,
        default_value.adrelid,
        true
      ) = '0'
  ) THEN
    RAISE EXCEPTION 'Plugin marketplace install-count contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_status_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_status_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'jsonb'::pg_catalog.regtype
      AND procedure.proargnames = ARRAY['_plugin_id', '_status']::text[]
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin status RPC contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_status_oid
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
  ) OR pg_catalog.has_function_privilege('anon', v_status_oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_status_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_status_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin status RPC ACL contract is incompatible'
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
  WHERE procedure.oid = v_status_oid;

  IF v_source_hash <>
     '5f41a3987681da3e56101d6c634c084cd204dea2b0c17bc59f5a3b83780713e2' THEN
    RAISE EXCEPTION 'Plugin status RPC source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  IF v_install_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_install_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'uuid'::pg_catalog.regtype
      AND procedure.proargnames =
          ARRAY['_workspace_id', '_plugin_id', '_config']::text[]
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 1
      AND pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) =
          '''{}''::jsonb'
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin install RPC contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
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
  ) OR pg_catalog.has_function_privilege('anon', v_install_oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_install_oid, 'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role', v_install_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin install RPC ACL contract is incompatible'
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

  IF v_source_hash NOT IN (
    '066aee1a7f0047accbb27594e46ad7dff70457b2436b942686547e316ee3e9b7',
    '7a3a8c82b510c0f71de0219bf703aac8385e7ce6ca78b48f591840ff89ab7da7'
  ) THEN
    RAISE EXCEPTION 'Plugin install RPC source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  IF v_uninstall_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_uninstall_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'jsonb'::pg_catalog.regtype
      AND procedure.proargnames = ARRAY['_installed_id']::text[]
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin uninstall RPC contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_uninstall_oid
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
  ) OR pg_catalog.has_function_privilege('anon', v_uninstall_oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_uninstall_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_uninstall_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin uninstall RPC ACL contract is incompatible'
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
  WHERE procedure.oid = v_uninstall_oid;

  IF v_source_hash <>
     '413149bad9e87560a846ebbf8b3ec77ee4abe481462593de7972c1bc63e262c5' THEN
    RAISE EXCEPTION 'Plugin uninstall RPC source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  IF v_feature_gate_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_feature_gate_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'boolean'::pg_catalog.regtype
      AND procedure.proargnames =
          ARRAY['_workspace_id', '_feature_keys']::text[]
      AND procedure.prosecdef
      AND NOT procedure.proretset
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 's'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig =
          ARRAY['search_path=pg_catalog, public']::text[]
      AND language.lanname = 'sql'
  ) THEN
    RAISE EXCEPTION 'Workspace feature gate contract is incompatible'
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
  WHERE procedure.oid = v_feature_gate_oid;

  IF v_source_hash <>
     '7546df77fb5c36e34f3d9fd0d0ca5cb0236ae9b1d3340934464e3a62d28e82ff' THEN
    RAISE EXCEPTION 'Workspace feature gate source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_feature_gate_oid
      AND (
        acl.privilege_type <> 'EXECUTE'
        OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
        OR acl.grantee NOT IN (
          'postgres'::pg_catalog.regrole::oid,
          'authenticated'::pg_catalog.regrole::oid
        )
        OR (
          acl.grantee = 'authenticated'::pg_catalog.regrole::oid
          AND acl.is_grantable
        )
      )
  ) OR pg_catalog.has_function_privilege(
       'anon', v_feature_gate_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_feature_gate_oid, 'EXECUTE'
     ) OR pg_catalog.has_function_privilege(
       'service_role', v_feature_gate_oid, 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Workspace feature gate ACL contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_owner_helper_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_owner_helper_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'boolean'::pg_catalog.regtype
      AND procedure.proargnames =
          ARRAY['_workspace_id', '_user_id', '_roles']::text[]
      AND NOT procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 's'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=public']::text[]
      AND language.lanname = 'sql'
  ) THEN
    RAISE EXCEPTION 'Plugin owner helper contract is incompatible'
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
  WHERE procedure.oid = v_owner_helper_oid;

  IF v_source_hash <>
     'fb12a2fed0d5f1433e472cf7e92367e7345a2e1f7974fcdf4a21e40b0f5dd739' THEN
    RAISE EXCEPTION 'Plugin owner helper source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_owner_helper_oid
      AND (
        acl.privilege_type <> 'EXECUTE'
        OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
        OR acl.grantee NOT IN (
          0,
          'postgres'::pg_catalog.regrole::oid
        )
        OR acl.is_grantable
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_owner_helper_oid
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Plugin owner helper ACL contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_membership_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_membership_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'boolean'::pg_catalog.regtype
      AND procedure.proargnames =
          ARRAY['_workspace_id', '_user_id']::text[]
      AND NOT procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 's'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=public']::text[]
      AND language.lanname = 'sql'
  ) THEN
    RAISE EXCEPTION 'Plugin entitlement helper contract is incompatible: membership'
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
  WHERE procedure.oid = v_membership_oid;

  IF v_source_hash <>
     '8d243d1fcf21f7b78123648b9309344213873dbef579826b1fe9470867d9a4d2' THEN
    RAISE EXCEPTION
      'Plugin entitlement helper source attestation failed: membership'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_membership_oid
      AND (
        acl.privilege_type <> 'EXECUTE'
        OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
        OR acl.grantee NOT IN (
          0,
          'postgres'::pg_catalog.regrole::oid
        )
        OR acl.is_grantable
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_membership_oid
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Plugin entitlement helper ACL contract is incompatible: membership'
      USING ERRCODE = '55000';
  END IF;

  IF v_tenant_features_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_tenant_features_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'record'::pg_catalog.regtype
      AND procedure.proargnames =
          ARRAY['_tenant_id', 'feature_key', 'source']::text[]
      AND procedure.proargmodes = ARRAY[
        'i'::"char", 't'::"char", 't'::"char"
      ]
      AND procedure.proallargtypes = ARRAY[
        'uuid'::pg_catalog.regtype::oid,
        'text'::pg_catalog.regtype::oid,
        'text'::pg_catalog.regtype::oid
      ]::oid[]
      AND procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 's'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=public']::text[]
      AND pg_catalog.pg_get_function_result(procedure.oid) =
          'TABLE(feature_key text, source text)'
      AND language.lanname = 'sql'
  ) THEN
    RAISE EXCEPTION
      'Plugin entitlement helper contract is incompatible: tenant features'
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
  WHERE procedure.oid = v_tenant_features_oid;

  IF v_source_hash <>
     '0b1b293807efb8617fd47804df9bb49af0cdc7bba553ae6daae1c68e28d163c2' THEN
    RAISE EXCEPTION
      'Plugin entitlement helper source attestation failed: tenant features'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid = v_tenant_features_oid
      AND (
        acl.privilege_type <> 'EXECUTE'
        OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
        OR acl.grantee NOT IN (
          'postgres'::pg_catalog.regrole::oid,
          'service_role'::pg_catalog.regrole::oid
        )
        OR (
          acl.grantee = 'service_role'::pg_catalog.regrole::oid
          AND acl.is_grantable
        )
      )
  ) OR pg_catalog.has_function_privilege(
       'anon', v_tenant_features_oid, 'EXECUTE'
     ) OR pg_catalog.has_function_privilege(
       'authenticated', v_tenant_features_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_tenant_features_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION
      'Plugin entitlement helper ACL contract is incompatible: tenant features'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.features AS feature
    WHERE feature.feature_key = 'plugin_install'
      AND feature.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Plugin install feature catalog contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_installations_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_installations_oid
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::pg_catalog.regrole::oid
  ) THEN
    RAISE EXCEPTION 'Plugin installation runtime schema is incompatible'
      USING ERRCODE = '55000';
  END IF;

  FOR v_column IN
    SELECT *
    FROM (VALUES
      (
        'id', 'uuid'::pg_catalog.regtype::oid, true,
        'gen_random_uuid()'::text
      ),
      ('workspace_id', 'uuid'::pg_catalog.regtype::oid, true, NULL::text),
      ('plugin_id', 'uuid'::pg_catalog.regtype::oid, true, NULL::text),
      ('config', 'jsonb'::pg_catalog.regtype::oid, true, '''{}''::jsonb'),
      ('enabled', 'boolean'::pg_catalog.regtype::oid, true, 'true'),
      (
        'installed_at', 'timestamptz'::pg_catalog.regtype::oid, true,
        'now()'
      ),
      ('installed_by', 'uuid'::pg_catalog.regtype::oid, false, NULL::text),
      (
        'updated_at', 'timestamptz'::pg_catalog.regtype::oid, true,
        'now()'
      )
    ) AS expected(
      column_name,
      type_oid,
      not_null,
      default_expression
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = v_installations_oid
        AND attribute.attname = v_column.column_name
        AND attribute.atttypid = v_column.type_oid
        AND attribute.attnotnull = v_column.not_null
        AND attribute.attidentity = ''
        AND attribute.attgenerated = ''
        AND (
          SELECT pg_catalog.pg_get_expr(
            default_value.adbin,
            default_value.adrelid,
            true
          )
          FROM pg_catalog.pg_attrdef AS default_value
          WHERE default_value.adrelid = attribute.attrelid
            AND default_value.adnum = attribute.attnum
        ) IS NOT DISTINCT FROM v_column.default_expression
    ) THEN
      RAISE EXCEPTION
        'Plugin installation runtime schema is incompatible: column %',
        v_column.column_name
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_installations_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attname NOT IN (
        'id', 'workspace_id', 'plugin_id', 'config', 'enabled',
        'installed_at', 'installed_by', 'updated_at'
      )
      AND attribute.attnotnull
      AND attribute.attidentity = ''
      AND attribute.attgenerated = ''
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attrdef AS default_value
        WHERE default_value.adrelid = attribute.attrelid
          AND default_value.adnum = attribute.attnum
      )
  ) THEN
    RAISE EXCEPTION
      'Plugin installation runtime schema has an unsupported required column'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_installations_oid
      AND constraint_record.contype = 'p'
      AND constraint_record.convalidated
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_installations_oid
            AND attribute.attname = 'id'
        )
      ]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_installations_oid
      AND constraint_record.contype = 'u'
      AND constraint_record.convalidated
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_installations_oid
            AND attribute.attname = 'workspace_id'
        ),
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_installations_oid
            AND attribute.attname = 'plugin_id'
        )
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Plugin installation key contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_workspaces_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_installations_oid
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.confrelid = v_workspaces_oid
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_installations_oid
            AND attribute.attname = 'workspace_id'
        )
      ]::smallint[]
      AND constraint_record.confkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_workspaces_oid
            AND attribute.attname = 'id'
        )
      ]::smallint[]
      AND constraint_record.confupdtype = 'a'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.confmatchtype = 's'
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
          'FOREIGN KEY (workspace_id) REFERENCES enterprise_workspaces(id) ON DELETE CASCADE'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_installations_oid
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.confrelid = v_marketplace_oid
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_installations_oid
            AND attribute.attname = 'plugin_id'
        )
      ]::smallint[]
      AND constraint_record.confkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_marketplace_oid
            AND attribute.attname = 'id'
        )
      ]::smallint[]
      AND constraint_record.confupdtype = 'a'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.confmatchtype = 's'
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
          'FOREIGN KEY (plugin_id) REFERENCES marketplace_plugins(id) ON DELETE CASCADE'
  ) THEN
    RAISE EXCEPTION 'Plugin installation runtime schema is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_private_configs_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_private_configs_oid
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::pg_catalog.regrole::oid
      AND relation.relrowsecurity
      AND NOT relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Plugin private config runtime schema is incompatible'
      USING ERRCODE = '55000';
  END IF;

  FOR v_column IN
    SELECT *
    FROM (VALUES
      (
        'installed_plugin_id', 'uuid'::pg_catalog.regtype::oid, true,
        NULL::text
      ),
      ('raw_config', 'jsonb'::pg_catalog.regtype::oid, true, NULL::text),
      (
        'created_at', 'timestamptz'::pg_catalog.regtype::oid, true,
        'now()'
      ),
      (
        'updated_at', 'timestamptz'::pg_catalog.regtype::oid, true,
        'now()'
      )
    ) AS expected(
      column_name,
      type_oid,
      not_null,
      default_expression
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = v_private_configs_oid
        AND attribute.attname = v_column.column_name
        AND attribute.atttypid = v_column.type_oid
        AND attribute.attnotnull = v_column.not_null
        AND attribute.attidentity = ''
        AND attribute.attgenerated = ''
        AND (
          SELECT pg_catalog.pg_get_expr(
            default_value.adbin,
            default_value.adrelid,
            true
          )
          FROM pg_catalog.pg_attrdef AS default_value
          WHERE default_value.adrelid = attribute.attrelid
            AND default_value.adnum = attribute.attnum
        ) IS NOT DISTINCT FROM v_column.default_expression
    ) THEN
      RAISE EXCEPTION
        'Plugin private config runtime schema is incompatible: column %',
        v_column.column_name
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_private_configs_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attname NOT IN (
        'installed_plugin_id', 'raw_config', 'created_at', 'updated_at'
      )
      AND attribute.attnotnull
      AND attribute.attidentity = ''
      AND attribute.attgenerated = ''
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attrdef AS default_value
        WHERE default_value.adrelid = attribute.attrelid
          AND default_value.adnum = attribute.attnum
      )
  ) THEN
    RAISE EXCEPTION
      'Plugin private config runtime schema has an unsupported required column'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_private_configs_oid
      AND constraint_record.contype = 'p'
      AND constraint_record.convalidated
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_private_configs_oid
            AND attribute.attname = 'installed_plugin_id'
        )
      ]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_private_configs_oid
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.confrelid = v_installations_oid
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_private_configs_oid
            AND attribute.attname = 'installed_plugin_id'
        )
      ]::smallint[]
      AND constraint_record.confkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_installations_oid
            AND attribute.attname = 'id'
        )
      ]::smallint[]
      AND constraint_record.confupdtype = 'a'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.confmatchtype = 's'
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
          'FOREIGN KEY (installed_plugin_id) REFERENCES workspace_installed_plugins(id) ON DELETE CASCADE'
  ) THEN
    RAISE EXCEPTION 'Plugin private config key contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_installations_oid IS NULL OR v_private_configs_oid IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_constraint AS constraint_record
       WHERE constraint_record.conrelid = v_installations_oid
         AND constraint_record.conname =
             'workspace_installed_plugins_public_config_redacted_check'
         AND constraint_record.contype = 'c'
         AND constraint_record.convalidated
         AND pg_catalog.pg_get_expr(
           constraint_record.conbin,
           constraint_record.conrelid,
           true
         ) = 'config = ''{}''::jsonb'
     ) OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_trigger AS trigger_record
       WHERE trigger_record.tgrelid = v_installations_oid
         AND trigger_record.tgname = 'trg_workspace_plugin_config_totality'
         AND NOT trigger_record.tgisinternal
         AND trigger_record.tgenabled = 'O'
         AND trigger_record.tgfoid =
             'effectime_private.ensure_workspace_plugin_config_v1()'::
               pg_catalog.regprocedure::oid
     ) THEN
    RAISE EXCEPTION 'Plugin configuration boundary contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    LEFT JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE installation.config IS DISTINCT FROM '{}'::jsonb
       OR private_config.installed_plugin_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM effectime_private.workspace_plugin_configs AS private_config
    LEFT JOIN public.workspace_installed_plugins AS installation
      ON installation.id = private_config.installed_plugin_id
    WHERE installation.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Plugin configuration boundary totality drift detected'
      USING ERRCODE = '55000';
  END IF;

  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_12_install_oid',
    v_install_oid::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_12_uninstall_oid',
    v_uninstall_oid::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_12_status_oid',
    v_status_oid::text,
    true
  );
END;
$plugin_install_policy_preflight$;

CREATE OR REPLACE FUNCTION public.marketplace_install_plugin(
  _workspace_id uuid,
  _plugin_id uuid,
  _config jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_caller uuid;
  v_install_id uuid;
  v_installed_at timestamptz;
  v_updated_at timestamptz;
  v_status text;
  v_raw_config jsonb;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_enterprise_role(
    _workspace_id,
    v_caller,
    ARRAY['owner'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Forbidden: workspace owner required';
  END IF;

  IF public.workspace_has_any_feature(
    _workspace_id,
    ARRAY['plugin_install']
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Plugin installation feature is not enabled for this workspace'
      USING ERRCODE = '42501';
  END IF;

  SELECT plugin.status
  INTO v_status
  FROM public.marketplace_plugins AS plugin
  WHERE plugin.id = _plugin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plugin not found';
  END IF;
  IF v_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Plugin not available for install (status=%)', v_status;
  END IF;

  v_raw_config := COALESCE(_config, '{}'::jsonb);

  INSERT INTO public.workspace_installed_plugins (
    workspace_id,
    plugin_id,
    config,
    installed_by
  ) VALUES (
    _workspace_id,
    _plugin_id,
    '{}'::jsonb,
    v_caller
  )
  ON CONFLICT (workspace_id, plugin_id) DO UPDATE
    SET config = '{}'::jsonb,
        enabled = true,
        installed_by = v_caller
  RETURNING id, installed_at, updated_at
  INTO v_install_id, v_installed_at, v_updated_at;

  INSERT INTO effectime_private.workspace_plugin_configs (
    installed_plugin_id,
    raw_config,
    created_at,
    updated_at
  ) VALUES (
    v_install_id,
    v_raw_config,
    v_installed_at,
    v_updated_at
  )
  ON CONFLICT (installed_plugin_id) DO UPDATE
    SET raw_config = EXCLUDED.raw_config,
        updated_at = EXCLUDED.updated_at;

  -- Uninstall locks/deletes the installation before updating the plugin row.
  -- Keep that same lock order here. FOR NO KEY UPDATE remains compatible with
  -- concurrent installers' FK KEY SHARE locks, but conflicts with status and
  -- install_count updates, so publication stays stable through commit without
  -- a concurrent install lock-upgrade deadlock.
  SELECT plugin.status
  INTO v_status
  FROM public.marketplace_plugins AS plugin
  WHERE plugin.id = _plugin_id
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plugin not found';
  END IF;
  IF v_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Plugin not available for install (status=%)', v_status;
  END IF;

  UPDATE public.marketplace_plugins AS plugin
  SET install_count = (
    SELECT pg_catalog.count(*)
    FROM public.workspace_installed_plugins AS installation
    WHERE installation.plugin_id = _plugin_id
      AND installation.enabled = true
  )
  WHERE plugin.id = _plugin_id;

  RETURN v_install_id;
END;
$function$;

DO $plugin_install_policy_postcondition$
DECLARE
  v_install_oid oid :=
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'::
      pg_catalog.regprocedure::oid;
  v_uninstall_oid oid :=
    'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid;
  v_status_oid oid :=
    'public.marketplace_set_plugin_status(uuid,text)'::
      pg_catalog.regprocedure::oid;
  v_expected_install_oid oid := pg_catalog.current_setting(
    'effectime_migration.v3_51_12_install_oid'
  )::oid;
  v_expected_uninstall_oid oid := pg_catalog.current_setting(
    'effectime_migration.v3_51_12_uninstall_oid'
  )::oid;
  v_expected_status_oid oid := pg_catalog.current_setting(
    'effectime_migration.v3_51_12_status_oid'
  )::oid;
  v_source_hash text;
BEGIN
  IF v_install_oid <> v_expected_install_oid THEN
    RAISE EXCEPTION 'Plugin install RPC OID changed unexpectedly'
      USING ERRCODE = '55000';
  END IF;
  IF v_uninstall_oid <> v_expected_uninstall_oid THEN
    RAISE EXCEPTION 'Plugin uninstall RPC OID changed unexpectedly'
      USING ERRCODE = '55000';
  END IF;
  IF v_status_oid <> v_expected_status_oid THEN
    RAISE EXCEPTION 'Plugin status RPC OID changed unexpectedly'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_status_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'jsonb'::pg_catalog.regtype
      AND procedure.proargnames = ARRAY['_plugin_id', '_status']::text[]
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin status RPC postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid IN (v_status_oid, v_uninstall_oid)
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
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(ARRAY[v_status_oid, v_uninstall_oid]) AS routine(oid)
    WHERE pg_catalog.has_function_privilege('anon', routine.oid, 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege(
         'authenticated', routine.oid, 'EXECUTE'
       )
       OR NOT pg_catalog.has_function_privilege(
         'service_role', routine.oid, 'EXECUTE'
       )
  ) THEN
    RAISE EXCEPTION 'Plugin status/uninstall RPC ACL postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_install_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'uuid'::pg_catalog.regtype
      AND procedure.proargnames =
          ARRAY['_workspace_id', '_plugin_id', '_config']::text[]
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.pronargdefaults = 1
      AND pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) =
          '''{}''::jsonb'
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin install RPC postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
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
  ) OR pg_catalog.has_function_privilege('anon', v_install_oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_install_oid, 'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
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
    RAISE EXCEPTION 'Plugin install RPC source postcondition failed'
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
  WHERE procedure.oid = v_uninstall_oid;

  IF v_source_hash <>
     '413149bad9e87560a846ebbf8b3ec77ee4abe481462593de7972c1bc63e262c5' THEN
    RAISE EXCEPTION 'Plugin uninstall RPC changed unexpectedly'
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
  WHERE procedure.oid = v_status_oid;

  IF v_source_hash <>
     '5f41a3987681da3e56101d6c634c084cd204dea2b0c17bc59f5a3b83780713e2' THEN
    RAISE EXCEPTION 'Plugin status RPC changed unexpectedly'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    LEFT JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE installation.config IS DISTINCT FROM '{}'::jsonb
       OR private_config.installed_plugin_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM effectime_private.workspace_plugin_configs AS private_config
    LEFT JOIN public.workspace_installed_plugins AS installation
      ON installation.id = private_config.installed_plugin_id
    WHERE installation.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Plugin configuration boundary postcondition failed'
      USING ERRCODE = '55000';
  END IF;
END;
$plugin_install_policy_postcondition$;
