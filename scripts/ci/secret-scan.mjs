import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const detectors = [
  ["private-key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["slack-token", /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g],
  ["stripe-live-key", /\bsk_live_[0-9A-Za-z]{20,}\b/g],
  ["openai-api-key", /\bsk-(?:proj-)?[0-9A-Za-z_-]{32,}\b/g],
  ["anthropic-api-key", /\bsk-ant-[0-9A-Za-z_-]{32,}\b/g],
  ["supabase-secret-key", /\bsb_secret_[0-9A-Za-z_-]{20,}\b/g],
];
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

const ignoredPaths = [/^scripts\/ci\/secret-scan\.mjs$/];
const forbiddenSigningFiles = [
  /(?:^|\/)[^/]+\.(?:jks|keystore|p12|mobileprovision)$/i,
  /(?:^|\/)AuthKey_[^/]+\.p8$/i,
];

function repositoryFiles() {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean);
}

function isProbablyBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8_192);
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

const findings = [];
let scannedFiles = 0;

for (const relativePath of repositoryFiles()) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (ignoredPaths.some((pattern) => pattern.test(normalizedPath))) continue;
  if (forbiddenSigningFiles.some((pattern) => pattern.test(normalizedPath))) {
    findings.push({ detector: "mobile-signing-secret-file", path: normalizedPath, line: 1 });
    continue;
  }

  const absolutePath = resolve(repositoryRoot, relativePath);
  let size;
  try {
    size = statSync(absolutePath).size;
  } catch {
    continue;
  }
  if (size > MAX_FILE_BYTES) continue;

  const buffer = readFileSync(absolutePath);
  if (isProbablyBinary(buffer)) continue;
  const source = buffer.toString("utf8");
  scannedFiles += 1;

  for (const [detector, pattern] of detectors) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      findings.push({ detector, path: normalizedPath, line });
    }
  }

  JWT_PATTERN.lastIndex = 0;
  for (const match of source.matchAll(JWT_PATTERN)) {
    if (decodeJwtPayload(match[0])?.role !== "service_role") continue;
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    findings.push({ detector: "supabase-service-role-jwt", path: normalizedPath, line });
  }
}

if (findings.length > 0) {
  console.error(`[secret-scan] Found ${findings.length} high-confidence secret candidate(s):`);
  for (const finding of findings) {
    console.error(`  - ${finding.path}:${finding.line} (${finding.detector})`);
  }
  console.error("[secret-scan] Values are intentionally omitted from output.");
  process.exit(1);
}

console.log(
  `[secret-scan] PASS: scanned ${scannedFiles} tracked and untracked repository text files.`,
);
