\set ON_ERROR_STOP on

-- This fixture is layered on the completed v3.51.13 contract state. Capture
-- the complete install-routine catalog surface before v3.51.14 changes only
-- proconfig, then create one deterministic installation whose public/private
-- and aggregate rows must survive DDL timeout, retry and reapply unchanged.
CREATE FUNCTION contract.plugin_install_lock_timeout_surface_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $state$
  SELECT pg_catalog.jsonb_build_object(
    'oid', procedure.oid,
    'identity', procedure.oid::pg_catalog.regprocedure::text,
    'namespace', procedure.pronamespace,
    'name', procedure.proname,
    'owner', procedure.proowner,
    'language', language.lanname,
    'kind', procedure.prokind,
    'return_type', procedure.prorettype,
    'returns_set', procedure.proretset,
    'security_definer', procedure.prosecdef,
    'strict', procedure.proisstrict,
    'leakproof', procedure.proleakproof,
    'volatility', procedure.provolatile,
    'parallel', procedure.proparallel,
    'cost', procedure.procost,
    'rows', procedure.prorows,
    'variadic_type', procedure.provariadic,
    'argument_count', procedure.pronargs,
    'default_count', procedure.pronargdefaults,
    'argument_types', procedure.proargtypes::text,
    'all_argument_types', procedure.proallargtypes,
    'argument_modes', procedure.proargmodes,
    'argument_names', procedure.proargnames,
    'argument_defaults', pg_catalog.pg_get_expr(
      procedure.proargdefaults,
      0,
      true
    ),
    'identity_arguments', pg_catalog.pg_get_function_identity_arguments(
      procedure.oid
    ),
    'arguments', pg_catalog.pg_get_function_arguments(procedure.oid),
    'result', pg_catalog.pg_get_function_result(procedure.oid),
    'source', procedure.prosrc,
    'binary', procedure.probin,
    'config', procedure.proconfig,
    'acl', procedure.proacl::text
  )
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_language AS language
    ON language.oid = procedure.prolang
  WHERE procedure.oid =
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'::
      pg_catalog.regprocedure::oid
$state$;

CREATE TABLE contract.plugin_install_lock_timeout_baseline (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  surface_state jsonb NOT NULL
);

INSERT INTO contract.plugin_install_lock_timeout_baseline (
  singleton,
  surface_state
) VALUES (
  true,
  contract.plugin_install_lock_timeout_surface_state()
);

UPDATE public.tenant_subscriptions
SET status = 'active'
WHERE tier_id = (SELECT id FROM public.tiers WHERE tier_key = 'enterprise');

INSERT INTO public.marketplace_plugins (
  id,
  slug,
  name,
  version,
  category,
  manifest,
  status,
  pricing_model
) VALUES (
  '59000000-0000-4000-8000-000000000001',
  'contract-install-lock-timeout',
  'Contract Install Lock Timeout',
  '1.0.0',
  'integration',
  '{}'::jsonb,
  'published',
  'free'
);

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
SELECT public.marketplace_install_plugin(
  '20000000-0000-4000-8000-000000000001'::uuid,
  '59000000-0000-4000-8000-000000000001'::uuid,
  '{"lock_timeout":"baseline"}'::jsonb
);
RESET ROLE;

CREATE TABLE contract.plugin_install_lock_timeout_runtime_baseline (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  installed_plugin_id uuid NOT NULL,
  installation_state jsonb NOT NULL,
  private_state jsonb NOT NULL,
  plugin_state jsonb NOT NULL
);

INSERT INTO contract.plugin_install_lock_timeout_runtime_baseline (
  singleton,
  installed_plugin_id,
  installation_state,
  private_state,
  plugin_state
)
SELECT true,
       installation.id,
       pg_catalog.to_jsonb(installation),
       pg_catalog.to_jsonb(private_config),
       pg_catalog.to_jsonb(plugin)
FROM public.workspace_installed_plugins AS installation
JOIN effectime_private.workspace_plugin_configs AS private_config
  ON private_config.installed_plugin_id = installation.id
JOIN public.marketplace_plugins AS plugin
  ON plugin.id = installation.plugin_id
WHERE installation.workspace_id =
      '20000000-0000-4000-8000-000000000001'::uuid
  AND installation.plugin_id =
      '59000000-0000-4000-8000-000000000001'::uuid;

CREATE TABLE contract.plugin_install_lock_timeout_results (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  outcome text NOT NULL,
  elapsed_ms numeric NOT NULL CHECK (elapsed_ms >= 0)
);

CREATE FUNCTION contract.assert_plugin_install_lock_timeout_runtime_baseline()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $assertion$
BEGIN
  IF (
       SELECT count(*)
       FROM contract.plugin_install_lock_timeout_runtime_baseline
     ) <> 1 OR NOT EXISTS (
    SELECT 1
    FROM contract.plugin_install_lock_timeout_runtime_baseline AS baseline
    JOIN public.workspace_installed_plugins AS installation
      ON installation.id = baseline.installed_plugin_id
     AND installation.workspace_id =
         '20000000-0000-4000-8000-000000000001'::uuid
     AND installation.plugin_id =
         '59000000-0000-4000-8000-000000000001'::uuid
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    JOIN public.marketplace_plugins AS plugin
      ON plugin.id = installation.plugin_id
    WHERE pg_catalog.to_jsonb(installation) = baseline.installation_state
      AND pg_catalog.to_jsonb(private_config) = baseline.private_state
      AND pg_catalog.to_jsonb(plugin) = baseline.plugin_state
  ) OR (
    SELECT count(*)
    FROM public.workspace_installed_plugins AS installation
    WHERE installation.workspace_id =
          '20000000-0000-4000-8000-000000000001'::uuid
      AND installation.plugin_id =
          '59000000-0000-4000-8000-000000000001'::uuid
  ) <> 1 OR EXISTS (
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
  ) OR EXISTS (
    SELECT 1
    FROM public.marketplace_plugins AS plugin
    WHERE plugin.install_count IS DISTINCT FROM (
      SELECT pg_catalog.count(*)::integer
      FROM public.workspace_installed_plugins AS installation
      WHERE installation.plugin_id = plugin.id
        AND installation.enabled = true
    )
  ) THEN
    RAISE EXCEPTION
      'Plugin install lock-timeout rollback/retry changed runtime state';
  END IF;
END;
$assertion$;

CREATE FUNCTION contract.plugin_install_lock_timeout_reapply_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $state$
  SELECT pg_catalog.jsonb_build_object(
    'surface', contract.plugin_install_lock_timeout_surface_state(),
    'marketplace_data', (
      SELECT pg_catalog.to_jsonb(state)
      FROM contract.table_state('public.marketplace_plugins'::pg_catalog.regclass) AS state
    ),
    'installation_data', (
      SELECT pg_catalog.to_jsonb(state)
      FROM contract.table_state(
        'public.workspace_installed_plugins'::pg_catalog.regclass
      ) AS state
    ),
    'private_config_data', (
      SELECT pg_catalog.to_jsonb(state)
      FROM contract.table_state(
        'effectime_private.workspace_plugin_configs'::pg_catalog.regclass
      ) AS state
    )
  )
$state$;

DO $seed_postcondition$
DECLARE
  v_source_hash text;
BEGIN
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

  IF (SELECT count(*) FROM contract.plugin_install_lock_timeout_baseline) <> 1
     OR contract.plugin_install_lock_timeout_surface_state() -> 'config'
        IS DISTINCT FROM pg_catalog.to_jsonb(
          ARRAY['search_path=pg_catalog']::text[]
        )
     OR v_source_hash <>
        '7a3a8c82b510c0f71de0219bf703aac8385e7ce6ca78b48f591840ff89ab7da7'
     OR NOT EXISTS (
       SELECT 1
       FROM contract.plugin_install_lock_timeout_runtime_baseline AS baseline
       WHERE baseline.private_state -> 'raw_config' =
             '{"lock_timeout":"baseline"}'::jsonb
         AND baseline.installation_state -> 'config' = '{}'::jsonb
         AND (baseline.plugin_state ->> 'install_count')::integer = 1
     ) THEN
    RAISE EXCEPTION 'Plugin install lock-timeout seed is incomplete';
  END IF;

  PERFORM contract.assert_plugin_install_lock_timeout_runtime_baseline();
END;
$seed_postcondition$;
