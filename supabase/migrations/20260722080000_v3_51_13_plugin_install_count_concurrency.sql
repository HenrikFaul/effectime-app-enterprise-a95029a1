-- v3.51.13 — plugin install-count concurrency boundary
--
-- The historical uninstall routine deleted the installation and then started
-- one UPDATE statement whose SET subquery counted enabled installations. At
-- READ COMMITTED, that statement kept the snapshot taken before it waited for
-- a concurrent install transaction's plugin-row lock. After the installer
-- committed, the waiting UPDATE could therefore overwrite install_count with a
-- count that did not include the newly committed installation.
--
-- Preserve the established installation -> plugin lock order. After deleting
-- the installation, acquire the plugin row with FOR NO KEY UPDATE in its own
-- statement. The following UPDATE gets a fresh READ COMMITTED snapshot, so it
-- sees any installer that committed while the lock statement was waiting.
-- Reconcile any count made stale before this fix while both runtime tables are
-- write-paused in the same installation -> marketplace order. The bounded
-- transaction-local lock timeout is fail-closed: a timeout aborts and rolls
-- back the whole migration. Operators must establish a maintenance write pause
-- and retry; the migration never continues with a partial reconciliation.

DO $plugin_install_count_preflight$
DECLARE
  v_install_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'
  );
  v_uninstall_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_uninstall_plugin(uuid)'
  );
  v_feature_gate_oid oid := pg_catalog.to_regprocedure(
    'public.workspace_has_any_feature(uuid,text[])'
  );
  v_owner_helper_oid oid := pg_catalog.to_regprocedure(
    'public.has_enterprise_role(uuid,uuid,public.enterprise_role[])'
  );
  v_membership_oid oid := pg_catalog.to_regprocedure(
    'public.is_enterprise_member(uuid,uuid)'
  );
  v_tenant_features_oid oid := pg_catalog.to_regprocedure(
    'public.tenant_enabled_features(uuid)'
  );
  v_ensure_config_oid oid := pg_catalog.to_regprocedure(
    'effectime_private.ensure_workspace_plugin_config_v1()'
  );
  v_config_getter_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_get_plugin_config_service_v1(uuid,uuid)'
  );
  v_marketplace_oid oid := pg_catalog.to_regclass(
    'public.marketplace_plugins'
  );
  v_installations_oid oid := pg_catalog.to_regclass(
    'public.workspace_installed_plugins'
  );
  v_private_configs_oid oid := pg_catalog.to_regclass(
    'effectime_private.workspace_plugin_configs'
  );
  v_workspaces_oid oid := pg_catalog.to_regclass(
    'public.enterprise_workspaces'
  );
  v_public_schema_oid oid := pg_catalog.to_regnamespace('public');
  v_extensions_schema_oid oid := pg_catalog.to_regnamespace('extensions');
  v_digest_oid oid := pg_catalog.to_regprocedure(
    'extensions.digest(bytea,text)'
  );
  v_pgcrypto_oid oid;
  v_executor_oid oid := CURRENT_USER::pg_catalog.regrole::oid;
  v_owner record;
  v_column record;
  v_expected record;
  v_source_hash text;
  v_uninstall_acl text;
BEGIN
  IF pg_catalog.to_regrole('postgres') IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL
     OR pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION
      'Plugin install-count concurrency boundary requires canonical Supabase roles'
      USING ERRCODE = '55000';
  END IF;

  -- Source hashes are security evidence only if neither the hashed schema nor
  -- the digest primitive can be shadowed by an untrusted principal.
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
      'Plugin install-count public schema trust contract is unsafe'
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
      AND constraint_record.convalidated
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_marketplace_oid
            AND attribute.attname = 'id'
        )
      ]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = v_marketplace_oid
      AND attribute.attname = 'install_count'
      AND attribute.atttypid = 'integer'::pg_catalog.regtype
      AND attribute.attnotnull
      AND attribute.attidentity = ''
      AND attribute.attgenerated = ''
      AND pg_catalog.pg_get_expr(
        default_value.adbin,
        default_value.adrelid,
        true
      ) = '0'
  ) THEN
    RAISE EXCEPTION 'Plugin marketplace install-count schema is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_installations_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_installations_oid
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::pg_catalog.regrole::oid
      AND relation.relrowsecurity
      AND NOT relation.relforcerowsecurity
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
      AND constraint_record.confdeltype = 'c'
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
      AND constraint_record.confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'Plugin installation foreign-key contract is incompatible'
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
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_private_configs_oid
      AND attribute.attname = 'installed_plugin_id'
      AND attribute.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute.attnotnull
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_private_configs_oid
      AND attribute.attname = 'raw_config'
      AND attribute.atttypid = 'jsonb'::pg_catalog.regtype
      AND attribute.attnotnull
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_private_configs_oid
      AND constraint_record.contype = 'p'
      AND constraint_record.convalidated
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
      AND constraint_record.confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'Plugin private config boundary schema is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
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
      AND trigger_record.tgfoid = v_ensure_config_oid
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
      AND NOT procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.procost = 100
      AND procedure.prorows = 0
      AND procedure.pronargdefaults = 1
      AND pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) =
          '''{}''::jsonb'
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin install RPC contract is incompatible'
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
      AND NOT procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.procost = 100
      AND procedure.prorows = 0
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin uninstall RPC contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  -- Preserve the exact shipped browser/service ACL. CREATE OR REPLACE keeps it;
  -- the postcondition also compares its canonical catalog representation.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid IN (v_install_oid, v_uninstall_oid)
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
    FROM pg_catalog.unnest(
      ARRAY[v_install_oid, v_uninstall_oid]
    ) AS routine(oid)
    WHERE pg_catalog.has_function_privilege('anon', routine.oid, 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege(
         'authenticated', routine.oid, 'EXECUTE'
       )
       OR NOT pg_catalog.has_function_privilege(
         'service_role', routine.oid, 'EXECUTE'
       )
  ) THEN
    RAISE EXCEPTION 'Plugin install/uninstall RPC ACL contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  FOR v_expected IN
    SELECT *
    FROM (VALUES
      (
        v_install_oid,
        '7a3a8c82b510c0f71de0219bf703aac8385e7ce6ca78b48f591840ff89ab7da7',
        'Plugin install RPC'
      ),
      (
        v_feature_gate_oid,
        '7546df77fb5c36e34f3d9fd0d0ca5cb0236ae9b1d3340934464e3a62d28e82ff',
        'Workspace feature gate'
      ),
      (
        v_owner_helper_oid,
        'fb12a2fed0d5f1433e472cf7e92367e7345a2e1f7974fcdf4a21e40b0f5dd739',
        'Plugin owner helper'
      ),
      (
        v_membership_oid,
        '8d243d1fcf21f7b78123648b9309344213873dbef579826b1fe9470867d9a4d2',
        'Plugin membership helper'
      ),
      (
        v_tenant_features_oid,
        '0b1b293807efb8617fd47804df9bb49af0cdc7bba553ae6daae1c68e28d163c2',
        'Plugin tenant-feature helper'
      ),
      (
        v_ensure_config_oid,
        'a7fd0b2c4e1444ccffedcac48b934755aa9c83fc28cda5e1a3f1412500c35da9',
        'Plugin config totality helper'
      ),
      (
        v_config_getter_oid,
        'b8db83002636fc32ea126c4f68191ead7e853123ed93797101e11c703b9ad4b8',
        'Plugin config service getter'
      )
    ) AS expected(routine_oid, source_hash, label)
  LOOP
    IF v_expected.routine_oid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid = v_expected.routine_oid
        AND procedure.prokind = 'f'
        AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
        AND NOT procedure.proleakproof
    ) THEN
      RAISE EXCEPTION '% contract is incompatible', v_expected.label
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
    WHERE procedure.oid = v_expected.routine_oid;

    IF v_source_hash <> v_expected.source_hash THEN
      RAISE EXCEPTION '% source attestation failed', v_expected.label
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

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

  IF v_source_hash NOT IN (
    '413149bad9e87560a846ebbf8b3ec77ee4abe481462593de7972c1bc63e262c5',
    '133cea58f66ee0faf729e88bd6d1965ca2be9a96485ceb34ecd8d495bae1063e'
  ) THEN
    RAISE EXCEPTION 'Plugin uninstall RPC source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  SELECT procedure.proacl::text
  INTO v_uninstall_acl
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_uninstall_oid;

  IF v_uninstall_acl IS NULL THEN
    RAISE EXCEPTION 'Plugin uninstall RPC ACL must be explicit'
      USING ERRCODE = '55000';
  END IF;

  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_13_install_oid',
    v_install_oid::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_13_uninstall_oid',
    v_uninstall_oid::text,
    true
  );
  PERFORM pg_catalog.set_config(
    'effectime_migration.v3_51_13_uninstall_acl',
    v_uninstall_acl,
    true
  );
END;
$plugin_install_count_preflight$;

-- Both install and uninstall acquire installation state before the marketplace
-- plugin row. Keep that order at table level as well. SHARE ROW EXCLUSIVE blocks
-- concurrent writes but still permits read traffic while the aggregate is
-- reconciled. SET LOCAL prevents timeout drift after this migration transaction.
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.workspace_installed_plugins IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.marketplace_plugins IN SHARE ROW EXCLUSIVE MODE;

-- A lock timeout above is an error by design. In the Supabase/project migration
-- transaction it rolls back this file in full; pause application writes and
-- retry instead of bypassing the lock or accepting a partial repair.
WITH expected_counts AS MATERIALIZED (
  SELECT plugin.id AS plugin_id,
         (
           pg_catalog.count(installation.id)
             FILTER (WHERE installation.enabled = true)
         )::integer AS enabled_count
  FROM public.marketplace_plugins AS plugin
  LEFT JOIN public.workspace_installed_plugins AS installation
    ON installation.plugin_id = plugin.id
  GROUP BY plugin.id
)
UPDATE public.marketplace_plugins AS plugin
SET install_count = expected.enabled_count
FROM expected_counts AS expected
WHERE plugin.id = expected.plugin_id
  AND plugin.install_count IS DISTINCT FROM expected.enabled_count;

CREATE OR REPLACE FUNCTION public.marketplace_uninstall_plugin(
  _installed_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY DEFINER
PARALLEL UNSAFE
COST 100
SET search_path = pg_catalog
AS $function$
DECLARE
  v_caller uuid;
  v_workspace uuid;
  v_plugin uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT installation.workspace_id, installation.plugin_id
  INTO v_workspace, v_plugin
  FROM public.workspace_installed_plugins AS installation
  WHERE installation.id = _installed_id;

  IF v_workspace IS NULL THEN
    RAISE EXCEPTION 'Installation not found';
  END IF;
  IF NOT public.has_enterprise_role(
    v_workspace,
    v_caller,
    ARRAY['owner'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Forbidden: workspace owner required';
  END IF;

  -- DELETE obtains the installation-row lock first. Match the install RPC's
  -- installation -> plugin order, but make the potentially waiting plugin lock
  -- a separate statement from the count UPDATE. The next statement therefore
  -- receives a fresh READ COMMITTED snapshot after any waiter commits.
  DELETE FROM public.workspace_installed_plugins AS installation
  WHERE installation.id = _installed_id;

  PERFORM plugin.id
  FROM public.marketplace_plugins AS plugin
  WHERE plugin.id = v_plugin
  FOR NO KEY UPDATE;

  UPDATE public.marketplace_plugins AS plugin
  SET install_count = (
    SELECT pg_catalog.count(*)
    FROM public.workspace_installed_plugins AS installation
    WHERE installation.plugin_id = v_plugin
      AND installation.enabled = true
  )
  WHERE plugin.id = v_plugin;

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$function$;

DO $plugin_install_count_postcondition$
DECLARE
  v_install_oid oid :=
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'::
      pg_catalog.regprocedure::oid;
  v_uninstall_oid oid :=
    'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid;
  v_expected_install_oid oid := pg_catalog.current_setting(
    'effectime_migration.v3_51_13_install_oid'
  )::oid;
  v_expected_uninstall_oid oid := pg_catalog.current_setting(
    'effectime_migration.v3_51_13_uninstall_oid'
  )::oid;
  v_expected_uninstall_acl text := pg_catalog.current_setting(
    'effectime_migration.v3_51_13_uninstall_acl'
  );
  v_installations_oid oid :=
    'public.workspace_installed_plugins'::pg_catalog.regclass::oid;
  v_private_configs_oid oid :=
    'effectime_private.workspace_plugin_configs'::pg_catalog.regclass::oid;
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_uninstall_oid
      AND procedure.prokind = 'f'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'jsonb'::pg_catalog.regtype
      AND procedure.proargnames = ARRAY['_installed_id']::text[]
      AND NOT procedure.proretset
      AND procedure.prosecdef
      AND NOT procedure.proisstrict
      AND NOT procedure.proleakproof
      AND procedure.provolatile = 'v'
      AND procedure.proparallel = 'u'
      AND procedure.procost = 100
      AND procedure.prorows = 0
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin uninstall RPC postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF (
    SELECT procedure.proacl::text
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = v_uninstall_oid
  ) IS DISTINCT FROM v_expected_uninstall_acl OR EXISTS (
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
  ) OR pg_catalog.has_function_privilege(
       'anon', v_uninstall_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_uninstall_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_uninstall_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin uninstall RPC ACL postcondition failed'
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
     '133cea58f66ee0faf729e88bd6d1965ca2be9a96485ceb34ecd8d495bae1063e' THEN
    RAISE EXCEPTION 'Plugin uninstall RPC source postcondition failed'
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
    RAISE EXCEPTION 'Plugin install policy boundary changed unexpectedly'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
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
  ) OR EXISTS (
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

  IF EXISTS (
    SELECT 1
    FROM public.marketplace_plugins AS plugin
    WHERE plugin.install_count IS DISTINCT FROM (
      SELECT pg_catalog.count(*)::integer
      FROM public.workspace_installed_plugins AS installation
      WHERE installation.plugin_id = plugin.id
        AND installation.enabled = true
    )
  ) THEN
    RAISE EXCEPTION 'Plugin install-count reconciliation postcondition failed'
      USING ERRCODE = '55000';
  END IF;
END;
$plugin_install_count_postcondition$;
