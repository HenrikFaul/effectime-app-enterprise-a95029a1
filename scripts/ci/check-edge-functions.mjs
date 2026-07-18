import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateDiagnosticRatchet,
  evaluateUnpinnedImportRatchet,
  parseDenoDiagnostics,
  reportedDenoErrorCount,
  validateDiagnosticBaseline,
} from "./edge-diagnostic-ratchet.mjs";
import {
  buildDenoInvocation,
  DENO_VERSION,
  parseDenoVersion,
} from "./deno-runtime.mjs";
import { collectRemoteImportSpecifiers } from "./edge-import-inventory.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, "../..");
const functionsRoot = resolve(repositoryRoot, "supabase/functions");
const configPath = resolve(repositoryRoot, "supabase/config.toml");
const superadminHubPath = resolve(functionsRoot, "superadmin-hub/index.ts");
const diagnosticBaselinePath = resolve(scriptDir, "edge-diagnostics-baseline.json");
const inventoryOnly = process.argv.includes("--inventory-only");
const ratchet = process.argv.includes("--ratchet");
const timeoutArgument = process.argv.find((argument) => argument.startsWith("--timeout-ms="));
const timeoutMs = timeoutArgument ? Number(timeoutArgument.split("=")[1]) : 10 * 60 * 1_000;

function fail(message) {
  console.error(`[edge-check] ${message}`);
  process.exit(1);
}

function emitRatchet(event, details = {}) {
  console.log(`[edge-ratchet] ${JSON.stringify({ event, ...details })}`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    windowsHide: true,
    ...options,
  });
}

function resolveDenoInvocation() {
  const configured = process.env.DENO_BIN;
  const installed = configured ? null : run("deno", ["--version"], { encoding: "utf8" });
  return buildDenoInvocation({
    configuredBin: configured,
    nativeDenoAvailable: Boolean(installed && !installed.error && installed.status === 0),
    npmExecPath: process.env.npm_execpath,
    nodeExecutable: process.execPath,
    platform: process.platform,
  });
}

function posixPath(path) {
  return path.replaceAll("\\", "/");
}

function walkSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSourceFiles(path));
    if (entry.isFile() && /\.(?:ts|tsx|json)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function hasExactVersion(specifier) {
  if (specifier.startsWith("npm:")) {
    const packageSpecifier = specifier
      .slice(4)
      .split("/")
      .slice(0, specifier.startsWith("npm:@") ? 2 : 1)
      .join("/");
    const versionSeparator = packageSpecifier.lastIndexOf("@");
    if (versionSeparator <= 0) return false;
    return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(
      packageSpecifier.slice(versionSeparator + 1),
    );
  }

  const match = specifier.match(/@([^/@]+)(?:\/|$)/g)?.at(-1);
  if (!match) return false;
  return /^@v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\/?$/.test(match);
}

if (!existsSync(functionsRoot) || !existsSync(configPath)) {
  fail("Supabase functions or supabase/config.toml is missing.");
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
  fail("--timeout-ms must be a number of at least 1000.");
}
if (inventoryOnly && ratchet) fail("--inventory-only and --ratchet cannot be combined.");

const functionNames = readdirSync(functionsRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name !== "_shared" &&
      existsSync(resolve(functionsRoot, entry.name, "index.ts")),
  )
  .map((entry) => entry.name)
  .sort();

const config = readFileSync(configPath, "utf8");
const registered = [...config.matchAll(/^\[functions\.([^\]]+)\]/gm)]
  .map((match) => match[1])
  .sort();
const missingRegistrations = functionNames.filter((name) => !registered.includes(name));
const staleRegistrations = registered.filter(
  (name) => !existsSync(resolve(functionsRoot, name, "index.ts")),
);

const superadminHubSource = readFileSync(superadminHubPath, "utf8");
const superadminInventoryBlock = superadminHubSource.match(
  /const knownFunctions = \[([\s\S]*?)\n\s*\]/u,
)?.[1];
if (!superadminInventoryBlock) {
  fail("Could not locate the superadmin platform-version function inventory.");
}
const superadminFunctionNames = [
  ...superadminInventoryBlock.matchAll(/^\s*['"]([^'"]+)['"],?\s*$/gmu),
].map((match) => match[1]);
const unparsedSuperadminInventory = superadminInventoryBlock
  .replace(/^\s*['"][^'"]+['"],?\s*$/gmu, "")
  .trim();
if (unparsedSuperadminInventory) {
  fail("The superadmin platform-version function inventory contains unparseable entries.");
}
const superadminInventoryDrift =
  JSON.stringify(superadminFunctionNames) !== JSON.stringify(functionNames);

const sourceFiles = walkSourceFiles(functionsRoot);
const remoteImports = [];
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const specifiers = collectRemoteImportSpecifiers(source);
  for (const specifier of specifiers) {
    remoteImports.push({ file: posixPath(relative(repositoryRoot, file)), specifier });
  }
}
const unpinnedImports = remoteImports.filter(({ specifier }) => !hasExactVersion(specifier));

console.log(
  `[edge-check] Inventory: ${functionNames.length} entrypoints, ${registered.length} config registrations, ${remoteImports.length} remote imports.`,
);
if (missingRegistrations.length > 0) {
  console.error(`[edge-check] Missing config registrations: ${missingRegistrations.join(", ")}`);
}
if (staleRegistrations.length > 0) {
  console.error(
    `[edge-check] Config registrations without index.ts: ${staleRegistrations.join(", ")}`,
  );
}
if (superadminInventoryDrift) {
  console.error(
    `[edge-check] Superadmin platform-version inventory drift: expected ${functionNames.join(", ")}; found ${superadminFunctionNames.join(", ")}`,
  );
}
if (unpinnedImports.length > 0) {
  console.warn(
    `[edge-check] ${unpinnedImports.length} imports are not pinned to an exact version:`,
  );
  for (const item of unpinnedImports.slice(0, 50)) {
    console.warn(`  - ${item.file}: ${item.specifier}`);
  }
  if (unpinnedImports.length > 50) console.warn("  - ... output truncated");
}

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  appendFileSync(
    summaryFile,
    [
      "## Supabase Edge Function check",
      "",
      `- Entrypoints: **${functionNames.length}**`,
      `- Registered in config: **${registered.length}**`,
      `- Missing registrations: **${missingRegistrations.length}**`,
      `- Stale registrations: **${staleRegistrations.length}**`,
      `- Superadmin inventory drift: **${superadminInventoryDrift ? "yes" : "no"}**`,
      `- Non-exact remote imports: **${unpinnedImports.length}**`,
      `- Deno type-check: **${inventoryOnly ? "not requested" : "see job result"}**`,
      "",
    ].join("\n"),
    "utf8",
  );
}

if (
  missingRegistrations.length > 0 ||
  staleRegistrations.length > 0 ||
  superadminInventoryDrift
) {
  process.exit(1);
}
if (inventoryOnly) {
  console.log("[edge-check] PASS: Edge inventory and Supabase registrations agree.");
  process.exit(0);
}

const denoInvocation = resolveDenoInvocation();
const entrypoints = functionNames.map((name) =>
  posixPath(relative(repositoryRoot, resolve(functionsRoot, name, "index.ts"))),
);

const versionResult = run(denoInvocation.command, [...denoInvocation.prefix, "--version"], {
  env: { ...process.env, DENO_NO_UPDATE_CHECK: "1", NO_COLOR: "1" },
  encoding: "utf8",
  timeout: 30_000,
  shell: denoInvocation.shell,
});
if (versionResult.error) {
  fail(`Could not determine Deno version: ${versionResult.error.message}`);
}
const actualVersion = parseDenoVersion(versionResult.stdout);
if (versionResult.status !== 0 || actualVersion !== DENO_VERSION) {
  fail(`Deno ${DENO_VERSION} is required; found ${actualVersion ?? "unknown"}.`);
}
console.log(`[edge-check] Deno runtime: ${actualVersion}.`);

let diagnosticBaseline;
if (ratchet) {
  if (!existsSync(diagnosticBaselinePath)) fail("Edge diagnostic baseline is missing.");
  try {
    diagnosticBaseline = JSON.parse(readFileSync(diagnosticBaselinePath, "utf8"));
  } catch (error) {
    fail(`Could not read Edge diagnostic baseline: ${error.message}`);
  }
  const baselineProblems = validateDiagnosticBaseline(diagnosticBaseline);
  if (baselineProblems.length > 0) {
    fail(`Invalid Edge diagnostic baseline: ${baselineProblems.join("; ")}`);
  }

  const newUnpinnedImports = evaluateUnpinnedImportRatchet({
    baseline: diagnosticBaseline,
    unpinnedImports,
  });
  emitRatchet("unpinned-imports", {
    actual: unpinnedImports.length,
    ceiling: diagnosticBaseline.allowedUnpinnedImports.length,
    new: newUnpinnedImports,
  });
  if (newUnpinnedImports.length > 0) {
    fail(
      `Found ${newUnpinnedImports.length} new unpinned import(s); pin exact versions or review the baseline.`,
    );
  }

  emitRatchet("runtime", { denoVersion: actualVersion });
}

const denoResult = run(
  denoInvocation.command,
  [
    ...denoInvocation.prefix,
    "check",
    "--node-modules-dir=none",
    "--no-lock",
    ...entrypoints,
  ],
  {
    env: { ...process.env, DENO_NO_UPDATE_CHECK: "1", ...(ratchet ? { NO_COLOR: "1" } : {}) },
    ...(ratchet ? { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 } : { stdio: "inherit" }),
    timeout: timeoutMs,
    shell: denoInvocation.shell,
  },
);

if (denoResult.error) {
  fail(
    denoResult.error.code === "ETIMEDOUT"
      ? `Deno check exceeded ${timeoutMs} ms.`
      : `Could not run Deno: ${denoResult.error.message}`,
  );
}
if (ratchet) {
  const denoOutput = `${denoResult.stdout ?? ""}\n${denoResult.stderr ?? ""}`;
  if (denoResult.status !== 0 && denoResult.status !== 1) {
    console.error(denoOutput.trim());
    fail(`Deno check terminated with unexpected exit code ${denoResult.status}.`);
  }

  const diagnostics = parseDenoDiagnostics(denoOutput, repositoryRoot);
  const reportedErrors = reportedDenoErrorCount(denoOutput);
  if (
    (denoResult.status === 1 && reportedErrors === null) ||
    (reportedErrors !== null && reportedErrors !== diagnostics.length)
  ) {
    console.error(denoOutput.trim());
    fail(
      `Could not account for Deno diagnostics (parsed ${diagnostics.length}, reported ${reportedErrors ?? "none"}).`,
    );
  }

  const result = evaluateDiagnosticRatchet({
    baseline: diagnosticBaseline,
    diagnostics,
    functionNames,
  });
  emitRatchet("summary", {
    actual: diagnostics.length,
    ceiling: diagnosticBaseline.totalErrorCeiling,
    modules: result.moduleCounts,
    files: result.fileCounts,
  });
  for (const violation of result.violations) emitRatchet("violation", violation);

  if (summaryFile) {
    const debtModules = Object.entries(diagnosticBaseline.moduleErrorCeilings).filter(
      ([, ceiling]) => ceiling > 0,
    );
    appendFileSync(
      summaryFile,
      [
        "### Diagnostic ratchet",
        "",
        `- Deno: **${diagnosticBaseline.denoVersion}**`,
        `- Diagnostics: **${diagnostics.length} / ${diagnosticBaseline.totalErrorCeiling}**`,
        `- Ratchet violations: **${result.violations.length}**`,
        "",
        "| Module | Current | Ceiling |",
        "| --- | ---: | ---: |",
        ...debtModules.map(
          ([module, ceiling]) => `| ${module} | ${result.moduleCounts[module] ?? 0} | ${ceiling} |`,
        ),
        "",
      ].join("\n"),
      "utf8",
    );
  }

  if (result.violations.length > 0) {
    console.error(denoOutput.trim());
    fail(`Edge diagnostic ratchet found ${result.violations.length} violation(s).`);
  }
  console.log(
    `[edge-check] PASS: ${diagnostics.length} known Deno diagnostics do not exceed the reviewed ceilings.`,
  );
  process.exit(0);
}
if (denoResult.status !== 0) {
  fail(`Deno check failed with exit code ${denoResult.status}.`);
}
console.log(`[edge-check] PASS: Deno checked ${entrypoints.length} entrypoints.`);
