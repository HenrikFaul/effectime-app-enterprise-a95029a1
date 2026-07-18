import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDenoInvocation,
  DENO_VERSION,
  parseDenoVersion,
} from "./deno-runtime.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "../..");
const functionsRoot = resolve(repositoryRoot, "supabase/functions");

function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function posixPath(path) {
  return path.replaceAll("\\", "/");
}

export function discoverEdgeTestFiles(
  root,
  readDirectory = (directory) => readdirSync(directory, { withFileTypes: true }),
) {
  const discovered = [];

  function visit(directory) {
    const entries = [...readDirectory(directory)].sort((left, right) =>
      lexicalCompare(left.name, right.name)
    );
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".test.ts")) discovered.push(path);
    }
  }

  visit(resolve(root));
  return discovered.sort((left, right) =>
    lexicalCompare(posixPath(relative(root, left)), posixPath(relative(root, right)))
  );
}

export function buildDenoTestArguments(root, testFiles) {
  if (!Array.isArray(testFiles) || testFiles.length === 0) {
    throw new Error("No Edge Deno test files found under supabase/functions.");
  }

  const absoluteRoot = resolve(root);
  const relativeFiles = testFiles.map((file) => {
    const absoluteFile = resolve(isAbsolute(file) ? file : resolve(absoluteRoot, file));
    const relativeFile = relative(absoluteRoot, absoluteFile);
    if (
      !relativeFile ||
      relativeFile === ".." ||
      relativeFile.startsWith(`..${sep}`) ||
      isAbsolute(relativeFile)
    ) {
      throw new Error(`Edge test path escapes the repository root: ${file}`);
    }
    if (!relativeFile.endsWith(".test.ts")) {
      throw new Error(`Edge test path does not end in .test.ts: ${file}`);
    }
    return posixPath(relativeFile);
  });

  return [
    "test",
    "--node-modules-dir=none",
    "--no-lock",
    ...[...new Set(relativeFiles)].sort(lexicalCompare),
  ];
}

export function buildDenoTestCommand(invocation, testArguments) {
  return {
    command: invocation.command,
    args: [...invocation.prefix, ...testArguments],
    shell: invocation.shell,
  };
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

export function runEdgeTests() {
  const testFiles = discoverEdgeTestFiles(functionsRoot);
  const testArguments = buildDenoTestArguments(repositoryRoot, testFiles);
  const invocation = resolveDenoInvocation();

  const versionResult = run(invocation.command, [...invocation.prefix, "--version"], {
    encoding: "utf8",
    env: { ...process.env, DENO_NO_UPDATE_CHECK: "1", NO_COLOR: "1" },
    shell: invocation.shell,
    timeout: 30_000,
  });
  if (versionResult.error) {
    throw new Error(`Could not determine Deno version: ${versionResult.error.message}`);
  }
  const actualVersion = parseDenoVersion(versionResult.stdout);
  if (versionResult.status !== 0 || actualVersion !== DENO_VERSION) {
    throw new Error(`Deno ${DENO_VERSION} is required; found ${actualVersion ?? "unknown"}.`);
  }

  console.log(
    `[edge-test] Running ${testFiles.length} discovered test file(s) with Deno ${actualVersion}.`,
  );
  for (const file of testArguments.slice(3)) console.log(`[edge-test] - ${file}`);

  const command = buildDenoTestCommand(invocation, testArguments);
  const result = run(command.command, command.args, {
    env: { ...process.env, DENO_NO_UPDATE_CHECK: "1" },
    shell: command.shell,
    stdio: "inherit",
  });
  if (result.error) throw new Error(`Could not run Edge Deno tests: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `Edge Deno tests ${result.signal ? `terminated by ${result.signal}` : `failed with exit code ${result.status}`}.`,
    );
  }
  console.log(`[edge-test] PASS: ${testFiles.length} discovered test file(s).`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    runEdgeTests();
  } catch (error) {
    console.error(`[edge-test] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
