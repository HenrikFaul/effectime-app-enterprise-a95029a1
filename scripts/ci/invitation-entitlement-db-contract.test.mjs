import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildCleanupArgs,
  buildDockerRunArgs,
  buildOwnershipInspectArgs,
  buildPostgresReadinessArgs,
  buildPsqlArgs,
  cleanupOwnedContainer,
  CONTRACT_DATABASE,
  CONTRACT_SQL_PATH,
  createContainerName,
  createOwnershipToken,
  MIGRATION_SQL_PATH,
  OWNERSHIP_LABEL_KEY,
  parseCreatedContainerId,
  POSTGRES_IMAGE,
  resolveOwnedCleanupTarget,
  waitForPostgres,
} from "./invitation-entitlement-db-contract.mjs";

const containerName = "effectime-invitation-entitlement-pg18-42-001122aabbcc";
const containerId = "a".repeat(64);
const foreignContainerId = "b".repeat(64);
const ownershipToken = "c".repeat(32);

test("creates a collision-resistant, validated invitation entitlement identity", () => {
  const first = createContainerName({ pid: 42, suffix: "001122aabbcc" });
  const second = createContainerName({ pid: 42, suffix: "ffeeddccbbaa" });
  assert.equal(first, containerName);
  assert.notEqual(first, second);
  assert.match(first, /^[a-z0-9-]+$/);
  assert.throws(
    () => createContainerName({ pid: 0, suffix: "001122aabbcc" }),
    /Invalid invitation entitlement contract container identity/,
  );
  assert.throws(
    () => createContainerName({ pid: 42, suffix: "001122AABBCC" }),
    /Invalid invitation entitlement contract container identity/,
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
    /Invalid invitation entitlement contract container name/,
  );
  assert.equal(parseCreatedContainerId(`${containerId}\n`), containerId);
  assert.throws(
    () => parseCreatedContainerId(containerName),
    /Invalid invitation entitlement contract container ID/,
  );
  assert.throws(
    () => parseCreatedContainerId(`${containerId}\n${foreignContainerId}`),
    /Invalid invitation entitlement contract container ID/,
  );
});

test("pins PostgreSQL 18.4 and mounts only the two contract inputs read-only", () => {
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
      "scripts/ci/invitation-entitlement-migration.test.sql",
    )},target=${CONTRACT_SQL_PATH},readonly`,
    `type=bind,source=${resolve(
      repoRoot,
      "supabase/migrations/20260722100000_v3_51_19_invitation_entitlement_parity.sql",
    )},target=${MIGRATION_SQL_PATH},readonly`,
  ]);
  assert.equal(
    args.some((argument) => argument.includes("target=/workspace")),
    false,
  );
});

test("all psql entry points are isolated and fail closed", () => {
  const contractArgs = buildPsqlArgs(containerName);
  assert.deepEqual(contractArgs.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(contractArgs.includes("-X"));
  assert.deepEqual(
    contractArgs.slice(contractArgs.indexOf("--set"), contractArgs.indexOf("--set") + 2),
    ["--set", "ON_ERROR_STOP=1"],
  );
  assert.equal(contractArgs.at(-1), CONTRACT_SQL_PATH);

  const readinessArgs = buildPostgresReadinessArgs(containerName);
  assert.deepEqual(readinessArgs.slice(0, 3), ["exec", containerName, "psql"]);
  assert.ok(readinessArgs.includes("-X"));
  assert.equal(readinessArgs[readinessArgs.indexOf("--dbname") + 1], CONTRACT_DATABASE);
  assert.ok(readinessArgs.includes("ON_ERROR_STOP=1"));
  assert.ok(readinessArgs.includes("--tuples-only"));
  assert.ok(readinessArgs.includes("--no-align"));
  assert.deepEqual(readinessArgs.slice(-2), ["--command", "SELECT 1;"]);
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

test("cleanup accepts only an exact 64-hex container ID", () => {
  assert.deepEqual(buildCleanupArgs(containerId), ["rm", "--force", containerId]);
  assert.throws(
    () => buildCleanupArgs(containerName),
    /Invalid invitation entitlement contract container ID/,
  );
  assert.throws(
    () => buildCleanupArgs(`${containerId};docker-rm-foreign`),
    /Invalid invitation entitlement contract container ID/,
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
