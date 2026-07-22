\set ON_ERROR_STOP on

-- Capture the complete catalog shape immediately after v3.51.11. The next
-- migration is allowed to replace only marketplace_install_plugin's body; all
-- table, trigger, policy, ACL and remaining routine metadata must stay exact.
-- Model an already-installed plugin that is no longer published. v3.51.12 must
-- gate only future install/reinstall calls and preserve this grandfathered row.
UPDATE public.marketplace_plugins AS plugin
SET status = 'approved'
FROM public.workspace_installed_plugins AS installation
WHERE installation.id = '52000000-0000-4000-8000-000000000001'::uuid
  AND plugin.id = installation.plugin_id;

CREATE FUNCTION contract.plugin_install_policy_surface_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $state$
  SELECT pg_catalog.jsonb_build_object(
    'relations', (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'identity', expected.identity,
          'oid', relation.oid,
          'kind', relation.relkind,
          'owner', relation.relowner,
          'rls', relation.relrowsecurity,
          'force_rls', relation.relforcerowsecurity,
          'replica_identity', relation.relreplident,
          'acl', COALESCE(relation.relacl::text, '<null>'),
          'columns', (
            SELECT COALESCE(
              pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'number', attribute.attnum,
                  'name', attribute.attname,
                  'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                  'not_null', attribute.attnotnull,
                  'identity', attribute.attidentity,
                  'generated', attribute.attgenerated,
                  'collation', attribute.attcollation,
                  'acl', COALESCE(attribute.attacl::text, '<null>'),
                  'default', COALESCE(
                    pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid),
                    '<null>'
                  )
                ) ORDER BY attribute.attnum
              ),
              '[]'::jsonb
            )
            FROM pg_catalog.pg_attribute AS attribute
            LEFT JOIN pg_catalog.pg_attrdef AS default_value
              ON default_value.adrelid = attribute.attrelid
             AND default_value.adnum = attribute.attnum
            WHERE attribute.attrelid = relation.oid
              AND attribute.attnum > 0
              AND NOT attribute.attisdropped
          ),
          'constraints', (
            SELECT COALESCE(
              pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'oid', constraint_record.oid,
                  'name', constraint_record.conname,
                  'type', constraint_record.contype,
                  'validated', constraint_record.convalidated,
                  'deferrable', constraint_record.condeferrable,
                  'deferred', constraint_record.condeferred,
                  'definition', pg_catalog.pg_get_constraintdef(
                    constraint_record.oid,
                    true
                  )
                ) ORDER BY constraint_record.oid
              ),
              '[]'::jsonb
            )
            FROM pg_catalog.pg_constraint AS constraint_record
            WHERE constraint_record.conrelid = relation.oid
          ),
          'indexes', (
            SELECT COALESCE(
              pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'oid', index_record.indexrelid,
                  'name', index_relation.relname,
                  'valid', index_record.indisvalid,
                  'ready', index_record.indisready,
                  'unique', index_record.indisunique,
                  'primary', index_record.indisprimary,
                  'definition', pg_catalog.pg_get_indexdef(index_record.indexrelid)
                ) ORDER BY index_record.indexrelid
              ),
              '[]'::jsonb
            )
            FROM pg_catalog.pg_index AS index_record
            JOIN pg_catalog.pg_class AS index_relation
              ON index_relation.oid = index_record.indexrelid
            WHERE index_record.indrelid = relation.oid
          ),
          'triggers', (
            SELECT COALESCE(
              pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'oid', trigger_record.oid,
                  'name', trigger_record.tgname,
                  'function', trigger_record.tgfoid,
                  'type', trigger_record.tgtype,
                  'enabled', trigger_record.tgenabled,
                  'internal', trigger_record.tgisinternal,
                  'arguments', pg_catalog.encode(trigger_record.tgargs, 'hex')
                ) ORDER BY trigger_record.oid
              ),
              '[]'::jsonb
            )
            FROM pg_catalog.pg_trigger AS trigger_record
            WHERE trigger_record.tgrelid = relation.oid
          ),
          'policies', (
            SELECT COALESCE(
              pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'oid', policy.oid,
                  'name', policy.polname,
                  'command', policy.polcmd,
                  'permissive', policy.polpermissive,
                  'roles', policy.polroles::text,
                  'using', COALESCE(
                    pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
                    '<null>'
                  ),
                  'check', COALESCE(
                    pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
                    '<null>'
                  )
                ) ORDER BY policy.oid
              ),
              '[]'::jsonb
            )
            FROM pg_catalog.pg_policy AS policy
            WHERE policy.polrelid = relation.oid
          )
        ) ORDER BY expected.identity
      )
      FROM pg_catalog.unnest(ARRAY[
        'public.marketplace_plugins',
        'public.workspace_installed_plugins',
        'effectime_private.workspace_plugin_configs'
      ]) AS expected(identity)
      JOIN pg_catalog.pg_class AS relation
        ON relation.oid = expected.identity::pg_catalog.regclass::oid
    ),
    'routines', (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'identity', expected.identity,
          'oid', procedure.oid,
          'return_type', procedure.prorettype,
          'argument_count', procedure.pronargs,
          'default_count', procedure.pronargdefaults,
          'argument_types', procedure.proargtypes::text,
          'all_argument_types', COALESCE(procedure.proallargtypes::text, '<null>'),
          'argument_modes', COALESCE(procedure.proargmodes::text, '<null>'),
          'argument_names', COALESCE(procedure.proargnames::text, '<null>'),
          'argument_defaults', COALESCE(
            pg_catalog.pg_get_expr(procedure.proargdefaults, 0),
            '<null>'
          ),
          'owner', procedure.proowner,
          'language', procedure.prolang,
          'security_definer', procedure.prosecdef,
          'leakproof', procedure.proleakproof,
          'strict', procedure.proisstrict,
          'returns_set', procedure.proretset,
          'volatility', procedure.provolatile,
          'parallel', procedure.proparallel,
          'kind', procedure.prokind,
          'config', COALESCE(procedure.proconfig::text, '<null>'),
          'acl', COALESCE(procedure.proacl::text, '<null>'),
          'binary', COALESCE(procedure.probin, '<null>'),
          'source', CASE
            WHEN expected.identity =
                 'public.marketplace_install_plugin(uuid,uuid,jsonb)'
            THEN '<intentionally-replaced>'
            ELSE procedure.prosrc
          END
        ) ORDER BY expected.identity
      )
      FROM pg_catalog.unnest(ARRAY[
        'public.marketplace_install_plugin(uuid,uuid,jsonb)',
        'public.marketplace_uninstall_plugin(uuid)',
        'public.marketplace_set_plugin_status(uuid,text)',
        'public.marketplace_get_plugin_config_service_v1(uuid,uuid)',
        'effectime_private.ensure_workspace_plugin_config_v1()',
        'public.workspace_has_any_feature(uuid,text[])',
        'public.has_enterprise_role(uuid,uuid,public.enterprise_role[])',
        'public.is_enterprise_member(uuid,uuid)',
        'public.tenant_enabled_features(uuid)'
      ]) AS expected(identity)
      JOIN pg_catalog.pg_proc AS procedure
        ON procedure.oid = expected.identity::pg_catalog.regprocedure::oid
    )
  )
$state$;

CREATE FUNCTION contract.plugin_install_policy_reapply_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $state$
  SELECT pg_catalog.jsonb_build_object(
    'surface', contract.plugin_install_policy_surface_state(),
    'install_source', (
      SELECT procedure.prosrc
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid =
        'public.marketplace_install_plugin(uuid,uuid,jsonb)'::pg_catalog.regprocedure::oid
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

CREATE TABLE contract.plugin_install_policy_baseline (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  surface_state jsonb NOT NULL,
  install_source text NOT NULL
);

CREATE TABLE contract.plugin_install_policy_grandfathered_baseline (
  installed_plugin_id uuid PRIMARY KEY,
  installation_state jsonb NOT NULL,
  private_state jsonb NOT NULL,
  plugin_state jsonb NOT NULL
);

INSERT INTO contract.plugin_install_policy_grandfathered_baseline (
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
WHERE installation.id = '52000000-0000-4000-8000-000000000001'::uuid
  AND plugin.status = 'approved';

INSERT INTO contract.plugin_install_policy_baseline (
  singleton,
  surface_state,
  install_source
) VALUES (
  true,
  contract.plugin_install_policy_surface_state(),
  (
    SELECT procedure.prosrc
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid =
      'public.marketplace_install_plugin(uuid,uuid,jsonb)'::pg_catalog.regprocedure::oid
  )
);

DO $seed_postcondition$
BEGIN
  IF (SELECT count(*) FROM contract.plugin_install_policy_baseline) <> 1 THEN
    RAISE EXCEPTION 'Plugin install policy catalog baseline was not captured';
  END IF;

  IF (
    SELECT count(*)
    FROM contract.plugin_install_policy_grandfathered_baseline
  ) <> 1 THEN
    RAISE EXCEPTION
      'Grandfathered approved plugin installation baseline was not captured';
  END IF;
END;
$seed_postcondition$;
