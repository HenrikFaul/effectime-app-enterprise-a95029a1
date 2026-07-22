-- v3.51.11 — private plugin configuration secret boundary
--
-- Preserve the shipped marketplace_install_plugin(uuid,uuid,jsonb) and
-- marketplace_uninstall_plugin(uuid) contracts while removing raw plugin
-- configuration from the browser-readable public relation. The public config
-- column remains present for cached web and installed Capacitor clients, but it
-- is permanently redacted to {}. Raw JSON is reachable only through a
-- service-role-only SECURITY DEFINER getter.

DO $plugin_config_preflight$
DECLARE
  v_base_oid oid := pg_catalog.to_regclass('public.workspace_installed_plugins');
  v_private_oid oid := pg_catalog.to_regclass(
    'effectime_private.workspace_plugin_configs'
  );
  v_install_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'
  );
  v_uninstall_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_uninstall_plugin(uuid)'
  );
  v_ensure_oid oid := pg_catalog.to_regprocedure(
    'effectime_private.ensure_workspace_plugin_config_v1()'
  );
  v_getter_oid oid := pg_catalog.to_regprocedure(
    'public.marketplace_get_plugin_config_service_v1(uuid,uuid)'
  );
  v_install_source_hash text;
  v_uninstall_source_hash text;
  v_ensure_source_hash text;
  v_getter_source_hash text;
BEGIN
  IF pg_catalog.to_regrole('postgres') IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL
     OR pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'Plugin config boundary requires canonical Supabase roles'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname IN ('anon', 'authenticated')
      AND (
        role.rolsuper
        OR role.rolinherit IS FALSE
        OR role.rolcreaterole
        OR role.rolcreatedb
        OR role.rolcanlogin
        OR role.rolreplication
        OR role.rolbypassrls
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    WHERE membership.member IN (
      'anon'::pg_catalog.regrole::oid,
      'authenticated'::pg_catalog.regrole::oid
    )
  ) THEN
    RAISE EXCEPTION 'Plugin config boundary browser-role contract is unsafe'
      USING ERRCODE = '55000';
  END IF;

  IF v_base_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_base_oid
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::pg_catalog.regrole::oid
      AND relation.relrowsecurity
      AND NOT relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Plugin installation table contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_base_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) <> 8 OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = v_base_oid
      AND attribute.attname = 'config'
      AND attribute.atttypid = 'jsonb'::pg_catalog.regtype
      AND attribute.attnotnull
      AND pg_catalog.pg_get_expr(
        default_value.adbin,
        default_value.adrelid,
        true
      ) = '''{}''::jsonb'
  ) THEN
    RAISE EXCEPTION 'Plugin installation config column contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_base_oid
      AND constraint_record.contype = 'p'
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_base_oid
            AND attribute.attname = 'id'
        )
      ]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_base_oid
      AND constraint_record.contype = 'u'
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_base_oid
            AND attribute.attname = 'workspace_id'
        ),
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_base_oid
            AND attribute.attname = 'plugin_id'
        )
      ]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_base_oid
      AND constraint_record.contype = 'f'
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
        'FOREIGN KEY (workspace_id) REFERENCES enterprise_workspaces(id) ON DELETE CASCADE'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_base_oid
      AND constraint_record.contype = 'f'
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
        'FOREIGN KEY (plugin_id) REFERENCES marketplace_plugins(id) ON DELETE CASCADE'
  ) THEN
    RAISE EXCEPTION 'Plugin installation key contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = v_base_oid
      AND trigger_record.tgname = 'trg_workspace_installed_plugins_updated_at'
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgfoid =
        'public.set_updated_at()'::pg_catalog.regprocedure::oid
  ) THEN
    RAISE EXCEPTION 'Plugin installation updated-at trigger is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT pg_catalog.has_table_privilege(
       'authenticated', v_base_oid, 'SELECT'
     ) OR EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(
         ARRAY[
           'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER',
           'MAINTAIN'
         ]
       ) AS privilege(name)
       WHERE pg_catalog.has_table_privilege(
         'authenticated', v_base_oid, privilege.name
       )
     ) OR EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(
         ARRAY[
           'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES',
           'TRIGGER', 'MAINTAIN'
         ]
       ) AS privilege(name)
       WHERE pg_catalog.has_table_privilege('anon', v_base_oid, privilege.name)
     ) OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS attribute
       CROSS JOIN LATERAL pg_catalog.unnest(
         ARRAY['INSERT', 'UPDATE', 'REFERENCES']
       ) AS privilege(name)
       WHERE attribute.attrelid = v_base_oid
         AND attribute.attnum > 0
         AND NOT attribute.attisdropped
         AND pg_catalog.has_column_privilege(
           'authenticated', v_base_oid, attribute.attnum, privilege.name
         )
     ) OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS attribute
       CROSS JOIN LATERAL pg_catalog.unnest(
         ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
       ) AS privilege(name)
       WHERE attribute.attrelid = v_base_oid
         AND attribute.attnum > 0
         AND NOT attribute.attisdropped
         AND pg_catalog.has_column_privilege(
           'anon', v_base_oid, attribute.attnum, privilege.name
         )
     ) THEN
    RAISE EXCEPTION 'Plugin installation browser ACL contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_install_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_install_oid
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'uuid'::pg_catalog.regtype
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.pronargdefaults = 1
      AND pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) =
          '''{}''::jsonb'
      AND language.lanname = 'plpgsql'
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
  ) OR NOT pg_catalog.has_function_privilege(
    'authenticated', v_install_oid, 'EXECUTE'
  ) OR NOT pg_catalog.has_function_privilege(
    'service_role', v_install_oid, 'EXECUTE'
  ) OR pg_catalog.has_function_privilege('anon', v_install_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Plugin install RPC contract is incompatible'
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
  INTO v_install_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_install_oid;

  IF v_install_source_hash NOT IN (
    '85d5db26dfa971df025af7a92a824c2aadcfd230ef7674d5c9ab9f2afdd31dc3',
    '066aee1a7f0047accbb27594e46ad7dff70457b2436b942686547e316ee3e9b7'
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
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'jsonb'::pg_catalog.regtype
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.pronargdefaults = 0
      AND language.lanname = 'plpgsql'
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
  ) OR NOT pg_catalog.has_function_privilege(
    'authenticated', v_uninstall_oid, 'EXECUTE'
  ) OR NOT pg_catalog.has_function_privilege(
    'service_role', v_uninstall_oid, 'EXECUTE'
  ) OR pg_catalog.has_function_privilege('anon', v_uninstall_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Plugin uninstall RPC contract is incompatible'
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
  INTO v_uninstall_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_uninstall_oid;

  IF v_uninstall_source_hash <>
     '413149bad9e87560a846ebbf8b3ec77ee4abe481462593de7972c1bc63e262c5' THEN
    RAISE EXCEPTION 'Plugin uninstall RPC source attestation failed'
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
  ) THEN
    RAISE EXCEPTION 'Plugin mutation RPC ACL contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF pg_catalog.to_regnamespace('effectime_private') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_namespace AS namespace
       WHERE namespace.oid = pg_catalog.to_regnamespace('effectime_private')
         AND namespace.nspowner = 'postgres'::pg_catalog.regrole::oid
     ) THEN
    RAISE EXCEPTION 'Private schema owner contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF pg_catalog.to_regnamespace('effectime_private') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_catalog.pg_namespace AS namespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(
           namespace.nspacl,
           pg_catalog.acldefault('n', namespace.nspowner)
         )
       ) AS acl
       WHERE namespace.oid = pg_catalog.to_regnamespace('effectime_private')
         AND acl.privilege_type = 'CREATE'
         AND acl.grantee <> 'postgres'::pg_catalog.regrole::oid
     ) THEN
    RAISE EXCEPTION 'Private schema CREATE privilege contract is unsafe'
      USING ERRCODE = '55000';
  END IF;

  IF v_private_oid IS NULL THEN
    IF v_ensure_oid IS NOT NULL
       OR v_getter_oid IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_constraint AS constraint_record
         WHERE constraint_record.conrelid = v_base_oid
           AND constraint_record.conname =
             'workspace_installed_plugins_public_config_redacted_check'
       ) THEN
      RAISE EXCEPTION 'Plugin config boundary is partially installed'
        USING ERRCODE = '55000';
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_private_oid
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::pg_catalog.regrole::oid
      AND relation.relrowsecurity
      AND NOT relation.relforcerowsecurity
  ) OR (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) <> 4 OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attname = 'installed_plugin_id'
      AND attribute.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute.attnotnull
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attrdef AS default_value
        WHERE default_value.adrelid = attribute.attrelid
          AND default_value.adnum = attribute.attnum
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attname = 'raw_config'
      AND attribute.atttypid = 'jsonb'::pg_catalog.regtype
      AND attribute.attnotnull
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attrdef AS default_value
        WHERE default_value.adrelid = attribute.attrelid
          AND default_value.adnum = attribute.attnum
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attname = 'created_at'
      AND attribute.atttypid = 'timestamptz'::pg_catalog.regtype
      AND attribute.attnotnull
      AND pg_catalog.pg_get_expr(
        default_value.adbin,
        default_value.adrelid,
        true
      ) = 'now()'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attname = 'updated_at'
      AND attribute.atttypid = 'timestamptz'::pg_catalog.regtype
      AND attribute.attnotnull
      AND pg_catalog.pg_get_expr(
        default_value.adbin,
        default_value.adrelid,
        true
      ) = 'now()'
  ) THEN
    RAISE EXCEPTION 'Private plugin config table contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_private_oid
      AND constraint_record.contype = 'p'
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
        'PRIMARY KEY (installed_plugin_id)'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_private_oid
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = v_base_oid
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
        'FOREIGN KEY (installed_plugin_id) REFERENCES workspace_installed_plugins(id) ON DELETE CASCADE'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = v_private_oid
  ) THEN
    RAISE EXCEPTION 'Private plugin config key/RLS contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(
      ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES',
        'TRIGGER', 'MAINTAIN'
      ]
    ) AS privilege(name)
    CROSS JOIN pg_catalog.unnest(
      ARRAY['anon', 'authenticated', 'service_role']
    ) AS role_name(name)
    WHERE pg_catalog.has_table_privilege(
      role_name.name, v_private_oid, privilege.name
    )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) AS acl
    WHERE relation.oid = v_private_oid
      AND acl.grantee NOT IN (
        'postgres'::pg_catalog.regrole::oid,
        'anon'::pg_catalog.regrole::oid,
        'authenticated'::pg_catalog.regrole::oid,
        'service_role'::pg_catalog.regrole::oid
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.unnest(attribute.attacl) AS acl_item(value)
    CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[acl_item.value]) AS acl
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND acl.grantee NOT IN (
        0,
        'postgres'::pg_catalog.regrole::oid,
        'anon'::pg_catalog.regrole::oid,
        'authenticated'::pg_catalog.regrole::oid,
        'service_role'::pg_catalog.regrole::oid
      )
  ) THEN
    RAISE EXCEPTION 'Private plugin config direct ACL contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF v_ensure_oid IS NULL OR v_getter_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = v_base_oid
      AND trigger_record.tgname = 'trg_workspace_plugin_config_totality'
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgtype = 21
      AND trigger_record.tgnargs = 0
      AND trigger_record.tgfoid = v_ensure_oid
  ) THEN
    RAISE EXCEPTION 'Plugin config boundary companion objects are incomplete'
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
    WHERE procedure.oid IN (v_ensure_oid, v_getter_oid)
      AND acl.grantee NOT IN (
        0,
        'postgres'::pg_catalog.regrole::oid,
        'anon'::pg_catalog.regrole::oid,
        'authenticated'::pg_catalog.regrole::oid,
        'service_role'::pg_catalog.regrole::oid
      )
  ) THEN
    RAISE EXCEPTION 'Plugin config companion function ACL contract is incompatible'
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
  INTO v_ensure_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_ensure_oid;

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
  INTO v_getter_source_hash
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_getter_oid;

  IF v_ensure_source_hash <>
       'a7fd0b2c4e1444ccffedcac48b934755aa9c83fc28cda5e1a3f1412500c35da9'
     OR v_getter_source_hash <>
       'b8db83002636fc32ea126c4f68191ead7e853123ed93797101e11c703b9ad4b8' THEN
    RAISE EXCEPTION 'Plugin config boundary source attestation failed'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_base_oid
      AND constraint_record.conname =
        'workspace_installed_plugins_public_config_redacted_check'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
      AND pg_catalog.pg_get_expr(
        constraint_record.conbin,
        constraint_record.conrelid,
        true
      ) = 'config = ''{}''::jsonb'
  ) THEN
    RAISE EXCEPTION 'Plugin config public redaction constraint is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    LEFT JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE private_config.installed_plugin_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM effectime_private.workspace_plugin_configs AS private_config
    LEFT JOIN public.workspace_installed_plugins AS installation
      ON installation.id = private_config.installed_plugin_id
    WHERE installation.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Plugin config boundary totality drift detected'
      USING ERRCODE = '55000';
  END IF;
END;
$plugin_config_preflight$;

CREATE SCHEMA IF NOT EXISTS effectime_private AUTHORIZATION postgres;

CREATE TABLE IF NOT EXISTS effectime_private.workspace_plugin_configs (
  installed_plugin_id uuid PRIMARY KEY
    REFERENCES public.workspace_installed_plugins(id) ON DELETE CASCADE,
  raw_config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE effectime_private.workspace_plugin_configs OWNER TO postgres;
ALTER TABLE effectime_private.workspace_plugin_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE effectime_private.workspace_plugin_configs
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE SELECT (installed_plugin_id, raw_config, created_at, updated_at),
       INSERT (installed_plugin_id, raw_config, created_at, updated_at),
       UPDATE (installed_plugin_id, raw_config, created_at, updated_at),
       REFERENCES (installed_plugin_id, raw_config, created_at, updated_at)
  ON TABLE effectime_private.workspace_plugin_configs
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION effectime_private.ensure_workspace_plugin_config_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO effectime_private.workspace_plugin_configs (
      installed_plugin_id,
      raw_config,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      '{}'::jsonb,
      NEW.installed_at,
      NEW.updated_at
    )
    ON CONFLICT (installed_plugin_id) DO UPDATE
      SET updated_at = EXCLUDED.updated_at;
  ELSE
    UPDATE effectime_private.workspace_plugin_configs AS private_config
    SET updated_at = NEW.updated_at
    WHERE private_config.installed_plugin_id = NEW.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Private plugin configuration is missing for installation'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION effectime_private.ensure_workspace_plugin_config_v1()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION effectime_private.ensure_workspace_plugin_config_v1()
  FROM PUBLIC, anon, authenticated, service_role;

DO $plugin_config_totality_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid =
          'public.workspace_installed_plugins'::pg_catalog.regclass::oid
      AND trigger_record.tgname = 'trg_workspace_plugin_config_totality'
      AND NOT trigger_record.tgisinternal
  ) THEN
    CREATE TRIGGER trg_workspace_plugin_config_totality
      AFTER INSERT OR UPDATE ON public.workspace_installed_plugins
      FOR EACH ROW
      EXECUTE FUNCTION
        effectime_private.ensure_workspace_plugin_config_v1();
  END IF;
END;
$plugin_config_totality_trigger$;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.workspace_installed_plugins IN ACCESS EXCLUSIVE MODE;

-- Copy every legacy value without logging or transforming the JSON. A conflict
-- is intentionally not updated: on reapply, the public {} is only a redaction
-- marker and must never overwrite an existing private secret.
INSERT INTO effectime_private.workspace_plugin_configs (
  installed_plugin_id,
  raw_config,
  created_at,
  updated_at
)
SELECT installation.id,
       installation.config,
       installation.installed_at,
       installation.updated_at
FROM public.workspace_installed_plugins AS installation
ON CONFLICT (installed_plugin_id) DO NOTHING;

DO $plugin_config_backfill_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    LEFT JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE private_config.installed_plugin_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Private plugin config backfill is incomplete'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE installation.config IS DISTINCT FROM '{}'::jsonb
      AND private_config.raw_config IS DISTINCT FROM installation.config
  ) THEN
    RAISE EXCEPTION 'Private plugin config conflicts with non-redacted source'
      USING ERRCODE = '55000';
  END IF;
END;
$plugin_config_backfill_guard$;

DO $plugin_config_redaction_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid =
          'public.workspace_installed_plugins'::pg_catalog.regclass::oid
      AND constraint_record.conname =
          'workspace_installed_plugins_public_config_redacted_check'
  ) THEN
    ALTER TABLE public.workspace_installed_plugins
      ADD CONSTRAINT workspace_installed_plugins_public_config_redacted_check
      CHECK (config = '{}'::jsonb) NOT VALID;
  END IF;
END;
$plugin_config_redaction_constraint$;

-- The historical trigger overwrites updated_at on every UPDATE. Disable only
-- that exact trigger while redacting so migration itself does not fabricate a
-- user-visible configuration-change timestamp. Transactional DDL restores the
-- original trigger state automatically if any later assertion fails.
ALTER TABLE public.workspace_installed_plugins
  DISABLE TRIGGER trg_workspace_installed_plugins_updated_at;

UPDATE public.workspace_installed_plugins
SET config = '{}'::jsonb
WHERE config IS DISTINCT FROM '{}'::jsonb;

ALTER TABLE public.workspace_installed_plugins
  ENABLE TRIGGER trg_workspace_installed_plugins_updated_at;

ALTER TABLE public.workspace_installed_plugins
  VALIDATE CONSTRAINT workspace_installed_plugins_public_config_redacted_check;

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

  SELECT plugin.status
  INTO v_status
  FROM public.marketplace_plugins AS plugin
  WHERE plugin.id = _plugin_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Plugin not found';
  END IF;
  IF v_status NOT IN ('published', 'approved') THEN
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

ALTER FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.marketplace_get_plugin_config_service_v1(
  p_workspace_id uuid,
  p_installed_plugin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_raw_config jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_workspace_id IS NULL OR p_installed_plugin_id IS NULL THEN
    RAISE EXCEPTION 'Workspace and plugin installation are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT private_config.raw_config
  INTO v_raw_config
  FROM public.workspace_installed_plugins AS installation
  JOIN effectime_private.workspace_plugin_configs AS private_config
    ON private_config.installed_plugin_id = installation.id
  WHERE installation.id = p_installed_plugin_id
    AND installation.workspace_id = p_workspace_id
    AND installation.enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plugin installation configuration is unavailable'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_raw_config;
END;
$function$;

ALTER FUNCTION public.marketplace_get_plugin_config_service_v1(uuid, uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION
  public.marketplace_get_plugin_config_service_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.marketplace_get_plugin_config_service_v1(uuid, uuid)
  TO service_role;

DO $plugin_config_postcondition$
DECLARE
  v_base_oid oid :=
    'public.workspace_installed_plugins'::pg_catalog.regclass::oid;
  v_private_oid oid :=
    'effectime_private.workspace_plugin_configs'::pg_catalog.regclass::oid;
  v_install_oid oid :=
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'::pg_catalog.regprocedure::oid;
  v_uninstall_oid oid :=
    'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid;
  v_ensure_oid oid :=
    'effectime_private.ensure_workspace_plugin_config_v1()'::pg_catalog.regprocedure::oid;
  v_getter_oid oid :=
    'public.marketplace_get_plugin_config_service_v1(uuid,uuid)'::pg_catalog.regprocedure::oid;
  v_source_hash text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        namespace.nspacl,
        pg_catalog.acldefault('n', namespace.nspowner)
      )
    ) AS acl
    WHERE namespace.oid = pg_catalog.to_regnamespace('effectime_private')
      AND acl.privilege_type = 'CREATE'
      AND acl.grantee <> 'postgres'::pg_catalog.regrole::oid
  ) THEN
    RAISE EXCEPTION 'Plugin config private schema ACL postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    WHERE installation.config IS DISTINCT FROM '{}'::jsonb
  ) OR EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    LEFT JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE private_config.installed_plugin_id IS NULL
       OR private_config.created_at IS DISTINCT FROM installation.installed_at
       OR private_config.updated_at IS DISTINCT FROM installation.updated_at
  ) OR EXISTS (
    SELECT 1
    FROM effectime_private.workspace_plugin_configs AS private_config
    LEFT JOIN public.workspace_installed_plugins AS installation
      ON installation.id = private_config.installed_plugin_id
    WHERE installation.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Plugin config data-boundary postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_base_oid
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
    WHERE trigger_record.tgrelid = v_base_oid
      AND trigger_record.tgname = 'trg_workspace_installed_plugins_updated_at'
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgfoid =
        'public.set_updated_at()'::pg_catalog.regprocedure::oid
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = v_base_oid
      AND trigger_record.tgname = 'trg_workspace_plugin_config_totality'
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgtype = 21
      AND trigger_record.tgnargs = 0
      AND trigger_record.tgfoid = v_ensure_oid
  ) THEN
    RAISE EXCEPTION 'Plugin config DDL postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(
      ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES',
        'TRIGGER', 'MAINTAIN'
      ]
    ) AS privilege(name)
    CROSS JOIN pg_catalog.unnest(
      ARRAY['anon', 'authenticated', 'service_role']
    ) AS role_name(name)
    WHERE pg_catalog.has_table_privilege(
      role_name.name, v_private_oid, privilege.name
    )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN pg_catalog.unnest(
      ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
    ) AS privilege(name)
    CROSS JOIN pg_catalog.unnest(
      ARRAY['anon', 'authenticated', 'service_role']
    ) AS role_name(name)
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND pg_catalog.has_column_privilege(
        role_name.name, v_private_oid, attribute.attnum, privilege.name
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.unnest(attribute.attacl) AS acl_item(value)
    CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[acl_item.value]) AS acl
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND acl.grantee = 0
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) AS acl
    WHERE relation.oid = v_private_oid
      AND acl.grantee <> 'postgres'::pg_catalog.regrole::oid
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.unnest(attribute.attacl) AS acl_item(value)
    CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[acl_item.value]) AS acl
    WHERE attribute.attrelid = v_private_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND acl.grantee <> 'postgres'::pg_catalog.regrole::oid
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) AS acl
    WHERE procedure.oid IN (
      v_install_oid, v_uninstall_oid, v_ensure_oid, v_getter_oid
    )
      AND (
        acl.privilege_type <> 'EXECUTE'
        OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
        OR (
          procedure.oid IN (v_install_oid, v_uninstall_oid)
          AND (
            acl.grantee NOT IN (
              'postgres'::pg_catalog.regrole::oid,
              'authenticated'::pg_catalog.regrole::oid,
              'service_role'::pg_catalog.regrole::oid
            )
            OR (
              acl.grantee <> 'postgres'::pg_catalog.regrole::oid
              AND acl.is_grantable
            )
          )
        )
        OR (
          procedure.oid = v_ensure_oid
          AND acl.grantee <> 'postgres'::pg_catalog.regrole::oid
        )
        OR (
          procedure.oid = v_getter_oid
          AND (
            acl.grantee NOT IN (
              'postgres'::pg_catalog.regrole::oid,
              'service_role'::pg_catalog.regrole::oid
            )
            OR (
              acl.grantee = 'service_role'::pg_catalog.regrole::oid
              AND acl.is_grantable
            )
          )
        )
      )
  ) OR pg_catalog.has_function_privilege('anon', v_getter_oid, 'EXECUTE')
     OR pg_catalog.has_function_privilege(
       'authenticated', v_getter_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_getter_oid, 'EXECUTE'
     ) OR pg_catalog.has_function_privilege('anon', v_install_oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_install_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_install_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_uninstall_oid, 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', v_uninstall_oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin config ACL postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_install_oid
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'uuid'::pg_catalog.regtype
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.pronargdefaults = 1
      AND pg_catalog.pg_get_expr(procedure.proargdefaults, 0, true) =
          '''{}''::jsonb'
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_language AS language
      ON language.oid = procedure.prolang
    WHERE procedure.oid = v_getter_oid
      AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
      AND procedure.prorettype = 'jsonb'::pg_catalog.regtype
      AND procedure.prosecdef
      AND procedure.provolatile = 'v'
      AND procedure.pronargdefaults = 0
      AND procedure.proconfig = ARRAY['search_path=pg_catalog']::text[]
      AND language.lanname = 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Plugin config routine postcondition failed'
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
     '066aee1a7f0047accbb27594e46ad7dff70457b2436b942686547e316ee3e9b7' THEN
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
  WHERE procedure.oid = v_ensure_oid;
  IF v_source_hash <>
       'a7fd0b2c4e1444ccffedcac48b934755aa9c83fc28cda5e1a3f1412500c35da9' THEN
    RAISE EXCEPTION 'Plugin config totality source postcondition failed'
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
  WHERE procedure.oid = v_getter_oid;
  IF v_source_hash <>
       'b8db83002636fc32ea126c4f68191ead7e853123ed93797101e11c703b9ad4b8' THEN
    RAISE EXCEPTION 'Plugin config getter source postcondition failed'
      USING ERRCODE = '55000';
  END IF;
END;
$plugin_config_postcondition$;

NOTIFY pgrst, 'reload schema';
