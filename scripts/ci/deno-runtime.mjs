import { readFileSync } from "node:fs";

const diagnosticBaselineUrl = new URL("./edge-diagnostics-baseline.json", import.meta.url);
const diagnosticBaseline = JSON.parse(readFileSync(diagnosticBaselineUrl, "utf8"));

if (!/^\d+\.\d+\.\d+$/.test(diagnosticBaseline.denoVersion ?? "")) {
  throw new Error(
    "scripts/ci/edge-diagnostics-baseline.json must define an exact denoVersion.",
  );
}

export const DENO_VERSION = diagnosticBaseline.denoVersion;

export function buildDenoInvocation({
  configuredBin,
  nativeDenoAvailable,
  npmExecPath,
  nodeExecutable,
  platform,
}) {
  if (configuredBin) return { command: configuredBin, prefix: [], shell: false };
  if (nativeDenoAvailable) return { command: "deno", prefix: [], shell: false };

  if (npmExecPath) {
    if (!nodeExecutable) throw new Error("nodeExecutable is required with npmExecPath.");
    return {
      command: nodeExecutable,
      prefix: [
        npmExecPath,
        "exec",
        "--yes",
        "--package",
        `deno@${DENO_VERSION}`,
        "--",
        "deno",
      ],
      shell: false,
    };
  }

  return {
    command: "npx",
    prefix: ["--yes", `deno@${DENO_VERSION}`],
    shell: platform === "win32",
  };
}

export function parseDenoVersion(output) {
  return output?.match(/^deno\s+(\d+\.\d+\.\d+)/m)?.[1] ?? null;
}
