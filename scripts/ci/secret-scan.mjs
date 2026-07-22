import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatSecretFinding,
  isForbiddenSigningPath,
  MAX_FILE_BYTES,
  normalizeRepositoryPath,
  scanSecretBuffer,
} from "./secret-scan-core.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function isolatedGitEnvironment() {
  const environment = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  for (const variable of [
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CEILING_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_DIR",
    "GIT_INDEX_FILE",
    "GIT_NAMESPACE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_WORK_TREE",
  ]) {
    delete environment[variable];
  }
  return environment;
}

function repositoryFiles() {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: isolatedGitEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
    .split("\0")
    .filter(Boolean);
}

const findings = [];
let scannedFiles = 0;

for (const relativePath of repositoryFiles()) {
  const normalizedPath = normalizeRepositoryPath(relativePath);
  if (isForbiddenSigningPath(normalizedPath)) {
    findings.push({ detector: "mobile-signing-secret-file", path: normalizedPath, line: 1 });
    continue;
  }

  const absolutePath = resolve(repositoryRoot, relativePath);
  let stats;
  try {
    stats = lstatSync(absolutePath);
  } catch {
    findings.push({ detector: "secret-scan-unreadable-file", path: normalizedPath, line: 1 });
    continue;
  }
  if (!stats.isFile() && !stats.isSymbolicLink()) {
    findings.push({ detector: "secret-scan-unsupported-file", path: normalizedPath, line: 1 });
    continue;
  }
  if (stats.size > MAX_FILE_BYTES) {
    findings.push({ detector: "secret-scan-size-limit", path: normalizedPath, line: 1 });
    continue;
  }

  let buffer;
  try {
    buffer = stats.isSymbolicLink()
      ? Buffer.from(readlinkSync(absolutePath), "utf8")
      : readFileSync(absolutePath);
  } catch {
    findings.push({ detector: "secret-scan-unreadable-file", path: normalizedPath, line: 1 });
    continue;
  }
  const result = scanSecretBuffer(buffer, normalizedPath);
  if (result.scanned) scannedFiles += 1;
  findings.push(...result.findings);
}

if (findings.length > 0) {
  console.error(`[secret-scan] Found ${findings.length} security finding(s):`);
  for (const finding of findings) {
    console.error(`  - ${formatSecretFinding(finding)}`);
  }
  console.error("[secret-scan] Values are intentionally omitted from output.");
  process.exit(1);
}

console.log(
  `[secret-scan] PASS: scanned ${scannedFiles} tracked and untracked repository text files.`,
);
