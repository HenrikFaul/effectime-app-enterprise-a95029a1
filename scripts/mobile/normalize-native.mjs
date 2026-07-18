import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const requestedPlatform = process.argv[2] ?? "all";

if (!new Set(["all", "android", "ios"]).has(requestedPlatform)) {
  throw new Error(`Unsupported native platform: ${requestedPlatform}`);
}

if (requestedPlatform === "all" || requestedPlatform === "ios") {
  const manifestPath = resolve(repositoryRoot, "ios/App/CapApp-SPM/Package.swift");
  if (!existsSync(manifestPath)) throw new Error("iOS Swift package manifest is missing.");

  const source = readFileSync(manifestPath, "utf8");
  const normalized = source.replace(
    /(path\s*:\s*")([^"]+)(")/g,
    (_match, prefix, packagePath, suffix) =>
      `${prefix}${packagePath.replaceAll("\\", "/")}${suffix}`,
  );

  if (/(?:path\s*:\s*")[^"]*\\/.test(normalized)) {
    throw new Error("iOS Swift package paths still contain platform-specific separators.");
  }
  if (normalized !== source) writeFileSync(manifestPath, normalized, "utf8");
}

console.log(`[mobile-normalize] PASS: ${requestedPlatform} native sources are deterministic.`);
