import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import test from "node:test";

import {
  ASYNC_DOCKER_TIMEOUT_MILLISECONDS,
  ASSERTIONS_SQL_PATH,
  assertExpectedPsqlFailure,
  buildCleanupArgs,
  buildDockerRunArgs,
  buildOwnershipInspectArgs,
  buildPostgresReadinessArgs,
  buildPsqlFileArgs,
  buildPsqlPluginInstallCountTamperArgs,
  buildPsqlPluginInstallLockTimeoutTamperArgs,
  buildPsqlPluginInstallPolicyTamperArgs,
  buildPsqlPluginSecretTamperArgs,
  buildPsqlTamperArgs,
  cleanupOwnedContainer,
  CLOCK_MIGRATION_SQL_PATH,
  CLOCKOUT_MIGRATION_SQL_PATH,
  CONTRACT_DATABASE,
  createContainerName,
  createOwnershipToken,
  dockerAsync,
  HARDENING_MIGRATION_SQL_PATH,
  MARKETPLACE_MIGRATION_SQL_PATH,
  OWNERSHIP_LABEL_KEY,
  parseCreatedContainerId,
  PLUGIN_INSTALL_COUNT_ASSERTIONS_SQL_PATH,
  PLUGIN_INSTALL_COUNT_BARRIER_SECONDS,
  PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_READY_SQL,
  PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_READY_SQL,
  PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH,
  PLUGIN_INSTALL_COUNT_READINESS_ATTEMPTS,
  PLUGIN_INSTALL_COUNT_READINESS_INTERVAL_MILLISECONDS,
  PLUGIN_INSTALL_COUNT_SEED_SQL_PATH,
  PLUGIN_INSTALL_COUNT_STATEMENT_TIMEOUT_SECONDS,
  PLUGIN_INSTALL_COUNT_TAMPER_CASES,
  PLUGIN_INSTALL_LOCK_TIMEOUT_ASSERTIONS_SQL_PATH,
  PLUGIN_INSTALL_LOCK_TIMEOUT_BARRIER_APPLICATION_NAME,
  PLUGIN_INSTALL_LOCK_TIMEOUT_BARRIER_SECONDS,
  PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_SQL,
  PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_READY_SQL,
  PLUGIN_INSTALL_LOCK_TIMEOUT_HOLDER_SQL,
  PLUGIN_INSTALL_LOCK_TIMEOUT_HOLDER_READY_SQL,
  PLUGIN_INSTALL_LOCK_TIMEOUT_MIGRATION_SQL_PATH,
  PLUGIN_INSTALL_LOCK_TIMEOUT_READINESS_ATTEMPTS,
  PLUGIN_INSTALL_LOCK_TIMEOUT_READINESS_INTERVAL_MILLISECONDS,
  PLUGIN_INSTALL_LOCK_TIMEOUT_SEED_SQL_PATH,
  PLUGIN_INSTALL_LOCK_TIMEOUT_STATEMENT_TIMEOUT_SECONDS,
  PLUGIN_INSTALL_LOCK_TIMEOUT_TAMPER_CASES,
  RETRY_PLUGIN_INSTALL_AFTER_LOCK_TIMEOUT_SQL,
  VERIFY_PLUGIN_INSTALL_LOCK_TIMEOUT_RETRY_SQL,
  VERIFY_PLUGIN_INSTALL_LOCK_TIMEOUT_ROLLBACK_SQL,
  PLUGIN_INSTALL_POLICY_ASSERTIONS_SQL_PATH,
  PLUGIN_INSTALL_POLICY_LOCK_HOLDER_READY_SQL,
  PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH,
  PLUGIN_INSTALL_POLICY_SEED_SQL_PATH,
  PLUGIN_INSTALL_POLICY_TAMPER_CASES,
  PLUGIN_SECRET_ASSERTIONS_SQL_PATH,
  PLUGIN_SECRET_MIGRATION_SQL_PATH,
  PLUGIN_SECRET_SEED_SQL_PATH,
  PLUGIN_SECRET_TAMPER_CASES,
  POSTGRES_IMAGE,
  resolveOwnedCleanupTarget,
  SETUP_SQL_PATH,
  TAMPER_CASES,
  throwPluginConcurrencyPhaseErrors,
  waitForPostgres,
  waitForPluginInstallPolicyLockHolder,
  buildTerminatePluginConcurrencyApplicationSql,
} from "./recovered-surface-acl-db-contract.mjs";

const containerName = "effectime-recovered-surface-acl-pg17-42-001122aabbcc";
const containerId = "a".repeat(64);
const foreignContainerId = "b".repeat(64);
const ownershipToken = "c".repeat(32);

test("creates a collision-resistant validated recovered-surface identity", () => {
  const first = createContainerName({ pid: 42, suffix: "001122aabbcc" });
  const second = createContainerName({ pid: 42, suffix: "ffeeddccbbaa" });
  assert.equal(first, containerName);
  assert.notEqual(first, second);
  assert.match(first, /^[a-z0-9-]+$/);
  assert.throws(
    () => createContainerName({ pid: 0, suffix: "001122aabbcc" }),
    /Invalid recovered surface ACL contract container identity/,
  );
  assert.throws(
    () => createContainerName({ pid: 42, suffix: "001122AABBCC" }),
    /Invalid recovered surface ACL contract container identity/,
  );
  assert.equal(createOwnershipToken(Buffer.alloc(16, 0xab)), "ab".repeat(16));
});

test("rejects injected names and accepts only exact Docker creation IDs", () => {
  assert.throws(
    () =>
      buildDockerRunArgs({
        containerName: `${containerName};docker-rm-foreign`,
        repoRoot: "C:\\Work\\Effectime Fixture",
        password: "ephemeral-value",
        ownershipToken,
      }),
    /Invalid recovered surface ACL contract container name/,
  );
  assert.equal(parseCreatedContainerId(`${containerId}\n`), containerId);
  assert.throws(
    () => parseCreatedContainerId(containerName),
    /Invalid recovered surface ACL contract container ID/,
  );
  assert.throws(
    () => parseCreatedContainerId(`${containerId}\n${foreignContainerId}`),
    /Invalid recovered surface ACL contract container ID/,
  );
});

test("pins PostgreSQL 17.6 and mounts only the eighteen exact inputs read-only", () => {
  const repoRoot = "C:\\Work\\Effectime Fixture";
  const args = buildDockerRunArgs({
    containerName,
    repoRoot,
    password: "ephemeral-value",
    ownershipToken,
  });

  assert.equal(args.at(-1), POSTGRES_IMAGE);
  assert.deepEqual(args.slice(0, 4), ["run", "--detach", "--name", containerName]);
  assert.equal(args[args.indexOf("--label") + 1], `${OWNERSHIP_LABEL_KEY}=${ownershipToken}`);
  assert.equal(args[args.indexOf("--network") + 1], "none");
  assert.equal(args.includes("--publish"), false);
  assert.equal(args.includes("-p"), false);
  assert.ok(args.includes(`POSTGRES_DB=${CONTRACT_DATABASE}`));

  const mounts = args
    .map((argument, index) => (argument === "--mount" ? args[index + 1] : null))
    .filter(Boolean);
  assert.deepEqual(mounts, [
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/recovered-surface-acl-setup.test.sql",
    )},target=${SETUP_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260514124827_v3_22_0_clock_in_engine.sql",
    )},target=${CLOCK_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260514194031_v3_30_0_plugin_marketplace.sql",
    )},target=${MARKETPLACE_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260516160000_v3_39_1_clock_event_clockout_fix.sql",
    )},target=${CLOCKOUT_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260722054500_v3_51_10_recovered_surface_acl_hardening.sql",
    )},target=${HARDENING_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/recovered-surface-acl-assertions.test.sql",
    )},target=${ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-config-secret-seed.test.sql",
    )},target=${PLUGIN_SECRET_SEED_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260722060000_v3_51_11_plugin_config_secret_boundary.sql",
    )},target=${PLUGIN_SECRET_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-config-secret-assertions.test.sql",
    )},target=${PLUGIN_SECRET_ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-install-policy-seed.test.sql",
    )},target=${PLUGIN_INSTALL_POLICY_SEED_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260722061500_v3_51_12_plugin_install_policy_boundary.sql",
    )},target=${PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-install-policy-assertions.test.sql",
    )},target=${PLUGIN_INSTALL_POLICY_ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-install-count-concurrency-seed.test.sql",
    )},target=${PLUGIN_INSTALL_COUNT_SEED_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260722080000_v3_51_13_plugin_install_count_concurrency.sql",
    )},target=${PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-install-count-concurrency-assertions.test.sql",
    )},target=${PLUGIN_INSTALL_COUNT_ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-install-lock-timeout-seed.test.sql",
    )},target=${PLUGIN_INSTALL_LOCK_TIMEOUT_SEED_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260722083000_v3_51_14_plugin_install_lock_timeout.sql",
    )},target=${PLUGIN_INSTALL_LOCK_TIMEOUT_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/plugin-install-lock-timeout-assertions.test.sql",
    )},target=${PLUGIN_INSTALL_LOCK_TIMEOUT_ASSERTIONS_SQL_PATH},readonly`,
  ]);
  assert.equal(
    args.some((argument) => argument.includes("target=/workspace")),
    false,
  );
  assert.ok(mounts.every((mount) => mount.endsWith(",readonly")));
});

test("psql entry points are isolated, fail closed, and file-allowlisted", () => {
  const setupArgs = buildPsqlFileArgs(containerName, SETUP_SQL_PATH);
  assert.deepEqual(setupArgs.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(setupArgs.includes("-X"));
  assert.deepEqual(setupArgs.slice(setupArgs.indexOf("--set"), setupArgs.indexOf("--set") + 2), [
    "--set",
    "ON_ERROR_STOP=1",
  ]);
  assert.equal(setupArgs.at(-1), SETUP_SQL_PATH);

  const migrationArgs = buildPsqlFileArgs(containerName, HARDENING_MIGRATION_SQL_PATH, {
    singleTransaction: true,
  });
  assert.ok(migrationArgs.includes("--single-transaction"));
  assert.equal(migrationArgs.at(-1), HARDENING_MIGRATION_SQL_PATH);

  const pluginSecretMigrationArgs = buildPsqlFileArgs(
    containerName,
    PLUGIN_SECRET_MIGRATION_SQL_PATH,
    { singleTransaction: true },
  );
  assert.ok(pluginSecretMigrationArgs.includes("--single-transaction"));
  assert.equal(pluginSecretMigrationArgs.at(-1), PLUGIN_SECRET_MIGRATION_SQL_PATH);

  const pluginInstallPolicyMigrationArgs = buildPsqlFileArgs(
    containerName,
    PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH,
    { singleTransaction: true },
  );
  assert.ok(pluginInstallPolicyMigrationArgs.includes("--single-transaction"));
  assert.equal(
    pluginInstallPolicyMigrationArgs.at(-1),
    PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH,
  );

  const pluginInstallCountMigrationArgs = buildPsqlFileArgs(
    containerName,
    PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH,
    { singleTransaction: true },
  );
  assert.ok(pluginInstallCountMigrationArgs.includes("--single-transaction"));
  assert.equal(
    pluginInstallCountMigrationArgs.at(-1),
    PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH,
  );

  const pluginInstallLockTimeoutMigrationArgs = buildPsqlFileArgs(
    containerName,
    PLUGIN_INSTALL_LOCK_TIMEOUT_MIGRATION_SQL_PATH,
    { singleTransaction: true },
  );
  assert.ok(pluginInstallLockTimeoutMigrationArgs.includes("--single-transaction"));
  assert.equal(
    pluginInstallLockTimeoutMigrationArgs.at(-1),
    PLUGIN_INSTALL_LOCK_TIMEOUT_MIGRATION_SQL_PATH,
  );

  assert.throws(
    () => buildPsqlFileArgs(containerName, CLOCK_MIGRATION_SQL_PATH),
    /SQL path is not allowlisted/,
  );
  assert.throws(
    () => buildPsqlFileArgs(containerName, "/etc/passwd"),
    /SQL path is not allowlisted/,
  );

  const readinessArgs = buildPostgresReadinessArgs(containerName);
  assert.deepEqual(readinessArgs.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(readinessArgs.includes("-X"));
  assert.equal(readinessArgs[readinessArgs.indexOf("--dbname") + 1], CONTRACT_DATABASE);
  assert.ok(readinessArgs.includes("ON_ERROR_STOP=1"));
  assert.ok(readinessArgs.includes("--tuples-only"));
  assert.ok(readinessArgs.includes("--no-align"));
  assert.deepEqual(readinessArgs.slice(-2), ["--command", "SELECT 1;"]);

  const tamperArgs = buildPsqlTamperArgs(containerName, TAMPER_CASES[0].sql);
  assert.deepEqual(tamperArgs.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(tamperArgs.includes("-X"));
  assert.equal(tamperArgs[tamperArgs.indexOf("--command") + 1], `BEGIN; ${TAMPER_CASES[0].sql}`);
  assert.equal(tamperArgs.at(-2), "--file");
  assert.equal(tamperArgs.at(-1), HARDENING_MIGRATION_SQL_PATH);
  assert.throws(
    () => buildPsqlTamperArgs(containerName, "DROP DATABASE postgres;"),
    /tamper SQL is not allowlisted/,
  );

  const pluginTamperArgs = buildPsqlPluginSecretTamperArgs(
    containerName,
    PLUGIN_SECRET_TAMPER_CASES[0].sql,
  );
  assert.deepEqual(pluginTamperArgs.slice(0, 3), ["exec", containerName, "psql"]);
  assert.equal(
    pluginTamperArgs[pluginTamperArgs.indexOf("--command") + 1],
    `BEGIN; ${PLUGIN_SECRET_TAMPER_CASES[0].sql}`,
  );
  assert.equal(pluginTamperArgs.at(-1), PLUGIN_SECRET_MIGRATION_SQL_PATH);
  assert.throws(
    () => buildPsqlPluginSecretTamperArgs(containerName, "DROP DATABASE postgres;"),
    /tamper SQL is not allowlisted/,
  );

  const pluginInstallPolicyTamperArgs = buildPsqlPluginInstallPolicyTamperArgs(
    containerName,
    PLUGIN_INSTALL_POLICY_TAMPER_CASES[0].sql,
  );
  assert.deepEqual(pluginInstallPolicyTamperArgs.slice(0, 3), [
    "exec",
    containerName,
    "psql",
  ]);
  assert.equal(
    pluginInstallPolicyTamperArgs[
      pluginInstallPolicyTamperArgs.indexOf("--command") + 1
    ],
    `BEGIN; ${PLUGIN_INSTALL_POLICY_TAMPER_CASES[0].sql}`,
  );
  assert.equal(
    pluginInstallPolicyTamperArgs.at(-1),
    PLUGIN_INSTALL_POLICY_MIGRATION_SQL_PATH,
  );
  assert.throws(
    () => buildPsqlPluginInstallPolicyTamperArgs(containerName, "DROP DATABASE postgres;"),
    /tamper SQL is not allowlisted/,
  );

  const pluginInstallCountTamperArgs = buildPsqlPluginInstallCountTamperArgs(
    containerName,
    PLUGIN_INSTALL_COUNT_TAMPER_CASES[0].sql,
  );
  assert.deepEqual(pluginInstallCountTamperArgs.slice(0, 3), [
    "exec",
    containerName,
    "psql",
  ]);
  assert.equal(
    pluginInstallCountTamperArgs[
      pluginInstallCountTamperArgs.indexOf("--command") + 1
    ],
    `BEGIN; ${PLUGIN_INSTALL_COUNT_TAMPER_CASES[0].sql}`,
  );
  assert.equal(
    pluginInstallCountTamperArgs.at(-1),
    PLUGIN_INSTALL_COUNT_MIGRATION_SQL_PATH,
  );
  assert.throws(
    () => buildPsqlPluginInstallCountTamperArgs(containerName, "DROP DATABASE postgres;"),
    /tamper SQL is not allowlisted/,
  );

  const pluginInstallLockTimeoutTamperArgs =
    buildPsqlPluginInstallLockTimeoutTamperArgs(
      containerName,
      PLUGIN_INSTALL_LOCK_TIMEOUT_TAMPER_CASES[0].sql,
    );
  assert.deepEqual(pluginInstallLockTimeoutTamperArgs.slice(0, 3), [
    "exec",
    containerName,
    "psql",
  ]);
  assert.equal(
    pluginInstallLockTimeoutTamperArgs[
      pluginInstallLockTimeoutTamperArgs.indexOf("--command") + 1
    ],
    `BEGIN; ${PLUGIN_INSTALL_LOCK_TIMEOUT_TAMPER_CASES[0].sql}`,
  );
  assert.equal(
    pluginInstallLockTimeoutTamperArgs.at(-1),
    PLUGIN_INSTALL_LOCK_TIMEOUT_MIGRATION_SQL_PATH,
  );
  assert.throws(
    () =>
      buildPsqlPluginInstallLockTimeoutTamperArgs(
        containerName,
        "DROP DATABASE postgres;",
      ),
    /tamper SQL is not allowlisted/,
  );
});

test("expected-failure matcher accepts only the exact preflight failure", () => {
  const expectedFailure = TAMPER_CASES[0].expectedFailure;
  const accepted = assertExpectedPsqlFailure(
    {
      status: 3,
      stdout: "",
      stderr: "psql:error: ERROR: Recovered surface RLS policy contract is incompatible\n",
    },
    expectedFailure,
  );
  assert.match(accepted, /RLS policy contract is incompatible/);
  assert.throws(
    () =>
      assertExpectedPsqlFailure(
        { status: 0, stdout: "migration passed", stderr: "" },
        expectedFailure,
      ),
    /Expected PostgreSQL contract failure/,
  );
  assert.throws(
    () =>
      assertExpectedPsqlFailure(
        { status: 3, stdout: "", stderr: "ERROR: unrelated failure" },
        expectedFailure,
      ),
    /failed for an unexpected reason/,
  );
});

test("readiness requires an exact successful query result", async () => {
  const outcomes = [
    { status: 1, stdout: "", stderr: "starting" },
    { status: 0, stdout: "unexpected\n", stderr: "" },
    { status: 0, stdout: "1\n", stderr: "" },
  ];
  const waits = [];
  await waitForPostgres(containerName, {
    executeDockerSync: () => outcomes.shift(),
    wait: async (milliseconds) => waits.push(milliseconds),
    attempts: 3,
    intervalMilliseconds: 7,
  });
  assert.deepEqual(waits, [7, 7]);

  await assert.rejects(
    waitForPostgres(containerName, {
      executeDockerSync: () => ({ status: 0, stdout: "", stderr: "" }),
      wait: async () => {},
      attempts: 1,
      intervalMilliseconds: 0,
    }),
    /did not become queryable/,
  );
});

test("plugin lock barriers require exact blocker relationships", async () => {
  const calls = [];
  const outcomes = [
    { status: 0, stdout: "0\n", stderr: "" },
    { status: 0, stdout: "1\n", stderr: "" },
  ];
  await waitForPluginInstallPolicyLockHolder(containerName, {
    executeDockerSync: (args) => {
      calls.push(args);
      return outcomes.shift();
    },
    wait: async () => {},
    attempts: 2,
    intervalMilliseconds: 0,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].at(-1), PLUGIN_INSTALL_POLICY_LOCK_HOLDER_READY_SQL);
  assert.match(PLUGIN_INSTALL_POLICY_LOCK_HOLDER_READY_SQL, /pg_blocking_pids\(holder\.pid\)/);
  assert.doesNotMatch(PLUGIN_INSTALL_POLICY_LOCK_HOLDER_READY_SQL, /PgSleep/);
  assert.match(
    PLUGIN_INSTALL_COUNT_LEGACY_INSTALLER_READY_SQL,
    /pg_blocking_pids\(installer\.pid\).*ARRAY\[barrier\.pid\]/,
  );
  assert.match(
    PLUGIN_INSTALL_COUNT_LEGACY_UNINSTALLER_READY_SQL,
    /pg_blocking_pids\(uninstaller\.pid\).*ARRAY\[installer\.pid\]/,
  );
  assert.match(
    PLUGIN_INSTALL_LOCK_TIMEOUT_HOLDER_READY_SQL,
    /pg_blocking_pids\(holder\.pid\).*ARRAY\[barrier\.pid\]/,
  );
  assert.match(
    PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_READY_SQL,
    /pg_blocking_pids\(client\.pid\).*ARRAY\[holder\.pid\]/,
  );
  assert.doesNotMatch(PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_READY_SQL, /PgSleep/);
  assert.match(PLUGIN_INSTALL_LOCK_TIMEOUT_HOLDER_SQL, /FOR NO KEY UPDATE/);
  assert.doesNotMatch(PLUGIN_INSTALL_LOCK_TIMEOUT_HOLDER_SQL, /UPDATE public/);
  assert.match(PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_SQL, /WHEN lock_not_available/);
  assert.match(
    PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_SQL,
    /SQLSTATE IS DISTINCT FROM '55P03'/,
  );
  assert.match(PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_SQL, /v_elapsed_ms < 4500/);
  assert.match(PLUGIN_INSTALL_LOCK_TIMEOUT_CLIENT_SQL, /v_elapsed_ms >= 8000/);
  assert.match(
    VERIFY_PLUGIN_INSTALL_LOCK_TIMEOUT_ROLLBACK_SQL,
    /assert_plugin_install_lock_timeout_runtime_baseline/,
  );
  assert.match(
    RETRY_PLUGIN_INSTALL_AFTER_LOCK_TIMEOUT_SQL,
    /SELECT public\.marketplace_install_plugin/,
  );
  assert.doesNotMatch(RETRY_PLUGIN_INSTALL_AFTER_LOCK_TIMEOUT_SQL, /contract\./);
  assert.match(
    VERIFY_PLUGIN_INSTALL_LOCK_TIMEOUT_RETRY_SQL,
    /installation_state ->> 'id'/,
  );
  assert.match(
    VERIFY_PLUGIN_INSTALL_LOCK_TIMEOUT_RETRY_SQL,
    /"lock_timeout":"fresh-retry"/,
  );
  assert.ok(calls[0].includes("--tuples-only"));
  assert.ok(calls[0].includes("--no-align"));

  await assert.rejects(
    waitForPluginInstallPolicyLockHolder(containerName, {
      executeDockerSync: () => ({ status: 0, stdout: "2\n", stderr: "" }),
      wait: async () => {},
      attempts: 1,
      intervalMilliseconds: 0,
    }),
    /did not reach its controlled advisory-lock barrier/,
  );
});

test("async concurrency execution is bounded and backend cleanup is allowlisted", async () => {
  assert.equal(ASYNC_DOCKER_TIMEOUT_MILLISECONDS, 45_000);
  assert.equal(PLUGIN_INSTALL_COUNT_BARRIER_SECONDS, 35);
  assert.equal(PLUGIN_INSTALL_COUNT_STATEMENT_TIMEOUT_SECONDS, 42);
  assert.equal(PLUGIN_INSTALL_COUNT_READINESS_ATTEMPTS, 131);
  assert.equal(PLUGIN_INSTALL_COUNT_READINESS_INTERVAL_MILLISECONDS, 100);
  assert.equal(PLUGIN_INSTALL_LOCK_TIMEOUT_BARRIER_SECONDS, 35);
  assert.equal(PLUGIN_INSTALL_LOCK_TIMEOUT_STATEMENT_TIMEOUT_SECONDS, 42);
  assert.equal(PLUGIN_INSTALL_LOCK_TIMEOUT_READINESS_ATTEMPTS, 131);
  assert.equal(
    PLUGIN_INSTALL_LOCK_TIMEOUT_READINESS_INTERVAL_MILLISECONDS,
    100,
  );
  assert.ok(
    PLUGIN_INSTALL_COUNT_BARRIER_SECONDS * 1_000 >
      2 *
        PLUGIN_INSTALL_COUNT_READINESS_ATTEMPTS *
        PLUGIN_INSTALL_COUNT_READINESS_INTERVAL_MILLISECONDS,
  );
  assert.ok(
    ASYNC_DOCKER_TIMEOUT_MILLISECONDS >
      PLUGIN_INSTALL_COUNT_STATEMENT_TIMEOUT_SECONDS * 1_000,
  );
  assert.ok(
    PLUGIN_INSTALL_LOCK_TIMEOUT_BARRIER_SECONDS * 1_000 >
      2 *
        PLUGIN_INSTALL_LOCK_TIMEOUT_READINESS_ATTEMPTS *
        PLUGIN_INSTALL_LOCK_TIMEOUT_READINESS_INTERVAL_MILLISECONDS,
  );
  assert.ok(
    ASYNC_DOCKER_TIMEOUT_MILLISECONDS >
      PLUGIN_INSTALL_LOCK_TIMEOUT_STATEMENT_TIMEOUT_SECONDS * 1_000,
  );

  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let killCount = 0;
  child.kill = () => {
    killCount += 1;
    return true;
  };
  const execution = dockerAsync(["exec", containerName, "bounded-test"], {
    timeoutMilliseconds: 5,
    spawnProcess: () => child,
  });
  const timeoutResult = await execution.completion;
  assert.equal(timeoutResult.status, null);
  assert.equal(timeoutResult.timedOut, true);
  assert.match(timeoutResult.stderr, /exceeded 5ms/);
  assert.equal(killCount, 1);

  const terminationSql = buildTerminatePluginConcurrencyApplicationSql(
    PLUGIN_INSTALL_LOCK_TIMEOUT_BARRIER_APPLICATION_NAME,
  );
  assert.match(terminationSql, /pg_terminate_backend/);
  assert.match(
    terminationSql,
    new RegExp(PLUGIN_INSTALL_LOCK_TIMEOUT_BARRIER_APPLICATION_NAME),
  );
  assert.throws(
    () => buildTerminatePluginConcurrencyApplicationSql("attacker'; SELECT 1; --"),
    /not allowlisted/,
  );
});

test("concurrency phase errors preserve the primary and cleanup failures", () => {
  const primaryError = new Error("primary race failure");
  const cleanupError = new AggregateError(
    [new Error("backend cleanup failure")],
    "cleanup failure",
  );

  assert.throws(
    () =>
      throwPluginConcurrencyPhaseErrors(
        "Plugin install policy lock phase",
        primaryError,
        cleanupError,
      ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(
        error.message,
        "Plugin install policy lock phase and cleanup both failed",
      );
      assert.deepEqual(error.errors, [primaryError, cleanupError]);
      return true;
    },
  );
  assert.throws(
    () =>
      throwPluginConcurrencyPhaseErrors(
        "Plugin install policy status phase",
        primaryError,
        null,
      ),
    (error) => error === primaryError,
  );
  assert.throws(
    () =>
      throwPluginConcurrencyPhaseErrors(
        "Plugin install-count fixed race",
        null,
        cleanupError,
      ),
    (error) => error === cleanupError,
  );
  assert.doesNotThrow(() =>
    throwPluginConcurrencyPhaseErrors(
      "Plugin install-count fixed race",
      null,
      null,
    ),
  );
});

test("cleanup accepts only an exact 64-hex container ID", () => {
  assert.deepEqual(buildCleanupArgs(containerId), ["rm", "--force", containerId]);
  assert.throws(
    () => buildCleanupArgs(containerName),
    /Invalid recovered surface ACL contract container ID/,
  );
  assert.throws(
    () => buildCleanupArgs(`${containerId};docker-rm-foreign`),
    /Invalid recovered surface ACL contract container ID/,
  );
  assert.deepEqual(buildOwnershipInspectArgs(containerId), [
    "inspect",
    "--format",
    `{{.Id}}\t{{index .Config.Labels "${OWNERSHIP_LABEL_KEY}"}}`,
    containerId,
  ]);
});

test("cleanup requires the inspected ID and ownership label to match exactly", () => {
  assert.equal(
    resolveOwnedCleanupTarget({
      containerId,
      ownershipToken,
      inspectionOutput: `${containerId}\t${ownershipToken}\n`,
    }),
    containerId,
  );
  assert.throws(
    () =>
      resolveOwnedCleanupTarget({
        containerId,
        ownershipToken,
        inspectionOutput: `${foreignContainerId}\t${ownershipToken}\n`,
      }),
    /Refusing to remove/,
  );
  assert.throws(
    () =>
      resolveOwnedCleanupTarget({
        containerId,
        ownershipToken,
        inspectionOutput: `${containerId}\t${"f".repeat(32)}\n`,
      }),
    /Refusing to remove/,
  );
});

test("failed creation cannot remove a container", () => {
  const calls = [];
  const removed = cleanupOwnedContainer({ containerId: null, ownershipToken }, (...args) => {
    calls.push(args);
    throw new Error("Docker must not run without a proven creation ID");
  });
  assert.equal(removed, false);
  assert.deepEqual(calls, []);
});

test("ownership mismatch preserves the container before docker rm", () => {
  const calls = [];
  assert.throws(
    () =>
      cleanupOwnedContainer({ containerId, ownershipToken }, (args) => {
        calls.push(args);
        return {
          status: 0,
          stdout: `${containerId}\t${"f".repeat(32)}\n`,
          stderr: "",
        };
      }),
    /Refusing to remove/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "inspect");
});

test("matching inspected ownership removes exactly the created ID", () => {
  const calls = [];
  const removed = cleanupOwnedContainer({ containerId, ownershipToken }, (args) => {
    calls.push(args);
    if (args[0] === "inspect") {
      return {
        status: 0,
        stdout: `${containerId}\t${ownershipToken}\n`,
        stderr: "",
      };
    }
    return { status: 0, stdout: containerId, stderr: "" };
  });
  assert.equal(removed, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.at(-1), ["rm", "--force", containerId]);
});
