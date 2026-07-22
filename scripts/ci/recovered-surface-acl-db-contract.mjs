import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POSTGRES_IMAGE =
  "postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929";
export const CONTRACT_DATABASE = "effectime_recovered_surface_acl_contract";
export const SETUP_SQL_PATH = "/contract/setup.sql";
export const CLOCK_MIGRATION_SQL_PATH = "/contract/clock-migration.sql";
export const MARKETPLACE_MIGRATION_SQL_PATH = "/contract/marketplace-migration.sql";
export const CLOCKOUT_MIGRATION_SQL_PATH = "/contract/clockout-migration.sql";
export const HARDENING_MIGRATION_SQL_PATH = "/contract/hardening-migration.sql";
export const ASSERTIONS_SQL_PATH = "/contract/assertions.sql";
export const PLUGIN_SECRET_SEED_SQL_PATH = "/contract/plugin-secret-seed.sql";
export const PLUGIN_SECRET_MIGRATION_SQL_PATH = "/contract/plugin-secret-migration.sql";
export const PLUGIN_SECRET_ASSERTIONS_SQL_PATH = "/contract/plugin-secret-assertions.sql";
export const PLUGIN_INSTALL_POLICY_SEED_SQL_PATH =
  "/contract/plugin-install-policy-seed.sql";
export const PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH =
  "/contract/plugin-install-policy-migration.sql";
export const PLUGIN_INSTALL_POLICY_ASSERTIONS_SQL_PATH =
  "/contract/plugin-install-policy-assertions.sql";
export const PLUGIN_INSTALL_COUNT_SEED_SQL_PATH =
  "/contract/plugin-install-count-seed.sql";
export const PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH =
  "/contract/plugin-install-count-migration.sql";
export const PLUGIN_INSTALL_COUNT_ASSERTIONS_SQL_PATH =
  "/contract/plugin-install-count-assertions.sql";
export const OWNERSHIP_LABEL_KEY = "com.effectime.ci.recovered-surface-acl-contract";
export const ASYNC_DOCKER_TIMEOUT_MILLISECONDS = 45_000;
export const VERIFY_FAILED_PREFLIGHT_SQL =
  "SELECT contract.assert_preflight_left_no_partial_mutation();";
export const VERIFY_PLUGIN_SECRET_FAILED_PREFLIGHT_SQL =
  "SELECT contract.assert_core_unchanged(true); DO $$ BEGIN IF pg_catalog.to_regclass('effectime_private.workspace_plugin_configs') IS NOT NULL OR pg_catalog.to_regprocedure('effectime_private.ensure_workspace_plugin_config_v1()') IS NOT NULL OR pg_catalog.to_regprocedure('public.marketplace_get_plugin_config_service_v1(uuid,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Failed plugin secret preflight left partial mutation'; END IF; END $$;";
export const VERIFY_PLUGIN_INSTALL_POLICY_FAILED_PREFLIGHT_SQL =
  "DO $verify$ BEGIN IF contract.plugin_install_policy_surface_state() IS DISTINCT FROM (SELECT surface_state FROM contract.plugin_install_policy_baseline WHERE singleton) OR (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid = 'public.marketplace_install_plugin(uuid,uuid,jsonb)'::pg_catalog.regprocedure::oid) IS DISTINCT FROM (SELECT install_source FROM contract.plugin_install_policy_baseline WHERE singleton) OR contract.pgcrypto_trust_state() IS DISTINCT FROM (SELECT state_value FROM contract.state_baseline WHERE state_name = 'pgcrypto_trust') OR pg_catalog.has_schema_privilege('authenticated', 'public', 'CREATE') OR pg_catalog.has_schema_privilege('anon', 'public', 'CREATE') OR pg_catalog.has_schema_privilege('service_role', 'public', 'CREATE') THEN RAISE EXCEPTION 'Failed plugin install policy preflight left partial mutation'; END IF; END; $verify$;";
export const VERIFY_PLUGIN_INSTALL_COUNT_FAILED_PREFLIGHT_SQL =
  "DO $verify$ BEGIN IF contract.plugin_install_count_surface_state() IS DISTINCT FROM (SELECT surface_state FROM contract.plugin_install_count_baseline WHERE singleton) OR (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid = 'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid) IS DISTINCT FROM (SELECT uninstall_source FROM contract.plugin_install_count_baseline WHERE singleton) THEN RAISE EXCEPTION 'Failed plugin install-count preflight left partial mutation'; END IF; END; $verify$;";
export const CAPTURE_HARDENED_STATE_SQL =
  "INSERT INTO contract.state_baseline (state_name, state_value) VALUES ('hardened_mutable', contract.mutable_surface_state()), ('hardened_qr_source', (SELECT pg_catalog.jsonb_build_object('prosrc', procedure.prosrc) FROM pg_catalog.pg_proc AS procedure WHERE procedure.oid = 'public.clock_generate_qr(uuid,integer)'::pg_catalog.regprocedure::oid)) ON CONFLICT (state_name) DO UPDATE SET state_value = EXCLUDED.state_value;";
export const SEED_REAPPLY_DRIFT_SQL =
  [
    "GRANT SELECT ON TABLE public.clock_events TO PUBLIC",
    "GRANT UPDATE (payload) ON TABLE public.plugin_webhook_events TO anon, authenticated",
    "GRANT EXECUTE ON FUNCTION public.haversine_km(numeric,numeric,numeric,numeric) TO PUBLIC, anon, authenticated",
    "ALTER FUNCTION public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid) SET search_path = public",
  ].join("; ") + ";";
export const SEED_PLUGIN_SECRET_REAPPLY_DRIFT_SQL =
  [
    "GRANT SELECT (raw_config) ON TABLE effectime_private.workspace_plugin_configs TO PUBLIC",
    "GRANT UPDATE (raw_config) ON TABLE effectime_private.workspace_plugin_configs TO authenticated",
    "GRANT REFERENCES (raw_config) ON TABLE effectime_private.workspace_plugin_configs TO service_role",
    "GRANT EXECUTE ON FUNCTION public.marketplace_get_plugin_config_service_v1(uuid,uuid) TO authenticated",
  ].join("; ") + ";";
export const PLUGIN_INSTALL_POLICY_LOCK_HOLDER_APPLICATION_NAME =
  "effectime_plugin_install_policy_lock_holder";
export const PLUGIN_INSTALL_POLICY_LOCK_BARRIER_APPLICATION_NAME =
  "effectime_plugin_install_policy_lock_barrier";
export const PLUGIN_INSTALL_POLICY_STATUS_HOLDER_APPLICATION_NAME =
  "effectime_plugin_install_policy_status_holder";
export const PLUGIN_INSTALL_POLICY_STATUS_BARRIER_APPLICATION_NAME =
  "effectime_plugin_install_policy_status_barrier";
export const PLUGIN_INSTALL_POLICY_INSTALL_WAITER_APPLICATION_NAME =
  "effectime_plugin_install_policy_install_waiter";
const PLUGIN_INSTALL_POLICY_LOCK_BARRIER_KEY = "35112, 1";
const PLUGIN_INSTALL_POLICY_STATUS_BARRIER_KEY = "35112, 2";
export const PLUGIN_INSTALL_POLICY_LOCK_BARRIER_SQL = [
  `SET application_name = '${PLUGIN_INSTALL_POLICY_LOCK_BARRIER_APPLICATION_NAME}'`,
  "SET statement_timeout = '42s'",
  `SELECT pg_catalog.pg_advisory_lock(${PLUGIN_INSTALL_POLICY_LOCK_BARRIER_KEY})`,
  "SELECT pg_catalog.pg_sleep(35)",
].join("; ") + ";";
export const PLUGIN_INSTALL_POLICY_STATUS_BARRIER_SQL = [
  `SET application_name = '${PLUGIN_INSTALL_POLICY_STATUS_BARRIER_APPLICATION_NAME}'`,
  "SET statement_timeout = '42s'",
  `SELECT pg_catalog.pg_advisory_lock(${PLUGIN_INSTALL_POLICY_STATUS_BARRIER_KEY})`,
  "SELECT pg_catalog.pg_sleep(35)",
].join("; ") + ";";
export const SEED_PLUGIN_INSTALL_POLICY_CONCURRENCY_SQL = [
  "UPDATE public.tenant_subscriptions SET status = 'active' WHERE tier_id = (SELECT id FROM public.tiers WHERE tier_key = 'enterprise')",
  "INSERT INTO public.marketplace_plugins (id, slug, name, version, category, manifest, status, pricing_model) VALUES ('57000000-0000-4000-8000-000000000001'::uuid, 'contract-policy-lock-holder', 'Contract Policy Lock Holder', '1.0.0', 'integration', '{}'::jsonb, 'published', 'free'), ('57000000-0000-4000-8000-000000000002'::uuid, 'contract-policy-concurrent-count', 'Contract Policy Concurrent Count', '1.0.0', 'integration', '{}'::jsonb, 'published', 'free'), ('57000000-0000-4000-8000-000000000003'::uuid, 'contract-policy-status-race', 'Contract Policy Status Race', '1.0.0', 'integration', '{}'::jsonb, 'published', 'free')",
  "SET ROLE authenticated",
  "SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false)",
  "SELECT public.marketplace_install_plugin('20000000-0000-4000-8000-000000000001'::uuid, '57000000-0000-4000-8000-000000000003'::uuid, '{\"concurrency\":\"original\"}'::jsonb)",
  "RESET ROLE",
  "CREATE TABLE contract.plugin_status_race_baseline AS SELECT pg_catalog.to_jsonb(installation) AS installation_state, pg_catalog.to_jsonb(private_config) AS private_state, plugin.install_count FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id JOIN public.marketplace_plugins AS plugin ON plugin.id = installation.plugin_id WHERE installation.workspace_id = '20000000-0000-4000-8000-000000000001'::uuid AND installation.plugin_id = '57000000-0000-4000-8000-000000000003'::uuid",
].join("; ") + ";";
export const PLUGIN_INSTALL_POLICY_LOCK_HOLDER_SQL = [
  `SET application_name = '${PLUGIN_INSTALL_POLICY_LOCK_HOLDER_APPLICATION_NAME}'`,
  "BEGIN",
  "SET LOCAL ROLE authenticated",
  "SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true)",
  "SELECT public.marketplace_install_plugin('20000000-0000-4000-8000-000000000001'::uuid, '57000000-0000-4000-8000-000000000001'::uuid, '{\"concurrency\":\"lock-holder\"}'::jsonb)",
  "RESET ROLE",
  `SELECT pg_catalog.pg_advisory_lock(${PLUGIN_INSTALL_POLICY_LOCK_BARRIER_KEY})`,
  "COMMIT",
].join("; ") + ";";
export const PLUGIN_INSTALL_POLICY_LOCK_BARRIER_READY_SQL =
  `SELECT count(*) FROM pg_catalog.pg_stat_activity AS barrier WHERE barrier.application_name = '${PLUGIN_INSTALL_POLICY_LOCK_BARRIER_APPLICATION_NAME}' AND barrier.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_catalog.pg_locks AS advisory_lock WHERE advisory_lock.pid = barrier.pid AND advisory_lock.locktype = 'advisory' AND advisory_lock.granted);`;
export const PLUGIN_INSTALL_POLICY_LOCK_HOLDER_READY_SQL =
  `SELECT count(*) FROM pg_catalog.pg_stat_activity AS holder JOIN pg_catalog.pg_stat_activity AS barrier ON barrier.application_name = '${PLUGIN_INSTALL_POLICY_LOCK_BARRIER_APPLICATION_NAME}' WHERE holder.application_name = '${PLUGIN_INSTALL_POLICY_LOCK_HOLDER_APPLICATION_NAME}' AND holder.wait_event_type = 'Lock' AND pg_catalog.pg_blocking_pids(holder.pid) = ARRAY[barrier.pid];`;
export const PLUGIN_INSTALL_POLICY_BLOCKED_STATUS_SQL =
  "SET lock_timeout = '750ms'; UPDATE public.marketplace_plugins SET status = 'approved' WHERE id = '57000000-0000-4000-8000-000000000001'::uuid;";
export const VERIFY_PLUGIN_INSTALL_POLICY_LOCK_SQL =
  "DO $verify$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.workspace_id = '20000000-0000-4000-8000-000000000001'::uuid AND installation.plugin_id = '57000000-0000-4000-8000-000000000001'::uuid AND installation.config = '{}'::jsonb AND installation.enabled AND private_config.raw_config = '{\"concurrency\":\"lock-holder\"}'::jsonb) OR (SELECT status FROM public.marketplace_plugins WHERE id = '57000000-0000-4000-8000-000000000001'::uuid) <> 'published' OR (SELECT install_count FROM public.marketplace_plugins WHERE id = '57000000-0000-4000-8000-000000000001'::uuid) <> 1 THEN RAISE EXCEPTION 'Late plugin status lock contract failed'; END IF; END; $verify$; UPDATE public.marketplace_plugins SET status = 'approved' WHERE id = '57000000-0000-4000-8000-000000000001'::uuid;";
export const PLUGIN_INSTALL_POLICY_STATUS_HOLDER_SQL = [
  `SET application_name = '${PLUGIN_INSTALL_POLICY_STATUS_HOLDER_APPLICATION_NAME}'`,
  "BEGIN",
  "SELECT id FROM public.workspace_installed_plugins WHERE workspace_id = '20000000-0000-4000-8000-000000000001'::uuid AND plugin_id = '57000000-0000-4000-8000-000000000003'::uuid FOR UPDATE",
  `SELECT pg_catalog.pg_advisory_lock(${PLUGIN_INSTALL_POLICY_STATUS_BARRIER_KEY})`,
  "COMMIT",
].join("; ") + ";";
export const PLUGIN_INSTALL_POLICY_STATUS_BARRIER_READY_SQL =
  `SELECT count(*) FROM pg_catalog.pg_stat_activity AS barrier WHERE barrier.application_name = '${PLUGIN_INSTALL_POLICY_STATUS_BARRIER_APPLICATION_NAME}' AND barrier.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_catalog.pg_locks AS advisory_lock WHERE advisory_lock.pid = barrier.pid AND advisory_lock.locktype = 'advisory' AND advisory_lock.granted);`;
export const PLUGIN_INSTALL_POLICY_STATUS_HOLDER_READY_SQL =
  `SELECT count(*) FROM pg_catalog.pg_stat_activity AS holder JOIN pg_catalog.pg_stat_activity AS barrier ON barrier.application_name = '${PLUGIN_INSTALL_POLICY_STATUS_BARRIER_APPLICATION_NAME}' WHERE holder.application_name = '${PLUGIN_INSTALL_POLICY_STATUS_HOLDER_APPLICATION_NAME}' AND holder.wait_event_type = 'Lock' AND pg_catalog.pg_blocking_pids(holder.pid) = ARRAY[barrier.pid];`;
export const PLUGIN_INSTALL_POLICY_INSTALL_WAITER_SQL = [
  `SET application_name = '${PLUGIN_INSTALL_POLICY_INSTALL_WAITER_APPLICATION_NAME}'`,
  "SET ROLE authenticated",
  "SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false)",
  "SELECT public.marketplace_install_plugin('20000000-0000-4000-8000-000000000001'::uuid, '57000000-0000-4000-8000-000000000003'::uuid, '{\"concurrency\":\"must-rollback\"}'::jsonb)",
].join("; ") + ";";
export const PLUGIN_INSTALL_POLICY_INSTALL_WAITER_READY_SQL =
  `SELECT count(*) FROM pg_catalog.pg_stat_activity AS waiter JOIN pg_catalog.pg_stat_activity AS holder ON holder.application_name = '${PLUGIN_INSTALL_POLICY_STATUS_HOLDER_APPLICATION_NAME}' WHERE waiter.application_name = '${PLUGIN_INSTALL_POLICY_INSTALL_WAITER_APPLICATION_NAME}' AND waiter.wait_event_type = 'Lock' AND pg_catalog.pg_blocking_pids(waiter.pid) = ARRAY[holder.pid];`;
export const PLUGIN_INSTALL_POLICY_STATUS_CHANGE_SQL =
  "SET lock_timeout = '750ms'; SET ROLE authenticated; SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false); SELECT public.marketplace_set_plugin_status('57000000-0000-4000-8000-000000000003'::uuid, 'archived');";
export const VERIFY_PLUGIN_INSTALL_POLICY_STATUS_RACE_SQL =
  "DO $verify$ BEGIN IF (SELECT count(*) FROM contract.plugin_status_race_baseline) <> 1 OR (SELECT status FROM public.marketplace_plugins WHERE id = '57000000-0000-4000-8000-000000000003'::uuid) <> 'archived' OR (SELECT install_count FROM public.marketplace_plugins WHERE id = '57000000-0000-4000-8000-000000000003'::uuid) IS DISTINCT FROM (SELECT install_count FROM contract.plugin_status_race_baseline) OR NOT EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id CROSS JOIN contract.plugin_status_race_baseline AS baseline WHERE installation.workspace_id = '20000000-0000-4000-8000-000000000001'::uuid AND installation.plugin_id = '57000000-0000-4000-8000-000000000003'::uuid AND pg_catalog.to_jsonb(installation) = baseline.installation_state AND pg_catalog.to_jsonb(private_config) = baseline.private_state) THEN RAISE EXCEPTION 'Plugin status race did not preserve the preexisting installation atomically'; END IF; END; $verify$;";
export const PLUGIN_INSTALL_POLICY_CONCURRENT_INSTALL_SQL = Object.freeze([
  "SET ROLE authenticated; SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false); SELECT public.marketplace_install_plugin('20000000-0000-4000-8000-000000000001'::uuid, '57000000-0000-4000-8000-000000000002'::uuid, '{\"concurrency\":\"workspace-a\"}'::jsonb);",
  "SET ROLE authenticated; SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', false); SELECT public.marketplace_install_plugin('20000000-0000-4000-8000-000000000002'::uuid, '57000000-0000-4000-8000-000000000002'::uuid, '{\"concurrency\":\"workspace-b\"}'::jsonb);",
]);
export const VERIFY_PLUGIN_INSTALL_POLICY_CONCURRENT_COUNT_SQL =
  "DO $verify$ BEGIN IF (SELECT count(*) FROM public.workspace_installed_plugins WHERE plugin_id = '57000000-0000-4000-8000-000000000002'::uuid AND enabled) <> 2 OR (SELECT count(*) FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.plugin_id = '57000000-0000-4000-8000-000000000002'::uuid AND installation.config = '{}'::jsonb AND private_config.raw_config = CASE installation.workspace_id WHEN '20000000-0000-4000-8000-000000000001'::uuid THEN '{\"concurrency\":\"workspace-a\"}'::jsonb WHEN '20000000-0000-4000-8000-000000000002'::uuid THEN '{\"concurrency\":\"workspace-b\"}'::jsonb ELSE NULL END) <> 2 OR (SELECT install_count FROM public.marketplace_plugins WHERE id = '57000000-0000-4000-8000-000000000002'::uuid) <> 2 OR EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation LEFT JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.config IS DISTINCT FROM '{}'::jsonb OR private_config.installed_plugin_id IS NULL) THEN RAISE EXCEPTION 'Concurrent plugin installs corrupted count or config totality'; END IF; END; $verify$;";
export const CAPTURE_PLUGIN_INSTALL_POLICY_REAPPLY_STATE_SQL =
  "INSERT INTO contract.state_baseline (state_name, state_value) VALUES ('plugin_install_policy_reapply', contract.plugin_install_policy_reapply_state()) ON CONFLICT (state_name) DO UPDATE SET state_value = EXCLUDED.state_value;";
export const VERIFY_PLUGIN_INSTALL_POLICY_REAPPLY_STATE_SQL =
  "DO $verify$ BEGIN IF contract.plugin_install_policy_reapply_state() IS DISTINCT FROM (SELECT state_value FROM contract.state_baseline WHERE state_name = 'plugin_install_policy_reapply') OR EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation LEFT JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.config IS DISTINCT FROM '{}'::jsonb OR private_config.installed_plugin_id IS NULL) OR EXISTS (SELECT 1 FROM effectime_private.workspace_plugin_configs AS private_config LEFT JOIN public.workspace_installed_plugins AS installation ON installation.id = private_config.installed_plugin_id WHERE installation.id IS NULL) THEN RAISE EXCEPTION 'Plugin install policy reapply changed catalog, data, source, or totality'; END IF; END; $verify$;";

export const PLUGIN_INSTALL_COUNT_PLUGIN_ID =
  "58000000-0000-4000-8000-000000000001";
export const PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_APPLICATION_NAME =
  "effectime_plugin_count_legacy_barrier";
export const PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_APPLICATION_NAME =
  "effectime_plugin_count_legacy_installer";
export const PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_APPLICATION_NAME =
  "effectime_plugin_count_legacy_uninstaller";
export const PLUGIN_INSTALL_COUNT_FIXED_BARRIER_APPLICATION_NAME =
  "effectime_plugin_count_fixed_barrier";
export const PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_APPLICATION_NAME =
  "effectime_plugin_count_fixed_installer";
export const PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_APPLICATION_NAME =
  "effectime_plugin_count_fixed_uninstaller";
const PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_KEY = "35113, 1";
const PLUGIN_INSTALL_COUNT_FIXED_BARRIER_KEY = "35113, 2";
export const PLUGIN_INSTALL_COUNT_BARRIER_SECONDS = 35;
export const PLUGIN_INSTALL_COUNT_STATEMENT_TIMEOUT_SECONDS = 42;
export const PLUGIN_INSTALL_COUNT_READINESS_ATTEMPTS = 131;
export const PLUGIN_INSTALL_COUNT_READINESS_INTERVAL_MILLISECONDS = 100;

function createPluginInstallCountBarrierSql(applicationName, advisoryKey) {
  return [
    `SET application_name = '${applicationName}'`,
    `SET statement_timeout = '${PLUGIN_INSTALL_COUNT_STATEMENT_TIMEOUT_SECONDS}s'`,
    `SELECT pg_catalog.pg_advisory_lock(${advisoryKey})`,
    `SELECT pg_catalog.pg_sleep(${PLUGIN_INSTALL_COUNT_BARRIER_SECONDS})`,
  ].join("; ") + ";";
}

function createPluginInstallCountInstallerSql(applicationName, advisoryKey, phase) {
  return [
    `SET application_name = '${applicationName}'`,
    `SET statement_timeout = '${PLUGIN_INSTALL_COUNT_STATEMENT_TIMEOUT_SECONDS}s'`,
    "BEGIN",
    "SET LOCAL ROLE authenticated",
    "SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true)",
    `SELECT public.marketplace_install_plugin('20000000-0000-4000-8000-000000000002'::uuid, '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid, '{\"race\":\"${phase}-install\"}'::jsonb)`,
    "RESET ROLE",
    `SELECT pg_catalog.pg_advisory_lock(${advisoryKey})`,
    "COMMIT",
  ].join("; ") + ";";
}

function createPluginInstallCountUninstallerSql(applicationName) {
  return [
    `SET application_name = '${applicationName}'`,
    `SET statement_timeout = '${PLUGIN_INSTALL_COUNT_STATEMENT_TIMEOUT_SECONDS}s'`,
    "SET ROLE authenticated",
    "SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false)",
    `SELECT public.marketplace_uninstall_plugin((SELECT installation.id FROM public.workspace_installed_plugins AS installation WHERE installation.workspace_id = '20000000-0000-4000-8000-000000000001'::uuid AND installation.plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid))`,
  ].join("; ") + ";";
}

function createPluginInstallCountBarrierReadySql(applicationName) {
  return `SELECT count(*) FROM pg_catalog.pg_stat_activity AS barrier WHERE barrier.application_name = '${applicationName}' AND barrier.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_catalog.pg_locks AS advisory_lock WHERE advisory_lock.pid = barrier.pid AND advisory_lock.locktype = 'advisory' AND advisory_lock.granted);`;
}

function createPluginInstallCountInstallerReadySql(
  installerApplicationName,
  barrierApplicationName,
) {
  return `SELECT count(*) FROM pg_catalog.pg_stat_activity AS installer JOIN pg_catalog.pg_stat_activity AS barrier ON barrier.application_name = '${barrierApplicationName}' WHERE installer.application_name = '${installerApplicationName}' AND installer.wait_event_type = 'Lock' AND pg_catalog.pg_blocking_pids(installer.pid) = ARRAY[barrier.pid];`;
}

function createPluginInstallCountUninstallerReadySql(
  uninstallerApplicationName,
  installerApplicationName,
) {
  return `SELECT count(*) FROM pg_catalog.pg_stat_activity AS uninstaller JOIN pg_catalog.pg_stat_activity AS installer ON installer.application_name = '${installerApplicationName}' WHERE uninstaller.application_name = '${uninstallerApplicationName}' AND uninstaller.wait_event_type = 'Lock' AND pg_catalog.pg_blocking_pids(uninstaller.pid) = ARRAY[installer.pid];`;
}

export const PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_SQL =
  createPluginInstallCountBarrierSql(
    PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_KEY,
  );
export const PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_SQL =
  createPluginInstallCountInstallerSql(
    PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_KEY,
    "legacy",
  );
export const PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_SQL =
  createPluginInstallCountUninstallerSql(
    PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_APPLICATION_NAME,
  );
export const PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_READY_SQL =
  createPluginInstallCountBarrierReadySql(
    PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_APPLICATION_NAME,
  );
export const PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_READY_SQL =
  createPluginInstallCountInstallerReadySql(
    PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_APPLICATION_NAME,
  );
export const PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_READY_SQL =
  createPluginInstallCountUninstallerReadySql(
    PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_APPLICATION_NAME,
  );
export const PLUGIN_INSTALL_COUNT_FIXED_BARRIER_SQL =
  createPluginInstallCountBarrierSql(
    PLUGIN_INSTALL_COUNT_FIXED_BARRIER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_FIXED_BARRIER_KEY,
  );
export const PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_SQL =
  createPluginInstallCountInstallerSql(
    PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_FIXED_BARRIER_KEY,
    "fixed",
  );
export const PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_SQL =
  createPluginInstallCountUninstallerSql(
    PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_APPLICATION_NAME,
  );
export const PLUGIN_INSTALL_COUNT_FIXED_BARRIER_READY_SQL =
  createPluginInstallCountBarrierReadySql(
    PLUGIN_INSTALL_COUNT_FIXED_BARRIER_APPLICATION_NAME,
  );
export const PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_READY_SQL =
  createPluginInstallCountInstallerReadySql(
    PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_FIXED_BARRIER_APPLICATION_NAME,
  );
export const PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_READY_SQL =
  createPluginInstallCountUninstallerReadySql(
    PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_APPLICATION_NAME,
    PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_APPLICATION_NAME,
  );
export const VERIFY_PLUGIN_INSTALL_COUNT_LEGACY_STALE_SQL =
  `DO $verify$ BEGIN IF (SELECT count(*) FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND enabled) <> 1 OR EXISTS (SELECT 1 FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND workspace_id <> '20000000-0000-4000-8000-000000000002'::uuid) OR (SELECT install_count FROM public.marketplace_plugins WHERE id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid) <> 0 OR NOT EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND installation.workspace_id = '20000000-0000-4000-8000-000000000002'::uuid AND installation.config = '{}'::jsonb AND private_config.raw_config = '{\"race\":\"legacy-install\"}'::jsonb) THEN RAISE EXCEPTION 'v3.51.12 stale install_count race was not reproduced exactly'; END IF; END; $verify$;`;
export const VERIFY_PLUGIN_INSTALL_COUNT_RECONCILED_SQL =
  `DO $verify$ BEGIN IF (SELECT count(*) FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND enabled) <> 1 OR EXISTS (SELECT 1 FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND workspace_id <> '20000000-0000-4000-8000-000000000002'::uuid) OR (SELECT install_count FROM public.marketplace_plugins WHERE id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid) <> 1 OR NOT EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND installation.workspace_id = '20000000-0000-4000-8000-000000000002'::uuid AND installation.config = '{}'::jsonb AND private_config.raw_config = '{\"race\":\"legacy-install\"}'::jsonb) OR EXISTS (SELECT 1 FROM public.marketplace_plugins AS plugin WHERE plugin.install_count IS DISTINCT FROM (SELECT pg_catalog.count(*)::integer FROM public.workspace_installed_plugins AS installation WHERE installation.plugin_id = plugin.id AND installation.enabled = true)) THEN RAISE EXCEPTION 'v3.51.13 did not reconcile the legacy install_count drift'; END IF; END; $verify$;`;
export const PREPARE_PLUGIN_INSTALL_COUNT_FIXED_RACE_SQL = [
  `DELETE FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid`,
  `UPDATE public.marketplace_plugins SET install_count = 0 WHERE id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid`,
  "SET ROLE authenticated",
  "SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false)",
  `SELECT public.marketplace_install_plugin('20000000-0000-4000-8000-000000000001'::uuid, '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid, '{\"race\":\"fixed-baseline\"}'::jsonb)`,
  "RESET ROLE",
].join("; ") + ";";
export const VERIFY_PLUGIN_INSTALL_COUNT_FIXED_BASELINE_SQL =
  `DO $verify$ BEGIN IF (SELECT count(*) FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND enabled) <> 1 OR NOT EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND installation.workspace_id = '20000000-0000-4000-8000-000000000001'::uuid AND installation.config = '{}'::jsonb AND private_config.raw_config = '{\"race\":\"fixed-baseline\"}'::jsonb) OR (SELECT install_count FROM public.marketplace_plugins WHERE id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid) <> 1 THEN RAISE EXCEPTION 'Plugin install_count race fixture reset failed'; END IF; END; $verify$;`;
export const VERIFY_PLUGIN_INSTALL_COUNT_FIXED_SQL =
  `DO $verify$ BEGIN IF (SELECT count(*) FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND enabled) <> 1 OR EXISTS (SELECT 1 FROM public.workspace_installed_plugins WHERE plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND workspace_id <> '20000000-0000-4000-8000-000000000002'::uuid) OR (SELECT install_count FROM public.marketplace_plugins WHERE id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid) <> 1 OR NOT EXISTS (SELECT 1 FROM public.workspace_installed_plugins AS installation JOIN effectime_private.workspace_plugin_configs AS private_config ON private_config.installed_plugin_id = installation.id WHERE installation.plugin_id = '${PLUGIN_INSTALL_COUNT_PLUGIN_ID}'::uuid AND installation.workspace_id = '20000000-0000-4000-8000-000000000002'::uuid AND installation.config = '{}'::jsonb AND private_config.raw_config = '{\"race\":\"fixed-install\"}'::jsonb) THEN RAISE EXCEPTION 'v3.51.13 concurrent uninstall wrote a stale install_count'; END IF; END; $verify$;`;
export const CAPTURE_PLUGIN_INSTALL_COUNT_REAPPLY_STATE_SQL =
  "INSERT INTO contract.state_baseline (state_name, state_value) VALUES ('plugin_install_count_reapply', contract.plugin_install_count_reapply_state()) ON CONFLICT (state_name) DO UPDATE SET state_value = EXCLUDED.state_value;";
export const VERIFY_PLUGIN_INSTALL_COUNT_REAPPLY_STATE_SQL =
  "DO $verify$ BEGIN IF contract.plugin_install_count_reapply_state() IS DISTINCT FROM (SELECT state_value FROM contract.state_baseline WHERE state_name = 'plugin_install_count_reapply') THEN RAISE EXCEPTION 'Plugin install_count migration reapply changed catalog, API, ACL, data, or totality'; END IF; END; $verify$;";

export const TAMPER_CASES = Object.freeze([
  Object.freeze({
    label: "RLS predicate drift",
    sql: "ALTER POLICY clock_events_read ON public.clock_events USING (true);",
    expectedFailure: /Recovered surface RLS policy contract is incompatible/i,
  }),
  Object.freeze({
    label: "RLS permissiveness drift",
    sql:
      [
        "DROP POLICY clock_events_read ON public.clock_events",
        "CREATE POLICY clock_events_read ON public.clock_events AS RESTRICTIVE FOR SELECT TO authenticated USING (membership_id IN (SELECT id FROM public.enterprise_memberships WHERE user_id = auth.uid()) OR public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]) OR public.has_role(auth.uid(), 'admin'::public.app_role))",
      ].join("; ") + ";",
    expectedFailure: /Recovered surface RLS policy contract is incompatible/i,
  }),
  Object.freeze({
    label: "unexpected extra RLS policy",
    sql: "CREATE POLICY contract_extra_policy ON public.clock_events AS RESTRICTIVE FOR SELECT TO authenticated USING (false);",
    expectedFailure: /Recovered surface RLS policy set is incompatible/i,
  }),
  Object.freeze({
    label: "partitioned recovered table",
    sql:
      [
        "ALTER TABLE public.clock_events RENAME TO contract_original_clock_events",
        "CREATE TABLE public.clock_events (id uuid, created_at timestamptz NOT NULL) PARTITION BY RANGE (created_at)",
        "ALTER TABLE public.clock_events OWNER TO postgres",
        "ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY",
      ].join("; ") + ";",
    expectedFailure: /Recovered surface table contract is incompatible/i,
  }),
  Object.freeze({
    label: "inherited browser parent-role column ACL",
    sql:
      [
        "GRANT contract_acl_parent TO anon, authenticated",
        "GRANT UPDATE (raw_data) ON public.clock_events TO contract_acl_parent",
      ].join("; ") + ";",
    expectedFailure: /Recovered surface browser roles must not inherit parent roles/i,
  }),
  Object.freeze({
    label: "authenticated BYPASSRLS capability drift",
    sql: "ALTER ROLE authenticated BYPASSRLS;",
    expectedFailure: /Recovered surface browser roles have unsafe role capabilities/i,
  }),
  Object.freeze({
    label: "anonymous SUPERUSER capability drift",
    sql: "ALTER ROLE anon SUPERUSER;",
    expectedFailure: /Recovered surface browser roles have unsafe role capabilities/i,
  }),
  Object.freeze({
    label: "pgcrypto schema owner drift",
    sql: "ALTER SCHEMA extensions OWNER TO contract_untrusted_owner;",
    expectedFailure: /(?:extensions|pgcrypto).*schema.*owner|schema owner.*trusted/i,
  }),
  Object.freeze({
    label: "pgcrypto extension owner drift",
    sql: "UPDATE pg_catalog.pg_extension SET extowner = 'contract_untrusted_owner'::pg_catalog.regrole WHERE extname = 'pgcrypto';",
    expectedFailure: /pgcrypto.*extension.*owner|extension owner.*trusted/i,
  }),
  Object.freeze({
    label: "gen_random_bytes owner drift",
    sql: "ALTER FUNCTION extensions.gen_random_bytes(integer) OWNER TO contract_untrusted_owner;",
    expectedFailure: /gen_random_bytes.*owner|owner.*gen_random_bytes|pgcrypto.*owner/i,
  }),
  Object.freeze({
    label: "gen_random_bytes extension-membership drift",
    sql: "ALTER EXTENSION pgcrypto DROP FUNCTION extensions.gen_random_bytes(integer);",
    expectedFailure: /gen_random_bytes|Trusted pgcrypto function contract|pgcrypto.*member/i,
  }),
  Object.freeze({
    label: "digest owner drift",
    sql: "ALTER FUNCTION extensions.digest(bytea, text) OWNER TO contract_untrusted_owner;",
    expectedFailure: /digest.*owner|owner.*digest|pgcrypto.*owner/i,
  }),
  Object.freeze({
    label: "digest extension-membership drift",
    sql: "ALTER EXTENSION pgcrypto DROP FUNCTION extensions.digest(bytea, text);",
    expectedFailure: /digest|Trusted pgcrypto function contract|pgcrypto.*member/i,
  }),
  Object.freeze({
    label: "routine source drift",
    sql: "UPDATE pg_catalog.pg_proc SET prosrc = prosrc || E'\\n-- contract source tamper' WHERE oid = 'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)'::pg_catalog.regprocedure::oid;",
    expectedFailure:
      /Recovered surface routine (?:source attestation failed|contract is incompatible)/i,
  }),
  Object.freeze({
    label: "unexpected routine proconfig drift",
    sql: "ALTER FUNCTION public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid) SET work_mem = '4MB';",
    expectedFailure: /Recovered surface routine contract is incompatible/i,
  }),
]);

export const PLUGIN_SECRET_TAMPER_CASES = Object.freeze([
  Object.freeze({
    label: "private schema CREATE grant",
    sql: "GRANT CREATE ON SCHEMA effectime_private TO contract_acl_parent;",
    expectedFailure: /Private schema CREATE privilege contract is unsafe/i,
  }),
  Object.freeze({
    label: "public config column write grant",
    sql: "GRANT UPDATE (config) ON public.workspace_installed_plugins TO authenticated;",
    expectedFailure: /Plugin installation browser ACL contract is incompatible/i,
  }),
  Object.freeze({
    label: "plugin installation table owner drift",
    sql: "ALTER TABLE public.workspace_installed_plugins OWNER TO contract_untrusted_owner;",
    expectedFailure: /Plugin installation table contract is incompatible/i,
  }),
  Object.freeze({
    label: "plugin updated-at trigger disabled",
    sql: "ALTER TABLE public.workspace_installed_plugins DISABLE TRIGGER trg_workspace_installed_plugins_updated_at;",
    expectedFailure: /Plugin installation updated-at trigger is incompatible/i,
  }),
  Object.freeze({
    label: "plugin install routine source drift",
    sql: "UPDATE pg_catalog.pg_proc SET prosrc = prosrc || E'\\n-- contract plugin-source tamper' WHERE oid = 'public.marketplace_install_plugin(uuid,uuid,jsonb)'::pg_catalog.regprocedure::oid;",
    expectedFailure: /Plugin install RPC source attestation failed/i,
  }),
  Object.freeze({
    label: "plugin mutation RPC custom-role grant",
    sql: "GRANT EXECUTE ON FUNCTION public.marketplace_install_plugin(uuid,uuid,jsonb) TO contract_acl_parent;",
    expectedFailure: /Plugin mutation RPC ACL contract is incompatible/i,
  }),
  Object.freeze({
    label: "private plugin config table collision",
    sql: "CREATE TABLE effectime_private.workspace_plugin_configs (unexpected text);",
    expectedFailure: /Private plugin config table contract is incompatible/i,
  }),
]);

export const PLUGIN_SECRET_REAPPLY_TAMPER_CASES = Object.freeze([
  Object.freeze({
    label: "missing private config row",
    sql: "DELETE FROM effectime_private.workspace_plugin_configs WHERE installed_plugin_id = '52000000-0000-4000-8000-000000000001'::uuid;",
    expectedFailure: /Plugin config boundary totality drift detected/i,
  }),
  Object.freeze({
    label: "private config custom-role column grant",
    sql: "GRANT SELECT (raw_config) ON TABLE effectime_private.workspace_plugin_configs TO contract_acl_parent;",
    expectedFailure: /Private plugin config direct ACL contract is incompatible/i,
  }),
  Object.freeze({
    label: "service getter custom-role grant",
    sql: "GRANT EXECUTE ON FUNCTION public.marketplace_get_plugin_config_service_v1(uuid,uuid) TO contract_acl_parent;",
    expectedFailure: /Plugin config companion function ACL contract is incompatible/i,
  }),
]);

export const PLUGIN_INSTALL_POLICY_TAMPER_CASES = Object.freeze([
  Object.freeze({
    label: "public schema CREATE grant",
    sql: "GRANT CREATE ON SCHEMA public TO authenticated;",
    expectedFailure: /Plugin install policy public schema trust contract is unsafe/i,
  }),
  Object.freeze({
    label: "digest extension membership drift",
    sql: "ALTER EXTENSION pgcrypto DROP FUNCTION extensions.digest(bytea,text);",
    expectedFailure: /Trusted pgcrypto digest contract is required/i,
  }),
  Object.freeze({
    label: "marketplace table owner drift",
    sql: "ALTER TABLE public.marketplace_plugins OWNER TO contract_untrusted_owner;",
    expectedFailure: /Plugin marketplace table contract is incompatible/i,
  }),
  Object.freeze({
    label: "marketplace status nullability drift",
    sql: "ALTER TABLE public.marketplace_plugins ALTER COLUMN status DROP NOT NULL;",
    expectedFailure: /Plugin marketplace status contract is incompatible/i,
  }),
  Object.freeze({
    label: "marketplace install-count type/default/nullability drift",
    sql: "ALTER TABLE public.marketplace_plugins ALTER COLUMN install_count TYPE bigint, ALTER COLUMN install_count DROP DEFAULT, ALTER COLUMN install_count DROP NOT NULL;",
    expectedFailure: /Plugin marketplace install-count contract is incompatible/i,
  }),
  Object.freeze({
    label: "workspace installation uniqueness drift",
    sql: "ALTER TABLE public.workspace_installed_plugins DROP CONSTRAINT workspace_installed_plugins_workspace_id_plugin_id_key;",
    expectedFailure: /Plugin installation key contract is incompatible/i,
  }),
  Object.freeze({
    label: "workspace installation plugin foreign-key drift",
    sql: "ALTER TABLE public.workspace_installed_plugins DROP CONSTRAINT workspace_installed_plugins_plugin_id_fkey;",
    expectedFailure: /Plugin installation runtime schema is incompatible/i,
  }),
  Object.freeze({
    label: "private plugin raw-config nullability drift",
    sql: "ALTER TABLE effectime_private.workspace_plugin_configs ALTER COLUMN raw_config DROP NOT NULL;",
    expectedFailure: /Plugin private config runtime schema is incompatible: column raw_config/i,
  }),
  Object.freeze({
    label: "private plugin config primary/foreign-key drift",
    sql: "ALTER TABLE effectime_private.workspace_plugin_configs DROP CONSTRAINT workspace_plugin_configs_pkey, DROP CONSTRAINT workspace_plugin_configs_installed_plugin_id_fkey;",
    expectedFailure: /Plugin private config key contract is incompatible/i,
  }),
  Object.freeze({
    label: "plugin status RPC source drift",
    sql: "UPDATE pg_catalog.pg_proc SET prosrc = prosrc || E'\\n-- contract status-source tamper' WHERE oid = 'public.marketplace_set_plugin_status(uuid,text)'::pg_catalog.regprocedure::oid;",
    expectedFailure: /Plugin status RPC source attestation failed/i,
  }),
  Object.freeze({
    label: "plugin status RPC custom-role grant",
    sql: "GRANT EXECUTE ON FUNCTION public.marketplace_set_plugin_status(uuid,text) TO contract_acl_parent;",
    expectedFailure: /Plugin status RPC ACL contract is incompatible/i,
  }),
  Object.freeze({
    label: "plugin uninstall RPC custom-role grant",
    sql: "GRANT EXECUTE ON FUNCTION public.marketplace_uninstall_plugin(uuid) TO contract_acl_parent;",
    expectedFailure: /Plugin uninstall RPC ACL contract is incompatible/i,
  }),
  Object.freeze({
    label: "workspace feature gate custom-role grant",
    sql: "GRANT EXECUTE ON FUNCTION public.workspace_has_any_feature(uuid,text[]) TO contract_acl_parent;",
    expectedFailure: /Workspace feature gate ACL contract is incompatible/i,
  }),
  Object.freeze({
    label: "membership entitlement source drift",
    sql: "UPDATE pg_catalog.pg_proc SET prosrc = prosrc || E'\\n-- contract membership-source tamper' WHERE oid = 'public.is_enterprise_member(uuid,uuid)'::pg_catalog.regprocedure::oid;",
    expectedFailure: /Plugin entitlement helper source attestation failed: membership/i,
  }),
  Object.freeze({
    label: "tenant entitlement custom-role grant",
    sql: "GRANT EXECUTE ON FUNCTION public.tenant_enabled_features(uuid) TO contract_acl_parent;",
    expectedFailure: /Plugin entitlement helper ACL contract is incompatible: tenant features/i,
  }),
]);

export const PLUGIN_INSTALL_COUNT_TAMPER_CASES = Object.freeze([
  Object.freeze({
    label: "plugin uninstall RPC source drift",
    sql: "UPDATE pg_catalog.pg_proc SET prosrc = prosrc || E'\\n-- contract uninstall-source tamper' WHERE oid = 'public.marketplace_uninstall_plugin(uuid)'::pg_catalog.regprocedure::oid;",
    expectedFailure: /Plugin uninstall RPC source attestation failed/i,
  }),
  Object.freeze({
    label: "plugin uninstall RPC custom-role grant",
    sql: "GRANT EXECUTE ON FUNCTION public.marketplace_uninstall_plugin(uuid) TO contract_acl_parent;",
    expectedFailure: /Plugin install\/uninstall RPC ACL contract is incompatible/i,
  }),
  Object.freeze({
    label: "plugin uninstall RPC search-path drift",
    sql: "ALTER FUNCTION public.marketplace_uninstall_plugin(uuid) SET search_path = public;",
    expectedFailure: /Plugin uninstall RPC contract is incompatible/i,
  }),
]);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const containerNamePattern = /^effectime-recovered-surface-acl-pg17-[1-9][0-9]*-[0-9a-f]{12}$/;
const containerIdPattern = /^[0-9a-f]{64}$/;
const ownershipTokenPattern = /^[0-9a-f]{32}$/;
const allowedContractSqlPaths = new Set([
  SETUP_SQL_PATH,
  HARDENING_MIGRATION_SQL_PATH,
  ASSERTIONS_SQL_PATH,
  PLUGIN_SECRET_SEED_SQL_PATH,
  PLUGIN_SECRET_MIGRATION_SQL_PATH,
  PLUGIN_SECRET_ASSERTIONS_SQL_PATH,
  PLUGIN_INSTALL_POLICY_SEED_SQL_PATH,
  PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH,
  PLUGIN_INSTALL_POLICY_ASSERTIONS_SQL_PATH,
  PLUGIN_INSTALL_COUNT_SEED_SQL_PATH,
  PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH,
  PLUGIN_INSTALL_COUNT_ASSERTIONS_SQL_PATH,
]);
const allowedTamperSql = new Set(TAMPER_CASES.map((tamperCase) => tamperCase.sql));
const allowedPluginSecretTamperSql = new Set(
  [...PLUGIN_SECRET_TAMPER_CASES, ...PLUGIN_SECRET_REAPPLY_TAMPER_CASES].map(
    (tamperCase) => tamperCase.sql,
  ),
);
const allowedPluginInstallPolicyTamperSql = new Set(
  PLUGIN_INSTALL_POLICY_TAMPER_CASES.map((tamperCase) => tamperCase.sql),
);
const allowedPluginInstallCountTamperSql = new Set(
  PLUGIN_INSTALL_COUNT_TAMPER_CASES.map((tamperCase) => tamperCase.sql),
);

function assertContainerName(containerName) {
  if (!containerNamePattern.test(containerName)) {
    throw new Error("Invalid recovered surface ACL contract container name");
  }
  return containerName;
}

function assertContainerId(containerId) {
  if (!containerIdPattern.test(containerId)) {
    throw new Error("Invalid recovered surface ACL contract container ID");
  }
  return containerId;
}

function assertOwnershipToken(ownershipToken) {
  if (!ownershipTokenPattern.test(ownershipToken)) {
    throw new Error("Invalid recovered surface ACL contract ownership token");
  }
  return ownershipToken;
}

function assertAllowedSqlPath(sqlPath) {
  if (!allowedContractSqlPaths.has(sqlPath)) {
    throw new Error("Recovered surface ACL contract SQL path is not allowlisted");
  }
  return sqlPath;
}

export function createContainerName({
  pid = process.pid,
  suffix = randomBytes(6).toString("hex"),
} = {}) {
  if (!Number.isInteger(pid) || pid < 1 || !/^[0-9a-f]{12}$/.test(suffix)) {
    throw new Error("Invalid recovered surface ACL contract container identity");
  }
  return `effectime-recovered-surface-acl-pg17-${pid}-${suffix}`;
}

export function createOwnershipToken(bytes = randomBytes(16)) {
  return assertOwnershipToken(Buffer.from(bytes).toString("hex"));
}

export function parseCreatedContainerId(output) {
  return assertContainerId(output.trim());
}

export function buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }) {
  assertContainerName(containerName);
  assertOwnershipToken(ownershipToken);
  if (!repoRoot || !password) {
    throw new Error("Recovered surface ACL contract runtime inputs are required");
  }

  const mounts = [
    [resolve(repoRoot, "scripts/ci/recovered-surface-acl-setup.test.sql"), SETUP_SQL_PATH],
    [
      resolve(repoRoot, "supabase/migrations/20260514124827_v3_22_0_clock_in_engine.sql"),
      CLOCK_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "supabase/migrations/20260514194031_v3_30_0_plugin_marketplace.sql"),
      MARKETPLACE_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "supabase/migrations/20260516160000_v3_39_1_clock_event_clockout_fix.sql"),
      CLOCKOUT_MIGRATION_SQL_PATH,
    ],
    [
      resolve(
        repoRoot,
        "supabase/migrations/20260722054500_v3_51_10_recovered_surface_acl_hardening.sql",
      ),
      HARDENING_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/recovered-surface-acl-assertions.test.sql"),
      ASSERTIONS_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/plugin-config-secret-seed.test.sql"),
      PLUGIN_SECRET_SEED_SQL_PATH,
    ],
    [
      resolve(
        repoRoot,
        "supabase/migrations/20260722060000_v3_51_11_plugin_config_secret_boundary.sql",
      ),
      PLUGIN_SECRET_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/plugin-config-secret-assertions.test.sql"),
      PLUGIN_SECRET_ASSERTIONS_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/plugin-install-policy-seed.test.sql"),
      PLUGIN_INSTALL_POLICY_SEED_SQL_PATH,
    ],
    [
      resolve(
        repoRoot,
        "supabase/migrations/20260722061500_v3_51_12_plugin_install_policy_boundary.sql",
      ),
      PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/plugin-install-policy-assertions.test.sql"),
      PLUGIN_INSTALL_POLICY_ASSERTIONS_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/plugin-install-count-concurrency-seed.test.sql"),
      PLUGIN_INSTALL_COUNT_SEED_SQL_PATH,
    ],
    [
      resolve(
        repoRoot,
        "supabase/migrations/20260722080000_v3_51_13_plugin_install_count_concurrency.sql",
      ),
      PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/plugin-install-count-concurrency-assertions.test.sql"),
      PLUGIN_INSTALL_COUNT_ASSERTIONS_SQL_PATH,
    ],
  ];

  return [
    "run",
    "--detach",
    "--name",
    containerName,
    "--label",
    `${OWNERSHIP_LABEL_KEY}=${ownershipToken}`,
    "--network",
    "none",
    "--env",
    `POSTGRES_PASSWORD=${password}`,
    "--env",
    `POSTGRES_DB=${CONTRACT_DATABASE}`,
    ...mounts.flatMap(([source, target]) => [
      "--mount",
      `type=bind,source=${source},target=${target},readonly`,
    ]),
    POSTGRES_IMAGE,
  ];
}

export function buildPsqlFileArgs(containerName, sqlPath, { singleTransaction = false } = {}) {
  assertContainerName(containerName);
  assertAllowedSqlPath(sqlPath);
  return [
    "exec",
    containerName,
    "psql",
    "-X",
    "--username",
    "postgres",
    "--dbname",
    CONTRACT_DATABASE,
    "--set",
    "ON_ERROR_STOP=1",
    "--set",
    "VERBOSITY=verbose",
    ...(singleTransaction ? ["--single-transaction"] : []),
    "--file",
    sqlPath,
  ];
}

export function buildPsqlTamperArgs(containerName, tamperSql) {
  assertContainerName(containerName);
  if (!allowedTamperSql.has(tamperSql)) {
    throw new Error("Recovered surface ACL tamper SQL is not allowlisted");
  }
  return [
    "exec",
    containerName,
    "psql",
    "-X",
    "--username",
    "postgres",
    "--dbname",
    CONTRACT_DATABASE,
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    `BEGIN; ${tamperSql}`,
    "--file",
    HARDENING_MIGRATION_SQL_PATH,
  ];
}

export function buildPsqlPluginSecretTamperArgs(containerName, tamperSql) {
  assertContainerName(containerName);
  if (!allowedPluginSecretTamperSql.has(tamperSql)) {
    throw new Error("Plugin secret-boundary tamper SQL is not allowlisted");
  }
  return [
    "exec",
    containerName,
    "psql",
    "-X",
    "--username",
    "postgres",
    "--dbname",
    CONTRACT_DATABASE,
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    `BEGIN; ${tamperSql}`,
    "--file",
    PLUGIN_SECRET_MIGRATION_SQL_PATH,
  ];
}

export function buildPsqlPluginInstallPolicyTamperArgs(containerName, tamperSql) {
  assertContainerName(containerName);
  if (!allowedPluginInstallPolicyTamperSql.has(tamperSql)) {
    throw new Error("Plugin install-policy tamper SQL is not allowlisted");
  }
  return [
    "exec",
    containerName,
    "psql",
    "-X",
    "--username",
    "postgres",
    "--dbname",
    CONTRACT_DATABASE,
    "--set",
    "ON_ERROR_STOP=1",
    "--set",
    "VERBOSITY=verbose",
    "--command",
    `BEGIN; ${tamperSql}`,
    "--file",
    PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH,
  ];
}

export function buildPsqlPluginInstallCountTamperArgs(containerName, tamperSql) {
  assertContainerName(containerName);
  if (!allowedPluginInstallCountTamperSql.has(tamperSql)) {
    throw new Error("Plugin install-count tamper SQL is not allowlisted");
  }
  return [
    "exec",
    containerName,
    "psql",
    "-X",
    "--username",
    "postgres",
    "--dbname",
    CONTRACT_DATABASE,
    "--set",
    "ON_ERROR_STOP=1",
    "--set",
    "VERBOSITY=verbose",
    "--command",
    `BEGIN; ${tamperSql}`,
    "--file",
    PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH,
  ];
}

export function buildPsqlCommandArgs(containerName, command, { tuplesOnly = false } = {}) {
  assertContainerName(containerName);
  if (!command) {
    throw new Error("A recovered surface ACL contract command is required");
  }
  return [
    "exec",
    containerName,
    "psql",
    "-X",
    "--username",
    "postgres",
    "--dbname",
    CONTRACT_DATABASE,
    "--set",
    "ON_ERROR_STOP=1",
    "--set",
    "VERBOSITY=verbose",
    ...(tuplesOnly ? ["--tuples-only", "--no-align"] : []),
    "--command",
    command,
  ];
}

export function buildPostgresReadinessArgs(containerName) {
  return buildPsqlCommandArgs(containerName, "SELECT 1;", { tuplesOnly: true });
}

export function buildOwnershipInspectArgs(containerId) {
  assertContainerId(containerId);
  return [
    "inspect",
    "--format",
    `{{.Id}}\t{{index .Config.Labels "${OWNERSHIP_LABEL_KEY}"}}`,
    containerId,
  ];
}

export function resolveOwnedCleanupTarget({ containerId, ownershipToken, inspectionOutput }) {
  assertContainerId(containerId);
  assertOwnershipToken(ownershipToken);
  const [inspectedId, inspectedToken, ...unexpected] = inspectionOutput.trim().split(/\s+/);
  if (unexpected.length > 0 || inspectedId !== containerId || inspectedToken !== ownershipToken) {
    throw new Error(
      "Refusing to remove a container whose ID and recovered surface ACL ownership label do not match",
    );
  }
  return containerId;
}

export function buildCleanupArgs(containerId) {
  return ["rm", "--force", assertContainerId(containerId)];
}

export function assertExpectedPsqlFailure(result, expectedMatcher) {
  const expectedDescription =
    expectedMatcher instanceof RegExp ? expectedMatcher.toString() : expectedMatcher;
  if (!result || result.status === 0) {
    throw new Error(`Expected PostgreSQL contract failure matching: ${expectedDescription}`);
  }
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const matches =
    expectedMatcher instanceof RegExp
      ? expectedMatcher.test(output)
      : output.includes(expectedMatcher);
  if (!matches) {
    throw new Error(
      `PostgreSQL contract failed for an unexpected reason; expected: ${expectedDescription}\n${output.trim()}`,
    );
  }
  return output;
}

function dockerSync(args, { allowFailure = false, stdio = "pipe" } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `docker ${args[0]} failed with exit code ${result.status}${details ? `\n${details}` : ""}`,
    );
  }
  return result;
}

export function dockerAsync(
  args,
  {
    timeoutMilliseconds = ASYNC_DOCKER_TIMEOUT_MILLISECONDS,
    spawnProcess = spawn,
  } = {},
) {
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1) {
    throw new Error("Invalid async Docker timeout");
  }
  const child = spawnProcess("docker", args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  let settled = false;
  let timeoutHandle;
  let settleCompletion;
  const completion = new Promise((resolveCompletion) => {
    settleCompletion = resolveCompletion;
  });
  const settle = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutHandle);
    settleCompletion(result);
  };

  timeoutHandle = setTimeout(() => {
    child.kill();
    settle({
      status: null,
      stdout,
      stderr: `${stderr}\nAsync docker execution exceeded ${timeoutMilliseconds}ms`.trim(),
      timedOut: true,
    });
  }, timeoutMilliseconds);

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("error", (error) => {
    settle({ status: null, stdout, stderr: `${stderr}\n${error.message}`.trim() });
  });
  child.on("close", (status) => {
    settle({ status, stdout, stderr });
  });

  return {
    completion,
    terminate: () => {
      if (!settled) child.kill();
    },
  };
}

function assertSuccessfulAsyncDockerResult(result, label) {
  if (!result || result.status !== 0) {
    const details = [result?.stdout, result?.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${label} failed${result?.timedOut ? " after its bounded timeout" : result?.status === null ? " to start" : ` with exit code ${result?.status}`}${details ? `\n${details}` : ""}`,
    );
  }
  return result;
}

export function cleanupOwnedContainer(
  { containerId, ownershipToken },
  executeDockerSync = dockerSync,
) {
  if (!containerId) return false;

  const inspection = executeDockerSync(buildOwnershipInspectArgs(containerId), {
    allowFailure: true,
    stdio: "pipe",
  });
  if (inspection.status !== 0) {
    throw new Error(
      `Unable to prove recovered surface ACL contract container ownership: ${inspection.stderr?.trim() || "inspect failed"}`,
    );
  }

  const cleanupTarget = resolveOwnedCleanupTarget({
    containerId,
    ownershipToken,
    inspectionOutput: inspection.stdout,
  });
  const cleanup = executeDockerSync(buildCleanupArgs(cleanupTarget), {
    allowFailure: true,
    stdio: "pipe",
  });
  if (cleanup.status !== 0) {
    throw new Error(
      `Failed to remove owned recovered surface ACL contract container ${containerId}: ${cleanup.stderr?.trim() || "unknown error"}`,
    );
  }
  return true;
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function waitForPostgres(
  containerName,
  { executeDockerSync = dockerSync, wait = delay, attempts = 80, intervalMilliseconds = 250 } = {},
) {
  assertContainerName(containerName);
  if (!Number.isInteger(attempts) || attempts < 1 || intervalMilliseconds < 0) {
    throw new Error("Invalid recovered surface ACL readiness limits");
  }

  const readinessArgs = buildPostgresReadinessArgs(containerName);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = executeDockerSync(readinessArgs, { allowFailure: true });
    if (result.status === 0 && result.stdout?.trim() === "1") return;
    if (attempt < attempts) await wait(intervalMilliseconds);
  }
  throw new Error(
    `PostgreSQL recovered surface ACL contract database ${CONTRACT_DATABASE} did not become queryable`,
  );
}

async function waitForPluginInstallPolicyActivity(
  containerName,
  readySql,
  failureMessage,
  {
    executeDockerSync = dockerSync,
    wait = delay,
    attempts = PLUGIN_INSTALL_COUNT_READINESS_ATTEMPTS,
    intervalMilliseconds = PLUGIN_INSTALL_COUNT_READINESS_INTERVAL_MILLISECONDS,
  } = {},
) {
  assertContainerName(containerName);
  if (!readySql || !failureMessage) {
    throw new Error("Plugin install policy activity contract is required");
  }
  if (!Number.isInteger(attempts) || attempts < 1 || intervalMilliseconds < 0) {
    throw new Error("Invalid plugin install policy lock wait limits");
  }

  const activityArgs = buildPsqlCommandArgs(
    containerName,
    readySql,
    { tuplesOnly: true },
  );
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = executeDockerSync(activityArgs, { allowFailure: true });
    if (result.status === 0 && result.stdout?.trim() === "1") return;
    if (attempt < attempts) await wait(intervalMilliseconds);
  }
  throw new Error(failureMessage);
}

const pluginConcurrencyApplicationNames = new Set([
  PLUGIN_INSTALL_POLICY_LOCK_BARRIER_APPLICATION_NAME,
  PLUGIN_INSTALL_POLICY_LOCK_HOLDER_APPLICATION_NAME,
  PLUGIN_INSTALL_POLICY_STATUS_BARRIER_APPLICATION_NAME,
  PLUGIN_INSTALL_POLICY_STATUS_HOLDER_APPLICATION_NAME,
  PLUGIN_INSTALL_POLICY_INSTALL_WAITER_APPLICATION_NAME,
  PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_APPLICATION_NAME,
  PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_APPLICATION_NAME,
  PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_APPLICATION_NAME,
  PLUGIN_INSTALL_COUNT_FIXED_BARRIER_APPLICATION_NAME,
  PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_APPLICATION_NAME,
  PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_APPLICATION_NAME,
]);

export function buildTerminatePluginConcurrencyApplicationSql(applicationName) {
  if (!pluginConcurrencyApplicationNames.has(applicationName)) {
    throw new Error("Plugin concurrency application is not allowlisted");
  }
  return `SELECT count(*) FROM (SELECT pg_catalog.pg_terminate_backend(activity.pid) AS terminated FROM pg_catalog.pg_stat_activity AS activity WHERE activity.pid <> pg_catalog.pg_backend_pid() AND activity.application_name = '${applicationName}') AS terminated_sessions WHERE terminated;`;
}

function terminatePluginConcurrencyApplication(
  containerName,
  applicationName,
  executeDockerSync,
  { requireOne = false } = {},
) {
  const result = executeDockerSync(
    buildPsqlCommandArgs(
      containerName,
      buildTerminatePluginConcurrencyApplicationSql(applicationName),
      { tuplesOnly: true },
    ),
    { allowFailure: true, stdio: "pipe" },
  );
  const terminatedCount = result.status === 0 ? result.stdout?.trim() : null;
  if (result.status !== 0 || (requireOne && terminatedCount !== "1")) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `Failed to release controlled plugin concurrency session ${applicationName}${details ? `\n${details}` : ""}`,
    );
  }
  return Number.parseInt(terminatedCount || "0", 10);
}

function cleanupPluginConcurrencyApplications(containerName, executeDockerSync) {
  const cleanupErrors = [];
  for (const applicationName of pluginConcurrencyApplicationNames) {
    try {
      terminatePluginConcurrencyApplication(
        containerName,
        applicationName,
        executeDockerSync,
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Plugin concurrency backend cleanup failed",
    );
  }
}

async function collectPluginConcurrencyCleanupError(
  label,
  executions,
  containerName,
  executeDockerSync,
) {
  const cleanupErrors = [];
  for (const execution of executions.filter(Boolean)) {
    try {
      execution.terminate();
      await execution.completion;
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    cleanupPluginConcurrencyApplications(containerName, executeDockerSync);
  } catch (error) {
    cleanupErrors.push(error);
  }
  return cleanupErrors.length > 0
    ? new AggregateError(cleanupErrors, `${label} cleanup failed`)
    : null;
}

export function throwPluginConcurrencyPhaseErrors(
  label,
  primaryError,
  cleanupError,
) {
  if (primaryError && cleanupError) {
    throw new AggregateError(
      [primaryError, cleanupError],
      `${label} and cleanup both failed`,
    );
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
}

export async function waitForPluginInstallPolicyLockHolder(
  containerName,
  options = {},
) {
  return waitForPluginInstallPolicyActivity(
    containerName,
    PLUGIN_INSTALL_POLICY_LOCK_HOLDER_READY_SQL,
    "Plugin install policy lock holder did not reach its controlled advisory-lock barrier",
    options,
  );
}

async function runPluginInstallPolicyConcurrencyContract({
  containerName,
  executeDockerSync,
  executeDockerAsync,
  wait,
}) {
  executeDockerSync(
    buildPsqlCommandArgs(containerName, SEED_PLUGIN_INSTALL_POLICY_CONCURRENCY_SQL),
    { stdio: "inherit" },
  );

  const lockBarrier = executeDockerAsync(
    buildPsqlCommandArgs(containerName, PLUGIN_INSTALL_POLICY_LOCK_BARRIER_SQL),
  );
  let lockHolder;
  let lockHolderResult;
  let lockPhaseError = null;
  try {
    await waitForPluginInstallPolicyActivity(
      containerName,
      PLUGIN_INSTALL_POLICY_LOCK_BARRIER_READY_SQL,
      "Plugin install policy lock barrier did not become ready",
      { executeDockerSync, wait },
    );
    lockHolder = executeDockerAsync(
      buildPsqlCommandArgs(containerName, PLUGIN_INSTALL_POLICY_LOCK_HOLDER_SQL),
    );
    await waitForPluginInstallPolicyLockHolder(containerName, {
      executeDockerSync,
      wait,
    });
    const blockedStatusChange = executeDockerSync(
      buildPsqlCommandArgs(containerName, PLUGIN_INSTALL_POLICY_BLOCKED_STATUS_SQL),
      { allowFailure: true, stdio: "pipe" },
    );
    assertExpectedPsqlFailure(
      blockedStatusChange,
      /55P03: canceling statement due to lock timeout/i,
    );
    if (/40P01:/i.test([blockedStatusChange.stdout, blockedStatusChange.stderr].join("\n"))) {
      throw new Error("Plugin install/status lock contract deadlocked");
    }
    terminatePluginConcurrencyApplication(
      containerName,
      PLUGIN_INSTALL_POLICY_LOCK_BARRIER_APPLICATION_NAME,
      executeDockerSync,
      { requireOne: true },
    );
    lockHolderResult = await lockHolder.completion;
    assertSuccessfulAsyncDockerResult(lockHolderResult, "Plugin install policy lock holder");
  } catch (error) {
    lockPhaseError = error;
  }
  const lockCleanupError = await collectPluginConcurrencyCleanupError(
    "Plugin install policy lock phase",
    [lockBarrier, lockHolder],
    containerName,
    executeDockerSync,
  );
  throwPluginConcurrencyPhaseErrors(
    "Plugin install policy lock phase",
    lockPhaseError,
    lockCleanupError,
  );

  executeDockerSync(
    buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_POLICY_LOCK_SQL),
    { stdio: "inherit" },
  );

  const statusBarrier = executeDockerAsync(
    buildPsqlCommandArgs(containerName, PLUGIN_INSTALL_POLICY_STATUS_BARRIER_SQL),
  );
  let statusHolder;
  let installWaiter;
  let statusHolderResult;
  let installWaiterResult;
  let statusPhaseError = null;
  try {
    await waitForPluginInstallPolicyActivity(
      containerName,
      PLUGIN_INSTALL_POLICY_STATUS_BARRIER_READY_SQL,
      "Plugin status barrier did not become ready",
      { executeDockerSync, wait },
    );
    statusHolder = executeDockerAsync(
      buildPsqlCommandArgs(containerName, PLUGIN_INSTALL_POLICY_STATUS_HOLDER_SQL),
    );
    await waitForPluginInstallPolicyActivity(
      containerName,
      PLUGIN_INSTALL_POLICY_STATUS_HOLDER_READY_SQL,
      "Plugin status holder did not reach its controlled lock barrier",
      { executeDockerSync, wait },
    );
    installWaiter = executeDockerAsync(
      buildPsqlCommandArgs(containerName, PLUGIN_INSTALL_POLICY_INSTALL_WAITER_SQL),
    );
    await waitForPluginInstallPolicyActivity(
      containerName,
      PLUGIN_INSTALL_POLICY_INSTALL_WAITER_READY_SQL,
      "Plugin install did not block on the late status revalidation lock",
      { executeDockerSync, wait },
    );
    const statusChange = executeDockerSync(
      buildPsqlCommandArgs(containerName, PLUGIN_INSTALL_POLICY_STATUS_CHANGE_SQL),
      { allowFailure: true, stdio: "pipe" },
    );
    if (statusChange.status !== 0) {
      const details = [statusChange.stdout, statusChange.stderr]
        .filter(Boolean)
        .join("\n")
        .trim();
      throw new Error(`Plugin status change blocked behind the reinstall waiter\n${details}`);
    }
    if (/40P01:/i.test([statusChange.stdout, statusChange.stderr].join("\n"))) {
      throw new Error("Plugin reinstall/status ordering deadlocked");
    }
    terminatePluginConcurrencyApplication(
      containerName,
      PLUGIN_INSTALL_POLICY_STATUS_BARRIER_APPLICATION_NAME,
      executeDockerSync,
      { requireOne: true },
    );
    statusHolderResult = await statusHolder.completion;
    assertSuccessfulAsyncDockerResult(statusHolderResult, "Plugin installation-row holder");
    installWaiterResult = await installWaiter.completion;
    assertExpectedPsqlFailure(
      installWaiterResult,
      /P0001: Plugin not available for install \(status=archived\)/i,
    );
    if (/40P01:/i.test([installWaiterResult.stdout, installWaiterResult.stderr].join("\n"))) {
      throw new Error("Plugin status/install race deadlocked");
    }
  } catch (error) {
    statusPhaseError = error;
  }
  const statusCleanupError = await collectPluginConcurrencyCleanupError(
    "Plugin install policy status phase",
    [statusBarrier, statusHolder, installWaiter],
    containerName,
    executeDockerSync,
  );
  throwPluginConcurrencyPhaseErrors(
    "Plugin install policy status phase",
    statusPhaseError,
    statusCleanupError,
  );

  executeDockerSync(
    buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_POLICY_STATUS_RACE_SQL),
    { stdio: "inherit" },
  );

  const concurrentInstalls = PLUGIN_INSTALL_POLICY_CONCURRENT_INSTALL_SQL.map((command) =>
    executeDockerAsync(buildPsqlCommandArgs(containerName, command)),
  );
  const concurrentResults = await Promise.all(
    concurrentInstalls.map((execution) => execution.completion),
  );
  concurrentResults.forEach((result, index) => {
    assertSuccessfulAsyncDockerResult(
      result,
      `Concurrent plugin install session ${index + 1}`,
    );
  });

  executeDockerSync(
    buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_POLICY_CONCURRENT_COUNT_SQL),
    { stdio: "inherit" },
  );
  console.log(
    "Plugin install late-lock and concurrent install-count contracts passed.",
  );
}

async function runPluginInstallCountRace({
  containerName,
  executeDockerSync,
  executeDockerAsync,
  wait,
  phase,
}) {
  const phaseContract = phase === "legacy"
    ? {
        barrierApplicationName:
          PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_APPLICATION_NAME,
        barrierSql: PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_SQL,
        barrierReadySql: PLUGIN_INSTALL_COUNT_LEGACY_BARRIER_READY_SQL,
        installerApplicationName:
          PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_APPLICATION_NAME,
        installerSql: PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_SQL,
        installerReadySql: PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_READY_SQL,
        uninstallerSql: PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_SQL,
        uninstallerReadySql: PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_READY_SQL,
      }
    : phase === "fixed"
      ? {
          barrierApplicationName:
            PLUGIN_INSTALL_COUNT_FIXED_BARRIER_APPLICATION_NAME,
          barrierSql: PLUGIN_INSTALL_COUNT_FIXED_BARRIER_SQL,
          barrierReadySql: PLUGIN_INSTALL_COUNT_FIXED_BARRIER_READY_SQL,
          installerApplicationName:
            PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_APPLICATION_NAME,
          installerSql: PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_SQL,
          installerReadySql: PLUGIN_INSTALL_COUNT_FIXED_INSTALLER_READY_SQL,
          uninstallerSql: PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_SQL,
          uninstallerReadySql: PLUGIN_INSTALL_COUNT_FIXED_UNINSTALLER_READY_SQL,
        }
      : null;
  if (!phaseContract) {
    throw new Error("Invalid plugin install-count race phase");
  }

  const barrier = executeDockerAsync(
    buildPsqlCommandArgs(containerName, phaseContract.barrierSql),
  );
  let installer;
  let uninstaller;
  let installerResult;
  let uninstallerResult;
  let raceError = null;
  try {
    await waitForPluginInstallPolicyActivity(
      containerName,
      phaseContract.barrierReadySql,
      `Plugin install-count ${phase} barrier did not become ready`,
      { executeDockerSync, wait },
    );
    installer = executeDockerAsync(
      buildPsqlCommandArgs(containerName, phaseContract.installerSql),
    );
    await waitForPluginInstallPolicyActivity(
      containerName,
      phaseContract.installerReadySql,
      `Plugin install-count ${phase} installer did not block on its exact barrier PID`,
      { executeDockerSync, wait },
    );
    uninstaller = executeDockerAsync(
      buildPsqlCommandArgs(containerName, phaseContract.uninstallerSql),
    );
    await waitForPluginInstallPolicyActivity(
      containerName,
      phaseContract.uninstallerReadySql,
      `Plugin install-count ${phase} uninstaller did not block on the exact installer PID`,
      { executeDockerSync, wait },
    );
    terminatePluginConcurrencyApplication(
      containerName,
      phaseContract.barrierApplicationName,
      executeDockerSync,
      { requireOne: true },
    );
    installerResult = await installer.completion;
    assertSuccessfulAsyncDockerResult(
      installerResult,
      `Plugin install-count ${phase} installer`,
    );
    uninstallerResult = await uninstaller.completion;
    assertSuccessfulAsyncDockerResult(
      uninstallerResult,
      `Plugin install-count ${phase} uninstaller`,
    );
  } catch (error) {
    raceError = error;
  }
  const cleanupError = await collectPluginConcurrencyCleanupError(
    `Plugin install-count ${phase} race`,
    [barrier, installer, uninstaller],
    containerName,
    executeDockerSync,
  );
  throwPluginConcurrencyPhaseErrors(
    `Plugin install-count ${phase} race`,
    raceError,
    cleanupError,
  );
}

export async function runRecoveredSurfaceAclDatabaseContract({
  containerName = createContainerName(),
  repoRoot = repositoryRoot,
  ownershipToken = createOwnershipToken(),
  executeDockerSync = dockerSync,
  executeDockerAsync = dockerAsync,
  wait = delay,
} = {}) {
  assertContainerName(containerName);
  assertOwnershipToken(ownershipToken);
  const password = randomBytes(24).toString("base64url");
  let createdContainerId = null;
  let contractError = null;
  let cleanupError = null;

  console.log(`Recovered surface ACL DB contract container: ${containerName}`);
  console.log(`Pinned PostgreSQL image: ${POSTGRES_IMAGE}`);
  try {
    const creation = executeDockerSync(
      buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }),
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    createdContainerId = parseCreatedContainerId(creation.stdout);
    await waitForPostgres(containerName, { executeDockerSync, wait });

    executeDockerSync(buildPsqlFileArgs(containerName, SETUP_SQL_PATH), {
      stdio: "inherit",
    });

    for (const tamperCase of TAMPER_CASES) {
      const expectedFailure = executeDockerSync(
        buildPsqlTamperArgs(containerName, tamperCase.sql),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedPsqlFailure(expectedFailure, tamperCase.expectedFailure);
      executeDockerSync(buildPsqlCommandArgs(containerName, VERIFY_FAILED_PREFLIGHT_SQL), {
        stdio: "inherit",
      });
      console.log(`Fail-closed tamper passed: ${tamperCase.label}`);
    }

    executeDockerSync(
      buildPsqlFileArgs(containerName, HARDENING_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(buildPsqlCommandArgs(containerName, CAPTURE_HARDENED_STATE_SQL), {
      stdio: "inherit",
    });

    executeDockerSync(buildPsqlCommandArgs(containerName, SEED_REAPPLY_DRIFT_SQL), {
      stdio: "inherit",
    });
    executeDockerSync(
      buildPsqlFileArgs(containerName, HARDENING_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlFileArgs(containerName, HARDENING_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );

    executeDockerSync(buildPsqlFileArgs(containerName, ASSERTIONS_SQL_PATH), {
      stdio: "inherit",
    });

    for (const tamperCase of PLUGIN_SECRET_TAMPER_CASES) {
      const expectedFailure = executeDockerSync(
        buildPsqlPluginSecretTamperArgs(containerName, tamperCase.sql),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedPsqlFailure(expectedFailure, tamperCase.expectedFailure);
      executeDockerSync(
        buildPsqlCommandArgs(
          containerName,
          VERIFY_PLUGIN_SECRET_FAILED_PREFLIGHT_SQL,
        ),
        { stdio: "inherit" },
      );
      console.log(`Fail-closed plugin secret tamper passed: ${tamperCase.label}`);
    }

    executeDockerSync(buildPsqlFileArgs(containerName, PLUGIN_SECRET_SEED_SQL_PATH), {
      stdio: "inherit",
    });
    executeDockerSync(
      buildPsqlFileArgs(containerName, PLUGIN_SECRET_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(buildPsqlFileArgs(containerName, PLUGIN_SECRET_ASSERTIONS_SQL_PATH), {
      stdio: "inherit",
    });

    for (const tamperCase of PLUGIN_SECRET_REAPPLY_TAMPER_CASES) {
      const expectedFailure = executeDockerSync(
        buildPsqlPluginSecretTamperArgs(containerName, tamperCase.sql),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedPsqlFailure(expectedFailure, tamperCase.expectedFailure);
      executeDockerSync(
        buildPsqlFileArgs(containerName, PLUGIN_SECRET_ASSERTIONS_SQL_PATH),
        { stdio: "inherit" },
      );
      console.log(`Fail-closed plugin secret reapply tamper passed: ${tamperCase.label}`);
    }

    // A forward migration reapply must preserve private config values and the
    // original installation timestamps while repairing column/function ACL
    // drift and remaining catalog-idempotent.
    executeDockerSync(
      buildPsqlCommandArgs(containerName, SEED_PLUGIN_SECRET_REAPPLY_DRIFT_SQL),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlFileArgs(containerName, PLUGIN_SECRET_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(buildPsqlFileArgs(containerName, PLUGIN_SECRET_ASSERTIONS_SQL_PATH), {
      stdio: "inherit",
    });

    executeDockerSync(buildPsqlFileArgs(containerName, PLUGIN_INSTALL_POLICY_SEED_SQL_PATH), {
      stdio: "inherit",
    });

    for (const tamperCase of PLUGIN_INSTALL_POLICY_TAMPER_CASES) {
      const expectedFailure = executeDockerSync(
        buildPsqlPluginInstallPolicyTamperArgs(containerName, tamperCase.sql),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedPsqlFailure(expectedFailure, tamperCase.expectedFailure);
      executeDockerSync(
        buildPsqlCommandArgs(
          containerName,
          VERIFY_PLUGIN_INSTALL_POLICY_FAILED_PREFLIGHT_SQL,
        ),
        { stdio: "inherit" },
      );
      console.log(`Fail-closed plugin install-policy tamper passed: ${tamperCase.label}`);
    }

    executeDockerSync(
      buildPsqlFileArgs(containerName, PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlFileArgs(containerName, PLUGIN_INSTALL_POLICY_ASSERTIONS_SQL_PATH),
      { stdio: "inherit" },
    );
    await runPluginInstallPolicyConcurrencyContract({
      containerName,
      executeDockerSync,
      executeDockerAsync,
      wait,
    });
    executeDockerSync(
      buildPsqlCommandArgs(containerName, CAPTURE_PLUGIN_INSTALL_POLICY_REAPPLY_STATE_SQL),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlFileArgs(containerName, PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_POLICY_REAPPLY_STATE_SQL),
      { stdio: "inherit" },
    );
    console.log("Plugin install policy migration reapply contract passed.");

    executeDockerSync(buildPsqlFileArgs(containerName, PLUGIN_INSTALL_COUNT_SEED_SQL_PATH), {
      stdio: "inherit",
    });
    for (const tamperCase of PLUGIN_INSTALL_COUNT_TAMPER_CASES) {
      const expectedFailure = executeDockerSync(
        buildPsqlPluginInstallCountTamperArgs(containerName, tamperCase.sql),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedPsqlFailure(expectedFailure, tamperCase.expectedFailure);
      executeDockerSync(
        buildPsqlCommandArgs(
          containerName,
          VERIFY_PLUGIN_INSTALL_COUNT_FAILED_PREFLIGHT_SQL,
        ),
        { stdio: "inherit" },
      );
      console.log(`Fail-closed plugin install-count tamper passed: ${tamperCase.label}`);
    }

    await runPluginInstallCountRace({
      containerName,
      executeDockerSync,
      executeDockerAsync,
      wait,
      phase: "legacy",
    });
    executeDockerSync(
      buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_COUNT_LEGACY_STALE_SQL),
      { stdio: "inherit" },
    );
    console.log("v3.51.12 stale install_count race reproduced deterministically.");

    executeDockerSync(
      buildPsqlFileArgs(containerName, PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlFileArgs(containerName, PLUGIN_INSTALL_COUNT_ASSERTIONS_SQL_PATH),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_COUNT_RECONCILED_SQL),
      { stdio: "inherit" },
    );
    console.log("v3.51.13 reconciled the deterministic legacy install_count drift.");

    executeDockerSync(
      buildPsqlCommandArgs(containerName, PREPARE_PLUGIN_INSTALL_COUNT_FIXED_RACE_SQL),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_COUNT_FIXED_BASELINE_SQL),
      { stdio: "inherit" },
    );

    await runPluginInstallCountRace({
      containerName,
      executeDockerSync,
      executeDockerAsync,
      wait,
      phase: "fixed",
    });
    executeDockerSync(
      buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_COUNT_FIXED_SQL),
      { stdio: "inherit" },
    );
    console.log("v3.51.13 concurrent uninstall install_count contract passed.");

    executeDockerSync(
      buildPsqlCommandArgs(containerName, CAPTURE_PLUGIN_INSTALL_COUNT_REAPPLY_STATE_SQL),
      { stdio: "inherit" },
    );
    for (let apply = 0; apply < 2; apply += 1) {
      executeDockerSync(
        buildPsqlFileArgs(containerName, PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH, {
          singleTransaction: true,
        }),
        { stdio: "inherit" },
      );
    }
    executeDockerSync(
      buildPsqlCommandArgs(containerName, VERIFY_PLUGIN_INSTALL_COUNT_REAPPLY_STATE_SQL),
      { stdio: "inherit" },
    );
    console.log("Plugin install-count migration reapply contract passed.");
    console.log(
      "Recovered surface ACL, plugin secret-boundary, install-policy and install-count PostgreSQL 17.6 contracts passed.",
    );
  } catch (error) {
    contractError = error;
  } finally {
    try {
      if (
        cleanupOwnedContainer(
          { containerId: createdContainerId, ownershipToken },
          executeDockerSync,
        )
      ) {
        console.log(
          `Removed owned recovered surface ACL contract container: ${containerName} (${createdContainerId})`,
        );
      }
    } catch (error) {
      cleanupError = error;
    }
  }

  if (contractError && cleanupError) {
    throw new AggregateError(
      [contractError, cleanupError],
      "Recovered surface ACL database contract and owned-container cleanup both failed",
    );
  }
  if (contractError) throw contractError;
  if (cleanupError) throw cleanupError;
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  runRecoveredSurfaceAclDatabaseContract().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
