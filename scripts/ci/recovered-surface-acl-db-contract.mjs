import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POSTGRES_IMAGE =
  "postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929";
export const CONTRACT_DATABASE = "effectime_recovered_surface_acl_contract";
export const SETUP_SQL_PATH = "/contract/setup.sql";
export const CLOCK_MIGRATION_SQL_PATH = "/contract/clock-migration.sql";
export const MARKETPLACE_MIGRATION_SQL_PATH = "/contract/marketplace-migration.sql";
export const CLOCKOUT_MIGRATION_SQL_PATH = "/contract/clockout-migration.sql";
export const HARDENING_MIGRATION_SQL_PATH = "/contract/hardening-migration.sql";
export const ASSERTIONS_SQL_PATH = "/contract/assertions.sql";
export const OWNERSHIP_LABEL_KEY = "com.effectime.ci.recovered-surface-acl-contract";
export const VERIFY_FAILED_PREFLIGHT_SQL =
  "SELECT contract.assert_preflight_left_no_partial_mutation();";
export const CAPTURE_HARDENED_STATE_SQL =
  "INSERT INTO contract.state_baseline (state_name, state_value) VALUES ('hardened_mutable', contract.mutable_surface_state()), ('hardened_qr_source', (SELECT pg_catalog.jsonb_build_object('prosrc', procedure.prosrc) FROM pg_catalog.pg_proc AS procedure WHERE procedure.oid = 'public.clock_generate_qr(uuid,integer)'::pg_catalog.regprocedure::oid)) ON CONFLICT (state_name) DO UPDATE SET state_value = EXCLUDED.state_value;";
export const SEED_REAPPLY_DRIFT_SQL =
  [
    "GRANT SELECT ON TABLE public.clock_events TO PUBLIC",
    "GRANT UPDATE (payload) ON TABLE public.plugin_webhook_events TO anon, authenticated",
    "GRANT EXECUTE ON FUNCTION public.haversine_km(numeric,numeric,numeric,numeric) TO PUBLIC, anon, authenticated",
    "ALTER FUNCTION public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid) SET search_path = public",
  ].join("; ") + ";";

export const TAMPER_CASES = Object.freeze([
  Object.freeze({
    label: "RLS predicate drift",
    sql: "ALTER POLICY clock_events_read ON public.clock_events USING (true);",
    expectedFailure: /Recovered surface RLS policy contract is incompatible/i,
  }),
  Object.freeze({
    label: "RLS permissiveness drift",
    sql:
      [
        "DROP POLICY clock_events_read ON public.clock_events",
        "CREATE POLICY clock_events_read ON public.clock_events AS RESTRICTIVE FOR SELECT TO authenticated USING (membership_id IN (SELECT id FROM public.enterprise_memberships WHERE user_id = auth.uid()) OR public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]) OR public.has_role(auth.uid(), 'admin'::public.app_role))",
      ].join("; ") + ";",
    expectedFailure: /Recovered surface RLS policy contract is incompatible/i,
  }),
  Object.freeze({
    label: "unexpected extra RLS policy",
    sql: "CREATE POLICY contract_extra_policy ON public.clock_events AS RESTRICTIVE FOR SELECT TO authenticated USING (false);",
    expectedFailure: /Recovered surface RLS policy set is incompatible/i,
  }),
  Object.freeze({
    label: "partitioned recovered table",
    sql:
      [
        "ALTER TABLE public.clock_events RENAME TO contract_original_clock_events",
        "CREATE TABLE public.clock_events (id uuid, created_at timestamptz NOT NULL) PARTITION BY RANGE (created_at)",
        "ALTER TABLE public.clock_events OWNER TO postgres",
        "ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY",
      ].join("; ") + ";",
    expectedFailure: /Recovered surface table contract is incompatible/i,
  }),
  Object.freeze({
    label: "inherited browser parent-role column ACL",
    sql:
      [
        "GRANT contract_acl_parent TO anon, authenticated",
        "GRANT UPDATE (raw_data) ON public.clock_events TO contract_acl_parent",
      ].join("; ") + ";",
    expectedFailure: /Recovered surface browser roles must not inherit parent roles/i,
  }),
  Object.freeze({
    label: "pgcrypto schema owner drift",
    sql: "ALTER SCHEMA extensions OWNER TO contract_untrusted_owner;",
    expectedFailure: /(?:extensions|pgcrypto).*schema.*owner|schema owner.*trusted/i,
  }),
  Object.freeze({
    label: "pgcrypto extension owner drift",
    sql: "UPDATE pg_catalog.pg_extension SET extowner = 'contract_untrusted_owner'::pg_catalog.regrole WHERE extname = 'pgcrypto';",
    expectedFailure: /pgcrypto.*extension.*owner|extension owner.*trusted/i,
  }),
  Object.freeze({
    label: "gen_random_bytes owner drift",
    sql: "ALTER FUNCTION extensions.gen_random_bytes(integer) OWNER TO contract_untrusted_owner;",
    expectedFailure: /gen_random_bytes.*owner|owner.*gen_random_bytes|pgcrypto.*owner/i,
  }),
  Object.freeze({
    label: "gen_random_bytes extension-membership drift",
    sql: "ALTER EXTENSION pgcrypto DROP FUNCTION extensions.gen_random_bytes(integer);",
    expectedFailure: /gen_random_bytes|Trusted pgcrypto function contract|pgcrypto.*member/i,
  }),
  Object.freeze({
    label: "digest owner drift",
    sql: "ALTER FUNCTION extensions.digest(bytea, text) OWNER TO contract_untrusted_owner;",
    expectedFailure: /digest.*owner|owner.*digest|pgcrypto.*owner/i,
  }),
  Object.freeze({
    label: "digest extension-membership drift",
    sql: "ALTER EXTENSION pgcrypto DROP FUNCTION extensions.digest(bytea, text);",
    expectedFailure: /digest|Trusted pgcrypto function contract|pgcrypto.*member/i,
  }),
  Object.freeze({
    label: "routine source drift",
    sql: "UPDATE pg_catalog.pg_proc SET prosrc = prosrc || E'\\n-- contract source tamper' WHERE oid = 'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)'::pg_catalog.regprocedure::oid;",
    expectedFailure:
      /Recovered surface routine (?:source attestation failed|contract is incompatible)/i,
  }),
  Object.freeze({
    label: "unexpected routine proconfig drift",
    sql: "ALTER FUNCTION public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid) SET work_mem = '4MB';",
    expectedFailure: /Recovered surface routine contract is incompatible/i,
  }),
]);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const containerNamePattern = /^effectime-recovered-surface-acl-pg17-[1-9][0-9]*-[0-9a-f]{12}$/;
const containerIdPattern = /^[0-9a-f]{64}$/;
const ownershipTokenPattern = /^[0-9a-f]{32}$/;
const allowedContractSqlPaths = new Set([
  SETUP_SQL_PATH,
  HARDENING_MIGRATION_SQL_PATH,
  ASSERTIONS_SQL_PATH,
]);
const allowedTamperSql = new Set(TAMPER_CASES.map((tamperCase) => tamperCase.sql));

function assertContainerName(containerName) {
  if (!containerNamePattern.test(containerName)) {
    throw new Error("Invalid recovered surface ACL contract container name");
  }
  return containerName;
}

function assertContainerId(containerId) {
  if (!containerIdPattern.test(containerId)) {
    throw new Error("Invalid recovered surface ACL contract container ID");
  }
  return containerId;
}

function assertOwnershipToken(ownershipToken) {
  if (!ownershipTokenPattern.test(ownershipToken)) {
    throw new Error("Invalid recovered surface ACL contract ownership token");
  }
  return ownershipToken;
}

function assertAllowedSqlPath(sqlPath) {
  if (!allowedContractSqlPaths.has(sqlPath)) {
    throw new Error("Recovered surface ACL contract SQL path is not allowlisted");
  }
  return sqlPath;
}

export function createContainerName({
  pid = process.pid,
  suffix = randomBytes(6).toString("hex"),
} = {}) {
  if (!Number.isInteger(pid) || pid < 1 || !/^[0-9a-f]{12}$/.test(suffix)) {
    throw new Error("Invalid recovered surface ACL contract container identity");
  }
  return `effectime-recovered-surface-acl-pg17-${pid}-${suffix}`;
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
    throw new Error("Recovered surface ACL contract runtime inputs are required");
  }

  const mounts = [
    [resolve(repoRoot, "scripts/ci/recovered-surface-acl-setup.test.sql"), SETUP_SQL_PATH],
    [
      resolve(repoRoot, "supabase/migrations/20260514124827_v3_22_0_clock_in_engine.sql"),
      CLOCK_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "supabase/migrations/20260514194031_v3_30_0_plugin_marketplace.sql"),
      MARKETPLACE_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "supabase/migrations/20260516160000_v3_39_1_clock_event_clockout_fix.sql"),
      CLOCKOUT_MIGRATION_SQL_PATH,
    ],
    [
      resolve(
        repoRoot,
        "supabase/migrations/20260722054500_v3_51_10_recovered_surface_acl_hardening.sql",
      ),
      HARDENING_MIGRATION_SQL_PATH,
    ],
    [
      resolve(repoRoot, "scripts/ci/recovered-surface-acl-assertions.test.sql"),
      ASSERTIONS_SQL_PATH,
    ],
  ];

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
    ...mounts.flatMap(([source, target]) => [
      "--mount",
      `type=bind,source=${source},target=${target},readonly`,
    ]),
    POSTGRES_IMAGE,
  ];
}

export function buildPsqlFileArgs(containerName, sqlPath, { singleTransaction = false } = {}) {
  assertContainerName(containerName);
  assertAllowedSqlPath(sqlPath);
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
    ...(singleTransaction ? ["--single-transaction"] : []),
    "--file",
    sqlPath,
  ];
}

export function buildPsqlTamperArgs(containerName, tamperSql) {
  assertContainerName(containerName);
  if (!allowedTamperSql.has(tamperSql)) {
    throw new Error("Recovered surface ACL tamper SQL is not allowlisted");
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
    "--command",
    `BEGIN; ${tamperSql}`,
    "--file",
    HARDENING_MIGRATION_SQL_PATH,
  ];
}

export function buildPsqlCommandArgs(containerName, command, { tuplesOnly = false } = {}) {
  assertContainerName(containerName);
  if (!command) {
    throw new Error("A recovered surface ACL contract command is required");
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
      "Refusing to remove a container whose ID and recovered surface ACL ownership label do not match",
    );
  }
  return containerId;
}

export function buildCleanupArgs(containerId) {
  return ["rm", "--force", assertContainerId(containerId)];
}

export function assertExpectedPsqlFailure(result, expectedMatcher) {
  const expectedDescription =
    expectedMatcher instanceof RegExp ? expectedMatcher.toString() : expectedMatcher;
  if (!result || result.status === 0) {
    throw new Error(`Expected PostgreSQL contract failure matching: ${expectedDescription}`);
  }
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const matches =
    expectedMatcher instanceof RegExp
      ? expectedMatcher.test(output)
      : output.includes(expectedMatcher);
  if (!matches) {
    throw new Error(
      `PostgreSQL contract failed for an unexpected reason; expected: ${expectedDescription}\n${output.trim()}`,
    );
  }
  return output;
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
      `Unable to prove recovered surface ACL contract container ownership: ${inspection.stderr?.trim() || "inspect failed"}`,
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
      `Failed to remove owned recovered surface ACL contract container ${containerId}: ${cleanup.stderr?.trim() || "unknown error"}`,
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
    throw new Error("Invalid recovered surface ACL readiness limits");
  }

  const readinessArgs = buildPostgresReadinessArgs(containerName);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = executeDockerSync(readinessArgs, { allowFailure: true });
    if (result.status === 0 && result.stdout?.trim() === "1") return;
    if (attempt < attempts) await wait(intervalMilliseconds);
  }
  throw new Error(
    `PostgreSQL recovered surface ACL contract database ${CONTRACT_DATABASE} did not become queryable`,
  );
}

export async function runRecoveredSurfaceAclDatabaseContract({
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

  console.log(`Recovered surface ACL DB contract container: ${containerName}`);
  console.log(`Pinned PostgreSQL image: ${POSTGRES_IMAGE}`);
  try {
    const creation = executeDockerSync(
      buildDockerRunArgs({ containerName, repoRoot, password, ownershipToken }),
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    createdContainerId = parseCreatedContainerId(creation.stdout);
    await waitForPostgres(containerName, { executeDockerSync, wait });

    executeDockerSync(buildPsqlFileArgs(containerName, SETUP_SQL_PATH), {
      stdio: "inherit",
    });

    for (const tamperCase of TAMPER_CASES) {
      const expectedFailure = executeDockerSync(
        buildPsqlTamperArgs(containerName, tamperCase.sql),
        { allowFailure: true, stdio: "pipe" },
      );
      assertExpectedPsqlFailure(expectedFailure, tamperCase.expectedFailure);
      executeDockerSync(buildPsqlCommandArgs(containerName, VERIFY_FAILED_PREFLIGHT_SQL), {
        stdio: "inherit",
      });
      console.log(`Fail-closed tamper passed: ${tamperCase.label}`);
    }

    executeDockerSync(
      buildPsqlFileArgs(containerName, HARDENING_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(buildPsqlCommandArgs(containerName, CAPTURE_HARDENED_STATE_SQL), {
      stdio: "inherit",
    });

    executeDockerSync(buildPsqlCommandArgs(containerName, SEED_REAPPLY_DRIFT_SQL), {
      stdio: "inherit",
    });
    executeDockerSync(
      buildPsqlFileArgs(containerName, HARDENING_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );
    executeDockerSync(
      buildPsqlFileArgs(containerName, HARDENING_MIGRATION_SQL_PATH, {
        singleTransaction: true,
      }),
      { stdio: "inherit" },
    );

    executeDockerSync(buildPsqlFileArgs(containerName, ASSERTIONS_SQL_PATH), {
      stdio: "inherit",
    });
    console.log("Recovered surface ACL PostgreSQL 17.6 contract passed.");
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
          `Removed owned recovered surface ACL contract container: ${containerName} (${createdContainerId})`,
        );
      }
    } catch (error) {
      cleanupError = error;
    }
  }

  if (contractError && cleanupError) {
    throw new AggregateError(
      [contractError, cleanupError],
      "Recovered surface ACL database contract and owned-container cleanup both failed",
    );
  }
  if (contractError) throw contractError;
  if (cleanupError) throw cleanupError;
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  runRecoveredSurfaceAclDatabaseContract().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
