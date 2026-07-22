\set ON_ERROR_STOP on

-- Seed every historically accepted JSONB shape before applying the forward
-- migration. Values are contract sentinels only; assertions never print them.
UPDATE public.workspace_installed_plugins
SET config = '{"endpoint":"https://hooks.example.test/contract","sensitive_marker":"must-stay-private","nested":{"unicode":"árvíztűrő"}}'::jsonb
WHERE id = '52000000-0000-4000-8000-000000000001'::uuid;

INSERT INTO public.workspace_installed_plugins (
  id, workspace_id, plugin_id, config, enabled, installed_by, installed_at, updated_at
)
SELECT
  fixture.id,
  fixture.workspace_id,
  plugin.id,
  fixture.config,
  true,
  fixture.installed_by,
  fixture.installed_at,
  fixture.updated_at
FROM (
  VALUES
    (
      '52000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'birthday-bot'::text,
      '["array-value",{"nested":true}]'::jsonb,
      '10000000-0000-4000-8000-000000000005'::uuid,
      '2026-07-22 04:02:00+00'::timestamptz,
      '2026-07-22 04:02:00+00'::timestamptz
    ),
    (
      '52000000-0000-4000-8000-000000000003'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'slack-leave-notify'::text,
      '"scalar-value"'::jsonb,
      '10000000-0000-4000-8000-000000000001'::uuid,
      '2026-07-22 04:03:00+00'::timestamptz,
      '2026-07-22 04:03:00+00'::timestamptz
    ),
    (
      '52000000-0000-4000-8000-000000000004'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'slack-leave-notify'::text,
      'null'::jsonb,
      '10000000-0000-4000-8000-000000000005'::uuid,
      '2026-07-22 04:04:00+00'::timestamptz,
      '2026-07-22 04:04:00+00'::timestamptz
    )
) AS fixture(id, workspace_id, plugin_slug, config, installed_by, installed_at, updated_at)
JOIN public.marketplace_plugins AS plugin ON plugin.slug = fixture.plugin_slug;

CREATE TABLE contract.plugin_config_expected (
  installed_plugin_id uuid PRIMARY KEY,
  raw_config jsonb NOT NULL
);

INSERT INTO contract.plugin_config_expected (installed_plugin_id, raw_config)
SELECT id, config
FROM public.workspace_installed_plugins;

CREATE TABLE contract.plugin_installation_metadata_baseline (
  installed_plugin_id uuid PRIMARY KEY,
  metadata jsonb NOT NULL
);

INSERT INTO contract.plugin_installation_metadata_baseline (installed_plugin_id, metadata)
SELECT id, pg_catalog.to_jsonb(installation) - 'config'
FROM public.workspace_installed_plugins AS installation;

CREATE TABLE contract.plugin_function_baseline (
  identity text PRIMARY KEY,
  object_oid oid NOT NULL,
  return_type oid NOT NULL,
  argument_defaults text,
  owner_oid oid NOT NULL,
  security_definer boolean NOT NULL,
  function_config text[],
  acl text,
  source text NOT NULL
);

INSERT INTO contract.plugin_function_baseline (
  identity,
  object_oid,
  return_type,
  argument_defaults,
  owner_oid,
  security_definer,
  function_config,
  acl,
  source
)
SELECT
  identity,
  procedure.oid,
  procedure.prorettype,
  pg_catalog.pg_get_expr(procedure.proargdefaults, 0),
  procedure.proowner,
  procedure.prosecdef,
  procedure.proconfig,
  procedure.proacl::text,
  procedure.prosrc
FROM pg_catalog.unnest(ARRAY[
  'public.marketplace_install_plugin(uuid,uuid,jsonb)',
  'public.marketplace_uninstall_plugin(uuid)'
]) AS expected(identity)
JOIN pg_catalog.pg_proc AS procedure
  ON procedure.oid = identity::pg_catalog.regprocedure::oid;

CREATE TABLE contract.private_schema_baseline (
  schema_oid oid PRIMARY KEY,
  schema_owner oid NOT NULL,
  schema_acl text,
  helper_oid oid NOT NULL,
  helper_owner oid NOT NULL,
  helper_acl text,
  helper_source text NOT NULL
);

INSERT INTO contract.private_schema_baseline (
  schema_oid,
  schema_owner,
  schema_acl,
  helper_oid,
  helper_owner,
  helper_acl,
  helper_source
)
SELECT
  namespace.oid,
  namespace.nspowner,
  namespace.nspacl::text,
  helper.oid,
  helper.proowner,
  helper.proacl::text,
  helper.prosrc
FROM pg_catalog.pg_namespace AS namespace
JOIN pg_catalog.pg_proc AS helper
  ON helper.oid =
     'effectime_private.contract_existing_helper()'::pg_catalog.regprocedure::oid
WHERE namespace.nspname = 'effectime_private';

DO $seed_postcondition$
BEGIN
  IF (SELECT count(*) FROM contract.plugin_config_expected) <> 4 THEN
    RAISE EXCEPTION 'Plugin secret fixture did not seed all historical JSONB shapes';
  END IF;
  IF pg_catalog.to_regclass('effectime_private.workspace_plugin_configs') IS NOT NULL THEN
    RAISE EXCEPTION 'Plugin private config table unexpectedly existed before migration';
  END IF;
  IF (SELECT count(*) FROM contract.private_schema_baseline) <> 1 THEN
    RAISE EXCEPTION 'Production-shaped private schema baseline was not captured';
  END IF;
END;
$seed_postcondition$;
