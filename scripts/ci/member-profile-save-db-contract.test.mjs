import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  AUTH_BOOTSTRAP_ACL_DRIFT_CASE,
  AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE,
  AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE,
  ASSERTIONS_SQL_PATH,
  BUSINESS_ROLE_MIGRATION_SQL_PATH,
  BUSINESS_ROLE_ASSERTIONS_SQL_PATH,
  BUSINESS_ROLE_CONCURRENCY_SQL_PATH,
  IDENTITY_CLEANUP_MIGRATION_SQL_PATH,
  IDENTITY_CLEANUP_SCHEDULER_MIGRATION_SQL_PATH,
  IDENTITY_CLEANUP_ASSERTIONS_SQL_PATH,
  IDENTITY_CLEANUP_SCHEDULER_ASSERTIONS_SQL_PATH,
  IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH,
  IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH,
  IDENTITY_CLEANUP_FINALIZER_BARRIER_QUERY,
  IDENTITY_CLEANUP_FINALIZER_WAIT_QUERY,
  IDENTITY_CLEANUP_SCHEDULER_WORKER_BARRIER_QUERY,
  IDENTITY_CLEANUP_SCHEDULER_WORKER_WAIT_QUERY,
  TEMPORARY_PROFILE_EVENT_BARRIER_QUERY,
  TEMPORARY_PROFILE_EVENT_WAIT_QUERY,
  TEMPORARY_PROFILE_UPGRADE_BARRIER_QUERY,
  TEMPORARY_PROFILE_UPGRADE_WAIT_QUERY,
  assertExpectedInventoryFailure,
  assertExpectedMigrationFailure,
  buildCleanupArgs,
  buildDockerRunArgs,
  buildOwnershipInspectArgs,
  buildPostgresReadinessArgs,
  buildPsqlCommandArgs,
  buildPsqlFileArgs,
  cleanupOwnedContainer,
  CONTRACT_DATABASE,
  CONCURRENCY_BARRIER_QUERY,
  CONCURRENCY_SQL_PATH,
  CONCURRENCY_WAIT_QUERY,
  createContainerName,
  createOwnershipToken,
  EXPECTED_INVENTORY_FAILURE,
  FIXTURE_MISMATCH_CLEANUP_SQL,
  LEXICAL_CONSTRAINT_DRIFT_CASES,
  MIGRATION_SQL_PATH,
  OWNERSHIP_LABEL_KEY,
  parseCreatedContainerId,
  POSTGRES_IMAGE,
  resolveOwnedCleanupTarget,
  SETUP_SQL_PATH,
  TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE,
  waitForPostgres,
} from "./member-profile-save-db-contract.mjs";

const containerName = "effectime-member-profile-save-pg18-42-001122aabbcc";
const containerId = "a".repeat(64);
const foreignContainerId = "b".repeat(64);
const ownershipToken = "c".repeat(32);

test("creates a collision-resistant validated member-profile container identity", () => {
  const first = createContainerName({ pid: 42, suffix: "001122aabbcc" });
  const second = createContainerName({ pid: 42, suffix: "ffeeddccbbaa" });
  assert.equal(first, containerName);
  assert.notEqual(first, second);
  assert.match(first, /^[a-z0-9-]+$/);
  assert.throws(
    () => createContainerName({ pid: 0, suffix: "001122aabbcc" }),
    /Invalid member profile save contract container identity/,
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
    /Invalid member profile save contract container name/,
  );
  assert.equal(parseCreatedContainerId(`${containerId}\n`), containerId);
  assert.throws(
    () => parseCreatedContainerId(containerName),
    /Invalid member profile save contract container ID/,
  );
});

test("pins PostgreSQL 18.4 and mounts only reviewed inputs read-only", () => {
  const repoRoot = "C:\\Work\\Effectime Fixture";
  const args = buildDockerRunArgs({
    containerName,
    repoRoot,
    password: "ephemeral-value",
    ownershipToken,
  });
  assert.equal(args.at(-1), POSTGRES_IMAGE);
  assert.equal(args[args.indexOf("--network") + 1], "none");
  assert.equal(args.includes("--publish"), false);
  assert.ok(args.includes(`POSTGRES_DB=${CONTRACT_DATABASE}`));
  const mounts = args
    .map((argument, index) => (argument === "--mount" ? args[index + 1] : null))
    .filter(Boolean);
  assert.deepEqual(mounts, [
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/member-profile-save-setup.test.sql",
    )},target=${SETUP_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260719143000_v3_51_6_atomic_member_profile_save.sql",
    )},target=${MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260721233000_v3_51_7_atomic_business_role_delete.sql",
    )},target=${BUSINESS_ROLE_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260721234500_v3_51_7_created_identity_compensation.sql",
    )},target=${IDENTITY_CLEANUP_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260722003000_v3_51_8_created_identity_cleanup_scheduler.sql",
    )},target=${IDENTITY_CLEANUP_SCHEDULER_MIGRATION_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/member-profile-save-assertions.test.sql",
    )},target=${ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/business-role-delete-assertions.test.sql",
    )},target=${BUSINESS_ROLE_ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/created-identity-cleanup-assertions.test.sql",
    )},target=${IDENTITY_CLEANUP_ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/created-identity-cleanup-concurrency.test.sql",
    )},target=${IDENTITY_CLEANUP_CONCURRENCY_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/created-identity-cleanup-scheduler-assertions.test.sql",
    )},target=${IDENTITY_CLEANUP_SCHEDULER_ASSERTIONS_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/created-identity-cleanup-scheduler-concurrency.test.sql",
    )},target=${IDENTITY_CLEANUP_SCHEDULER_CONCURRENCY_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/business-role-delete-concurrency.test.sql",
    )},target=${BUSINESS_ROLE_CONCURRENCY_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/member-profile-save-concurrency.test.sql",
    )},target=${CONCURRENCY_SQL_PATH},readonly`,
  ]);
});

test("psql entry points are isolated and path allow-listed", () => {
  for (const sqlPath of [
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
  ]) {
    const args = buildPsqlFileArgs(containerName, sqlPath);
    assert.deepEqual(args.slice(0, 3), ["exec", containerName, "psql"]);
    assert.ok(args.includes("-X"));
    assert.ok(args.includes("ON_ERROR_STOP=1"));
    assert.equal(args.at(-1), sqlPath);
  }
  assert.throws(
    () => buildPsqlFileArgs(containerName, "/contract/foreign.sql"),
    /Invalid member profile save contract SQL path/,
  );
  assert.throws(
    () => buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, ["unsafe=value"]),
    /Invalid member profile save contract psql variable/,
  );
  const concurrency = buildPsqlFileArgs(containerName, CONCURRENCY_SQL_PATH, [
    "MEMBER_PROFILE_SAVE_A=1",
  ]);
  assert.deepEqual(
    concurrency.slice(concurrency.indexOf("--variable"), concurrency.indexOf("--file")),
    ["--variable", "MEMBER_PROFILE_SAVE_A=1"],
  );
});

test("tenant inventory must fail for exactly the expected fixture reason", () => {
  assert.equal(
    assertExpectedInventoryFailure({
      status: 3,
      stdout: "",
      stderr: `ERROR: ${EXPECTED_INVENTORY_FAILURE}\n`,
    }),
    true,
  );
  assert.throws(
    () => assertExpectedInventoryFailure({ status: 0, stdout: "", stderr: "" }),
    /unexpectedly accepted fixture tenant drift/,
  );
  assert.throws(
    () => assertExpectedInventoryFailure({ status: 3, stdout: "", stderr: "other" }),
    /unexpected reason/,
  );
});

test("same-name lexical constraints with weaker definitions fail closed", () => {
  assert.equal(LEXICAL_CONSTRAINT_DRIFT_CASES.length, 3);
  for (const driftCase of LEXICAL_CONSTRAINT_DRIFT_CASES) {
    assert.match(driftCase.installSql, /CHECK \(true\) NOT VALID;$/);
    assert.match(
      driftCase.cleanupSql,
      /^ALTER TABLE public\.[a-z_]+ DROP CONSTRAINT [a-z_]+;$/,
    );
    assert.equal(
      assertExpectedMigrationFailure(
        { status: 3, stdout: "", stderr: `ERROR: ${driftCase.expectedFailure}` },
        driftCase.expectedFailure,
        driftCase.label,
      ),
      true,
    );
    assert.throws(
      () => assertExpectedMigrationFailure(
        { status: 0, stdout: "", stderr: "" },
        driftCase.expectedFailure,
        driftCase.label,
      ),
      /unexpectedly accepted/,
    );
  }
});

test("an incompatible auth profile bootstrap trigger is restored exactly", () => {
  assert.match(AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE.installSql, /BEFORE INSERT ON auth\.users/);
  assert.match(AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE.installSql, /DISABLE TRIGGER/);
  assert.match(
    AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE.verificationSql,
    /trigger_record\.tgtype = 5/,
  );
  assert.match(
    AUTH_BOOTSTRAP_TRIGGER_DRIFT_CASE.verificationSql,
    /trigger_record\.tgenabled = 'O'/,
  );
});

test("auth profile bootstrap service-role ACL drift is revoked on repeat apply", () => {
  assert.equal(
    AUTH_BOOTSTRAP_ACL_DRIFT_CASE.installSql,
    "GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;",
  );
  assert.match(
    AUTH_BOOTSTRAP_ACL_DRIFT_CASE.verificationSql,
    /has_function_privilege/,
  );
  assert.match(AUTH_BOOTSTRAP_ACL_DRIFT_CASE.verificationSql, /service_role/);
});

test("an unknown additional auth bootstrap trigger fails closed without silent deletion", () => {
  assert.match(
    AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE.installSql,
    /CREATE TRIGGER legacy_auth_profile_bootstrap AFTER INSERT ON auth\.users/,
  );
  assert.equal(
    AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE.cleanupSql,
    "DROP TRIGGER legacy_auth_profile_bootstrap ON auth.users;",
  );
  assert.equal(
    AUTH_BOOTSTRAP_EXTRA_TRIGGER_DRIFT_CASE.expectedFailure,
    "unexpected additional auth profile bootstrap trigger binding: 1 trigger(s)",
  );
});

test("temporary-profile cleanup preflight rejects drift before partial DDL", () => {
  assert.match(
    TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.installSql,
    /RENAME COLUMN is_temporary/,
  );
  assert.match(
    TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.expectedFailure,
    /profile-column contract is incompatible/,
  );
  assert.match(
    TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.verificationSql,
    /temporary_profile_cleanup_leases/,
  );
  assert.match(
    TEMPORARY_PROFILE_PREFLIGHT_DRIFT_CASE.verificationSql,
    /lease_token/,
  );
});

test("fixture cleanup is an exact SQL command with a row-count assertion", () => {
  const args = buildPsqlCommandArgs(containerName, FIXTURE_MISMATCH_CLEANUP_SQL);
  assert.deepEqual(args.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(args.includes("-X"));
  assert.equal(args.at(-2), "--command");
  assert.equal(args.at(-1), FIXTURE_MISMATCH_CLEANUP_SQL);
  assert.match(FIXTURE_MISMATCH_CLEANUP_SQL, /dead0000-0000-4000-8000-000000000001/);
  assert.match(FIXTURE_MISMATCH_CLEANUP_SQL, /v_removed <> 1/);
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
  assert.deepEqual(buildPostgresReadinessArgs(containerName).slice(-2), ["--command", "SELECT 1;"]);
});

test("concurrency evidence uses fixed advisory and blocking-session queries", () => {
  assert.match(CONCURRENCY_BARRIER_QUERY, /classid = 734556/);
  assert.match(CONCURRENCY_BARRIER_QUERY, /objid = 1/);
  assert.match(CONCURRENCY_WAIT_QUERY, /pg_blocking_pids/);
  assert.match(CONCURRENCY_WAIT_QUERY, /effectime-member-profile-save-a/);
  assert.match(CONCURRENCY_WAIT_QUERY, /effectime-member-profile-save-b/);
  assert.doesNotMatch(CONCURRENCY_WAIT_QUERY, /\$\{|;\s*(DROP|DELETE)/i);
  assert.match(IDENTITY_CLEANUP_FINALIZER_BARRIER_QUERY, /classid = 734561/);
  assert.match(IDENTITY_CLEANUP_FINALIZER_BARRIER_QUERY, /objid = 13/);
  assert.match(IDENTITY_CLEANUP_FINALIZER_WAIT_QUERY, /pg_blocking_pids/);
  assert.match(
    IDENTITY_CLEANUP_FINALIZER_WAIT_QUERY,
    /effectime-created-identity-finalizer/,
  );
  assert.match(
    IDENTITY_CLEANUP_FINALIZER_WAIT_QUERY,
    /effectime-created-identity-finalize-writer/,
  );
  assert.match(IDENTITY_CLEANUP_SCHEDULER_WORKER_BARRIER_QUERY, /classid = 734562/);
  assert.match(IDENTITY_CLEANUP_SCHEDULER_WORKER_BARRIER_QUERY, /objid = 21/);
  assert.match(IDENTITY_CLEANUP_SCHEDULER_WORKER_WAIT_QUERY, /pg_blocking_pids/);
  assert.match(
    IDENTITY_CLEANUP_SCHEDULER_WORKER_WAIT_QUERY,
    /effectime-created-identity-worker-a/,
  );
  assert.match(
    IDENTITY_CLEANUP_SCHEDULER_WORKER_WAIT_QUERY,
    /effectime-created-identity-worker-b/,
  );
  assert.match(TEMPORARY_PROFILE_EVENT_BARRIER_QUERY, /classid = 734563/);
  assert.match(TEMPORARY_PROFILE_EVENT_BARRIER_QUERY, /objid = 31/);
  assert.match(TEMPORARY_PROFILE_EVENT_WAIT_QUERY, /pg_blocking_pids/);
  assert.match(
    TEMPORARY_PROFILE_EVENT_WAIT_QUERY,
    /effectime-temp-cleanup-event-claimer/,
  );
  assert.match(
    TEMPORARY_PROFILE_EVENT_WAIT_QUERY,
    /effectime-temp-cleanup-event-writer/,
  );
  assert.match(TEMPORARY_PROFILE_UPGRADE_BARRIER_QUERY, /classid = 734563/);
  assert.match(TEMPORARY_PROFILE_UPGRADE_BARRIER_QUERY, /objid = 32/);
  assert.match(TEMPORARY_PROFILE_UPGRADE_WAIT_QUERY, /pg_blocking_pids/);
  assert.match(
    TEMPORARY_PROFILE_UPGRADE_WAIT_QUERY,
    /effectime-temp-cleanup-upgrade-claimer/,
  );
  assert.match(
    TEMPORARY_PROFILE_UPGRADE_WAIT_QUERY,
    /effectime-temp-cleanup-upgrade-writer/,
  );
});

test("cleanup accepts only exact container IDs and ownership evidence", () => {
  assert.deepEqual(buildCleanupArgs(containerId), ["rm", "--force", containerId]);
  assert.deepEqual(buildOwnershipInspectArgs(containerId), [
    "inspect",
    "--format",
    `{{.Id}}\t{{index .Config.Labels "${OWNERSHIP_LABEL_KEY}"}}`,
    containerId,
  ]);
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
});

test("failed creation cannot remove any container", () => {
  const calls = [];
  const removed = cleanupOwnedContainer({ containerId: null, ownershipToken }, (...args) => {
    calls.push(args);
    throw new Error("Docker must not run without a proven creation ID");
  });
  assert.equal(removed, false);
  assert.deepEqual(calls, []);
});

test("matching ownership removes exactly the created container ID", () => {
  const calls = [];
  const removed = cleanupOwnedContainer({ containerId, ownershipToken }, (args) => {
    calls.push(args);
    if (args[0] === "inspect") {
      return { status: 0, stdout: `${containerId}\t${ownershipToken}\n`, stderr: "" };
    }
    return { status: 0, stdout: containerId, stderr: "" };
  });
  assert.equal(removed, true);
  assert.deepEqual(calls.at(-1), ["rm", "--force", containerId]);
});
