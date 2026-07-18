import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, "../..");
const baselineArgument = process.argv.find((argument) => argument.startsWith("--baseline="));
const baselinePath = baselineArgument
  ? resolve(repositoryRoot, baselineArgument.slice("--baseline=".length))
  : resolve(scriptDir, "eslint-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

function fail(message) {
  console.error(`[eslint-ratchet] ${message}`);
  process.exit(1);
}

function runEslint() {
  const eslintCli = resolve(repositoryRoot, "node_modules/eslint/bin/eslint.js");
  if (!existsSync(eslintCli)) {
    fail("ESLint is not installed. Run npm ci before this check.");
  }

  const result = spawnSync(
    process.execPath,
    [eslintCli, ".", "--format", "json", "--no-error-on-unmatched-pattern"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    },
  );

  if (result.error) {
    fail(`Could not execute ESLint: ${result.error.message}`);
  }
  if (result.status !== 0 && result.status !== 1) {
    const diagnostics = result.stderr?.trim() || "No diagnostics were produced.";
    fail(`ESLint failed before producing a report (exit ${result.status}).\n${diagnostics}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    const diagnostics = result.stderr?.trim() || result.stdout?.slice(0, 1_000);
    fail(`ESLint did not return valid JSON: ${error.message}\n${diagnostics}`);
  }
}

function summarize(report) {
  const counts = new Map();
  const fileCounts = {};
  const fileFingerprints = {};
  let filesWithMessages = 0;
  let errors = 0;
  let warnings = 0;

  for (const file of report) {
    if (file.messages.length > 0) filesWithMessages += 1;
    const perFile = new Map();
    const perFileFingerprints = new Map();
    const sourceLines = existsSync(file.filePath)
      ? readFileSync(file.filePath, "utf8").split(/\r?\n/)
      : [];
    for (const message of file.messages) {
      const ruleId = message.ruleId || "<fatal-or-config>";
      const severity = message.severity === 2 || message.fatal ? "errors" : "warnings";
      const current = counts.get(ruleId) || { errors: 0, warnings: 0 };
      const currentFile = perFile.get(ruleId) || { errors: 0, warnings: 0 };
      current[severity] += 1;
      currentFile[severity] += 1;
      if (severity === "errors") {
        errors += 1;
      } else {
        warnings += 1;
      }
      counts.set(ruleId, current);
      perFile.set(ruleId, currentFile);

      const source = (sourceLines[(message.line ?? 1) - 1] ?? "").trim().replace(/\s+/g, " ");
      const fingerprint = createHash("sha256")
        .update(JSON.stringify([ruleId, severity, message.message, message.nodeType ?? "", source]))
        .digest("hex")
        .slice(0, 20);
      const currentFingerprint = perFileFingerprints.get(fingerprint) || {
        ruleId,
        severity,
        message: message.message,
        source,
        count: 0,
      };
      currentFingerprint.count += 1;
      perFileFingerprints.set(fingerprint, currentFingerprint);
    }
    if (perFile.size > 0) {
      const filePath = relative(repositoryRoot, file.filePath).replaceAll("\\", "/");
      fileCounts[filePath] = Object.fromEntries(
        [...perFile.entries()].sort(([left], [right]) => left.localeCompare(right)),
      );
      fileFingerprints[filePath] = Object.fromEntries(
        [...perFileFingerprints.entries()].sort(([left], [right]) => left.localeCompare(right)),
      );
    }
  }

  return {
    filesChecked: report.length,
    filesWithMessages,
    totals: { errors, warnings },
    counts: Object.fromEntries(
      [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
    fileCounts: Object.fromEntries(
      Object.entries(fileCounts).sort(([left], [right]) => left.localeCompare(right)),
    ),
    fileFingerprints: Object.fromEntries(
      Object.entries(fileFingerprints).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function baselineFrom(summary) {
  return {
    schemaVersion: 3,
    purpose:
      "Existing ESLint diagnostic fingerprint ceiling. CI fails on new findings and requires baseline reduction when findings are fixed.",
    command: "eslint . --format json",
    totals: summary.totals,
    counts: summary.counts,
    fileCounts: summary.fileCounts,
    fileFingerprints: summary.fileFingerprints,
  };
}

function appendStepSummary(summary, regressions, improvements) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const lines = [
    "## ESLint debt ratchet",
    "",
    `- Current: **${summary.totals.errors} errors**, **${summary.totals.warnings} warnings**`,
    `- Files with findings: **${summary.filesWithMessages}/${summary.filesChecked}**`,
    `- New/increased diagnostic fingerprints: **${regressions.length}**`,
    `- Removed/decreased diagnostic fingerprints: **${improvements.length}**`,
    "",
  ];

  if (regressions.length > 0) {
    lines.push("### Regressions", "", ...regressions.map((item) => `- ${item}`), "");
  }
  if (improvements.length > 0) {
    lines.push(
      "### Improvements available for baseline reduction",
      "",
      ...improvements.slice(0, 30).map((item) => `- ${item}`),
      "",
    );
  }

  appendFileSync(summaryFile, `${lines.join("\n")}\n`, "utf8");
}

const summary = summarize(runEslint());

if (updateBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(baselineFrom(summary), null, 2)}\n`, "utf8");
  console.log(
    `[eslint-ratchet] Updated ${baselinePath} (${summary.totals.errors} errors, ${summary.totals.warnings} warnings).`,
  );
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  fail(
    "Baseline is missing. Review the current lint report, then run this script with --update-baseline.",
  );
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
if (
  baseline.schemaVersion !== 3 ||
  typeof baseline.fileCounts !== "object" ||
  typeof baseline.fileFingerprints !== "object"
) {
  fail("Unsupported or malformed ESLint baseline.");
}

const regressions = [];
const improvements = [];

const files = new Set([
  ...Object.keys(baseline.fileFingerprints),
  ...Object.keys(summary.fileFingerprints),
]);
for (const filePath of [...files].sort()) {
  const allowedFingerprints = baseline.fileFingerprints[filePath] || {};
  const currentFingerprints = summary.fileFingerprints[filePath] || {};
  const fingerprints = new Set([
    ...Object.keys(allowedFingerprints),
    ...Object.keys(currentFingerprints),
  ]);
  for (const fingerprint of [...fingerprints].sort()) {
    const allowed = allowedFingerprints[fingerprint];
    const current = currentFingerprints[fingerprint];
    const allowedCount = allowed?.count ?? 0;
    const currentCount = current?.count ?? 0;
    const diagnostic = current ?? allowed;
    const delta = currentCount - allowedCount;
    const bucket = `\`${filePath}\` · \`${diagnostic.ruleId}\` ${diagnostic.severity} · \`${fingerprint}\``;
    if (delta > 0) {
      regressions.push(`${bucket}: ${currentCount} > ${allowedCount} (+${delta})`);
    } else if (delta < 0) {
      improvements.push(`${bucket}: ${currentCount} < ${allowedCount} (${delta})`);
    }
  }
}

console.log(
  `[eslint-ratchet] Current: ${summary.totals.errors} errors, ${summary.totals.warnings} warnings across ${summary.filesWithMessages} files.`,
);
appendStepSummary(summary, regressions, improvements);

if (regressions.length > 0) {
  console.error("[eslint-ratchet] New lint debt detected:");
  for (const regression of regressions) console.error(`  - ${regression.replaceAll("`", "")}`);
  console.error(
    "[eslint-ratchet] Fix the regression. Update the baseline only after a reviewed rule/config change.",
  );
  process.exit(1);
}

if (improvements.length > 0) {
  console.error(
    `[eslint-ratchet] ${improvements.length} diagnostic fingerprints improved. Regenerate and review the baseline so fixed debt cannot return.`,
  );
  process.exit(1);
}
console.log("[eslint-ratchet] PASS: the diagnostic fingerprint baseline is unchanged.");
