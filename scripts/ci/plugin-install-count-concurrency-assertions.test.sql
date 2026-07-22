\set ON_ERROR_STOP on

DO $catalog_contract$
DECLARE
  v_baseline contract.plugin_install_count_baseline%ROWTYPE;
  v_uninstall pg_catalog.pg_proc%ROWTYPE;
  v_source_hash text;
  v_source_upper text;
  v_delete_position integer;
  v_lock_position integer;
  v_count_position integer;
BEGIN
  SELECT * INTO STRICT v_baseline
  FROM contract.plugin_install_count_baseline
  WHERE singleton;

  IF contract.plugin_install_count_surface_state()
     IS DISTINCT FROM v_baseline.surface_state THEN
    RAISE EXCEPTION
      'Plugin install-count migration changed a non-source catalog contract';
  END IF;

  SELECT * INTO STRICT v_uninstall
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid =
    'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid;

  IF v_uninstall.oid <> v_baseline.uninstall_oid
     OR v_uninstall.prosrc IS NOT DISTINCT FROM v_baseline.uninstall_source
     OR v_uninstall.prokind <> 'f'
     OR v_uninstall.proowner <> 'postgres'::pg_catalog.regrole::oid
     OR v_uninstall.prorettype <> 'jsonb'::pg_catalog.regtype
     OR v_uninstall.pronargs <> 1
     OR v_uninstall.proargtypes[0] <>
        'uuid'::pg_catalog.regtype::oid
     OR v_uninstall.proargnames <> ARRAY['_installed_id']::text[]
     OR NOT v_uninstall.prosecdef
     OR v_uninstall.proisstrict
     OR v_uninstall.proleakproof
     OR v_uninstall.provolatile <> 'v'
     OR v_uninstall.proparallel <> 'u'
     OR v_uninstall.pronargdefaults <> 0
     OR v_uninstall.proconfig <> ARRAY['search_path=pg_catalog']::text[] THEN
    RAISE EXCEPTION 'Plugin uninstall RPC API contract changed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        v_uninstall.proacl,
        pg_catalog.acldefault('f', v_uninstall.proowner)
      )
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
  ) OR pg_catalog.has_function_privilege('anon', v_uninstall.oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
       'authenticated', v_uninstall.oid, 'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role', v_uninstall.oid, 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin uninstall RPC ACL changed';
  END IF;

  SELECT pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(
               pg_catalog.replace(v_uninstall.prosrc, E'\r\n', E'\n'),
               'UTF8'
             ),
             'sha256'
           ),
           'hex'
         )
  INTO v_source_hash;

  IF v_source_hash <>
     '133cea58f66ee0faf729e88bd6d1965ca2be9a96485ceb34ecd8d495bae1063e' THEN
    RAISE EXCEPTION 'Plugin uninstall RPC source hash changed: %', v_source_hash;
  END IF;

  v_source_upper := pg_catalog.upper(v_uninstall.prosrc);
  v_delete_position := pg_catalog.strpos(
    v_source_upper,
    'DELETE FROM PUBLIC.WORKSPACE_INSTALLED_PLUGINS AS INSTALLATION'
  );
  v_lock_position := pg_catalog.strpos(
    v_source_upper,
    E'\n  FOR NO KEY UPDATE;'
  );
  v_count_position := pg_catalog.strpos(
    v_source_upper,
    'UPDATE PUBLIC.MARKETPLACE_PLUGINS AS PLUGIN'
  );

  IF v_delete_position = 0
     OR v_lock_position = 0
     OR v_count_position = 0
     OR NOT (
       v_delete_position < v_lock_position
       AND v_lock_position < v_count_position
     )
     OR (
       SELECT count(*)
       FROM pg_catalog.regexp_matches(
         v_source_upper,
         E'\n[[:space:]]*FOR[[:space:]]+NO[[:space:]]+KEY[[:space:]]+UPDATE;',
         'g'
       )
     ) <> 1 THEN
    RAISE EXCEPTION
      'Plugin uninstall delete/lock/count statement ordering is incompatible';
  END IF;
END;
$catalog_contract$;

DO $grandfathering_and_reconciliation$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM contract.plugin_install_count_grandfathered_baseline AS baseline
    JOIN public.workspace_installed_plugins AS installation
      ON installation.id = baseline.installed_plugin_id
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    JOIN public.marketplace_plugins AS plugin
      ON plugin.id = installation.plugin_id
    WHERE baseline.installed_plugin_id =
          '52000000-0000-4000-8000-000000000001'::uuid
      AND pg_catalog.to_jsonb(installation) = baseline.installation_state
      AND pg_catalog.to_jsonb(private_config) = baseline.private_state
      AND pg_catalog.to_jsonb(plugin) - ARRAY['install_count', 'updated_at'] =
          baseline.plugin_state - ARRAY['install_count', 'updated_at']
      AND plugin.updated_at >=
          (baseline.plugin_state ->> 'updated_at')::timestamptz
  ) THEN
    RAISE EXCEPTION
      'Grandfathered plugin business state changed during v3.51.13';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE installation.plugin_id =
          '58000000-0000-4000-8000-000000000001'::uuid
      AND installation.workspace_id =
          '20000000-0000-4000-8000-000000000002'::uuid
      AND installation.config = '{}'::jsonb
      AND private_config.raw_config = '{"race":"legacy-install"}'::jsonb
  ) OR (
    SELECT install_count
    FROM public.marketplace_plugins
    WHERE id = '58000000-0000-4000-8000-000000000001'::uuid
  ) <> 1 THEN
    RAISE EXCEPTION 'v3.51.13 did not reconcile the legacy race fixture';
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
    RAISE EXCEPTION 'v3.51.13 left a stale marketplace install_count';
  END IF;
END;
$grandfathering_and_reconciliation$;

DO $authorization_failures_are_atomic$
DECLARE
  v_install_id uuid;
  v_before_installation jsonb;
  v_before_private jsonb;
  v_before_count integer;
BEGIN
  SELECT installation.id,
         pg_catalog.to_jsonb(installation),
         pg_catalog.to_jsonb(private_config),
         plugin.install_count
  INTO STRICT v_install_id,
              v_before_installation,
              v_before_private,
              v_before_count
  FROM public.workspace_installed_plugins AS installation
  JOIN effectime_private.workspace_plugin_configs AS private_config
    ON private_config.installed_plugin_id = installation.id
  JOIN public.marketplace_plugins AS plugin
    ON plugin.id = installation.plugin_id
  WHERE installation.plugin_id =
        '58000000-0000-4000-8000-000000000001'::uuid
    AND installation.workspace_id =
        '20000000-0000-4000-8000-000000000002'::uuid;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000002',
    true
  );
  BEGIN
    PERFORM public.marketplace_uninstall_plugin(v_install_id);
    RAISE EXCEPTION 'Expected non-owner uninstall denial';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'Forbidden: workspace owner required' THEN
        RAISE;
      END IF;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    JOIN public.marketplace_plugins AS plugin
      ON plugin.id = installation.plugin_id
    WHERE installation.id = v_install_id
      AND pg_catalog.to_jsonb(installation) = v_before_installation
      AND pg_catalog.to_jsonb(private_config) = v_before_private
      AND plugin.install_count = v_before_count
  ) THEN
    RAISE EXCEPTION 'Denied plugin uninstall mutated state';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000001',
    true
  );
  BEGIN
    PERFORM public.marketplace_uninstall_plugin(
      'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
    );
    RAISE EXCEPTION 'Expected missing-installation denial';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'Installation not found' THEN
        RAISE;
      END IF;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    JOIN public.marketplace_plugins AS plugin
      ON plugin.id = installation.plugin_id
    WHERE installation.id = v_install_id
      AND pg_catalog.to_jsonb(installation) = v_before_installation
      AND pg_catalog.to_jsonb(private_config) = v_before_private
      AND plugin.install_count = v_before_count
  ) THEN
    RAISE EXCEPTION 'Missing plugin uninstall mutated state';
  END IF;
END;
$authorization_failures_are_atomic$;
