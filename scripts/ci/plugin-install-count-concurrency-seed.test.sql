\set ON_ERROR_STOP on

-- This fixture runs only inside the isolated PostgreSQL contract container.
-- Capture every v3.51.12 catalog contract while redacting only the uninstall
-- routine body that v3.51.13 is explicitly allowed to replace.
CREATE FUNCTION contract.plugin_install_count_surface_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $state$
  WITH policy_state AS (
    SELECT contract.plugin_install_policy_surface_state() AS value
  ),
  redacted_routines AS (
    SELECT pg_catalog.jsonb_agg(
             CASE
               WHEN routine.value ->> 'identity' =
                    'public.marketplace_uninstall_plugin(uuid)'
               THEN pg_catalog.jsonb_set(
                      routine.value,
                      '{source}',
                      pg_catalog.to_jsonb('<intentionally-replaced>'::text)
                    )
               ELSE routine.value
             END
             ORDER BY routine.ordinality
           ) AS value
    FROM policy_state
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      policy_state.value -> 'routines'
    ) WITH ORDINALITY AS routine(value, ordinality)
  )
  SELECT pg_catalog.jsonb_set(
           policy_state.value,
           '{routines}',
           redacted_routines.value
         )
  FROM policy_state
  CROSS JOIN redacted_routines
$state$;

CREATE FUNCTION contract.plugin_install_count_reapply_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $state$
  SELECT pg_catalog.jsonb_build_object(
    'surface', contract.plugin_install_count_surface_state(),
    'uninstall_source', (
      SELECT procedure.prosrc
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid =
        'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid
    ),
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

CREATE TABLE contract.plugin_install_count_baseline (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  surface_state jsonb NOT NULL,
  uninstall_oid oid NOT NULL,
  uninstall_source text NOT NULL
);

CREATE TABLE contract.plugin_install_count_grandfathered_baseline (
  installed_plugin_id uuid PRIMARY KEY,
  installation_state jsonb NOT NULL,
  private_state jsonb NOT NULL,
  plugin_state jsonb NOT NULL
);

INSERT INTO contract.plugin_install_count_grandfathered_baseline (
  installed_plugin_id,
  installation_state,
  private_state,
  plugin_state
)
SELECT installation.id,
       pg_catalog.to_jsonb(installation),
       pg_catalog.to_jsonb(private_config),
       pg_catalog.to_jsonb(plugin)
FROM public.workspace_installed_plugins AS installation
JOIN effectime_private.workspace_plugin_configs AS private_config
  ON private_config.installed_plugin_id = installation.id
JOIN public.marketplace_plugins AS plugin
  ON plugin.id = installation.plugin_id
WHERE installation.id = '52000000-0000-4000-8000-000000000001'::uuid;

INSERT INTO contract.plugin_install_count_baseline (
  singleton,
  surface_state,
  uninstall_oid,
  uninstall_source
)
SELECT true,
       contract.plugin_install_count_surface_state(),
       procedure.oid,
       procedure.prosrc
FROM pg_catalog.pg_proc AS procedure
WHERE procedure.oid =
  'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid;

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
  '58000000-0000-4000-8000-000000000001',
  'contract-install-count-race',
  'Contract Install Count Race',
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
  '58000000-0000-4000-8000-000000000001'::uuid,
  '{"race":"legacy-baseline"}'::jsonb
);
RESET ROLE;

DO $seed_postcondition$
BEGIN
  IF (SELECT count(*) FROM contract.plugin_install_count_baseline) <> 1
     OR (
       SELECT count(*)
       FROM contract.plugin_install_count_grandfathered_baseline
     ) <> 1
     OR (
       SELECT count(*)
       FROM public.workspace_installed_plugins
       WHERE plugin_id = '58000000-0000-4000-8000-000000000001'::uuid
         AND enabled
     ) <> 1
     OR (
       SELECT install_count
       FROM public.marketplace_plugins
       WHERE id = '58000000-0000-4000-8000-000000000001'::uuid
     ) <> 1
     OR NOT EXISTS (
       SELECT 1
       FROM public.workspace_installed_plugins AS installation
       JOIN effectime_private.workspace_plugin_configs AS private_config
         ON private_config.installed_plugin_id = installation.id
       WHERE installation.plugin_id =
             '58000000-0000-4000-8000-000000000001'::uuid
         AND installation.workspace_id =
             '20000000-0000-4000-8000-000000000001'::uuid
         AND installation.config = '{}'::jsonb
         AND private_config.raw_config = '{"race":"legacy-baseline"}'::jsonb
     ) THEN
    RAISE EXCEPTION 'Plugin install-count concurrency seed is incomplete';
  END IF;
END;
$seed_postcondition$;
