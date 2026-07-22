\set ON_ERROR_STOP on

DO $catalog_contract$
DECLARE
  v_private_table_oid oid := pg_catalog.to_regclass(
    'effectime_private.workspace_plugin_configs'
  )::oid;
  v_public_table_oid oid := 'public.workspace_installed_plugins'::pg_catalog.regclass::oid;
  v_role name;
  v_install_baseline contract.plugin_function_baseline%ROWTYPE;
  v_uninstall_baseline contract.plugin_function_baseline%ROWTYPE;
  v_install pg_catalog.pg_proc%ROWTYPE;
  v_uninstall pg_catalog.pg_proc%ROWTYPE;
  v_ensure pg_catalog.pg_proc%ROWTYPE;
  v_getter pg_catalog.pg_proc%ROWTYPE;
  v_private_columns text[];
BEGIN
  IF v_private_table_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = v_private_table_oid
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::pg_catalog.regrole::oid
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Plugin private config table contract is incompatible';
  END IF;

  SELECT pg_catalog.array_agg(
      pg_catalog.format(
        '%s:%s:%s:%s',
        attribute.attname,
        pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
        attribute.attnotnull,
        COALESCE(pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid), '')
      )
      ORDER BY attribute.attnum
    )
    INTO v_private_columns
    FROM pg_catalog.pg_attribute AS attribute
    LEFT JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = v_private_table_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped;

  IF v_private_columns IS DISTINCT FROM ARRAY[
    'installed_plugin_id:uuid:t:',
    'raw_config:jsonb:t:',
    'created_at:timestamp with time zone:t:now()',
    'updated_at:timestamp with time zone:t:now()'
  ]::text[] THEN
    RAISE EXCEPTION 'Plugin private config column contract is incompatible: %',
      v_private_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_private_table_oid
      AND constraint_record.contype = 'p'
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_private_table_oid
            AND attribute.attname = 'installed_plugin_id'
        )::smallint
      ]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_private_table_oid
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = v_public_table_oid
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = v_private_table_oid
            AND attribute.attname = 'installed_plugin_id'
        )::smallint
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Plugin private config key/cascade contract is incompatible';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = v_private_table_oid
  ) THEN
    RAISE EXCEPTION 'Plugin private config table must not expose an RLS policy';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon'::name, 'authenticated'::name, 'service_role'::name]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(
        ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
      ) AS privilege(name)
      WHERE pg_catalog.has_table_privilege(v_role, v_private_table_oid, privilege.name)
    ) THEN
      RAISE EXCEPTION 'Plugin private config table leaked privilege to %', v_role;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN pg_catalog.unnest(
        ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
      ) AS privilege(name)
      WHERE attribute.attrelid = v_private_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND pg_catalog.has_column_privilege(
          v_role, v_private_table_oid, attribute.attnum, privilege.name
        )
    ) THEN
      RAISE EXCEPTION 'Plugin private config column leaked privilege to %', v_role;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) AS acl
    WHERE relation.oid = v_private_table_oid
      AND acl.grantee <> 'postgres'::pg_catalog.regrole::oid
  ) THEN
    RAISE EXCEPTION 'Plugin private config table leaked non-owner privileges';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    CROSS JOIN LATERAL pg_catalog.unnest(attribute.attacl) AS acl_item(value)
    CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[acl_item.value]) AS acl
    WHERE attribute.attrelid = v_private_table_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND acl.grantee <> 'postgres'::pg_catalog.regrole::oid
  ) THEN
    RAISE EXCEPTION 'Plugin private config columns leaked non-owner privileges';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM contract.private_schema_baseline AS baseline
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = baseline.schema_oid
    JOIN pg_catalog.pg_proc AS helper
      ON helper.oid = baseline.helper_oid
    WHERE namespace.nspname = 'effectime_private'
      AND namespace.nspowner = baseline.schema_owner
      AND namespace.nspacl::text IS NOT DISTINCT FROM baseline.schema_acl
      AND helper.oid =
          'effectime_private.contract_existing_helper()'::pg_catalog.regprocedure::oid
      AND helper.proowner = baseline.helper_owner
      AND helper.proacl::text IS NOT DISTINCT FROM baseline.helper_acl
      AND helper.prosrc = baseline.helper_source
  ) THEN
    RAISE EXCEPTION 'Plugin migration changed the pre-existing private schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = v_public_table_oid
      AND constraint_record.conname = 'workspace_installed_plugins_public_config_redacted_check'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid, true) =
          'CHECK (config = ''{}''::jsonb)'
  ) THEN
    RAISE EXCEPTION 'Public plugin config redaction constraint is incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    JOIN pg_catalog.pg_proc AS procedure ON procedure.oid = trigger_record.tgfoid
    WHERE trigger_record.tgrelid = v_public_table_oid
      AND trigger_record.tgname = 'trg_workspace_plugin_config_totality'
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgtype = 21
      AND trigger_record.tgnargs = 0
      AND procedure.oid = pg_catalog.to_regprocedure(
        'effectime_private.ensure_workspace_plugin_config_v1()'
      )::oid
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = v_public_table_oid
      AND trigger_record.tgname = 'trg_workspace_installed_plugins_updated_at'
      AND trigger_record.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'Plugin config totality/update trigger contract is incompatible';
  END IF;

  SELECT * INTO v_install_baseline
  FROM contract.plugin_function_baseline
  WHERE identity = 'public.marketplace_install_plugin(uuid,uuid,jsonb)';
  SELECT * INTO v_uninstall_baseline
  FROM contract.plugin_function_baseline
  WHERE identity = 'public.marketplace_uninstall_plugin(uuid)';
  SELECT * INTO v_install
  FROM pg_catalog.pg_proc
  WHERE oid = 'public.marketplace_install_plugin(uuid,uuid,jsonb)'::pg_catalog.regprocedure::oid;
  SELECT * INTO v_uninstall
  FROM pg_catalog.pg_proc
  WHERE oid = 'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid;
  SELECT * INTO v_ensure
  FROM pg_catalog.pg_proc
  WHERE oid =
    'effectime_private.ensure_workspace_plugin_config_v1()'::pg_catalog.regprocedure::oid;
  SELECT * INTO v_getter
  FROM pg_catalog.pg_proc
  WHERE oid = 'public.marketplace_get_plugin_config_service_v1(uuid,uuid)'::pg_catalog.regprocedure::oid;

  IF v_install.oid IS DISTINCT FROM v_install_baseline.object_oid
     OR v_install.prorettype IS DISTINCT FROM v_install_baseline.return_type
     OR pg_catalog.pg_get_expr(v_install.proargdefaults, 0)
        IS DISTINCT FROM v_install_baseline.argument_defaults
     OR v_install.proowner IS DISTINCT FROM v_install_baseline.owner_oid
     OR v_install.prosecdef IS DISTINCT FROM v_install_baseline.security_definer
     OR v_install.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR pg_catalog.has_function_privilege('anon', v_install.oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_install.oid, 'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role', v_install.oid, 'EXECUTE'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.aclexplode(
         COALESCE(v_install.proacl, pg_catalog.acldefault('f', v_install.proowner))
       ) AS acl
        WHERE acl.privilege_type <> 'EXECUTE'
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
     OR v_install.prosrc IS NOT DISTINCT FROM v_install_baseline.source THEN
    RAISE EXCEPTION
      'Plugin install RPC compatibility/security contract is incompatible (oid %/%, return %/%, defaults %/%, owner %/%, definer %/%, config %, acl %/%, source_changed %)',
      v_install.oid,
      v_install_baseline.object_oid,
      v_install.prorettype,
      v_install_baseline.return_type,
      pg_catalog.pg_get_expr(v_install.proargdefaults, 0),
      v_install_baseline.argument_defaults,
      v_install.proowner,
      v_install_baseline.owner_oid,
      v_install.prosecdef,
      v_install_baseline.security_definer,
      v_install.proconfig,
      v_install.proacl::text,
      v_install_baseline.acl,
      v_install.prosrc IS DISTINCT FROM v_install_baseline.source;
  END IF;

  IF v_uninstall.oid IS DISTINCT FROM v_uninstall_baseline.object_oid
     OR v_uninstall.prorettype IS DISTINCT FROM v_uninstall_baseline.return_type
     OR pg_catalog.pg_get_expr(v_uninstall.proargdefaults, 0)
        IS DISTINCT FROM v_uninstall_baseline.argument_defaults
     OR v_uninstall.proowner IS DISTINCT FROM v_uninstall_baseline.owner_oid
     OR v_uninstall.prosecdef IS DISTINCT FROM v_uninstall_baseline.security_definer
     OR v_uninstall.proconfig IS DISTINCT FROM v_uninstall_baseline.function_config
     OR pg_catalog.has_function_privilege('anon', v_uninstall.oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_uninstall.oid, 'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role', v_uninstall.oid, 'EXECUTE'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.aclexplode(
         COALESCE(v_uninstall.proacl, pg_catalog.acldefault('f', v_uninstall.proowner))
       ) AS acl
        WHERE acl.privilege_type <> 'EXECUTE'
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
     OR v_uninstall.prosrc IS DISTINCT FROM v_uninstall_baseline.source THEN
    RAISE EXCEPTION 'Plugin uninstall RPC changed unexpectedly';
  END IF;

  IF v_ensure.oid IS NULL
     OR v_ensure.prorettype <> 'trigger'::pg_catalog.regtype::oid
     OR v_ensure.proowner <> 'postgres'::pg_catalog.regrole::oid
     OR NOT v_ensure.prosecdef
     OR v_ensure.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.aclexplode(
         COALESCE(v_ensure.proacl, pg_catalog.acldefault('f', v_ensure.proowner))
       ) AS acl
       WHERE acl.privilege_type <> 'EXECUTE'
          OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
          OR acl.grantee <> 'postgres'::pg_catalog.regrole::oid
     ) THEN
    RAISE EXCEPTION 'Plugin config totality function ACL contract is incompatible';
  END IF;

  IF v_getter.oid IS NULL
     OR v_getter.prorettype <> 'jsonb'::pg_catalog.regtype::oid
     OR v_getter.proowner <> 'postgres'::pg_catalog.regrole::oid
     OR NOT v_getter.prosecdef
     OR v_getter.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR pg_catalog.has_function_privilege(
       'anon', v_getter.oid, 'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'authenticated', v_getter.oid, 'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role', v_getter.oid, 'EXECUTE'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.aclexplode(
         COALESCE(v_getter.proacl, pg_catalog.acldefault('f', v_getter.proowner))
       ) AS acl
        WHERE acl.privilege_type <> 'EXECUTE'
           OR acl.grantor <> 'postgres'::pg_catalog.regrole::oid
           OR acl.grantee NOT IN (
             'postgres'::pg_catalog.regrole::oid,
             'service_role'::pg_catalog.regrole::oid
           )
           OR (
             acl.grantee = 'service_role'::pg_catalog.regrole::oid
             AND acl.is_grantable
           )
      ) THEN
    RAISE EXCEPTION 'Plugin service getter ACL contract is incompatible';
  END IF;
END;
$catalog_contract$;

DO $data_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    WHERE installation.config IS DISTINCT FROM '{}'::jsonb
  ) OR EXISTS (
    SELECT 1
    FROM contract.plugin_config_expected AS expected
    LEFT JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = expected.installed_plugin_id
    WHERE private_config.installed_plugin_id IS NULL
       OR private_config.raw_config IS DISTINCT FROM expected.raw_config
  ) OR EXISTS (
    SELECT 1
    FROM effectime_private.workspace_plugin_configs AS private_config
    LEFT JOIN public.workspace_installed_plugins AS installation
      ON installation.id = private_config.installed_plugin_id
    WHERE installation.id IS NULL
  ) OR (
    SELECT count(*) FROM effectime_private.workspace_plugin_configs
  ) IS DISTINCT FROM (
    SELECT count(*) FROM public.workspace_installed_plugins
  ) THEN
    RAISE EXCEPTION 'Plugin config migration lost, exposed, or orphaned data';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    JOIN contract.plugin_installation_metadata_baseline AS baseline
      ON baseline.installed_plugin_id = installation.id
    WHERE pg_catalog.to_jsonb(installation) - 'config' IS DISTINCT FROM baseline.metadata
  ) OR (
    SELECT count(*) FROM contract.plugin_installation_metadata_baseline
  ) IS DISTINCT FROM (
    SELECT count(*) FROM public.workspace_installed_plugins
  ) THEN
    RAISE EXCEPTION 'Plugin config redaction changed installation metadata';
  END IF;
END;
$data_contract$;

BEGIN;
SET LOCAL ROLE anon;
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM effectime_private.workspace_plugin_configs'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.marketplace_get_plugin_config_service_v1(NULL::uuid,NULL::uuid)'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
SELECT (count(*) = 2 AND pg_catalog.bool_and(config = '{}'::jsonb)) AS member_safe_read
FROM public.workspace_installed_plugins
WHERE workspace_id = '20000000-0000-4000-8000-000000000001'::uuid \gset
\if :member_safe_read
\else
  \warn 'workspace member legacy-safe plugin projection failed'
  \quit 1
\endif
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM effectime_private.workspace_plugin_configs'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.marketplace_get_plugin_config_service_v1(NULL::uuid,NULL::uuid)'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000006',
  true
);
SELECT (count(*) = 2 AND pg_catalog.bool_and(config = '{}'::jsonb)) AS assistant_safe_read
FROM public.workspace_installed_plugins
WHERE workspace_id = '20000000-0000-4000-8000-000000000001'::uuid \gset
\if :assistant_safe_read
\else
  \warn 'resource assistant legacy-safe plugin projection failed'
  \quit 1
\endif
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);
SELECT (count(*) = 0) AS outsider_isolated
FROM public.workspace_installed_plugins \gset
\if :outsider_isolated
\else
  \warn 'plugin installation tenant isolation failed'
  \quit 1
\endif
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);
SELECT (count(*) = 4 AND pg_catalog.bool_and(config = '{}'::jsonb)) AS admin_safe_read
FROM public.workspace_installed_plugins \gset
\if :admin_safe_read
\else
  \warn 'platform admin redacted plugin projection failed'
  \quit 1
\endif
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM effectime_private.workspace_plugin_configs'
);
SELECT (
  public.marketplace_get_plugin_config_service_v1(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '52000000-0000-4000-8000-000000000001'::uuid
  ) = '{"endpoint":"https://hooks.example.test/contract","sensitive_marker":"must-stay-private","nested":{"unicode":"árvíztűrő"}}'::jsonb
) AS service_getter_exact \gset
\if :service_getter_exact
\else
  \warn 'service-only plugin config getter failed'
  \quit 1
\endif
DO $service_workspace_mismatch$
BEGIN
  PERFORM public.marketplace_get_plugin_config_service_v1(
    '20000000-0000-4000-8000-000000000002'::uuid,
    '52000000-0000-4000-8000-000000000001'::uuid
  );
  RAISE EXCEPTION 'Cross-workspace plugin config lookup unexpectedly succeeded';
EXCEPTION
  WHEN invalid_parameter_value THEN NULL;
END;
$service_workspace_mismatch$;
RESET ROLE;
UPDATE public.workspace_installed_plugins
SET enabled = false
WHERE id = '52000000-0000-4000-8000-000000000001'::uuid;
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
DO $disabled_installation_denied$
BEGIN
  PERFORM public.marketplace_get_plugin_config_service_v1(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '52000000-0000-4000-8000-000000000001'::uuid
  );
  RAISE EXCEPTION 'Disabled plugin configuration lookup unexpectedly succeeded';
EXCEPTION
  WHEN invalid_parameter_value THEN NULL;
END;
$disabled_installation_denied$;
RESET ROLE;
ROLLBACK;

BEGIN;
INSERT INTO public.marketplace_plugins (
  id, slug, name, version, category, manifest, status, pricing_model
) VALUES
  (
    '54000000-0000-4000-8000-000000000001',
    'contract-approved-plugin',
    'Contract Approved Plugin',
    '1.0.0',
    'integration',
    '{}'::jsonb,
    'approved',
    'free'
  ),
  (
    '54000000-0000-4000-8000-000000000002',
    'contract-rollback-plugin',
    'Contract Rollback Plugin',
    '1.0.0',
    'integration',
    '{}'::jsonb,
    'published',
    'free'
  );

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
DO $member_denied$
BEGIN
  PERFORM public.marketplace_install_plugin(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '54000000-0000-4000-8000-000000000001'::uuid,
    '{"member":"must-fail"}'::jsonb
  );
  RAISE EXCEPTION 'Member plugin install unexpectedly succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE;
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Forbidden: workspace owner required%' THEN
      RAISE;
    END IF;
END;
$member_denied$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000006',
  true
);
DO $assistant_denied$
BEGIN
  PERFORM public.marketplace_install_plugin(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '54000000-0000-4000-8000-000000000001'::uuid,
    '{"assistant":"must-fail"}'::jsonb
  );
  RAISE EXCEPTION 'Resource assistant plugin install unexpectedly succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE;
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Forbidden: workspace owner required%' THEN
      RAISE;
    END IF;
END;
$assistant_denied$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000005',
  true
);
DO $other_workspace_owner_denied$
BEGIN
  PERFORM public.marketplace_install_plugin(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '54000000-0000-4000-8000-000000000001'::uuid,
    '{"other_workspace_owner":"must-fail"}'::jsonb
  );
  RAISE EXCEPTION 'Other workspace owner plugin install unexpectedly succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE;
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Forbidden: workspace owner required%' THEN
      RAISE;
    END IF;
END;
$other_workspace_owner_denied$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT public.marketplace_install_plugin(
  '20000000-0000-4000-8000-000000000001'::uuid,
  '54000000-0000-4000-8000-000000000001'::uuid,
  '{"runtime":"private-only"}'::jsonb
) AS installed_id \gset
RESET ROLE;
SELECT (
  installation.config = '{}'::jsonb
  AND private_config.raw_config = '{"runtime":"private-only"}'::jsonb
) AS install_is_atomic
FROM public.workspace_installed_plugins AS installation
JOIN effectime_private.workspace_plugin_configs AS private_config
  ON private_config.installed_plugin_id = installation.id
WHERE installation.id = :'installed_id'::uuid \gset
\if :install_is_atomic
\else
  \warn 'owner plugin install did not preserve the secret boundary'
  \quit 1
\endif

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT (
  public.marketplace_install_plugin(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '54000000-0000-4000-8000-000000000001'::uuid,
    'null'::jsonb
  ) = :'installed_id'::uuid
) AS reinstall_kept_id \gset
RESET ROLE;
SELECT (private_config.raw_config = 'null'::jsonb) AS json_null_preserved
FROM effectime_private.workspace_plugin_configs AS private_config
WHERE private_config.installed_plugin_id = :'installed_id'::uuid \gset
\if :reinstall_kept_id
\else
  \warn 'plugin reinstall changed the installation identity'
  \quit 1
\endif
\if :json_null_preserved
\else
  \warn 'plugin reinstall did not preserve JSON null'
  \quit 1
\endif

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT public.marketplace_uninstall_plugin(:'installed_id'::uuid) AS uninstall_result \gset
RESET ROLE;
SELECT (
  (:'uninstall_result'::jsonb->>'ok')::boolean
  AND NOT EXISTS (
    SELECT 1 FROM public.workspace_installed_plugins WHERE id = :'installed_id'::uuid
  )
  AND NOT EXISTS (
    SELECT 1 FROM effectime_private.workspace_plugin_configs
    WHERE installed_plugin_id = :'installed_id'::uuid
  )
  AND (
    SELECT install_count
    FROM public.marketplace_plugins
    WHERE id = '54000000-0000-4000-8000-000000000001'::uuid
  ) = 0
) AS uninstall_cascaded \gset
\if :uninstall_cascaded
\else
  \warn 'plugin uninstall did not cascade the private config'
  \quit 1
\endif

ALTER TABLE effectime_private.workspace_plugin_configs
  ADD CONSTRAINT contract_reject_private_write
  CHECK (raw_config IS DISTINCT FROM '{"reject":"write"}'::jsonb);

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
DO $atomic_failure$
BEGIN
  PERFORM public.marketplace_install_plugin(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '54000000-0000-4000-8000-000000000002'::uuid,
    '{"reject":"write"}'::jsonb
  );
  RAISE EXCEPTION 'Rejected private write unexpectedly succeeded';
EXCEPTION
  WHEN check_violation THEN NULL;
END;
$atomic_failure$;
RESET ROLE;

DO $rollback_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins
    WHERE plugin_id = '54000000-0000-4000-8000-000000000002'::uuid
  ) OR EXISTS (
    SELECT 1
    FROM effectime_private.workspace_plugin_configs
    WHERE installed_plugin_id IN (
      SELECT id FROM public.workspace_installed_plugins
      WHERE plugin_id = '54000000-0000-4000-8000-000000000002'::uuid
    )
  ) OR (
    SELECT count(*) FROM effectime_private.workspace_plugin_configs
  ) IS DISTINCT FROM (
    SELECT count(*) FROM contract.plugin_config_expected
  ) OR (
    SELECT install_count
    FROM public.marketplace_plugins
    WHERE id = '54000000-0000-4000-8000-000000000002'::uuid
  ) <> 0 THEN
    RAISE EXCEPTION 'Failed private write left a partial public installation';
  END IF;
END;
$rollback_contract$;
ROLLBACK;

BEGIN;
INSERT INTO public.marketplace_plugins (
  id, slug, name, version, category, manifest, status, pricing_model
) VALUES (
  '54000000-0000-4000-8000-000000000003',
  'contract-direct-write-plugin',
  'Contract Direct Write Plugin',
  '1.0.0',
  'integration',
  '{}'::jsonb,
  'published',
  'free'
);
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.workspace_installed_plugins (
  id, workspace_id, plugin_id, config, enabled, installed_by
) VALUES (
  '55000000-0000-4000-8000-000000000001'::uuid,
  '20000000-0000-4000-8000-000000000001'::uuid,
  '54000000-0000-4000-8000-000000000003'::uuid,
  '{}'::jsonb,
  true,
  NULL
);
DO $direct_nonredacted_denied$
BEGIN
  UPDATE public.workspace_installed_plugins
  SET config = '{"must":"fail"}'::jsonb
  WHERE id = '55000000-0000-4000-8000-000000000001'::uuid;
  RAISE EXCEPTION 'Direct non-redacted plugin config update unexpectedly succeeded';
EXCEPTION
  WHEN check_violation THEN NULL;
END;
$direct_nonredacted_denied$;
RESET ROLE;
DO $direct_write_totality$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM effectime_private.workspace_plugin_configs
    WHERE installed_plugin_id = '55000000-0000-4000-8000-000000000001'::uuid
      AND raw_config = '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'Direct service-role insert did not create a private config pair';
  END IF;
END;
$direct_write_totality$;
ROLLBACK;

\echo 'Plugin config secret-boundary PostgreSQL contract passed.'
