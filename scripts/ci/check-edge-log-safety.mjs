import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const piiSensitiveFunctions = [
  "supabase/functions/auth-email-hook/index.ts",
  "supabase/functions/send-transactional-email/index.ts",
];
const rawConsolePattern = /\bconsole\.(?:debug|info|log|warn|error)\s*\(/g;

const findings = [];

for (const relativePath of piiSensitiveFunctions) {
  const source = readFileSync(resolve(repositoryRoot, relativePath), "utf8");
  for (const match of source.matchAll(rawConsolePattern)) {
    findings.push({
      path: relativePath,
      line: source.slice(0, match.index).split(/\r?\n/).length,
    });
  }

  if (!source.includes("createStructuredLogger")) {
    findings.push({ path: relativePath, line: 1, reason: "structured logger is not wired" });
  }
}

if (findings.length > 0) {
  console.error("[edge-log-safety] Raw console logging or missing logger integration detected:");
  for (const finding of findings) {
    console.error(
      `  - ${finding.path}:${finding.line}${finding.reason ? ` (${finding.reason})` : ""}`,
    );
  }
  process.exit(1);
}

console.log(
  `[edge-log-safety] PASS: ${piiSensitiveFunctions.length} PII-sensitive functions use only the structured logger.`,
);
