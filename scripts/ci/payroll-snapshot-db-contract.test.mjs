import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildCleanupArgs,
  buildDockerRunArgs,
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
} from "./payroll-snapshot-db-contract.mjs";

const containerName = "effectime-payroll-pg18-42-001122aabbcc";
const containerId = "a".repeat(64);
const foreignContainerId = "b".repeat(64);
const ownershipToken = "c".repeat(32);

test("creates explicit collision-resistant Docker container names", () => {
  const first = createContainerName({ pid: 42, suffix: "001122aabbcc" });
  const second = createContainerName({ pid: 42, suffix: "ffeeddccbbaa" });
  assert.equal(first, "effectime-payroll-pg18-42-001122aabbcc");
  assert.notEqual(first, second);
  assert.match(first, /^[a-z0-9-]+$/);
});

test("rejects injected container names and accepts only full creation IDs", () => {
  assert.throws(
    () =>
      buildDockerRunArgs({
        containerName: `${containerName};docker-rm-foreign`,
        repoRoot: "C:\\Work\\Effectime Fixture",
        password: "ephemeral-value",
        ownershipToken,
      }),
    /Invalid payroll contract container name/,
  );
  assert.equal(parseCreatedContainerId(`${containerId}\n`), containerId);
  assert.throws(
    () => parseCreatedContainerId(containerName),
    /Invalid payroll contract container ID/,
  );
  assert.throws(
    () => parseCreatedContainerId(`${containerId}\n${foreignContainerId}`),
    /Invalid payroll contract container ID/,
  );
  assert.equal(createOwnershipToken(Buffer.alloc(16, 0xab)), "ab".repeat(16));
});

test("pins PostgreSQL and mounts only the contract inputs read-only", () => {
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
  const mounts = args
    .map((argument, index) => (argument === "--mount" ? args[index + 1] : null))
    .filter(Boolean);
  assert.deepEqual(mounts, [
    `type=bind,source=${resolve(
      repoRoot,
      "scripts/ci/payroll-snapshot-migration.test.sql",
    )},target=${CONTRACT_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260717134000_payroll_immutable_snapshots.sql",
    )},target=${MIGRATION_SQL_PATH},readonly`,
  ]);
  assert.equal(
    args.some((argument) => argument.includes("target=/workspace")),
    false,
  );
  assert.ok(args.includes(`POSTGRES_DB=${CONTRACT_DATABASE}`));
});

test("runs the real SQL contract with ON_ERROR_STOP and every concurrency mode", () => {
  const base = buildPsqlArgs(containerName);
  assert.deepEqual(base.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(base.includes("ON_ERROR_STOP=1"));
  assert.equal(base.at(-1), CONTRACT_SQL_PATH);

  assert.deepEqual(
    CONCURRENCY_SCENARIOS.map(({ label, advisoryObjectId, waitDescription }) => ({
      label,
      advisoryObjectId,
      waitDescription,
    })),
    [
      {
        label: "payroll snapshot lock",
        advisoryObjectId: 1,
        waitDescription: "period row lock",
      },
      {
        label: "payroll break-glass reopen",
        advisoryObjectId: 2,
        waitDescription: "period row lock",
      },
      {
        label: "payroll actor demotion versus reopen",
        advisoryObjectId: 3,
        waitDescription: "membership row lock",
      },
    ],
  );
  for (const scenario of CONCURRENCY_SCENARIOS) {
    for (const variable of [
      scenario.sessionAVariable,
      scenario.sessionBVariable,
      scenario.verifyVariable,
    ]) {
      const concurrent = buildPsqlArgs(containerName, [variable]);
      const variableIndex = concurrent.indexOf("--variable");
      assert.equal(concurrent[variableIndex + 1], variable);
    }
  }
});

test("cleanup accepts only a full container ID, never a name", () => {
  assert.deepEqual(buildCleanupArgs(containerId), ["rm", "--force", containerId]);
  assert.throws(() => buildCleanupArgs(containerName), /Invalid payroll contract container ID/);
  assert.throws(
    () => buildCleanupArgs(`${containerId};docker-rm-foreign`),
    /Invalid payroll contract container ID/,
  );
});

test("failed creation or name collision cannot remove any container", () => {
  const calls = [];
  const removed = cleanupOwnedContainer({ containerId: null, ownershipToken }, (...args) => {
    calls.push(args);
    throw new Error("Docker must not be called without a proven creation ID");
  });
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
    /Refusing to remove a container whose ID and ownership label do not match/,
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
  assert.deepEqual(calls.at(-1), ["rm", "--force", containerId]);
});

test("child failure is observed immediately as a fulfilled outcome", async () => {
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

test("pending child is terminated and settled even after the graceful window", async () => {
  const child = new EventEmitter();
  const signals = [];
  child.kill = (signal) => {
    signals.push(signal);
    queueMicrotask(() => child.emit("exit", null, signal));
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
  assert.equal(signals[0], "SIGTERM");
  assert.equal(session.settled, true);
  assert.equal(results[0].status, "rejected");
});

test("all concurrency fixtures use explicit gates without ordering sleeps", () => {
  const fixture = readFileSync(
    new URL("./payroll-snapshot-migration.test.sql", import.meta.url),
    "utf8",
  );
  assert.match(fixture, /fixture_wait_for_payroll_concurrency_release/);
  assert.match(fixture, /effectime-payroll-contract-b/);
  assert.match(fixture, /PAYROLL_REOPEN_CONCURRENCY_A/);
  assert.match(fixture, /PAYROLL_REOPEN_CONCURRENCY_B/);
  assert.match(fixture, /PAYROLL_REOPEN_CONCURRENCY_VERIFY/);
  assert.match(fixture, /effectime-payroll-reopen-contract-b/);
  assert.match(fixture, /pg_advisory_xact_lock\(734551, 2\)/);
  assert.match(fixture, /concurrent reopen has one winner, exact open state and one audit/);
  assert.match(fixture, /PAYROLL_DEMOTION_CONCURRENCY_A/);
  assert.match(fixture, /PAYROLL_DEMOTION_REOPEN_CONCURRENCY_B/);
  assert.match(fixture, /PAYROLL_DEMOTION_CONCURRENCY_VERIFY/);
  assert.match(fixture, /effectime-payroll-demotion-reopen-contract-b/);
  assert.match(fixture, /pg_advisory_xact_lock\(734551, 3\)/);
  assert.match(fixture, /bit-identical locked period and no reopen audit/);
  assert.doesNotMatch(fixture, /pg_sleep\(3\)/);
});
