\set ON_ERROR_STOP on

DO $catalog_contract$
DECLARE
  v_baseline jsonb;
  v_expected jsonb;
  v_current jsonb;
  v_source_hash text;
BEGIN
  SELECT baseline.surface_state
  INTO STRICT v_baseline
  FROM contract.plugin_install_lock_timeout_baseline AS baseline
  WHERE baseline.singleton;

  v_expected := pg_catalog.jsonb_set(
    v_baseline,
    '{config}',
    pg_catalog.to_jsonb(
      ARRAY['search_path=pg_catalog', 'lock_timeout=5s']::text[]
    ),
    false
  );
  v_current := contract.plugin_install_lock_timeout_surface_state();

  IF v_current IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'Plugin install lock-timeout migration changed catalog metadata beyond proconfig';
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
  WHERE procedure.oid =
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'::
      pg_catalog.regprocedure::oid;

  IF v_source_hash <>
     '7a3a8c82b510c0f71de0219bf703aac8385e7ce6ca78b48f591840ff89ab7da7'
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_language AS language
         ON language.oid = procedure.prolang
       WHERE procedure.oid =
         'public.marketplace_install_plugin(uuid,uuid,jsonb)'::
           pg_catalog.regprocedure::oid
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
         AND procedure.proconfig =
             ARRAY['search_path=pg_catalog', 'lock_timeout=5s']::text[]
         AND language.lanname = 'plpgsql'
     ) THEN
    RAISE EXCEPTION 'Plugin install lock-timeout API contract is incompatible';
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
    WHERE procedure.oid =
          'public.marketplace_install_plugin(uuid,uuid,jsonb)'::
            pg_catalog.regprocedure::oid
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
       'anon',
       'public.marketplace_install_plugin(uuid,uuid,jsonb)',
       'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'authenticated',
       'public.marketplace_install_plugin(uuid,uuid,jsonb)',
       'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role',
       'public.marketplace_install_plugin(uuid,uuid,jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Plugin install lock-timeout ACL contract changed';
  END IF;
END;
$catalog_contract$;

-- The migration is metadata-only. This same assertion is intentionally usable
-- by the runner after a blocked ALTER rollback, after the successful retry and
-- after a timed-out runtime install attempt.
SELECT contract.assert_plugin_install_lock_timeout_runtime_baseline();

DO $retry_totality$
BEGIN
  IF contract.plugin_install_lock_timeout_reapply_state() IS NULL THEN
    RAISE EXCEPTION 'Plugin install lock-timeout reapply state is unavailable';
  END IF;
END;
$retry_totality$;
