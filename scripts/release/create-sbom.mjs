import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const outputPath = resolve(
  repositoryRoot,
  outputArgument?.slice("--output=".length) || "artifacts/web-sbom.cdx.json",
);
const npmArguments = [
  "sbom",
  "--package-lock-only",
  "--sbom-format=cyclonedx",
  "--sbom-type=application",
];
const npmCli = process.env.npm_execpath;

const result = spawnSync(
  npmCli ? process.execPath : "npm",
  npmCli ? [npmCli, ...npmArguments] : npmArguments,
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: !npmCli && process.platform === "win32",
    windowsHide: true,
  },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || "npm sbom failed without diagnostics\n");
  process.exit(result.status ?? 1);
}

const sbom = JSON.parse(result.stdout);
if (sbom.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components)) {
  throw new Error("npm returned a malformed CycloneDX SBOM");
}
sbom.metadata ??= {};
sbom.metadata.properties = [
  ...(sbom.metadata.properties ?? []).filter(
    (property) =>
      property.name !== "effectime:sbom-scope" && property.name !== "effectime:sbom-coverage",
  ),
  { name: "effectime:sbom-scope", value: "web-mobile-node-package-lock-dependencies" },
  {
    name: "effectime:sbom-coverage",
    value:
      "Shared web/mobile Node dependencies represented by package-lock.json, including Capacitor packages; excludes Supabase Edge Deno graphs and native OS/SDK components.",
  },
].sort((left, right) => left.name.localeCompare(right.name));

mkdirSync(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp-${process.pid}`;
writeFileSync(temporaryPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
if (existsSync(outputPath)) unlinkSync(outputPath);
renameSync(temporaryPath, outputPath);

console.log(
  `[release-web-sbom] Wrote ${relative(repositoryRoot, outputPath)} with ${sbom.components.length} components.`,
);
