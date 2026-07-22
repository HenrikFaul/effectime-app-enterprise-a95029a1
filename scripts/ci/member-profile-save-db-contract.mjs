import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POSTGRES_IMAGE =
  "postgres:18.4@sha256:32ca0af8e77bfb8c6610c488e4691f83f972a3e9e64d3b02facf3ab111ad5500";
export const CONTRACT_DATABASE = "effectime_member_profile_save_contract";
export const SETUP_SQL_PATH = "/contract/setup.sql";
export const MIGRATION_SQL_PATH = "/contract/migration.sql";
export const BUSINESS_ROLE_MIGRATION_SQL_PATH = "/contract/business-role-migration.sql";
export const BUSINESS_ROLE_ASSERTIONS_SQL_PATH = "/contract/business-role-assertions.sql";
export const IDENTITY_CLEANUP_MIGRATION_SQL_PATH = "/contract/identity-cleanup-migration.sql";
export const IDENTITY_CLEANUP_SCHEDULER_MIGRATION_SQL_PATH =
  "/contract/identity-cleanup-scheduler-migration.sql";
export const IDENTITY_CLEANUP_ASSERTIONS_SQL_PATH = "/contract/identity-cleanup-assertions.sql";
export const IDENTITY_CLEANUP_SCHEDULER_ASSERTIONS_SQL_PATH =
  "/contract/identity-cleanup-scheduler-assertions.sql";
export const IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH =
  "/contract/identity-cleanup-scheduler-concurrency.sql";
export const IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH =
  "/contract/identity-cleanup-concurrency.sql";
export const BUSINESS_ROLE_CONCURRENCY_SQL_PATH = "/contract/business-role-concurrency.sql";
export const ASSERTIONS_SQL_PATH = "/contract/assertions.sql";
export const CONCURRENCY_SQL_PATH = "/contract/concurrency.sql";
export const OWNERSHIP_LABEL_KEY = "com.effectime.ci.member-profile-save-contract";
export const EXPECTED_INVENTORY_FAILURE =
  "member role allocation tenant integrity inventory failed: 1 mismatched row(s)";
export const LEXICAL_CONSTRAINT_DRIFT_CASES = Object.freeze([
  Object.freeze({
    label: "allocation role",
    installSql:
      "ALTER TABLE public.enterprise_member_role_allocations ADD CONSTRAINT enterprise_member_role_allocations_business_role_lexical_check CHECK (true) NOT VALID;",
    cleanupSql:
      "ALTER TABLE public.enterprise_member_role_allocations DROP CONSTRAINT enterprise_member_role_allocations_business_role_lexical_check;",
    expectedFailure: "member role allocation lexical constraint contract is incompatible",
  }),
  Object.freeze({
    label: "membership metadata",
    installSql:
      "ALTER TABLE public.enterprise_memberships ADD CONSTRAINT enterprise_memberships_profile_metadata_lexical_check CHECK (true) NOT VALID;",
    cleanupSql:
      "ALTER TABLE public.enterprise_memberships DROP CONSTRAINT enterprise_memberships_profile_metadata_lexical_check;",
    expectedFailure: "member profile metadata lexical constraint contract is incompatible",
  }),
  Object.freeze({
    label: "profile display name",
    installSql:
      "ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_lexical_check CHECK (true) NOT VALID;",
    cleanupSql:
      "ALTER TABLE public.profiles DROP CONSTRAINT profiles_display_name_lexical_check;",
    expectedFailure: "profile display name lexical constraint contract is incompatible",
  }),
]);
export const AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE = Object.freeze({
  label: "auth profile bootstrap trigger",
  installSql: [
    "DROP TRIGGER on_auth_user_created ON auth.users;",
    "CREATE TRIGGER on_auth_user_created BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();",
    "ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;",
  ].join(" "),
  verificationSql: `DO $verify_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'auth.users'::pg_catalog.regclass
      AND trigger_record.tgname = 'on_auth_user_created'
      AND trigger_record.tgfoid = 'public.handle_new_user()'::pg_catalog.regprocedure
      AND trigger_record.tgtype = 5
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
  ) THEN
    RAISE EXCEPTION 'auth profile bootstrap trigger was not repaired exactly';
  END IF;
END;
$verify_trigger$;`,
});
export const AUTH_BOOTSTRAP_ACL_DRIFT_CASE = Object.freeze({
  label: "auth profile bootstrap ACL",
  installSql: "GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;",
  verificationSql: `DO $verify_acl$
BEGIN
  IF pg_catalog.has_function_privilege(
    'service_role',
    'public.handle_new_user()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'auth profile bootstrap service_role ACL was not revoked';
  END IF;
END;
$verify_acl$;`,
});
export const AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE = Object.freeze({
  label: "additional auth profile bootstrap trigger",
  installSql:
    "CREATE TRIGGER legacy_auth_profile_bootstrap AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();",
  cleanupSql: "DROP TRIGGER legacy_auth_profile_bootstrap ON auth.users;",
  expectedFailure: "unexpected additional auth profile bootstrap trigger binding: 1 trigger(s)",
});
export const TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE = Object.freeze({
  label: "temporary-profile cleanup schema drift",
  installSql:
    "ALTER TABLE public.profiles RENAME COLUMN is_temporary TO is_temporary_incompatible;",
  cleanupSql:
    "ALTER TABLE public.profiles RENAME COLUMN is_temporary_incompatible TO is_temporary;",
  expectedFailure: "Temporary profile cleanup profile-column contract is incompatible",
  verificationSql: `DO $verify_temporary_profile_preflight$
BEGIN
  IF pg_catalog.to_regclass(
       'effectime_private.temporary_profile_cleanup_leases'
     ) IS NOT NULL
     OR pg_catalog.to_regclass(
       'effectime_private.created_identity_cleanup_worker_state'
     ) IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS attribute_record
       WHERE attribute_record.attrelid =
         'effectime_private.created_identity_cleanup_jobs'::pg_catalog.regclass
         AND attribute_record.attname = 'lease_token'
         AND NOT attribute_record.attisdropped
     ) THEN
    RAISE EXCEPTION 'temporary-profile preflight left partial scheduler DDL';
  END IF;
END;
$verify_temporary_profile_preflight$;`,
});
export const FIXTURE_MISMATCH_CLEANUP_SQL = `DO $cleanup$
DECLARE
  v_removed integer;
BEGIN
  DELETE FROM public.enterprise_member_role_allocations
  WHERE id = 'dead0000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  IF v_removed <> 1 THEN
    RAISE EXCEPTION 'fixture mismatch cleanup removed % rows', v_removed;
  END IF;
END;
$cleanup$;`;
export const CONCURRENCY_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734556",
  "AND objid = 1",
  "AND granted",
  ");",
].join(" ");
export const CONCURRENCY_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-member-profile-save-b'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-member-profile-save-a'",
  ")",
  ");",
].join(" ");
export const LOCK_TIMEOUT_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734556",
  "AND objid = 2",
  "AND granted",
  ");",
].join(" ");
export const LOCK_TIMEOUT_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-member-profile-lock-timeout'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-member-profile-lock-holder'",
  ")",
  ");",
].join(" ");
export const MVCC_READ_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734556",
  "AND objid = 3",
  "AND granted",
  ");",
].join(" ");
export const MIXED_WRITER_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734556",
  "AND objid = 4",
  "AND granted",
  ");",
].join(" ");
export const MIXED_WRITER_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-member-profile-mixed-direct'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-member-profile-mixed-rpc'",
  ")",
  ");",
].join(" ");
export const BUSINESS_ROLE_WRITER_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734559",
  "AND objid = 11",
  "AND granted",
  ");",
].join(" ");
export const BUSINESS_ROLE_WRITER_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-business-role-writer-first-b'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-business-role-writer-first-a'",
  ")",
  ");",
].join(" ");
export const BUSINESS_ROLE_DELETE_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734559",
  "AND objid = 12",
  "AND granted",
  ");",
].join(" ");
export const IDENTITY_CLEANUP_FINALIZER_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734561",
  "AND objid = 13",
  "AND granted",
  ");",
].join(" ");
export const IDENTITY_CLEANUP_FINALIZER_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-created-identity-finalize-writer'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-created-identity-finalizer'",
  ")",
  ");",
].join(" ");
export const IDENTITY_CLEANUP_SCHEDULER_WORKER_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734562",
  "AND objid = 21",
  "AND granted",
  ");",
].join(" ");
export const IDENTITY_CLEANUP_SCHEDULER_WORKER_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-created-identity-worker-b'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-created-identity-worker-a'",
  ")",
  ");",
].join(" ");
export const TEMPORARY_PROFILE_EVENT_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734563",
  "AND objid = 31",
  "AND granted",
  ");",
].join(" ");
export const TEMPORARY_PROFILE_EVENT_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-temp-cleanup-event-writer'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-temp-cleanup-event-claimer'",
  ")",
  ");",
].join(" ");
export const TEMPORARY_PROFILE_UPGRADE_BARRIER_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_locks",
  "WHERE locktype = 'advisory'",
  "AND classid = 734563",
  "AND objid = 32",
  "AND granted",
  ");",
].join(" ");
export const TEMPORARY_PROFILE_UPGRADE_WAIT_QUERY = [
  "SELECT EXISTS (",
  "SELECT 1 FROM pg_catalog.pg_stat_activity AS waiter",
  "WHERE waiter.datname = pg_catalog.current_database()",
  "AND waiter.application_name = 'effectime-temp-cleanup-upgrade-writer'",
  "AND waiter.state = 'active'",
  "AND waiter.wait_event_type = 'Lock'",
  "AND EXISTS (",
  "SELECT 1 FROM pg_catalog.unnest(pg_catalog.pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
  "JOIN pg_catalog.pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
  "WHERE blocker.application_name = 'effectime-temp-cleanup-upgrade-claimer'",
  ")",
  ");",
].join(" ");
export const RESET_CONCURRENCY_GATE_SQL =
  "UPDATE contract.member_profile_save_concurrency_gate SET released = false WHERE id = 1; DELETE FROM contract.member_profile_save_concurrency_results;";
export const RELEASE_CONCURRENCY_GATE_SQL =
  "UPDATE contract.member_profile_save_concurrency_gate SET released = true WHERE id = 1;";
export const RESET_BUSINESS_ROLE_CONCURRENCY_SQL =
  "UPDATE contract.business_role_delete_concurrency_gate SET released = false; DELETE FROM contract.business_role_delete_concurrency_results;";
export const RELEASE_BUSINESS_ROLE_WRITER_GATE_SQL =
  "UPDATE contract.business_role_delete_concurrency_gate SET released = true WHERE id = 11;";
export const RELEASE_BUSINESS_ROLE_DELETE_GATE_SQL =
  "UPDATE contract.business_role_delete_concurrency_gate SET released = true WHERE id = 12;";
export const RESET_IDENTITY_CLEANUP_CONCURRENCY_SQL =
  "UPDATE contract.created_identity_cleanup_concurrency_gate SET released = false WHERE id = 13; DELETE FROM contract.created_identity_cleanup_concurrency_results;";
export const RELEASE_IDENTITY_CLEANUP_FINALIZER_GATE_SQL =
  "UPDATE contract.created_identity_cleanup_concurrency_gate SET released = true WHERE id = 13;";
export const RESET_IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL =
  "UPDATE contract.created_identity_cleanup_scheduler_concurrency_gate SET released = false WHERE id = 21; DELETE FROM contract.created_identity_cleanup_scheduler_concurrency_results; UPDATE effectime_private.created_identity_cleanup_worker_state SET active_run_id = NULL, lease_expires_at = NULL, active_started_at = NULL WHERE singleton;";
export const RELEASE_IDENTITY_CLEANUP_SCHEDULER_WORKER_GATE_SQL =
  "UPDATE contract.created_identity_cleanup_scheduler_concurrency_gate SET released = true WHERE id = 21;";
export const RESET_TEMPORARY_PROFILE_CLEANUP_CONCURRENCY_SQL =
  "UPDATE contract.temporary_profile_cleanup_concurrency_gate SET released = false; DELETE FROM contract.temporary_profile_cleanup_concurrency_results;";
export const RELEASE_TEMPORARY_PROFILE_EVENT_GATE_SQL =
  "UPDATE contract.temporary_profile_cleanup_concurrency_gate SET released = true WHERE id = 31;";
export const RELEASE_TEMPORARY_PROFILE_UPGRADE_GATE_SQL =
  "UPDATE contract.temporary_profile_cleanup_concurrency_gate SET released = true WHERE id = 32;";
const TERMINATE_CONCURRENCY_BACKENDS_SQL = [
  "SELECT pg_catalog.pg_terminate_backend(pid)",
  "FROM pg_catalog.pg_stat_activity",
  "WHERE pid <> pg_catalog.pg_backend_pid()",
  "AND application_name IN (",
  "'effectime-member-profile-save-a',",
  "'effectime-member-profile-save-b',",
  "'effectime-member-profile-lock-holder',",
  "'effectime-member-profile-lock-timeout',",
  "'effectime-member-profile-read-writer',",
  "'effectime-member-profile-read-during',",
  "'effectime-member-profile-mixed-rpc',",
  "'effectime-member-profile-mixed-direct',",
  "'effectime-business-role-writer-first-a',",
  "'effectime-business-role-writer-first-b',",
  "'effectime-business-role-delete-first-a',",
  "'effectime-business-role-delete-first-b',",
  "'effectime-created-identity-finalizer',",
  "'effectime-created-identity-finalize-writer',",
  "'effectime-created-identity-worker-a',",
  "'effectime-created-identity-worker-b',",
  "'effectime-temp-cleanup-event-claimer',",
  "'effectime-temp-cleanup-event-writer',",
  "'effectime-temp-cleanup-upgrade-claimer',",
  "'effectime-temp-cleanup-upgrade-writer'",
  ");",
].join(" ");

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const containerNamePattern = /^effectime-member-profile-save-pg18-[1-9][0-9]*-[0-9a-f]{12}$/;
const containerIdPattern = /^[0-9a-f]{64}$/;
const ownershipTokenPattern = /^[0-9a-f]{32}$/;

function assertContainerName(containerName) {
  if (!containerNamePattern.test(containerName)) {
    throw new Error("Invalid member profile save contract container name");
  }
  return containerName;
}

function assertContainerId(containerId) {
  if (!containerIdPattern.test(containerId)) {
    throw new Error("Invalid member profile save contract container ID");
  }
  return containerId;
}

function assertOwnershipToken(ownershipToken) {
  if (!ownershipTokenPattern.test(ownershipToken)) {
    throw new Error("Invalid member profile save contract ownership token");
  }
  return ownershipToken;
}

export function createContainerName({
  pid = process.pid,
  suffix = randomBytes(6).toString("hex"),
} = {}) {
  if (!Number.isInteger(pid) || pid < 1 || !/^[0-9a-f]{12}$/.test(suffix)) {
    throw new Error("Invalid member profile save contract container identity");
  }
  return `effectime-member-profile-save-pg18-${pid}-${suffix}`;
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
    throw new Error("Member profile save contract runtime inputs are required");
  }

  const setupSource = resolve(repoRoot, "scripts/ci/member-profile-save-setup.test.sql");
  const migrationSource = resolve(
    repoRoot,
    "supabase/migrations/20260719143000_v3_51_6_atomic_member_profile_save.sql",
  );
  const businessRoleMigrationSource = resolve(
    repoRoot,
    "supabase/migrations/20260721233000_v3_51_7_atomic_business_role_delete.sql",
  );
  const identityCleanupMigrationSource = resolve(
    repoRoot,
    "supabase/migrations/20260721234500_v3_51_7_created_identity_compensation.sql",
  );
  const identityCleanupSchedulerMigrationSource = resolve(
    repoRoot,
    "supabase/migrations/20260722003000_v3_51_8_created_identity_cleanup_scheduler.sql",
  );
  const assertionsSource = resolve(repoRoot, "scripts/ci/member-profile-save-assertions.test.sql");
  const businessRoleAssertionsSource = resolve(
    repoRoot,
    "scripts/ci/business-role-delete-assertions.test.sql",
  );
  const identityCleanupAssertionsSource = resolve(
    repoRoot,
    "scripts/ci/created-identity-cleanup-assertions.test.sql",
  );
  const identityCleanupConcurrencySource = resolve(
    repoRoot,
    "scripts/ci/created-identity-cleanup-concurrency.test.sql",
  );
  const identityCleanupSchedulerAssertionsSource = resolve(
    repoRoot,
    "scripts/ci/created-identity-cleanup-scheduler-assertions.test.sql",
  );
  const identityCleanupSchedulerConcurrencySource = resolve(
    repoRoot,
    "scripts/ci/created-identity-cleanup-scheduler-concurrency.test.sql",
  );
  const businessRoleConcurrencySource = resolve(
    repoRoot,
    "scripts/ci/business-role-delete-concurrency.test.sql",
  );
  const concurrencySource = resolve(
    repoRoot,
    "scripts/ci/member-profile-save-concurrency.test.sql",
  );

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
    "--mount",
    `type=bind,source=${setupSource},target=${SETUP_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${migrationSource},target=${MIGRATION_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${businessRoleMigrationSource},target=${BUSINESS_ROLE_MIGRATION_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${identityCleanupMigrationSource},target=${IDENTITY_CLEANUP_MIGRATION_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${identityCleanupSchedulerMigrationSource},target=${IDENTITY_CLEANUP_SCHEDULER_MIGRATION_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${assertionsSource},target=${ASSERTIONS_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${businessRoleAssertionsSource},target=${BUSINESS_ROLE_ASSERTIONS_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${identityCleanupAssertionsSource},target=${IDENTITY_CLEANUP_ASSERTIONS_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${identityCleanupConcurrencySource},target=${IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${identityCleanupSchedulerAssertionsSource},target=${IDENTITY_CLEANUP_SCHEDULER_ASSERTIONS_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${identityCleanupSchedulerConcurrencySource},target=${IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${businessRoleConcurrencySource},target=${BUSINESS_ROLE_CONCURRENCY_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${concurrencySource},target=${CONCURRENCY_SQL_PATH},readonly`,
    POSTGRES_IMAGE,
  ];
}

export function buildPsqlFileArgs(containerName, sqlPath, variables = []) {
  assertContainerName(containerName);
  if (
    ![
      SETUP_SQL_PATH,
      MIGRATION_SQL_PATH,
      BUSINESS_ROLE_MIGRATION_SQL_PATH,
      IDENTITY_CLEANUP_MIGRATION_SQL_PATH,
      IDENTITY_CLEANUP_SCHEDULER_MIGRATION_SQL_PATH,
      ASSERTIONS_SQL_PATH,
      BUSINESS_ROLE_ASSERTIONS_SQL_PATH,
      IDENTITY_CLEANUP_ASSERTIONS_SQL_PATH,
      IDENTITY_CLEANUP_SCHEDULER_ASSERTIONS_SQL_PATH,
      IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
      IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH,
      BUSINESS_ROLE_CONCURRENCY_SQL_PATH,
      CONCURRENCY_SQL_PATH,
    ].includes(
      sqlPath,
    )
  ) {
    throw new Error("Invalid member profile save contract SQL path");
  }
  if (!Array.isArray(variables) || variables.some((value) => !/^[A-Z_]+=[01]$/.test(value))) {
    throw new Error("Invalid member profile save contract psql variable");
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
    ...variables.flatMap((variable) => ["--variable", variable]),
    "--file",
    sqlPath,
  ];
}

export function buildPsqlCommandArgs(containerName, command, { tuplesOnly = false } = {}) {
  assertContainerName(containerName);
  if (!command) {
    throw new Error("A member profile save contract command is required");
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
    ...(tuplesOnly ? ["--tuples-only", "--no-align"] : []),
    "--command",
    command,
  ];
}

export function buildPostgresReadinessArgs(containerName) {
  return buildPsqlCommandArgs(containerName, "SELECT 1;", { tuplesOnly: true });
}

export function assertExpectedMigrationFailure(result, expectedFailure, label) {
  if (!result || result.status === 0) {
    throw new Error(`Member profile save migration unexpectedly accepted ${label}`);
  }
  const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
  if (!details.includes(expectedFailure)) {
    throw new Error(
      `Member profile save migration failed for an unexpected reason${details.trim() ? `\n${details.trim()}` : ""}`,
    );
  }
  return true;
}

export function assertExpectedInventoryFailure(result) {
  return assertExpectedMigrationFailure(
    result,
    EXPECTED_INVENTORY_FAILURE,
    "fixture tenant drift",
  );
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
      "Refusing to remove a container whose ID and member profile save ownership label do not match",
    );
  }
  return containerId;
}

export function buildCleanupArgs(containerId) {
  return ["rm", "--force", assertContainerId(containerId)];
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

function dockerAsync(args) {
  const child = spawn("docker", args, { stdio: "inherit" });
  let settled = false;
  let outcome = null;
  const completion = new Promise((resolvePromise) => {
    let completed = false;
    const finish = (value) => {
      if (completed) return;
      completed = true;
      settled = true;
      outcome = value;
      resolvePromise(value);
    };
    child.once("error", (error) => finish({ status: "rejected", reason: error }));
    child.once("exit", (code, signal) => {
      if (code === 0) {
        finish({ status: "fulfilled" });
      } else {
        finish({
          status: "rejected",
          reason: new Error(
            `docker ${args[0]} exited with ${code ?? `signal ${signal ?? "unknown"}`}`,
          ),
        });
      }
    });
  });
  return {
    child,
    completion,
    get settled() {
      return settled;
    },
    get outcome() {
      return outcome;
    },
  };
}

async function waitForObservedQuery(containerName, session, query, description) {
  for (let attempt = 1; attempt <= 150; attempt += 1) {
    if (session.settled) {
      const result = await session.completion;
      if (result.status === "rejected") throw result.reason;
      throw new Error(`Concurrency session ended before ${description}`);
    }
    const observation = dockerSync(
      buildPsqlCommandArgs(containerName, query, { tuplesOnly: true }),
      { allowFailure: true },
    );
    if (observation.status === 0 && observation.stdout.trim() === "t") return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function settleConcurrencySessions(containerName, sessions, graceMilliseconds = 5_000) {
  await Promise.race([
    Promise.all(sessions.map((session) => session.completion)),
    delay(graceMilliseconds),
  ]);
  const pending = sessions.filter((session) => !session.settled);
  if (pending.length > 0) {
    dockerSync(buildPsqlCommandArgs(containerName, TERMINATE_CONCURRENCY_BACKENDS_SQL), {
      allowFailure: true,
    });
    for (const session of pending) session.child.kill("SIGTERM");
    await Promise.race([Promise.all(pending.map((session) => session.completion)), delay(1_000)]);
  }
  const results = await Promise.all(sessions.map((session) => session.completion));
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

async function runConcurrencyContract(containerName) {
  const sessions = [];
  let scenarioError = null;
  try {
    dockerSync(buildPsqlCommandArgs(containerName, RESET_CONCURRENCY_GATE_SQL));
    const sessionA = dockerAsync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_SAVE_A=1"]),
    );
    sessions.push(sessionA);
    await waitForObservedQuery(
      containerName,
      sessionA,
      CONCURRENCY_BARRIER_QUERY,
      "the primary save transaction barrier",
    );

    const sessionB = dockerAsync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_SAVE_B=1"]),
    );
    sessions.push(sessionB);
    await waitForObservedQuery(
      containerName,
      sessionB,
      CONCURRENCY_WAIT_QUERY,
      "the second save transaction advisory-lock wait",
    );

    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_CONCURRENCY_GATE_SQL));
  } catch (error) {
    scenarioError = error;
  }

  try {
    await settleConcurrencySessions(containerName, sessions);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;

  dockerSync(
    buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_SAVE_VERIFY=1"]),
    { stdio: "inherit" },
  );
  console.log("Proved two-session member profile save serialization.");
}

async function runBoundedLockTimeoutContract(containerName) {
  const sessions = [];
  let scenarioError = null;
  try {
    dockerSync(buildPsqlCommandArgs(containerName, RESET_CONCURRENCY_GATE_SQL));
    const holder = dockerAsync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_LOCK_HOLDER=1"]),
    );
    sessions.push(holder);
    await waitForObservedQuery(
      containerName,
      holder,
      LOCK_TIMEOUT_BARRIER_QUERY,
      "the lock-timeout holder transaction barrier",
    );

    const timeoutClient = dockerAsync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_LOCK_TIMEOUT=1"]),
    );
    sessions.push(timeoutClient);
    await waitForObservedQuery(
      containerName,
      timeoutClient,
      LOCK_TIMEOUT_WAIT_QUERY,
      "the bounded member-profile lock wait",
    );

    const timeoutOutcome = await Promise.race([
      timeoutClient.completion,
      delay(8_000).then(() => {
        throw new Error("Member profile lock_timeout client exceeded its 8 second contract budget");
      }),
    ]);
    if (timeoutOutcome.status === "rejected") throw timeoutOutcome.reason;
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_CONCURRENCY_GATE_SQL));
  } catch (error) {
    scenarioError = error;
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_CONCURRENCY_GATE_SQL), {
      allowFailure: true,
    });
  }

  try {
    await settleConcurrencySessions(containerName, sessions, 9_000);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;

  dockerSync(
    buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_LOCK_VERIFY=1"]),
    { stdio: "inherit" },
  );
  console.log("Proved function-scoped bounded member profile lock timeout and fresh retry.");
}

async function runAtomicReadMvccContract(containerName) {
  const sessions = [];
  let scenarioError = null;
  try {
    dockerSync(buildPsqlCommandArgs(containerName, RESET_CONCURRENCY_GATE_SQL));
    const writer = dockerAsync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_READ_WRITER=1"]),
    );
    sessions.push(writer);
    await waitForObservedQuery(
      containerName,
      writer,
      MVCC_READ_BARRIER_QUERY,
      "the uncommitted allocation writer barrier",
    );

    dockerSync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_READ_DURING=1"]),
      { stdio: "inherit" },
    );
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_CONCURRENCY_GATE_SQL));
  } catch (error) {
    scenarioError = error;
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_CONCURRENCY_GATE_SQL), {
      allowFailure: true,
    });
  }

  try {
    await settleConcurrencySessions(containerName, sessions);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;

  dockerSync(
    buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_READ_VERIFY=1"]),
    { stdio: "inherit" },
  );
  console.log("Proved one-statement member profile read MVCC consistency.");
}

async function runMixedWriterContract(containerName) {
  const sessions = [];
  let scenarioError = null;
  try {
    dockerSync(buildPsqlCommandArgs(containerName, RESET_CONCURRENCY_GATE_SQL));
    const rpcSession = dockerAsync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_MIXED_RPC=1"]),
    );
    sessions.push(rpcSession);
    await waitForObservedQuery(
      containerName,
      rpcSession,
      MIXED_WRITER_BARRIER_QUERY,
      "the parent-first RPC lock barrier",
    );

    const directSession = dockerAsync(
      buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_MIXED_DIRECT=1"]),
    );
    sessions.push(directSession);
    await waitForObservedQuery(
      containerName,
      directSession,
      MIXED_WRITER_WAIT_QUERY,
      "the allocation-first direct writer wait",
    );
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_CONCURRENCY_GATE_SQL));
  } catch (error) {
    scenarioError = error;
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_CONCURRENCY_GATE_SQL), {
      allowFailure: true,
    });
  }

  try {
    await settleConcurrencySessions(containerName, sessions, 8_000);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;

  dockerSync(
    buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["MEMBER_PROFILE_MIXED_VERIFY=1"]),
    { stdio: "inherit" },
  );
  console.log("Proved mixed legacy allocation/RPC lock conflict aborts one whole transaction safely.");
}

async function runBusinessRoleDeleteConcurrencyContract(containerName) {
  let sessions = [];
  let scenarioError = null;
  try {
    dockerSync(buildPsqlCommandArgs(containerName, RESET_BUSINESS_ROLE_CONCURRENCY_SQL));
    const writer = dockerAsync(
      buildPsqlFileArgs(containerName, BUSINESS_ROLE_CONCURRENCY_SQL_PATH, [
        "BUSINESS_ROLE_WRITER_FIRST_A=1",
      ]),
    );
    sessions.push(writer);
    await waitForObservedQuery(
      containerName,
      writer,
      BUSINESS_ROLE_WRITER_BARRIER_QUERY,
      "the business-role writer-first barrier",
    );

    const deleteAfterWriter = dockerAsync(
      buildPsqlFileArgs(containerName, BUSINESS_ROLE_CONCURRENCY_SQL_PATH, [
        "BUSINESS_ROLE_WRITER_FIRST_B=1",
      ]),
    );
    sessions.push(deleteAfterWriter);
    await waitForObservedQuery(
      containerName,
      deleteAfterWriter,
      BUSINESS_ROLE_WRITER_WAIT_QUERY,
      "the business-role delete workspace-gate wait",
    );
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_BUSINESS_ROLE_WRITER_GATE_SQL));
  } catch (error) {
    scenarioError = error;
  }
  try {
    await settleConcurrencySessions(containerName, sessions);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;
  dockerSync(
    buildPsqlFileArgs(containerName, BUSINESS_ROLE_CONCURRENCY_SQL_PATH, [
      "BUSINESS_ROLE_WRITER_FIRST_VERIFY=1",
    ]),
    { stdio: "inherit" },
  );

  sessions = [];
  scenarioError = null;
  try {
    dockerSync(buildPsqlCommandArgs(containerName, RESET_BUSINESS_ROLE_CONCURRENCY_SQL));
    const deleting = dockerAsync(
      buildPsqlFileArgs(containerName, BUSINESS_ROLE_CONCURRENCY_SQL_PATH, [
        "BUSINESS_ROLE_DELETE_FIRST_A=1",
      ]),
    );
    sessions.push(deleting);
    await waitForObservedQuery(
      containerName,
      deleting,
      BUSINESS_ROLE_DELETE_BARRIER_QUERY,
      "the business-role delete-first barrier",
    );

    const writerDuringDelete = dockerAsync(
      buildPsqlFileArgs(containerName, BUSINESS_ROLE_CONCURRENCY_SQL_PATH, [
        "BUSINESS_ROLE_DELETE_FIRST_B=1",
      ]),
    );
    sessions.push(writerDuringDelete);
    for (let attempt = 0; attempt < 30 && !writerDuringDelete.settled; attempt += 1) {
      await delay(100);
    }
    if (!writerDuringDelete.settled) {
      throw new Error(
        "Direct business-role writer did not fail immediately behind the workspace gate",
      );
    }
    const writerOutcome = await writerDuringDelete.completion;
    if (writerOutcome.status === "rejected") throw writerOutcome.reason;
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_BUSINESS_ROLE_DELETE_GATE_SQL));
  } catch (error) {
    scenarioError = error;
    dockerSync(buildPsqlCommandArgs(containerName, RELEASE_BUSINESS_ROLE_DELETE_GATE_SQL), {
      allowFailure: true,
    });
  }
  try {
    await settleConcurrencySessions(containerName, sessions);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;
  dockerSync(
    buildPsqlFileArgs(containerName, BUSINESS_ROLE_CONCURRENCY_SQL_PATH, [
      "BUSINESS_ROLE_DELETE_FIRST_VERIFY=1",
    ]),
    { stdio: "inherit" },
  );
  console.log("Proved workspace-scoped business-role writer/delete serialization.");
}

async function runCreatedIdentityCleanupConcurrencyContract(containerName) {
  const sessions = [];
  let scenarioError = null;
  try {
    dockerSync(buildPsqlCommandArgs(containerName, RESET_IDENTITY_CLEANUP_CONCURRENCY_SQL));
    const finalizer = dockerAsync(
      buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH, [
        "CREATED_IDENTITY_FINALIZER_A=1",
      ]),
    );
    sessions.push(finalizer);
    await waitForObservedQuery(
      containerName,
      finalizer,
      IDENTITY_CLEANUP_FINALIZER_BARRIER_QUERY,
      "the created-identity finalizer barrier",
    );

    const lateWriter = dockerAsync(
      buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH, [
        "CREATED_IDENTITY_FINALIZER_B=1",
      ]),
    );
    sessions.push(lateWriter);
    await waitForObservedQuery(
      containerName,
      lateWriter,
      IDENTITY_CLEANUP_FINALIZER_WAIT_QUERY,
      "the late identity writer cleanup-gate wait",
    );
    dockerSync(
      buildPsqlCommandArgs(containerName, RELEASE_IDENTITY_CLEANUP_FINALIZER_GATE_SQL),
    );
  } catch (error) {
    scenarioError = error;
    dockerSync(
      buildPsqlCommandArgs(containerName, RELEASE_IDENTITY_CLEANUP_FINALIZER_GATE_SQL),
      { allowFailure: true },
    );
  }

  try {
    await settleConcurrencySessions(containerName, sessions, 8_000);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;

  dockerSync(
    buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH, [
      "CREATED_IDENTITY_FINALIZER_VERIFY=1",
    ]),
    { stdio: "inherit" },
  );
  console.log("Proved created-identity finalizer/write serialization.");
}

async function runCreatedIdentityCleanupSchedulerConcurrencyContract(containerName) {
  const sessions = [];
  let scenarioError = null;
  try {
    dockerSync(
      buildPsqlCommandArgs(
        containerName,
        RESET_IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL,
      ),
    );
    const firstWorker = dockerAsync(
      buildPsqlFileArgs(
        containerName,
        IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
        ["CREATED_IDENTITY_SCHEDULER_WORKER_A=1"],
      ),
    );
    sessions.push(firstWorker);
    await waitForObservedQuery(
      containerName,
      firstWorker,
      IDENTITY_CLEANUP_SCHEDULER_WORKER_BARRIER_QUERY,
      "the created-identity scheduler worker barrier",
    );

    const overlappingWorker = dockerAsync(
      buildPsqlFileArgs(
        containerName,
        IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
        ["CREATED_IDENTITY_SCHEDULER_WORKER_B=1"],
      ),
    );
    sessions.push(overlappingWorker);
    await waitForObservedQuery(
      containerName,
      overlappingWorker,
      IDENTITY_CLEANUP_SCHEDULER_WORKER_WAIT_QUERY,
      "the overlapping created-identity scheduler worker",
    );
  } catch (error) {
    scenarioError = error;
  } finally {
    try {
      dockerSync(
        buildPsqlCommandArgs(
          containerName,
          RELEASE_IDENTITY_CLEANUP_SCHEDULER_WORKER_GATE_SQL,
        ),
      );
    } catch (error) {
      if (!scenarioError) scenarioError = error;
    }
  }

  try {
    await settleConcurrencySessions(containerName, sessions, 8_000);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;

  dockerSync(
    buildPsqlFileArgs(
      containerName,
      IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
      ["CREATED_IDENTITY_SCHEDULER_VERIFY=1"],
    ),
    { stdio: "inherit" },
  );
  console.log("Proved created-identity scheduler worker single-flight fencing.");
}

async function runTemporaryProfileCleanupRaceScenario(
  containerName,
  {
    claimerVariable,
    writerVariable,
    verifyVariable,
    barrierQuery,
    waitQuery,
    releaseSql,
    label,
  },
) {
  const sessions = [];
  let scenarioError = null;
  try {
    dockerSync(
      buildPsqlCommandArgs(
        containerName,
        RESET_TEMPORARY_PROFILE_CLEANUP_CONCURRENCY_SQL,
      ),
    );
    const claimer = dockerAsync(
      buildPsqlFileArgs(
        containerName,
        IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
        [`${claimerVariable}=1`],
      ),
    );
    sessions.push(claimer);
    await waitForObservedQuery(
      containerName,
      claimer,
      barrierQuery,
      `${label} claimer barrier`,
    );

    const writer = dockerAsync(
      buildPsqlFileArgs(
        containerName,
        IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
        [`${writerVariable}=1`],
      ),
    );
    sessions.push(writer);
    await waitForObservedQuery(
      containerName,
      writer,
      waitQuery,
      `${label} blocked writer`,
    );
  } catch (error) {
    scenarioError = error;
  } finally {
    try {
      dockerSync(buildPsqlCommandArgs(containerName, releaseSql));
    } catch (error) {
      if (!scenarioError) scenarioError = error;
    }
  }

  try {
    await settleConcurrencySessions(containerName, sessions, 8_000);
  } catch (error) {
    if (!scenarioError) scenarioError = error;
  }
  if (scenarioError) throw scenarioError;

  dockerSync(
    buildPsqlFileArgs(
      containerName,
      IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
      [`${verifyVariable}=1`],
    ),
    { stdio: "inherit" },
  );
}

async function runTemporaryProfileCleanupConcurrencyContract(containerName) {
  await runTemporaryProfileCleanupRaceScenario(containerName, {
    claimerVariable: "TEMPORARY_PROFILE_EVENT_CLAIMER",
    writerVariable: "TEMPORARY_PROFILE_EVENT_WRITER",
    verifyVariable: "TEMPORARY_PROFILE_EVENT_VERIFY",
    barrierQuery: TEMPORARY_PROFILE_EVENT_BARRIER_QUERY,
    waitQuery: TEMPORARY_PROFILE_EVENT_WAIT_QUERY,
    releaseSql: RELEASE_TEMPORARY_PROFILE_EVENT_GATE_SQL,
    label: "temporary-profile event-extension",
  });
  await runTemporaryProfileCleanupRaceScenario(containerName, {
    claimerVariable: "TEMPORARY_PROFILE_UPGRADE_CLAIMER",
    writerVariable: "TEMPORARY_PROFILE_UPGRADE_WRITER",
    verifyVariable: "TEMPORARY_PROFILE_UPGRADE_VERIFY",
    barrierQuery: TEMPORARY_PROFILE_UPGRADE_BARRIER_QUERY,
    waitQuery: TEMPORARY_PROFILE_UPGRADE_WAIT_QUERY,
    releaseSql: RELEASE_TEMPORARY_PROFILE_UPGRADE_GATE_SQL,
    label: "temporary-profile upgrade",
  });
  console.log(
    "Proved temporary-profile event-extension and upgrade race fencing.",
  );
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
      `Unable to prove member profile save contract container ownership: ${inspection.stderr?.trim() || "inspect failed"}`,
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
      `Failed to remove owned member profile save contract container ${containerId}: ${cleanup.stderr?.trim() || "unknown error"}`,
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
    throw new Error("Invalid member profile save readiness limits");
  }

  const readinessArgs = buildPostgresReadinessArgs(containerName);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = executeDockerSync(readinessArgs, { allowFailure: true });
    if (result.status === 0 && result.stdout?.trim() === "1") return;
    if (attempt < attempts) await wait(intervalMilliseconds);
  }
  throw new Error(
    `PostgreSQL member profile save contract database ${CONTRACT_DATABASE} did not become queryable`,
  );
}

export async function runMemberProfileSaveDatabaseContract({
  containerName = createContainerName(),
  repoRoot = repositoryRoot,
  ownershipToken = createOwnershipToken(),
  executeDockerSync = dockerSync,
  wait = delay,
} = {}) {
  assertContainerName(containerName);
  assertOwnershipToken(ownershipToken);
  const password = randomBytes(24).toString("base64url");
  let createdContainerId = null;
  let contractError = null;
  let cleanupError = null;

  console.log(`Member profile save DB contract container: ${containerName}`);
  console.log(`Pinned PostgreSQL image: ${POSTGRES_IMAGE}`);
  try {
    const creation = executeDockerSync(
      buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }),
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    createdContainerId = parseCreatedContainerId(creation.stdout);
    await waitForPostgres(containerName, { executeDockerSync, wait });

    executeDockerSync(buildPsqlFileArgs(containerName, SETUP_SQL_PATH), { stdio: "inherit" });
    const inventoryFailure = executeDockerSync(
      buildPsqlFileArgs(containerName, MIGRATION_SQL_PATH),
      { allowFailure: true, stdio: "pipe" },
    );
    assertExpectedInventoryFailure(inventoryFailure);
    console.log("Proved legacy tenant mismatch inventory fails without mutation.");

    executeDockerSync(buildPsqlCommandArgs(containerName, FIXTURE_MISMATCH_CLEANUP_SQL), {
      stdio: "inherit",
    });
    for (const driftCase of LEXICAL_CONSTRAINT_DRIFT_CASES) {
      executeDockerSync(buildPsqlCommandArgs(containerName, driftCase.installSql), {
        stdio: "inherit",
      });
      try {
        const driftFailure = executeDockerSync(
          buildPsqlFileArgs(containerName, MIGRATION_SQL_PATH),
          { allowFailure: true, stdio: "pipe" },
        );
        assertExpectedMigrationFailure(
          driftFailure,
          driftCase.expectedFailure,
          `${driftCase.label} lexical constraint drift`,
        );
      } finally {
        executeDockerSync(buildPsqlCommandArgs(containerName, driftCase.cleanupSql), {
          stdio: "inherit",
        });
      }
      console.log(`Proved incompatible ${driftCase.label} lexical constraint fails closed.`);
    }
    executeDockerSync(
      buildPsqlCommandArgs(containerName, AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE.installSql),
      { stdio: "inherit" },
    );
    executeDockerSync(buildPsqlFileArgs(containerName, MIGRATION_SQL_PATH), { stdio: "inherit" });
    executeDockerSync(
      buildPsqlCommandArgs(containerName, AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE.verificationSql),
      { stdio: "inherit" },
    );
    console.log("Proved auth profile bootstrap trigger drift is repaired exactly.");

    executeDockerSync(
      buildPsqlCommandArgs(containerName, AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE.installSql),
      { stdio: "inherit" },
    );
    try {
      const extraTriggerFailure = executeDockerSync(
        buildPsqlFileArgs(containerName, MIGRATION_SQL_PATH),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedMigrationFailure(
        extraTriggerFailure,
        AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE.expectedFailure,
        AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE.label,
      );
    } finally {
      executeDockerSync(
        buildPsqlCommandArgs(containerName, AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE.cleanupSql),
        { stdio: "inherit" },
      );
    }
    console.log("Proved an unknown additional auth bootstrap trigger fails closed.");

    executeDockerSync(
      buildPsqlCommandArgs(containerName, AUTH_BOOTSTRAP_ACL_DRIFT_CASE.installSql),
      { stdio: "inherit" },
    );
    executeDockerSync(buildPsqlFileArgs(containerName, MIGRATION_SQL_PATH), { stdio: "inherit" });
    executeDockerSync(
      buildPsqlCommandArgs(containerName, AUTH_BOOTSTRAP_ACL_DRIFT_CASE.verificationSql),
      { stdio: "inherit" },
    );
    console.log("Proved auth profile bootstrap ACL drift is repaired exactly.");

    executeDockerSync(buildPsqlFileArgs(containerName, MIGRATION_SQL_PATH), { stdio: "inherit" });
    executeDockerSync(buildPsqlFileArgs(containerName, BUSINESS_ROLE_MIGRATION_SQL_PATH), {
      stdio: "inherit",
    });
    executeDockerSync(buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_MIGRATION_SQL_PATH), {
      stdio: "inherit",
    });
    executeDockerSync(
      buildPsqlCommandArgs(
        containerName,
        TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.installSql,
      ),
      { stdio: "inherit" },
    );
    try {
      const preflightFailure = executeDockerSync(
        buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_SCHEDULER_MIGRATION_SQL_PATH),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedMigrationFailure(
        preflightFailure,
        TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.expectedFailure,
        TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.label,
      );
      executeDockerSync(
        buildPsqlCommandArgs(
          containerName,
          TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.verificationSql,
        ),
        { stdio: "inherit" },
      );
    } finally {
      executeDockerSync(
        buildPsqlCommandArgs(
          containerName,
          TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.cleanupSql,
        ),
        { stdio: "inherit" },
      );
    }
    console.log(
      "Proved temporary-profile cleanup schema drift fails before scheduler DDL.",
    );
    executeDockerSync(
      buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_SCHEDULER_MIGRATION_SQL_PATH),
      { stdio: "inherit" },
    );
    executeDockerSync(buildPsqlFileArgs(containerName, BUSINESS_ROLE_MIGRATION_SQL_PATH), {
      stdio: "inherit",
    });
    executeDockerSync(buildPsqlFileArgs(containerName, ASSERTIONS_SQL_PATH), { stdio: "inherit" });
    executeDockerSync(buildPsqlFileArgs(containerName, BUSINESS_ROLE_ASSERTIONS_SQL_PATH), {
      stdio: "inherit",
    });
    executeDockerSync(buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_ASSERTIONS_SQL_PATH), {
      stdio: "inherit",
    });
    executeDockerSync(
      buildPsqlFileArgs(containerName, IDENTITY_CLEANUP_SCHEDULER_ASSERTIONS_SQL_PATH),
      { stdio: "inherit" },
    );
    if (executeDockerSync !== dockerSync) {
      console.log("Skipped live concurrency child processes for injected runner execution.");
    } else {
      await runConcurrencyContract(containerName);
      await runBoundedLockTimeoutContract(containerName);
      await runMixedWriterContract(containerName);
      await runAtomicReadMvccContract(containerName);
      await runBusinessRoleDeleteConcurrencyContract(containerName);
      await runCreatedIdentityCleanupConcurrencyContract(containerName);
      await runCreatedIdentityCleanupSchedulerConcurrencyContract(containerName);
      await runTemporaryProfileCleanupConcurrencyContract(containerName);
    }
    console.log("Member profile save PostgreSQL 18.4 contract passed.");
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
          `Removed owned member profile save contract container: ${containerName} (${createdContainerId})`,
        );
      }
    } catch (error) {
      cleanupError = error;
    }
  }

  if (contractError && cleanupError) {
    throw new AggregateError(
      [contractError, cleanupError],
      "Member profile save database contract and owned-container cleanup both failed",
    );
  }
  if (contractError) throw contractError;
  if (cleanupError) throw cleanupError;
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  runMemberProfileSaveDatabaseContract().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
