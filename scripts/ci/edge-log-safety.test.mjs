import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  analyzeCleanupHandlerSource,
  analyzeStructuredLoggerSource,
  cleanupLogContracts,
  loadTypeScriptParser,
} from "./check-edge-log-safety.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const [createdIdentityContract, temporaryUserContract] = cleanupLogContracts;
const readRepositoryFile = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
const reasons = (findings) => findings.map((finding) => finding.reason).join("\n");

test("current cleanup handlers satisfy their AST-enforced log contracts", () => {
  for (const contract of cleanupLogContracts) {
    assert.deepEqual(analyzeCleanupHandlerSource(readRepositoryFile(contract.path), contract), []);
  }
});

test("cleanup contexts reject raw request, identity, endpoint, credential, error and result values", () => {
  const source = readRepositoryFile(createdIdentityContract.path);
  for (const unsafeValue of [
    "request.body",
    "body",
    "headers",
    "userId",
    "email",
    "supabaseUrl",
    "token",
    "secret",
    "error",
    "result",
  ]) {
    const mutated = source.replace('code: "invalid_server_configuration"', `code: ${unsafeValue}`);
    const findings = analyzeCleanupHandlerSource(mutated, createdIdentityContract);
    assert.match(reasons(findings), /exact safe aggregate\/correlation source/u, unsafeValue);
  }
});

test("cleanup contexts reject raw fields, context variables, spreads and widened types", () => {
  const source = readRepositoryFile(createdIdentityContract.path);
  const rawField = source.replace(
    "correlationId,\n        code:",
    "correlationId,\n        request: req,\n        code:",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(rawField, createdIdentityContract)),
    /not allowlisted: request/u,
  );

  const arbitraryContext = source.replace(
    '{\n        correlationId,\n        code: "invalid_server_configuration",\n      }',
    "result",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(arbitraryContext, createdIdentityContract)),
    /inline object literal/u,
  );

  const arbitrarySpread = source.replace(
    "code: executionErrorCode,\n        claimed: summary.claimed,",
    "code: executionErrorCode,\n        ...result,",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(arbitrarySpread, createdIdentityContract)),
    /spreads are forbidden/u,
  );

  const widenedType = source.replace(
    "receiptFailures?: number;\n};",
    "receiptFailures?: number;\n  email?: string;\n};",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(widenedType, createdIdentityContract)),
    /fields must be exactly/u,
  );
});

test("computed, optional, aliased and destructured logger or console sinks fail closed", () => {
  const source = readRepositoryFile(createdIdentityContract.path);
  for (const addition of [
    'logger["info"]("leak", { request: req });',
    'logger?.info("cleanup-created-identities.run-succeeded", { correlationId });',
    "const unsafeLog = logger.error; unsafeLog(req.headers);",
    "const { error: unsafeLog } = logger; unsafeLog(req.body);",
    'console["error"](config.serviceRoleKey);',
    "const rawSink = console.error; rawSink(secret);",
    "globalThis.console.error(config.serviceRoleKey);",
    "Deno.stderr.write(new TextEncoder().encode(config.serviceRoleKey));",
    "process.stdout.write(config.serviceRoleKey);",
  ]) {
    const findings = analyzeCleanupHandlerSource(
      `${source}\n${addition}\n`,
      createdIdentityContract,
    );
    assert.match(reasons(findings), /forbidden|may not be computed|may not be passed/u, addition);
  }

  const unsafeDefault = source.replace(
    "console.info(event, context)",
    "console.info(event, { context, secret: config.serviceRoleKey })",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(unsafeDefault, createdIdentityContract)),
    /defaultLogger\.info must only forward|raw console\.info/u,
  );
});

test("comments cannot satisfy events or create false console findings", () => {
  const source = readRepositoryFile(createdIdentityContract.path);
  const missingExecutableEvent = source
    .replace(
      'logger.info("cleanup-created-identities.overlap-skipped"',
      'logger.info("cleanup-created-identities.unreviewed-event"',
    )
    .concat(
      '\n// logger.info("cleanup-created-identities.overlap-skipped", { correlationId, code: "worker_overlap" });\n',
    );
  assert.match(
    reasons(analyzeCleanupHandlerSource(missingExecutableEvent, createdIdentityContract)),
    /required safe logger event is missing: cleanup-created-identities\.overlap-skipped/u,
  );

  const structured = `
    import { createStructuredLogger } from "../_shared/structured-logger.ts";
    const logger = createStructuredLogger({ service: "safe" });
    // console.log(email);
  `;
  assert.deepEqual(analyzeStructuredLoggerSource(structured), []);
});

test("aggregate and correlation aliases have verified assignment provenance", () => {
  const created = readRepositoryFile(createdIdentityContract.path);
  const headerCorrelation = created.replace(
    /const correlationId = \([\s\S]*?\n    \)\(\);/u,
    'const correlationId = req.headers.get("authorization") ?? "missing";',
  );
  assert.notEqual(headerCorrelation, created, "correlation mutation must apply");
  assert.match(
    reasons(analyzeCleanupHandlerSource(headerCorrelation, createdIdentityContract)),
    /bounded random correlation generator/u,
  );

  const rawErrorCode = created.replace(
    'executionErrorCode = "worker_deadline_exceeded";',
    'executionErrorCode = req.headers.get("authorization");',
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(rawErrorCode, createdIdentityContract)),
    /accepts only static codes or safeErrorCode/u,
  );

  const arbitrarySummary = created.replace(
    "summary.claimed = jobs.length;",
    "summary.claimed = result.total;",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(arbitrarySummary, createdIdentityContract)),
    /WorkerSummary write is not an allowlisted aggregate update/u,
  );

  const unsafeSanitizer = created.replace(
    'return error instanceof WorkerError ? error.code : "worker_execution_failed";',
    "return error.message;",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(unsafeSanitizer, createdIdentityContract)),
    /safeErrorCode may expose only/u,
  );

  const arbitraryPendingFloor = created.replace(
    "summary.claimed - summary.completed",
    "summary.claimed - result.total",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(arbitraryPendingFloor, createdIdentityContract)),
    /WorkerSummary write is not an allowlisted aggregate update/u,
  );

  const temporary = readRepositoryFile(temporaryUserContract.path).replace(
    "eligible += 1;",
    "eligible = result.total;",
  );
  assert.match(
    reasons(analyzeCleanupHandlerSource(temporary, temporaryUserContract)),
    /eligible accepts only bounded aggregate increments/u,
  );
});

test("structured logger wiring requires an executable exact import/call and rejects every console sink form", () => {
  const commentOnly = `
    // import { createStructuredLogger } from "../_shared/structured-logger.ts";
    // createStructuredLogger({ service: "fake" });
    console["log"](email);
  `;
  const findings = analyzeStructuredLoggerSource(commentOnly);
  assert.match(reasons(findings), /one exact named import/u);
  assert.match(reasons(findings), /must be called/u);
  assert.match(reasons(findings), /computed|raw console/u);

  const aliased = `
    import { createStructuredLogger } from "../_shared/structured-logger.ts";
    const logger = createStructuredLogger({ service: "safe" });
    const sink = console.error;
    sink(email);
  `;
  assert.match(reasons(analyzeStructuredLoggerSource(aliased)), /may not be computed/u);

  const unboundFactory = `
    import { createStructuredLogger } from "../_shared/structured-logger.ts";
    createStructuredLogger({ service: "unused" });
    const logger = customLogger;
  `;
  assert.match(
    reasons(analyzeStructuredLoggerSource(unboundFactory)),
    /one exact createStructuredLogger/u,
  );
});

test("missing TypeScript parser fails with an actionable lockfile-install instruction", () => {
  assert.throws(
    () =>
      loadTypeScriptParser(() => {
        throw new Error("MODULE_NOT_FOUND");
      }),
    /TypeScript parser unavailable; run `npm ci --no-audit --no-fund`/u,
  );
});

test("hosted edge-safety installs the lockfile before invoking the AST gate", () => {
  const workflow = readRepositoryFile(".github/workflows/quality.yml");
  const edgeSafety = workflow.slice(
    workflow.indexOf("  edge-safety:"),
    workflow.indexOf("  edge-check:"),
  );
  const install = edgeSafety.indexOf("npm ci --no-audit --no-fund");
  const gate = edgeSafety.indexOf("npm run edge:log-safety");
  assert(
    install >= 0 && gate > install,
    "edge-safety must install pinned dependencies before AST analysis",
  );
});
