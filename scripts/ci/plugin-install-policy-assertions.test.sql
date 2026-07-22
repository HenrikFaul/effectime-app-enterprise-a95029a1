\set ON_ERROR_STOP on

DO $catalog_contract$
DECLARE
  v_baseline contract.plugin_install_policy_baseline%ROWTYPE;
  v_install pg_catalog.pg_proc%ROWTYPE;
  v_source_upper text;
  v_entitlement_position integer;
  v_initial_status_position integer;
  v_public_upsert_position integer;
  v_private_upsert_position integer;
  v_lock_position integer;
  v_count_position integer;
BEGIN
  SELECT * INTO STRICT v_baseline
  FROM contract.plugin_install_policy_baseline
  WHERE singleton;

  IF contract.plugin_install_policy_surface_state()
     IS DISTINCT FROM v_baseline.surface_state THEN
    RAISE EXCEPTION
      'Plugin install policy migration changed a non-source catalog contract';
  END IF;

  SELECT * INTO STRICT v_install
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid =
    'public.marketplace_install_plugin(uuid,uuid,jsonb)'::pg_catalog.regprocedure::oid;

  IF v_install.prosrc IS NOT DISTINCT FROM v_baseline.install_source THEN
    RAISE EXCEPTION 'Plugin install policy migration did not replace the RPC body';
  END IF;

  -- Lock-order contract: entitlement and a nonlocking availability check must
  -- precede both installation writes. The plugin UPDATE lock is acquired only
  -- after the public/private upserts and held through the count refresh.
  v_source_upper := pg_catalog.upper(v_install.prosrc);
  v_entitlement_position := pg_catalog.strpos(
    v_source_upper,
    'PUBLIC.WORKSPACE_HAS_ANY_FEATURE'
  );
  v_initial_status_position := pg_catalog.strpos(
    v_source_upper,
    'SELECT PLUGIN.STATUS'
  );
  v_public_upsert_position := pg_catalog.strpos(
    v_source_upper,
    'INSERT INTO PUBLIC.WORKSPACE_INSTALLED_PLUGINS'
  );
  v_private_upsert_position := pg_catalog.strpos(
    v_source_upper,
    'INSERT INTO EFFECTIME_PRIVATE.WORKSPACE_PLUGIN_CONFIGS'
  );
  v_lock_position := pg_catalog.strpos(
    v_source_upper,
    E'\n  FOR NO KEY UPDATE;'
  );
  v_count_position := pg_catalog.strpos(
    v_source_upper,
    'UPDATE PUBLIC.MARKETPLACE_PLUGINS AS PLUGIN'
  );

  IF v_entitlement_position = 0
     OR v_initial_status_position = 0
     OR v_public_upsert_position = 0
     OR v_private_upsert_position = 0
     OR v_lock_position = 0
     OR v_count_position = 0
     OR NOT (
       v_entitlement_position < v_initial_status_position
       AND v_initial_status_position < v_public_upsert_position
       AND v_public_upsert_position < v_private_upsert_position
       AND v_private_upsert_position < v_lock_position
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
      'Plugin install policy lock/check ordering contract is incompatible';
  END IF;
END;
$catalog_contract$;

DO $grandfathered_approved_installation_preserved$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM contract.plugin_install_policy_grandfathered_baseline AS baseline
    JOIN public.workspace_installed_plugins AS installation
      ON installation.id = baseline.installed_plugin_id
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    JOIN public.marketplace_plugins AS plugin
      ON plugin.id = installation.plugin_id
    WHERE baseline.installed_plugin_id =
          '52000000-0000-4000-8000-000000000001'::uuid
      AND plugin.status = 'approved'
      AND pg_catalog.to_jsonb(installation) = baseline.installation_state
      AND pg_catalog.to_jsonb(private_config) = baseline.private_state
      AND pg_catalog.to_jsonb(plugin) = baseline.plugin_state
  ) THEN
    RAISE EXCEPTION
      'Grandfathered approved plugin installation changed during v3.51.12';
  END IF;
END;
$grandfathered_approved_installation_preserved$;

BEGIN;

INSERT INTO public.marketplace_plugins (
  id,
  slug,
  name,
  version,
  category,
  manifest,
  status,
  pricing_model
) VALUES
  (
    '56000000-0000-4000-8000-000000000001',
    'contract-policy-approved',
    'Contract Policy Approved',
    '1.0.0',
    'integration',
    '{}'::jsonb,
    'approved',
    'free'
  ),
  (
    '56000000-0000-4000-8000-000000000002',
    'contract-policy-pending',
    'Contract Policy Pending',
    '1.0.0',
    'integration',
    '{}'::jsonb,
    'pending',
    'free'
  ),
  (
    '56000000-0000-4000-8000-000000000003',
    'contract-policy-rejected',
    'Contract Policy Rejected',
    '1.0.0',
    'integration',
    '{}'::jsonb,
    'rejected',
    'free'
  ),
  (
    '56000000-0000-4000-8000-000000000004',
    'contract-policy-archived',
    'Contract Policy Archived',
    '1.0.0',
    'integration',
    '{}'::jsonb,
    'archived',
    'free'
  ),
  (
    '56000000-0000-4000-8000-000000000005',
    'contract-policy-published',
    'Contract Policy Published',
    '1.0.0',
    'integration',
    '{}'::jsonb,
    'published',
    'free'
  );

CREATE TABLE contract.plugin_install_policy_runtime_baseline AS
SELECT plugin.id AS plugin_id, pg_catalog.to_jsonb(plugin) AS plugin_state
FROM public.marketplace_plugins AS plugin
WHERE plugin.id BETWEEN
      '56000000-0000-4000-8000-000000000001'::uuid
      AND '56000000-0000-4000-8000-000000000005'::uuid;

CREATE TABLE contract.plugin_install_policy_runtime_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  private_count_before_policy_calls bigint NOT NULL,
  installed_id uuid,
  reinstall_kept_id boolean,
  uninstall_result jsonb
);

INSERT INTO contract.plugin_install_policy_runtime_state (
  singleton,
  private_count_before_policy_calls
)
SELECT true, count(*)
FROM effectime_private.workspace_plugin_configs;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

DO $unentitled_owner_denied$
BEGIN
  BEGIN
    PERFORM public.marketplace_install_plugin(
      '20000000-0000-4000-8000-000000000001'::uuid,
      '56000000-0000-4000-8000-000000000005'::uuid,
      '{"unentitled":"must-not-persist"}'::jsonb
    );
    RAISE EXCEPTION 'Unentitled owner plugin install unexpectedly succeeded'
      USING ERRCODE = 'ZX001';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM IS DISTINCT FROM
         'Plugin installation feature is not enabled for this workspace' THEN
        RAISE;
      END IF;
  END;
END;
$unentitled_owner_denied$;

RESET ROLE;

DO $unentitled_zero_side_effects$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    WHERE installation.plugin_id BETWEEN
          '56000000-0000-4000-8000-000000000001'::uuid
          AND '56000000-0000-4000-8000-000000000005'::uuid
  ) OR (
    SELECT count(*) FROM effectime_private.workspace_plugin_configs
  ) <> (
    SELECT private_count_before_policy_calls
    FROM contract.plugin_install_policy_runtime_state
    WHERE singleton
  ) OR EXISTS (
    SELECT 1
    FROM public.marketplace_plugins AS plugin
    JOIN contract.plugin_install_policy_runtime_baseline AS baseline
      ON baseline.plugin_id = plugin.id
    WHERE pg_catalog.to_jsonb(plugin) IS DISTINCT FROM baseline.plugin_state
  ) THEN
    RAISE EXCEPTION 'Unentitled plugin install left a partial side effect';
  END IF;
END;
$unentitled_zero_side_effects$;

UPDATE public.tenant_subscriptions
SET status = 'active'
WHERE tenant_id = '21000000-0000-4000-8000-000000000001'::uuid
  AND tier_id = (SELECT id FROM public.tiers WHERE tier_key = 'enterprise');

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

DO $nonpublished_plugins_denied$
DECLARE
  v_fixture record;
BEGIN
  FOR v_fixture IN
    SELECT plugin.id, plugin.status
    FROM public.marketplace_plugins AS plugin
    WHERE plugin.id BETWEEN
          '56000000-0000-4000-8000-000000000001'::uuid
          AND '56000000-0000-4000-8000-000000000004'::uuid
    ORDER BY plugin.id
  LOOP
    BEGIN
      PERFORM public.marketplace_install_plugin(
        '20000000-0000-4000-8000-000000000001'::uuid,
        v_fixture.id,
        pg_catalog.jsonb_build_object('status', v_fixture.status)
      );
      RAISE EXCEPTION 'Non-published plugin install unexpectedly succeeded'
        USING ERRCODE = 'ZX001';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM IS DISTINCT FROM pg_catalog.format(
          'Plugin not available for install (status=%s)',
          v_fixture.status
        ) THEN
          RAISE;
        END IF;
    END;
  END LOOP;
END;
$nonpublished_plugins_denied$;

RESET ROLE;

DO $nonpublished_zero_side_effects$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    WHERE installation.plugin_id BETWEEN
          '56000000-0000-4000-8000-000000000001'::uuid
          AND '56000000-0000-4000-8000-000000000004'::uuid
  ) OR (
    SELECT count(*) FROM effectime_private.workspace_plugin_configs
  ) <> (
    SELECT private_count_before_policy_calls
    FROM contract.plugin_install_policy_runtime_state
    WHERE singleton
  ) OR EXISTS (
    SELECT 1
    FROM public.marketplace_plugins AS plugin
    JOIN contract.plugin_install_policy_runtime_baseline AS baseline
      ON baseline.plugin_id = plugin.id
    WHERE pg_catalog.to_jsonb(plugin) IS DISTINCT FROM baseline.plugin_state
  ) THEN
    RAISE EXCEPTION 'Non-published plugin denial left a partial side effect';
  END IF;
END;
$nonpublished_zero_side_effects$;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT public.marketplace_install_plugin(
  '20000000-0000-4000-8000-000000000001'::uuid,
  '56000000-0000-4000-8000-000000000005'::uuid,
  '{"published":"private-only"}'::jsonb
) AS policy_installed_id \gset
RESET ROLE;

UPDATE contract.plugin_install_policy_runtime_state
SET installed_id = :'policy_installed_id'::uuid
WHERE singleton;

DO $published_install_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE installation.id = (
      SELECT installed_id
      FROM contract.plugin_install_policy_runtime_state
      WHERE singleton
    )
      AND installation.workspace_id =
          '20000000-0000-4000-8000-000000000001'::uuid
      AND installation.plugin_id =
          '56000000-0000-4000-8000-000000000005'::uuid
      AND installation.config = '{}'::jsonb
      AND installation.enabled
      AND installation.installed_by =
          '10000000-0000-4000-8000-000000000001'::uuid
      AND private_config.raw_config =
          '{"published":"private-only"}'::jsonb
  ) OR (
    SELECT plugin.install_count
    FROM public.marketplace_plugins AS plugin
    WHERE plugin.id = '56000000-0000-4000-8000-000000000005'::uuid
  ) <> 1 THEN
    RAISE EXCEPTION 'Entitled published plugin install was not atomic';
  END IF;
END;
$published_install_contract$;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT (
  public.marketplace_install_plugin(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '56000000-0000-4000-8000-000000000005'::uuid,
    'null'::jsonb
  ) = :'policy_installed_id'::uuid
) AS policy_reinstall_kept_id \gset
RESET ROLE;

UPDATE contract.plugin_install_policy_runtime_state
SET reinstall_kept_id = :'policy_reinstall_kept_id'::boolean
WHERE singleton;

DO $published_reinstall_contract$
BEGIN
  IF NOT (
    SELECT reinstall_kept_id
    FROM contract.plugin_install_policy_runtime_state
    WHERE singleton
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.workspace_installed_plugins AS installation
    JOIN effectime_private.workspace_plugin_configs AS private_config
      ON private_config.installed_plugin_id = installation.id
    WHERE installation.id = (
      SELECT installed_id
      FROM contract.plugin_install_policy_runtime_state
      WHERE singleton
    )
      AND installation.config = '{}'::jsonb
      AND installation.enabled
      AND private_config.raw_config = 'null'::jsonb
  ) OR (
    SELECT plugin.install_count
    FROM public.marketplace_plugins AS plugin
    WHERE plugin.id = '56000000-0000-4000-8000-000000000005'::uuid
  ) <> 1 THEN
    RAISE EXCEPTION 'Entitled published plugin reinstall changed identity/count/config';
  END IF;
END;
$published_reinstall_contract$;

UPDATE public.tenant_subscriptions
SET status = 'inactive'
WHERE tenant_id = '21000000-0000-4000-8000-000000000001'::uuid
  AND tier_id = (SELECT id FROM public.tiers WHERE tier_key = 'enterprise');

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT public.marketplace_uninstall_plugin(
  :'policy_installed_id'::uuid
) AS policy_uninstall_result \gset
RESET ROLE;

UPDATE contract.plugin_install_policy_runtime_state
SET uninstall_result = :'policy_uninstall_result'::jsonb
WHERE singleton;

DO $uninstall_after_entitlement_loss$
BEGIN
  IF NOT (
       SELECT (uninstall_result->>'ok')::boolean
       FROM contract.plugin_install_policy_runtime_state
       WHERE singleton
     )
     OR EXISTS (
       SELECT 1
       FROM public.workspace_installed_plugins
       WHERE id = (
         SELECT installed_id
         FROM contract.plugin_install_policy_runtime_state
         WHERE singleton
       )
     ) OR EXISTS (
       SELECT 1
       FROM effectime_private.workspace_plugin_configs
       WHERE installed_plugin_id = (
         SELECT installed_id
         FROM contract.plugin_install_policy_runtime_state
         WHERE singleton
       )
     ) OR (
       SELECT plugin.install_count
       FROM public.marketplace_plugins AS plugin
       WHERE plugin.id = '56000000-0000-4000-8000-000000000005'::uuid
     ) <> 0 THEN
    RAISE EXCEPTION 'Plugin uninstall was blocked or inconsistent after entitlement loss';
  END IF;
END;
$uninstall_after_entitlement_loss$;

ROLLBACK;

\echo 'Plugin install entitlement/published-only PostgreSQL contract passed.'
