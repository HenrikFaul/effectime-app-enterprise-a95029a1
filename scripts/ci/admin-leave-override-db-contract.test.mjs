import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildAdvisoryLockQuery,
  buildCleanupArgs,
  buildConcurrentWaitQuery,
  buildDockerRunArgs,
  buildPostgresReadinessArgs,
  buildPsqlArgs,
  cleanupOwnedContainer,
  CONCURRENCY_SCENARIOS,
  CONTRACT_DATABASE,
  CONTRACT_SQL_PATH,
  createContainerName,
  createOwnershipToken,
  MIGRATION_SQL_PATH,
  observeDockerChild,
  OWNERSHIP_LABEL_KEY,
  parseCreatedContainerId,
  POSTGRES_IMAGE,
  settleOrTerminateSessions,
} from "./admin-leave-override-db-contract.mjs";

const containerName = "effectime-admin-override-pg18-42-001122aabbcc";
const containerId = "a".repeat(64);
const foreignContainerId = "b".repeat(64);
const ownershipToken = "c".repeat(32);

test("creates a bounded collision-resistant admin override container identity", () => {
  const first = createContainerName({ pid: 42, suffix: "001122aabbcc" });
  const second = createContainerName({ pid: 42, suffix: "ffeeddccbbaa" });
  assert.equal(first, containerName);
  assert.notEqual(first, second);
  assert.match(first, /^[a-z0-9-]+$/);
  assert.equal(createOwnershipToken(Buffer.alloc(16, 0xab)), "ab".repeat(16));
});

test("rejects injected runtime identities and accepts only a full creation ID", () => {
  assert.throws(
    () =>
      buildDockerRunArgs({
        containerName: `${containerName};docker-rm-foreign`,
        repoRoot: "C:\\Work\\Effectime Fixture",
        password: "ephemeral-value",
        ownershipToken,
      }),
    /Invalid admin override contract container name/,
  );
  assert.equal(parseCreatedContainerId(`${containerId}\n`), containerId);
  assert.throws(
    () => parseCreatedContainerId(containerName),
    /Invalid admin override contract container ID/,
  );
  assert.throws(
    () => parseCreatedContainerId(`${containerId}\n${foreignContainerId}`),
    /Invalid admin override contract container ID/,
  );
});

test("pins PostgreSQL and mounts only the exact contract inputs read-only", () => {
  const repoRoot = "C:\\Work\\Effectime Fixture";
  const args = buildDockerRunArgs({
    containerName,
    repoRoot,
    password: "ephemeral-value",
    ownershipToken,
  });

  assert.equal(args.at(-1), POSTGRES_IMAGE);
  assert.deepEqual(args.slice(0, 4), ["run", "--detach", "--name", containerName]);
  assert.equal(
    args[args.indexOf("--label") + 1],
    `${OWNERSHIP_LABEL_KEY}=${ownershipToken}`,
  );
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
      "scripts/ci/admin-leave-override-migration.test.sql",
    )},target=${CONTRACT_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260719010000_v3_51_4_admin_override_idempotency.sql",
    )},target=${MIGRATION_SQL_PATH},readonly`,
  ]);
  assert.equal(
    args.some((argument) => argument.includes("target=/workspace")),
    false,
  );
});

test("builds fail-closed psql commands for every deterministic concurrency mode", () => {
  const base = buildPsqlArgs(containerName);
  assert.deepEqual(base.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(base.includes("-X"));
  assert.ok(base.includes("ON_ERROR_STOP=1"));
  assert.equal(base[base.indexOf("--dbname") + 1], CONTRACT_DATABASE);
  assert.equal(base.at(-1), CONTRACT_SQL_PATH);

  assert.equal(Object.isFrozen(CONCURRENCY_SCENARIOS), true);
  assert.deepEqual(
    CONCURRENCY_SCENARIOS.map(
      ({ label, advisoryObjectId, waitingApplication, waitDescription }) => ({
        label,
        advisoryObjectId,
        waitingApplication,
        waitDescription,
      }),
    ),
    [
      {
        label: "admin override duplicate replay",
        advisoryObjectId: 1,
        waitingApplication: "effectime-admin-override-duplicate-b",
        waitDescription: "admin override serialization lock",
      },
      {
        label: "admin override actor demotion",
        advisoryObjectId: 2,
        waitingApplication: "effectime-admin-override-demotion-b",
        waitDescription: "membership row lock",
      },
    ],
  );

  for (const scenario of CONCURRENCY_SCENARIOS) {
    assert.equal(Object.isFrozen(scenario), true);
    assert.equal(Object.isFrozen(scenario.applications), true);
    for (const variable of [
      scenario.sessionAVariable,
      scenario.sessionBVariable,
      scenario.verifyVariable,
    ]) {
      const args = buildPsqlArgs(containerName, [variable]);
      const variableIndex = args.indexOf("--variable");
      assert.equal(args[variableIndex + 1], variable);
    }
  }
});

test("uses explicit advisory and blocking-session evidence without injectable names", () => {
  const advisory = buildAdvisoryLockQuery(2);
  assert.match(advisory, /classid = 734553/);
  assert.match(advisory, /objid = 2/);
  assert.throws(
    () => buildAdvisoryLockQuery(0),
    /Invalid admin override concurrency advisory lock identity/,
  );

  const wait = buildConcurrentWaitQuery(
    "effectime-admin-override-duplicate-b",
    "effectime-admin-override-duplicate-a",
  );
  assert.match(wait, /waiter\.datname = current_database\(\)/);
  assert.match(wait, /waiter\.wait_event_type = 'Lock'/);
  assert.match(wait, /pg_blocking_pids\(waiter\.pid\)/);
  assert.match(wait, /effectime-admin-override-duplicate-a/);
  assert.match(wait, /effectime-admin-override-duplicate-b/);
  assert.throws(
    () => buildConcurrentWaitQuery("valid-name", "invalid'; SELECT 1; --"),
    /Invalid admin override concurrency application name/,
  );
});

test("readiness requires a successful query against the named contract database", () => {
  const args = buildPostgresReadinessArgs(containerName);
  assert.deepEqual(args.slice(0, 3), ["exec", containerName, "psql"]);
  assert.equal(args[args.indexOf("--dbname") + 1], CONTRACT_DATABASE);
  assert.ok(args.includes("ON_ERROR_STOP=1"));
  assert.ok(args.includes("--tuples-only"));
  assert.ok(args.includes("--no-align"));
  assert.deepEqual(args.slice(-2), ["--command", "SELECT 1;"]);
  assert.equal(args.includes("pg_isready"), false);
});

test("failed creation or a Docker name collision cannot remove any container", () => {
  const calls = [];
  const removed = cleanupOwnedContainer(
    { containerId: null, ownershipToken },
    (...args) => {
      calls.push(args);
      throw new Error("Docker must not run without a proven creation ID");
    },
  );
  assert.equal(removed, false);
  assert.deepEqual(calls, []);
});

test("ownership mismatch refuses cleanup before docker rm", () => {
  const calls = [];
  assert.throws(
    () =>
      cleanupOwnedContainer({ containerId, ownershipToken }, (args) => {
        calls.push(args);
        return {
          status: 0,
          stdout: `${foreignContainerId}\t${ownershipToken}\n`,
          stderr: "",
        };
      }),
    /Refusing to remove a container whose ID and admin override ownership label do not match/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "inspect");
});

test("matching creation ID and ownership label remove exactly that ID", () => {
  const calls = [];
  const removed = cleanupOwnedContainer({ containerId, ownershipToken }, (args) => {
    calls.push(args);
    if (args[0] === "inspect") {
      return { status: 0, stdout: `${containerId}\t${ownershipToken}\n`, stderr: "" };
    }
    return { status: 0, stdout: containerId, stderr: "" };
  });
  assert.equal(removed, true);
  assert.deepEqual(calls.at(-1), buildCleanupArgs(containerId));
  assert.deepEqual(calls.at(-1), ["rm", "--force", containerId]);
  assert.throws(
    () => buildCleanupArgs(containerName),
    /Invalid admin override contract container ID/,
  );
});

test("child failure is observed immediately as a settled rejection outcome", async () => {
  const child = new EventEmitter();
  child.kill = () => true;
  const session = observeDockerChild(child, ["exec", containerName]);
  child.emit("error", new Error("simulated spawn failure"));
  const outcome = await session.completion;
  assert.equal(session.settled, true);
  assert.equal(outcome.status, "rejected");
  assert.match(outcome.reason.message, /simulated spawn failure/);
  child.emit("exit", 1, null);
  assert.equal(session.outcome, outcome);
});

test("pending concurrency children have bounded backend, SIGTERM and SIGKILL cleanup", async () => {
  const child = new EventEmitter();
  const signals = [];
  child.kill = (signal) => {
    signals.push(signal);
    if (signal === "SIGKILL") queueMicrotask(() => child.emit("exit", null, signal));
    return true;
  };
  const session = observeDockerChild(child, ["exec", containerName]);
  const dockerCalls = [];
  const results = await settleOrTerminateSessions(containerName, [session], {
    executeDockerSync: (args) => {
      dockerCalls.push(args);
      return { status: 0, stdout: "", stderr: "" };
    },
    graceMilliseconds: 0,
    terminationGraceMilliseconds: 0,
  });

  assert.equal(dockerCalls.length, 1);
  assert.match(dockerCalls[0].at(-1), /pg_terminate_backend/);
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(session.settled, true);
  assert.equal(results[0].status, "rejected");
});

test("a child that ignores SIGKILL fails the lifecycle contract within the bounded window", async () => {
  const child = new EventEmitter();
  const signals = [];
  child.kill = (signal) => {
    signals.push(signal);
    return true;
  };
  const session = observeDockerChild(child, ["exec", containerName]);

  await assert.rejects(
    settleOrTerminateSessions(containerName, [session], {
      executeDockerSync: () => ({ status: 0, stdout: "", stderr: "" }),
      graceMilliseconds: 0,
      terminationGraceMilliseconds: 0,
    }),
    /did not terminate after SIGKILL/,
  );
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(session.settled, false);
});
