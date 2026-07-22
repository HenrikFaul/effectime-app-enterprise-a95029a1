import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATION_PROVENANCE_MANIFEST =
  "scripts/ci/remote-migration-provenance.json";

export const EXPECTED_RECOVERED_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: "20260514124827",
    name: "v3_22_0_clock_in_engine",
    bytes: 12227,
    sha256: "89a2752acd0403f998ca987827f0a0ef6a8cffaadb21a78f6ddac02603a080f1",
  }),
  Object.freeze({
    version: "20260514194031",
    name: "v3_30_0_plugin_marketplace",
    bytes: 14451,
    sha256: "b9652205609fa1f274281db86741c19637f8442d513ae325087c29bd94f663b4",
  }),
]);

const ROOT_KEYS = Object.freeze(["algorithm", "migrations", "schemaVersion"]);
const ENTRY_KEYS = Object.freeze(["bytes", "name", "path", "sha256", "version"]);
const VERSION_PATTERN = /^[0-9]{14}$/u;
const NAME_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = resolve(scriptDirectory, "../..");

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(
      `${label} keys must be exactly: ${expectedKeys.join(", ")}; found: ${actualKeys.join(", ") || "none"}`,
    );
  }
}

export function parseRecoveredMigrationManifest(source) {
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Migration provenance manifest is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }

  assertPlainObject(manifest, "Migration provenance manifest");
  assertExactKeys(manifest, ROOT_KEYS, "Migration provenance manifest");
  if (manifest.schemaVersion !== 1) {
    throw new Error("Migration provenance schemaVersion must equal 1");
  }
  if (manifest.algorithm !== "sha256") {
    throw new Error('Migration provenance algorithm must equal "sha256"');
  }
  if (!Array.isArray(manifest.migrations)) {
    throw new Error("Migration provenance migrations must be an array");
  }

  const identities = [];
  for (const [index, entry] of manifest.migrations.entries()) {
    const label = `Migration provenance entry ${index + 1}`;
    assertPlainObject(entry, label);
    assertExactKeys(entry, ENTRY_KEYS, label);
    if (!VERSION_PATTERN.test(entry.version)) {
      throw new Error(`${label} version must contain exactly 14 digits`);
    }
    if (!NAME_PATTERN.test(entry.name)) {
      throw new Error(`${label} name is invalid`);
    }
    const expectedPath = `supabase/migrations/${entry.version}_${entry.name}.sql`;
    if (entry.path !== expectedPath || entry.path.includes("\\")) {
      throw new Error(`${label} path must equal ${expectedPath}`);
    }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1) {
      throw new Error(`${label} bytes must be a positive safe integer`);
    }
    if (!SHA256_PATTERN.test(entry.sha256)) {
      throw new Error(`${label} sha256 must be 64 lowercase hexadecimal characters`);
    }
    identities.push(`${entry.version}_${entry.name}`);
  }

  const expectedIdentities = EXPECTED_RECOVERED_MIGRATIONS.map(
    ({ version, name }) => `${version}_${name}`,
  );
  if (
    identities.length !== expectedIdentities.length ||
    identities.some((identity, index) => identity !== expectedIdentities[index])
  ) {
    throw new Error(
      `Migration provenance entries must be the exact ordered recovery set: ${expectedIdentities.join(", ")}`,
    );
  }

  for (const [index, entry] of manifest.migrations.entries()) {
    const expected = EXPECTED_RECOVERED_MIGRATIONS[index];
    if (entry.bytes !== expected.bytes || entry.sha256 !== expected.sha256) {
      throw new Error(
        `Migration provenance entry ${index + 1} does not match the canonical recovery attestation`,
      );
    }
  }

  return manifest;
}

function assertContainedMigrationPath(repositoryRoot, entry) {
  const migrationsRoot = resolve(repositoryRoot, "supabase/migrations");
  const absolutePath = resolve(repositoryRoot, entry.path);
  const relativePath = relative(migrationsRoot, absolutePath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Recovered migration path escapes supabase/migrations: ${entry.path}`);
  }
  return absolutePath;
}

export async function verifyRecoveredMigrationProvenance({
  repositoryRoot = defaultRepositoryRoot,
  manifestPath = MIGRATION_PROVENANCE_MANIFEST,
} = {}) {
  const resolvedRepositoryRoot = resolve(repositoryRoot);
  const resolvedManifestPath = resolve(resolvedRepositoryRoot, manifestPath);
  let manifestSource;
  try {
    manifestSource = await readFile(resolvedManifestPath, "utf8");
  } catch (error) {
    throw new Error(
      `Unable to read migration provenance manifest ${manifestPath}: ${error instanceof Error ? error.message : error}`,
    );
  }
  const manifest = parseRecoveredMigrationManifest(manifestSource);

  let totalBytes = 0;
  for (const entry of manifest.migrations) {
    const absolutePath = assertContainedMigrationPath(resolvedRepositoryRoot, entry);
    let metadata;
    try {
      metadata = await lstat(absolutePath);
    } catch (error) {
      throw new Error(
        `Unable to read recovered migration ${entry.path}: ${error instanceof Error ? error.message : error}`,
      );
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Recovered migration must be a regular non-symlink file: ${entry.path}`);
    }
    let content;
    try {
      content = await readFile(absolutePath);
    } catch (error) {
      throw new Error(
        `Unable to read recovered migration ${entry.path}: ${error instanceof Error ? error.message : error}`,
      );
    }
    if (content.byteLength !== entry.bytes) {
      throw new Error(
        `Recovered migration byte drift for ${entry.path}: expected ${entry.bytes}, found ${content.byteLength}`,
      );
    }
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (sha256 !== entry.sha256) {
      throw new Error(
        `Recovered migration SHA-256 drift for ${entry.path}: expected ${entry.sha256}, found ${sha256}`,
      );
    }
    totalBytes += content.byteLength;
  }

  return Object.freeze({ files: manifest.migrations.length, bytes: totalBytes });
}

async function runCli() {
  if (process.argv.length > 2) {
    throw new Error(`Unsupported argument(s): ${process.argv.slice(2).join(", ")}`);
  }
  const result = await verifyRecoveredMigrationProvenance();
  process.stdout.write(
    `[migration-provenance] verified ${result.files} recovered migrations (${result.bytes} bytes).\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[migration-provenance] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
