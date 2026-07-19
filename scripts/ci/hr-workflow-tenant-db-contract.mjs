import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POSTGRES_IMAGE =
  "postgres:18.4@sha256:32ca0af8e77bfb8c6610c488e4691f83f972a3e9e64d3b02facf3ab111ad5500";
export const CONTRACT_DATABASE = "effectime_hr_workflow_contract";
export const OWNERSHIP_LABEL_KEY = "com.effectime.ci.hr-workflow-contract";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = "/contract/fixture.sql";
const baseMigrationPath = "/contract/base-migration.sql";
const repairMigrationPath = "/contract/migration.sql";
const containerNamePattern = /^effectime-hr-workflow-pg18-[1-9][0-9]*-[0-9a-f]{12}$/;
const containerIdPattern = /^[0-9a-f]{64}$/;
const ownershipTokenPattern = /^[0-9a-f]{32}$/;

const scenarios = Object.freeze([
  Object.freeze({
    label: "assignee reassignment",
    sessionAVariable: "HR_REASSIGN_A=1",
    sessionBVariable: "HR_REASSIGN_B=1",
    verifyVariable: "HR_REASSIGN_VERIFY=1",
    advisoryObjectId: 1,
    resultKey: "reassign",
    applications: Object.freeze(["effectime-hr-reassign-a", "effectime-hr-reassign-b"]),
  }),
  Object.freeze({
    label: "membership suspension",
    sessionAVariable: "HR_SUSPEND_A=1",
    sessionBVariable: "HR_SUSPEND_B=1",
    verifyVariable: "HR_SUSPEND_VERIFY=1",
    advisoryObjectId: 2,
    resultKey: "suspend",
    applications: Object.freeze(["effectime-hr-suspend-a", "effectime-hr-suspend-b"]),
  }),
  Object.freeze({
    label: "direct assignment during membership suspension",
    sessionAVariable: "HR_DIRECT_SUSPEND_A=1",
    sessionBVariable: "HR_DIRECT_SUSPEND_B=1",
    verifyVariable: "HR_DIRECT_SUSPEND_VERIFY=1",
    advisoryObjectId: 3,
    resultKey: "direct-suspend",
    applications: Object.freeze([
      "effectime-hr-direct-suspend-a",
      "effectime-hr-direct-suspend-b",
    ]),
  }),
  Object.freeze({
    label: "direct instance during template deactivation",
    sessionAVariable: "HR_TEMPLATE_DEACTIVATE_A=1",
    sessionBVariable: "HR_TEMPLATE_DEACTIVATE_B=1",
    verifyVariable: "HR_TEMPLATE_DEACTIVATE_VERIFY=1",
    advisoryObjectId: 4,
    resultKey: "template-deactivate",
    applications: Object.freeze([
      "effectime-hr-template-deactivate-a",
      "effectime-hr-template-deactivate-b",
    ]),
  }),
]);

function assertContainerName(value) {
  if (!containerNamePattern.test(value)) throw new Error("Invalid HR contract container name");
  return value;
}

function assertContainerId(value) {
  if (!containerIdPattern.test(value)) throw new Error("Invalid HR contract container ID");
  return value;
}

function assertOwnershipToken(value) {
  if (!ownershipTokenPattern.test(value)) throw new Error("Invalid HR contract ownership token");
  return value;
}

export function createContainerName({
  pid = process.pid,
  suffix = randomBytes(6).toString("hex"),
} = {}) {
  if (!Number.isInteger(pid) || pid < 1 || !/^[0-9a-f]{12}$/.test(suffix)) {
    throw new Error("Invalid HR contract container identity");
  }
  return `effectime-hr-workflow-pg18-${pid}-${suffix}`;
}

export function createOwnershipToken(bytes = randomBytes(16)) {
  return assertOwnershipToken(Buffer.from(bytes).toString("hex"));
}

export function buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }) {
  assertContainerName(containerName);
  assertOwnershipToken(ownershipToken);
  if (!repoRoot || !password) throw new Error("HR contract runtime inputs are required");
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
    `type=bind,source=${resolve(repoRoot, "scripts/ci/hr-workflow-tenant-migration.test.sql")},target=${fixturePath},readonly`,
    "--mount",
    `type=bind,source=${resolve(repoRoot, "supabase/migrations/20260511000001_create_hr_workflows.sql")},target=${baseMigrationPath},readonly`,
    "--mount",
    `type=bind,source=${resolve(repoRoot, "supabase/migrations/20260719000000_v3_51_3_hr_workflow_tenant_boundaries.sql")},target=${repairMigrationPath},readonly`,
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
    fixturePath,
  ];
}

export function buildPsqlCommandArgs(containerName, command, { tuplesOnly = false } = {}) {
  assertContainerName(containerName);
  if (!command) throw new Error("HR contract command is required");
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

function parseContainerId(output) {
  return assertContainerId(output.trim());
}

export function resolveOwnedCleanupTarget({ containerId, ownershipToken, inspectionOutput }) {
  assertContainerId(containerId);
  assertOwnershipToken(ownershipToken);
  const [inspectedId, inspectedToken, ...unexpected] = inspectionOutput.trim().split(/\s+/);
  if (unexpected.length > 0 || inspectedId !== containerId || inspectedToken !== ownershipToken) {
    throw new Error("Refusing to remove a container without matching HR contract ownership");
  }
  return containerId;
}

export function cleanupOwnedContainer({
  containerId,
  ownershipToken,
  runDocker = dockerSync,
}) {
  if (!containerId) return;
  const inspection = runDocker(
    [
      "inspect",
      "--format",
      `{{.Id}}\t{{index .Config.Labels "${OWNERSHIP_LABEL_KEY}"}}`,
      assertContainerId(containerId),
    ],
    { allowFailure: true },
  );
  if (inspection.status !== 0) {
    throw new Error(`Unable to prove HR contract container ownership: ${inspection.stderr.trim()}`);
  }
  const target = resolveOwnedCleanupTarget({
    containerId,
    ownershipToken,
    inspectionOutput: inspection.stdout,
  });
  const cleanup = runDocker(["rm", "--force", target], { allowFailure: true });
  if (cleanup.status !== 0) {
    throw new Error(`Failed to remove owned HR contract container: ${cleanup.stderr.trim()}`);
  }
}

function observeChild(args) {
  const child = spawn("docker", args, { stdio: "inherit" });
  let settled = false;
  const completion = new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      settled = true;
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`docker ${args[0]} exited with ${code ?? `signal ${signal}`}`));
    });
  });
  // Attach a rejection observer immediately so a child cannot become an
  // unhandled rejection while the runner is proving a database lock wait.
  completion.catch(() => {});
  return { child, completion, get settled() { return settled; } };
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForPostgres(containerName) {
  const args = buildPsqlCommandArgs(containerName, "SELECT 1;", { tuplesOnly: true });
  for (let attempt = 1; attempt <= 80; attempt += 1) {
    const result = dockerSync(args, { allowFailure: true });
    if (result.status === 0 && result.stdout.trim() === "1") return;
    await delay(250);
  }
  throw new Error("HR workflow contract database did not become queryable");
}

function advisoryBarrierQuery(objectId) {
  return [
    "SELECT EXISTS (SELECT 1 FROM pg_locks",
    "WHERE locktype = 'advisory'",
    "AND classid = 734552",
    `AND objid = ${objectId}`,
    "AND granted);",
  ].join(" ");
}

function lockWaitQuery(waiter, blocker) {
  if (!/^[a-z0-9-]+$/.test(waiter) || !/^[a-z0-9-]+$/.test(blocker)) {
    throw new Error("Invalid HR contract application name");
  }
  return [
    "SELECT EXISTS (SELECT 1 FROM pg_stat_activity AS waiter",
    `WHERE waiter.application_name = '${waiter}'`,
    "AND waiter.state = 'active'",
    "AND waiter.wait_event_type = 'Lock'",
    "AND EXISTS (SELECT 1 FROM unnest(pg_blocking_pids(waiter.pid)) AS blocked(pid)",
    "JOIN pg_stat_activity AS blocker ON blocker.pid = blocked.pid",
    `WHERE blocker.application_name = '${blocker}'));`,
  ].join(" ");
}

async function waitForBooleanQuery(containerName, query, primarySession, description) {
  for (let attempt = 1; attempt <= 150; attempt += 1) {
    if (primarySession?.settled) {
      await primarySession.completion;
      throw new Error(`HR ${description} session ended before the barrier was observed`);
    }
    const result = dockerSync(
      buildPsqlCommandArgs(containerName, query, { tuplesOnly: true }),
      { allowFailure: true },
    );
    if (result.status === 0 && result.stdout.trim() === "t") return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for HR ${description}`);
}

function terminateDatabaseSessions(containerName, applications) {
  const quoted = applications.map((name) => `'${name}'`).join(", ");
  dockerSync(
    buildPsqlCommandArgs(
      containerName,
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND application_name IN (${quoted});`,
    ),
    { allowFailure: true },
  );
}

async function collectSessionResultsWithin(sessions, timeoutMilliseconds, wait) {
  return Promise.race([
    Promise.allSettled(sessions.map((session) => session.completion)),
    wait(timeoutMilliseconds).then(() => null),
  ]);
}

export async function settleSessions(
  containerName,
  sessions,
  applications,
  {
    terminateSessions = terminateDatabaseSessions,
    wait = delay,
    gracePeriodMilliseconds = 2_000,
  } = {},
) {
  const settled = await collectSessionResultsWithin(
    sessions,
    gracePeriodMilliseconds,
    wait,
  );
  if (settled) return settled;

  terminateSessions(containerName, applications);
  for (const session of sessions) {
    if (!session.settled) session.child.kill("SIGTERM");
  }
  const terminated = await collectSessionResultsWithin(
    sessions,
    gracePeriodMilliseconds,
    wait,
  );
  if (terminated) return terminated;

  for (const session of sessions) {
    if (!session.settled) session.child.kill("SIGKILL");
  }
  const killed = await collectSessionResultsWithin(
    sessions,
    gracePeriodMilliseconds,
    wait,
  );
  if (killed) return killed;
  throw new Error("HR workflow concurrency child processes did not terminate");
}

async function runConcurrencyScenario(containerName, scenario) {
  const sessions = [];
  let primaryError = null;
  try {
    dockerSync(
      buildPsqlCommandArgs(
        containerName,
        `UPDATE contract.hr_concurrency_gate SET released = false WHERE id = 1; DELETE FROM contract.hr_concurrency_results WHERE scenario = '${scenario.resultKey}';`,
      ),
    );
    const sessionA = observeChild(buildPsqlArgs(containerName, [scenario.sessionAVariable]));
    sessions.push(sessionA);
    await waitForBooleanQuery(
      containerName,
      advisoryBarrierQuery(scenario.advisoryObjectId),
      sessionA,
      `${scenario.label} advisory barrier`,
    );

    const sessionB = observeChild(buildPsqlArgs(containerName, [scenario.sessionBVariable]));
    sessions.push(sessionB);
    await waitForBooleanQuery(
      containerName,
      lockWaitQuery(scenario.applications[1], scenario.applications[0]),
      sessionB,
      `${scenario.label} row-lock wait`,
    );

    dockerSync(
      buildPsqlCommandArgs(
        containerName,
        "UPDATE contract.hr_concurrency_gate SET released = true WHERE id = 1;",
      ),
    );
    const results = await Promise.allSettled(sessions.map((session) => session.completion));
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    dockerSync(buildPsqlArgs(containerName, [scenario.verifyVariable]), { stdio: "inherit" });
  } catch (error) {
    primaryError = error;
  } finally {
    dockerSync(
      buildPsqlCommandArgs(
        containerName,
        "UPDATE contract.hr_concurrency_gate SET released = true WHERE id = 1;",
      ),
      { allowFailure: true },
    );
    const lifecycle = await settleSessions(containerName, sessions, scenario.applications);
    const lifecycleFailure = lifecycle.find((result) => result.status === "rejected");
    if (!primaryError && lifecycleFailure) primaryError = lifecycleFailure.reason;
  }
  if (primaryError) throw primaryError;
}

export async function runHrWorkflowTenantDatabaseContract({
  containerName = createContainerName(),
  repoRoot = repositoryRoot,
  ownershipToken = createOwnershipToken(),
} = {}) {
  const password = randomBytes(24).toString("base64url");
  let containerId = null;
  let contractError = null;
  let cleanupError = null;

  console.log(`HR workflow DB contract container: ${containerName}`);
  console.log(`Pinned PostgreSQL image: ${POSTGRES_IMAGE}`);
  try {
    const creation = dockerSync(
      buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }),
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    containerId = parseContainerId(creation.stdout);
    await waitForPostgres(containerName);
    dockerSync(buildPsqlArgs(containerName), { stdio: "inherit" });
    for (const scenario of scenarios) {
      await runConcurrencyScenario(containerName, scenario);
    }
    console.log("HR workflow tenant PostgreSQL 18.4 contract passed.");
  } catch (error) {
    contractError = error;
  } finally {
    try {
      cleanupOwnedContainer({ containerId, ownershipToken });
    } catch (error) {
      cleanupError = error;
    }
  }

  if (contractError && cleanupError) {
    throw new AggregateError(
      [contractError, cleanupError],
      "HR workflow contract and owned-container cleanup both failed",
    );
  }
  if (contractError) throw contractError;
  if (cleanupError) throw cleanupError;
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  runHrWorkflowTenantDatabaseContract().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
