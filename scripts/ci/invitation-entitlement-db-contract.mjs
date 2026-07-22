import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POSTGRES_IMAGE =
  "postgres:18.4@sha256:32ca0af8e77bfb8c6610c488e4691f83f972a3e9e64d3b02facf3ab111ad5500";
export const CONTRACT_DATABASE = "effectime_invitation_entitlement_contract";
export const CONTRACT_SQL_PATH = "/contract/fixture.sql";
export const MIGRATION_SQL_PATH = "/contract/migration.sql";
export const OWNERSHIP_LABEL_KEY = "com.effectime.ci.invitation-entitlement-contract";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const containerNamePattern =
  /^effectime-invitation-entitlement-pg18-[1-9][0-9]*-[0-9a-f]{12}$/;
const containerIdPattern = /^[0-9a-f]{64}$/;
const ownershipTokenPattern = /^[0-9a-f]{32}$/;

function assertContainerName(containerName) {
  if (!containerNamePattern.test(containerName)) {
    throw new Error("Invalid invitation entitlement contract container name");
  }
  return containerName;
}

function assertContainerId(containerId) {
  if (!containerIdPattern.test(containerId)) {
    throw new Error("Invalid invitation entitlement contract container ID");
  }
  return containerId;
}

function assertOwnershipToken(ownershipToken) {
  if (!ownershipTokenPattern.test(ownershipToken)) {
    throw new Error("Invalid invitation entitlement contract ownership token");
  }
  return ownershipToken;
}

export function createContainerName({
  pid = process.pid,
  suffix = randomBytes(6).toString("hex"),
} = {}) {
  if (!Number.isInteger(pid) || pid < 1 || !/^[0-9a-f]{12}$/.test(suffix)) {
    throw new Error("Invalid invitation entitlement contract container identity");
  }
  return `effectime-invitation-entitlement-pg18-${pid}-${suffix}`;
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
    throw new Error("Invitation entitlement contract runtime inputs are required");
  }

  const fixtureSource = resolve(
    repoRoot,
    "scripts/ci/invitation-entitlement-migration.test.sql",
  );
  const migrationSource = resolve(
    repoRoot,
    "supabase/migrations/20260722100000_v3_51_19_invitation_entitlement_parity.sql",
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
    `type=bind,source=${fixtureSource},target=${CONTRACT_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${migrationSource},target=${MIGRATION_SQL_PATH},readonly`,
    POSTGRES_IMAGE,
  ];
}

export function buildPsqlArgs(containerName) {
  assertContainerName(containerName);
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
    "--file",
    CONTRACT_SQL_PATH,
  ];
}

export function buildPsqlCommandArgs(containerName, command, { tuplesOnly = false } = {}) {
  assertContainerName(containerName);
  if (!command) {
    throw new Error("An invitation entitlement contract command is required");
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
      "Refusing to remove a container whose ID and invitation entitlement ownership label do not match",
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
      `Unable to prove invitation entitlement contract container ownership: ${inspection.stderr?.trim() || "inspect failed"}`,
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
      `Failed to remove owned invitation entitlement contract container ${containerId}: ${cleanup.stderr?.trim() || "unknown error"}`,
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
    throw new Error("Invalid invitation entitlement readiness limits");
  }

  const readinessArgs = buildPostgresReadinessArgs(containerName);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = executeDockerSync(readinessArgs, { allowFailure: true });
    if (result.status === 0 && result.stdout?.trim() === "1") return;
    if (attempt < attempts) await wait(intervalMilliseconds);
  }
  throw new Error(
    `PostgreSQL invitation entitlement contract database ${CONTRACT_DATABASE} did not become queryable`,
  );
}

export async function runInvitationEntitlementDatabaseContract({
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

  console.log(`Invitation entitlement DB contract container: ${containerName}`);
  console.log(`Pinned PostgreSQL image: ${POSTGRES_IMAGE}`);
  try {
    const creation = executeDockerSync(
      buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }),
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    createdContainerId = parseCreatedContainerId(creation.stdout);
    await waitForPostgres(containerName, { executeDockerSync, wait });
    executeDockerSync(buildPsqlArgs(containerName), { stdio: "inherit" });
    console.log("Invitation entitlement PostgreSQL 18.4 contract passed.");
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
          `Removed owned invitation entitlement contract container: ${containerName} (${createdContainerId})`,
        );
      }
    } catch (error) {
      cleanupError = error;
    }
  }

  if (contractError && cleanupError) {
    throw new AggregateError(
      [contractError, cleanupError],
      "Invitation entitlement database contract and owned-container cleanup both failed",
    );
  }
  if (contractError) throw contractError;
  if (cleanupError) throw cleanupError;
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  runInvitationEntitlementDatabaseContract().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
