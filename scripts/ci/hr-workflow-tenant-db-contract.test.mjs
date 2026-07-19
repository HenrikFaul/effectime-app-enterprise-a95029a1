import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONTRACT_DATABASE,
  OWNERSHIP_LABEL_KEY,
  POSTGRES_IMAGE,
  buildDockerRunArgs,
  buildPsqlArgs,
  buildPsqlCommandArgs,
  cleanupOwnedContainer,
  createContainerName,
  createOwnershipToken,
  resolveOwnedCleanupTarget,
  settleSessions,
} from "./hr-workflow-tenant-db-contract.mjs";

const containerName = "effectime-hr-workflow-pg18-42-0123456789ab";
const ownershipToken = "00112233445566778899aabbccddeeff";
const containerId = "a".repeat(64);

test("creates a bounded, task-owned container name", () => {
  assert.equal(
    createContainerName({ pid: 42, suffix: "0123456789ab" }),
    containerName,
  );
  assert.throws(
    () => createContainerName({ pid: 0, suffix: "0123456789ab" }),
    /Invalid HR contract container identity/,
  );
});

test("creates a fixed-width ownership token", () => {
  assert.equal(
    createOwnershipToken(Buffer.from("00112233445566778899aabbccddeeff", "hex")),
    ownershipToken,
  );
});

test("pins the isolated PostgreSQL image and all read-only contract inputs", () => {
  const args = buildDockerRunArgs({
    containerName,
    repoRoot: "/repo",
    password: "ephemeral-password",
    ownershipToken,
  });
  assert.equal(args.at(-1), POSTGRES_IMAGE);
  assert.deepEqual(args.slice(args.indexOf("--network"), args.indexOf("--network") + 2), [
    "--network",
    "none",
  ]);
  assert.ok(args.includes(`${OWNERSHIP_LABEL_KEY}=${ownershipToken}`));
  assert.ok(args.includes(`POSTGRES_DB=${CONTRACT_DATABASE}`));
  const mounts = args.filter((value) => value.startsWith("type=bind"));
  assert.equal(mounts.length, 3);
  assert.ok(mounts.every((value) => value.endsWith(",readonly")));
  assert.ok(mounts.some((value) => value.includes("hr-workflow-tenant-migration.test.sql")));
  assert.ok(mounts.some((value) => value.includes("20260511000001_create_hr_workflows.sql")));
  assert.ok(
    mounts.some((value) =>
      value.includes("20260719000000_v3_51_3_hr_workflow_tenant_boundaries.sql"),
    ),
  );
});

test("builds fail-closed psql commands and preserves concurrency variables", () => {
  const args = buildPsqlArgs(containerName, ["HR_REASSIGN_A=1"]);
  assert.ok(args.includes("ON_ERROR_STOP=1"));
  assert.deepEqual(args.slice(args.indexOf("--variable"), args.indexOf("--variable") + 2), [
    "--variable",
    "HR_REASSIGN_A=1",
  ]);
  assert.equal(args.at(-1), "/contract/fixture.sql");

  const commandArgs = buildPsqlCommandArgs(containerName, "SELECT 1;", {
    tuplesOnly: true,
  });
  assert.ok(commandArgs.includes("--tuples-only"));
  assert.equal(commandArgs.at(-1), "SELECT 1;");
});

test("cleanup only accepts the exact inspected ID and ownership token", () => {
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
        inspectionOutput: `${"b".repeat(64)}\t${ownershipToken}\n`,
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

test("cleanup inspects ownership before removing the exact container ID", () => {
  const calls = [];
  const runDocker = (args) => {
    calls.push(args);
    if (args[0] === "inspect") {
      return { status: 0, stdout: `${containerId}\t${ownershipToken}\n`, stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };

  cleanupOwnedContainer({ containerId, ownershipToken, runDocker });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "inspect");
  assert.deepEqual(calls[1], ["rm", "--force", containerId]);
});

test("cleanup preserves a container when inspected ownership does not match", () => {
  const calls = [];
  assert.throws(
    () => cleanupOwnedContainer({
      containerId,
      ownershipToken,
      runDocker: (args) => {
        calls.push(args);
        return {
          status: 0,
          stdout: `${containerId}\t${"f".repeat(32)}\n`,
          stderr: "",
        };
      },
    }),
    /Refusing to remove/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "inspect");
});

test("concurrency cleanup has a bounded SIGTERM and SIGKILL path", async () => {
  const signals = [];
  const terminations = [];
  const session = {
    settled: false,
    completion: new Promise(() => {}),
    child: { kill: (signal) => signals.push(signal) },
  };

  await assert.rejects(
    settleSessions(containerName, [session], ["effectime-hr-test-a"], {
      terminateSessions: (name, applications) => terminations.push([name, applications]),
      wait: async () => {},
      gracePeriodMilliseconds: 1,
    }),
    /did not terminate/,
  );

  assert.deepEqual(terminations, [[containerName, ["effectime-hr-test-a"]]]);
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
});
