import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, "../..");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const outputPath = resolve(
  repositoryRoot,
  outputArgument?.slice("--output=".length) || "artifacts/release-manifest.json",
);
const requireClean = process.argv.includes("--require-clean");

function git(args, fallback = null) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function fileRecord(path) {
  if (!existsSync(path)) return { exists: false };
  const content = readFileSync(path);
  return { exists: true, bytes: content.length, sha256: sha256(content) };
}

function requiredCycloneDxRecord(path, expectedScope) {
  const record = fileRecord(path);
  if (!record.exists) throw new Error(`Required release SBOM is missing: ${relative(repositoryRoot, path)}`);

  const sbom = JSON.parse(readFileSync(path, "utf8"));
  const properties = sbom.metadata?.properties ?? sbom.metadata?.component?.properties ?? [];
  const scope = properties.find((property) => property.name === "effectime:sbom-scope")?.value;
  if (sbom.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components)) {
    throw new Error(`Required release SBOM is malformed: ${relative(repositoryRoot, path)}`);
  }
  if (scope !== expectedScope) {
    throw new Error(
      `Required release SBOM has scope ${scope ?? "<missing>"}; expected ${expectedScope}`,
    );
  }
  return record;
}

function listFiles(directory, predicate = () => true) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, predicate));
    if (entry.isFile() && predicate(path)) files.push(path);
  }
  return files;
}

function treeRecord(directory, predicate = () => true) {
  const files = listFiles(directory, predicate);
  const aggregate = createHash("sha256");
  let bytes = 0;
  for (const path of files) {
    const content = readFileSync(path);
    const name = relative(directory, path).replaceAll("\\", "/");
    bytes += content.length;
    aggregate.update(name).update("\0").update(sha256(content)).update("\0");
  }
  return {
    exists: existsSync(directory),
    files: files.length,
    bytes,
    sha256: files.length > 0 ? aggregate.digest("hex") : null,
  };
}

const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(resolve(repositoryRoot, "package-lock.json"), "utf8"));
const gitStatus = git(["status", "--porcelain=v1", "--untracked-files=all"], "");
const dirty = gitStatus.length > 0;
if (requireClean && dirty) {
  console.error("[release-manifest] Refusing to attest a dirty working tree.");
  process.exit(1);
}

const migrationsDirectory = resolve(repositoryRoot, "supabase/migrations");
const migrationFiles = listFiles(migrationsDirectory, (path) => path.endsWith(".sql"));
const edgeFunctionsDirectory = resolve(repositoryRoot, "supabase/functions");
const edgeFunctionNames = readdirSync(edgeFunctionsDirectory, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name !== "_shared" &&
      existsSync(resolve(edgeFunctionsDirectory, entry.name, "index.ts")),
  )
  .map((entry) => entry.name)
  .sort();
const webSbom = requiredCycloneDxRecord(
  resolve(repositoryRoot, "artifacts/web-sbom.cdx.json"),
  "web-mobile-node-package-lock-dependencies",
);
const edgeSbom = requiredCycloneDxRecord(
  resolve(repositoryRoot, "artifacts/edge-sbom.cdx.json"),
  "edge-deno-runtime-dependencies",
);
const webDist = treeRecord(resolve(repositoryRoot, "dist"));
if (!webDist.exists || webDist.files === 0 || !webDist.sha256) {
  throw new Error("Required tested web distribution is missing or empty: dist");
}
const mobileDist = treeRecord(resolve(repositoryRoot, "dist-mobile"));
if (!mobileDist.exists || mobileDist.files === 0 || !mobileDist.sha256) {
  throw new Error("Required tested mobile distribution is missing or empty: dist-mobile");
}

const mobilePackageNames = [
  "@aparajita/capacitor-secure-storage",
  "@capacitor/android",
  "@capacitor/app",
  "@capacitor/browser",
  "@capacitor/cli",
  "@capacitor/core",
  "@capacitor/ios",
];
const mobileDependencies = Object.fromEntries(
  mobilePackageNames.map((name) => {
    const locked = packageLock.packages?.[`node_modules/${name}`] ?? {};
    return [name, { version: locked.version ?? null, integrity: locked.integrity ?? null }];
  }),
);
const iosResolvedCandidates = [
  "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
  "ios/App/CapApp-SPM/Package.resolved",
];
const iosResolvedPath = iosResolvedCandidates.find((path) =>
  existsSync(resolve(repositoryRoot, path)),
);

const manifest = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  application: {
    name: packageJson.name,
    version: packageJson.version,
  },
  source: {
    repository: process.env.GITHUB_REPOSITORY || null,
    sha: process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]),
    ref: process.env.GITHUB_REF || git(["symbolic-ref", "--short", "HEAD"]),
    tag: git(["tag", "--points-at", "HEAD"], "").split(/\r?\n/).filter(Boolean)[0] || null,
    dirty,
  },
  ci: {
    provider: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
    workflow: process.env.GITHUB_WORKFLOW || null,
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    actor: process.env.GITHUB_ACTOR || null,
  },
  toolchain: {
    node: process.version,
    packageManager: packageJson.packageManager || null,
    lockfileVersion: packageLock.lockfileVersion,
  },
  artifacts: {
    packageLock: fileRecord(resolve(repositoryRoot, "package-lock.json")),
    webSbom,
    edgeSbom,
    webDist,
    mobileDist,
  },
  mobile: {
    appId: "app.effectime",
    dependencies: mobileDependencies,
    capacitorConfig: fileRecord(resolve(repositoryRoot, "capacitor.config.ts")),
    androidGradleWrapper: fileRecord(
      resolve(repositoryRoot, "android/gradle/wrapper/gradle-wrapper.properties"),
    ),
    iosSwiftPackage: fileRecord(resolve(repositoryRoot, "ios/App/CapApp-SPM/Package.swift")),
    iosPackageResolved: {
      path: iosResolvedPath ?? null,
      ...fileRecord(resolve(repositoryRoot, iosResolvedPath ?? iosResolvedCandidates[0])),
    },
  },
  database: {
    migrations: {
      count: migrationFiles.length,
      first: migrationFiles.length > 0 ? migrationFiles[0].split(/[\\/]/).at(-1) : null,
      last: migrationFiles.length > 0 ? migrationFiles.at(-1).split(/[\\/]/).at(-1) : null,
      tree: treeRecord(migrationsDirectory, (path) => path.endsWith(".sql")),
    },
  },
  edgeFunctions: {
    count: edgeFunctionNames.length,
    names: edgeFunctionNames,
    tree: treeRecord(edgeFunctionsDirectory, (path) => /\.(?:ts|tsx|json|lock)$/.test(path)),
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp-${process.pid}`;
writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
if (existsSync(outputPath)) unlinkSync(outputPath);
renameSync(temporaryPath, outputPath);

const outputStat = statSync(outputPath);
console.log(
  `[release-manifest] Wrote ${relative(repositoryRoot, outputPath)} (${outputStat.size} bytes) for ${manifest.source.sha}.`,
);
