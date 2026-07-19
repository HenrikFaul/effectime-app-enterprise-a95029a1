import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POSTGRES_IMAGE =
  "postgres:18.4@sha256:32ca0af8e77bfb8c6610c488e4691f83f972a3e9e64d3b02facf3ab111ad5500";
export const CONTRACT_DATABASE = "effectime_admin_leave_override_contract";
export const CONTRACT_SQL_PATH = "/contract/fixture.sql";
export const MIGRATION_SQL_PATH = "/contract/migration.sql";
export const OWNERSHIP_LABEL_KEY = "com.effectime.ci.admin-leave-override-contract";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const containerNamePattern = /^effectime-admin-override-pg18-[1-9][0-9]*-[0-9a-f]{12}$/;
const containerIdPattern = /^[0-9a-f]{64}$/;
const ownershipTokenPattern = /^[0-9a-f]{32}$/;
const applicationNamePattern = /^[a-z0-9-]+$/;
const advisoryLockClassId = 734553;

export const CONCURRENCY_SCENARIOS = Object.freeze([
  Object.freeze({
    label: "admin override duplicate replay",
    sessionAVariable: "ADMIN_OVERRIDE_DUPLICATE_A=1",
    sessionBVariable: "ADMIN_OVERRIDE_DUPLICATE_B=1",
    verifyVariable: "ADMIN_OVERRIDE_DUPLICATE_VERIFY=1",
    advisoryObjectId: 1,
    waitingApplication: "effectime-admin-override-duplicate-b",
    waitDescription: "admin override serialization lock",
    applications: Object.freeze([
      "effectime-admin-override-duplicate-a",
      "effectime-admin-override-duplicate-b",
    ]),
  }),
  Object.freeze({
    label: "admin override actor demotion",
    sessionAVariable: "ADMIN_OVERRIDE_DEMOTION_A=1",
    sessionBVariable: "ADMIN_OVERRIDE_DEMOTION_B=1",
    verifyVariable: "ADMIN_OVERRIDE_DEMOTION_VERIFY=1",
    advisoryObjectId: 2,
    waitingApplication: "effectime-admin-override-demotion-b",
    waitDescription: "membership row lock",
    applications: Object.freeze([
      "effectime-admin-override-demotion-a",
      "effectime-admin-override-demotion-b",
    ]),
  }),
]);

const concurrencyApplications = CONCURRENCY_SCENARIOS.flatMap(
  (scenario) => scenario.applications,
);
const resetConcurrencyGateQuery =
  "UPDATE contract.admin_override_concurrency_gate SET released = false WHERE id = 1;";
const releaseConcurrencyGateQuery =
  "UPDATE contract.admin_override_concurrency_gate SET released = true WHERE id = 1;";
const terminateConcurrencyBackendsQuery = [
  "SELECT pg_terminate_backend(pid)",
  "FROM pg_stat_activity",
  "WHERE pid <> pg_backend_pid()",
  `AND application_name IN (${concurrencyApplications.map((name) => `'${name}'`).join(", ")});`,
].join(" ");

function assertContainerName(containerName) {
  if (!containerNamePattern.test(containerName)) {
    throw new Error("Invalid admin override contract container name");
  }
  return containerName;
}

function assertContainerId(containerId) {
  if (!containerIdPattern.test(containerId)) {
    throw new Error("Invalid admin override contract container ID");
  }
  return containerId;
}

function assertOwnershipToken(ownershipToken) {
  if (!ownershipTokenPattern.test(ownershipToken)) {
    throw new Error("Invalid admin override contract ownership token");
  }
  return ownershipToken;
}

function assertApplicationName(applicationName) {
  if (!applicationNamePattern.test(applicationName)) {
    throw new Error("Invalid admin override concurrency application name");
  }
  return applicationName;
}

export function createContainerName({
  pid = process.pid,
  suffix = randomBytes(6).toString("hex"),
} = {}) {
  if (!Number.isInteger(pid) || pid < 1 || !/^[0-9a-f]{12}$/.test(suffix)) {
    throw new Error("Invalid admin override contract container identity");
  }
  return `effectime-admin-override-pg18-${pid}-${suffix}`;
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
    throw new Error("Admin override contract runtime inputs are required");
  }

  const contractSource = resolve(
    repoRoot,
    "scripts/ci/admin-leave-override-migration.test.sql",
  );
  const migrationSource = resolve(
    repoRoot,
    "supabase/migrations/20260719010000_v3_51_4_admin_override_idempotency.sql",
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
    `type=bind,source=${contractSource},target=${CONTRACT_SQL_PATH},readonly`,
    "--mount",
    `type=bind,source=${migrationSource},target=${MIGRATION_SQL_PATH},readonly`,
    POSTGRES_IMAGE,
  ];
}

export function buildPsqlArgs(containerName, variables = []) {
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
    ...variables.flatMap((variable) => ["--variable", variable]),
    "--file",
    CONTRACT_SQL_PATH,
  ];
}

export function buildPsqlCommandArgs(
  containerName,
  command,
  { tuplesOnly = false } = {},
) {
  assertContainerName(containerName);
  if (!command) throw new Error("An admin override contract command is required");
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

export function buildAdvisoryLockQuery(objectId) {
  if (!Number.isInteger(objectId) || objectId < 1) {
    throw new Error("Invalid admin override concurrency advisory lock identity");
  }
  return [
    "SELECT EXISTS (",
    "SELECT 1 FROM pg_locks",
    "WHERE locktype = 'advisory'",
    `AND classid = ${advisoryLockClassId}`,
    `AND objid = ${objectId}`,
    "AND granted",
    ");",
  ].join(" ");
}

export function buildConcurrentWaitQuery(applicationName, blockingApplicationName) {
  const waiter = assertApplicationName(applicationName);
  const blocker = assertApplicationName(blockingApplicationName);
  return [
    "SELECT EXISTS (",
    "SELECT 1 FROM pg_stat_activity AS waiter",
    "WHERE waiter.datname = current_database()",
    `AND waiter.application_name = '${waiter}'`,
    "AND waiter.state = 'active'",
    "AND waiter.wait_event_type = 'Lock'",
    "AND EXISTS (",
    "SELECT 1",
    "FROM unnest(pg_blocking_pids(waiter.pid)) AS blocker_pid(pid)",
    "JOIN pg_stat_activity AS blocker ON blocker.pid = blocker_pid.pid",
    `WHERE blocker.application_name = '${blocker}'`,
    ")",
    ");",
  ].join(" ");
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

export function resolveOwnedCleanupTarget({
  containerId,
  ownershipToken,
  inspectionOutput,
}) {
  assertContainerId(containerId);
  assertOwnershipToken(ownershipToken);
  const [inspectedId, inspectedToken, ...unexpected] = inspectionOutput
    .trim()
    .split(/\s+/);
  if (
    unexpected.length > 0 ||
    inspectedId !== containerId ||
    inspectedToken !== ownershipToken
  ) {
    throw new Error(
      "Refusing to remove a container whose ID and admin override ownership label do not match",
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
      `Unable to prove admin override contract container ownership: ${inspection.stderr?.trim() || "inspect failed"}`,
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
      `Failed to remove owned admin override contract container ${containerId}: ${cleanup.stderr?.trim() || "unknown error"}`,
    );
  }
  return true;
}

export function observeDockerChild(child, args) {
  let settled = false;
  let outcome = null;
  const rawCompletion = new Promise((resolvePromise, rejectPromise) => {
    let completed = false;
    const completeOnce = (callback, value) => {
      if (completed) return;
      completed = true;
      callback(value);
    };
    child.once("error", (error) => completeOnce(rejectPromise, error));
    child.once("exit", (code, signal) => {
      if (code === 0) {
        completeOnce(resolvePromise);
      } else {
        completeOnce(
          rejectPromise,
          new Error(`docker ${args[0]} exited with ${code ?? `signal ${signal ?? "unknown"}`}`),
        );
      }
    });
  });

  // Observe rejection synchronously. Callers receive an always-fulfilled outcome
  // so a failed child cannot become an unhandled rejection while a lock barrier
  // is being polled.
  const completion = rawCompletion.then(
    () => {
      settled = true;
      outcome = { status: "fulfilled" };
      return outcome;
    },
    (reason) => {
      settled = true;
      outcome = { status: "rejected", reason };
      return outcome;
    },
  );
  return {
    child,
    completion,
    get outcome() {
      return outcome;
    },
    get settled() {
      return settled;
    },
  };
}

function dockerAsync(args) {
  return observeDockerChild(spawn("docker", args, { stdio: "inherit" }), args);
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForPostgres(containerName) {
  for (let attempt = 1; attempt <= 80; attempt += 1) {
    const result = dockerSync(buildPostgresReadinessArgs(containerName), {
      allowFailure: true,
    });
    if (result.status === 0 && result.stdout.trim() === "1") return;
    await delay(250);
  }
  throw new Error(
    `PostgreSQL admin override contract database ${CONTRACT_DATABASE} did not become queryable`,
  );
}

async function waitForConcurrencyBarrier(containerName, session, scenario) {
  for (let attempt = 1; attempt <= 150; attempt += 1) {
    if (session.settled) {
      const result = await session.completion;
      if (result.status === "rejected") throw result.reason;
      throw new Error(
        `Primary ${scenario.label} session ended before reaching its advisory barrier`,
      );
    }
    const result = dockerSync(
      buildPsqlCommandArgs(containerName, buildAdvisoryLockQuery(scenario.advisoryObjectId), {
        tuplesOnly: true,
      }),
      { allowFailure: true },
    );
    if (result.status === 0 && result.stdout.trim() === "t") return;
    await delay(100);
  }
  throw new Error(`Concurrent ${scenario.label} session did not reach its advisory barrier`);
}

async function waitForConcurrentLockWait(containerName, session, scenario) {
  for (let attempt = 1; attempt <= 150; attempt += 1) {
    if (session.settled) {
      const result = await session.completion;
      if (result.status === "rejected") throw result.reason;
      throw new Error(
        `Concurrent ${scenario.label} session ended before waiting on the ${scenario.waitDescription}`,
      );
    }
    const result = dockerSync(
      buildPsqlCommandArgs(
        containerName,
        buildConcurrentWaitQuery(
          scenario.waitingApplication,
          scenario.applications[0],
        ),
        { tuplesOnly: true },
      ),
      { allowFailure: true },
    );
    if (result.status === 0 && result.stdout.trim() === "t") return;
    await delay(100);
  }
  throw new Error(
    `Second ${scenario.label} session did not reach its deterministic ${scenario.waitDescription} wait`,
  );
}

function waitForObservedCompletion(session, milliseconds) {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(null), milliseconds);
    session.completion.then((result) => {
      clearTimeout(timer);
      resolvePromise(result);
    });
  });
}

export async function settleOrTerminateSessions(
  containerName,
  sessions,
  {
    executeDockerSync = dockerSync,
    graceMilliseconds = 2_000,
    terminationGraceMilliseconds = 1_000,
  } = {},
) {
  assertContainerName(containerName);
  let pending = sessions.filter((session) => !session.settled);
  if (pending.length === 0) {
    return Promise.all(sessions.map((session) => session.completion));
  }

  await Promise.all(
    pending.map((session) => waitForObservedCompletion(session, graceMilliseconds)),
  );
  pending = sessions.filter((session) => !session.settled);
  let terminationError = null;
  if (pending.length > 0) {
    try {
      const termination = executeDockerSync(
        buildPsqlCommandArgs(containerName, terminateConcurrencyBackendsQuery),
        { allowFailure: true },
      );
      if (termination.status !== 0) {
        terminationError = new Error(
          `Failed to terminate admin override concurrency backends: ${termination.stderr?.trim() || "unknown error"}`,
        );
      }
    } catch (error) {
      terminationError = error;
    } finally {
      for (const session of pending) session.child.kill("SIGTERM");
    }

    await Promise.all(
      pending.map((session) =>
        waitForObservedCompletion(session, terminationGraceMilliseconds),
      ),
    );
    pending = sessions.filter((session) => !session.settled);
    if (pending.length > 0) {
      for (const session of pending) session.child.kill("SIGKILL");
      await Promise.all(
        pending.map((session) =>
          waitForObservedCompletion(session, terminationGraceMilliseconds),
        ),
      );
      pending = sessions.filter((session) => !session.settled);
      if (pending.length > 0) {
        throw new Error(
          "Admin override concurrency child processes did not terminate after SIGKILL",
        );
      }
    }
  }

  const results = await Promise.all(sessions.map((session) => session.completion));
  if (terminationError) throw terminationError;
  return results;
}

async function runConcurrencyScenario(containerName, scenario) {
  const sessions = [];
  let contractError = null;
  const lifecycleErrors = [];
  try {
    console.log(`Resetting deterministic ${scenario.label} concurrency gate.`);
    dockerSync(buildPsqlCommandArgs(containerName, resetConcurrencyGateQuery));

    const sessionA = dockerAsync(buildPsqlArgs(containerName, [scenario.sessionAVariable]));
    sessions.push(sessionA);
    await waitForConcurrencyBarrier(containerName, sessionA, scenario);
    console.log(`Primary ${scenario.label} reached the advisory barrier.`);
    if (sessionA.settled) {
      const result = await sessionA.completion;
      if (result.status === "rejected") throw result.reason;
      throw new Error(`Primary ${scenario.label} session ended before gate release`);
    }

    const sessionB = dockerAsync(buildPsqlArgs(containerName, [scenario.sessionBVariable]));
    sessions.push(sessionB);
    await waitForConcurrentLockWait(containerName, sessionB, scenario);
    console.log(`Second ${scenario.label} is waiting on the ${scenario.waitDescription}.`);

    dockerSync(buildPsqlCommandArgs(containerName, releaseConcurrencyGateQuery));
    console.log(`Released deterministic ${scenario.label} concurrency gate.`);

    const results = await Promise.all(sessions.map((session) => session.completion));
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    dockerSync(buildPsqlArgs(containerName, [scenario.verifyVariable]), {
      stdio: "inherit",
    });
  } catch (error) {
    contractError = error;
  } finally {
    try {
      const release = dockerSync(
        buildPsqlCommandArgs(containerName, releaseConcurrencyGateQuery),
        { allowFailure: true },
      );
      if (release.status !== 0) {
        lifecycleErrors.push(
          new Error(
            `Failed to release ${scenario.label} concurrency gate: ${release.stderr?.trim() || "unknown error"}`,
          ),
        );
      }
    } catch (error) {
      lifecycleErrors.push(error);
    } finally {
      try {
        await settleOrTerminateSessions(containerName, sessions);
      } catch (error) {
        lifecycleErrors.push(error);
      }
    }
  }

  const errors = [contractError, ...lifecycleErrors].filter(Boolean);
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      `${scenario.label} concurrency contract or child lifecycle cleanup failed`,
    );
  }
  if (errors.length === 1) throw errors[0];
}

async function runConcurrencyContracts(containerName) {
  for (const scenario of CONCURRENCY_SCENARIOS) {
    await runConcurrencyScenario(containerName, scenario);
  }
}

export async function runAdminLeaveOverrideDatabaseContract({
  containerName = createContainerName(),
  repoRoot = repositoryRoot,
  ownershipToken = createOwnershipToken(),
} = {}) {
  const password = randomBytes(24).toString("base64url");
  let createdContainerId = null;
  let contractError = null;
  let cleanupError = null;

  console.log(`Admin override DB contract container: ${containerName}`);
  console.log(`Pinned PostgreSQL image: ${POSTGRES_IMAGE}`);
  try {
    const creation = dockerSync(
      buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }),
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    createdContainerId = parseCreatedContainerId(creation.stdout);
    await waitForPostgres(containerName);
    dockerSync(buildPsqlArgs(containerName), { stdio: "inherit" });
    await runConcurrencyContracts(containerName);
    console.log("Admin leave override PostgreSQL 18.4 contract passed.");
  } catch (error) {
    contractError = error;
  } finally {
    try {
      if (cleanupOwnedContainer({ containerId: createdContainerId, ownershipToken })) {
        console.log(
          `Removed owned admin override contract container: ${containerName} (${createdContainerId})`,
        );
      }
    } catch (error) {
      cleanupError = error;
    }
  }

  if (contractError && cleanupError) {
    throw new AggregateError(
      [contractError, cleanupError],
      "Admin override database contract and owned-container cleanup both failed",
    );
  }
  if (contractError) throw contractError;
  if (cleanupError) throw cleanupError;
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  runAdminLeaveOverrideDatabaseContract().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
