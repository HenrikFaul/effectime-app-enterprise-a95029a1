import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

export const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
export const RELEASE_ARTIFACT_SHA256_PATTERN = /^[0-9a-f]{64}$/;
export const PUBLIC_RELEASE_MANIFEST_PATH = ".well-known/effectime-release.json";
export const RELEASE_ARTIFACT_INVENTORY_FORMAT = "relative-path-nul-file-sha256-nul-v1";
export const MAX_RELEASE_ARTIFACT_FILES = 4096;
export const MAX_RELEASE_ARTIFACT_BYTES = 512 * 1024 * 1024;
export const MAX_RELEASE_ARTIFACT_FILE_BYTES = 128 * 1024 * 1024;
const PROVIDER_CONTROL_PATHS = new Set(["_headers", "_redirects"]);

export function normalizeReleaseSha(value, label = "release SHA") {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a 40-character hexadecimal Git commit SHA.`);
  }

  const normalized = value.trim().toLowerCase();
  if (!RELEASE_SHA_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a 40-character hexadecimal Git commit SHA.`);
  }

  return normalized;
}

export function normalizeArtifactSha256(value, label = "artifact SHA-256") {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a 64-character hexadecimal SHA-256 digest.`);
  }

  const normalized = value.trim().toLowerCase();
  if (!RELEASE_ARTIFACT_SHA256_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a 64-character hexadecimal SHA-256 digest.`);
  }

  return normalized;
}

function normalizeInventoryPath(value) {
  if (typeof value !== "string") throw new Error("Artifact inventory paths must be strings.");
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized) ||
    /[\0?#]/.test(normalized) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Artifact inventory path must be a normalized relative path: ${value}`);
  }
  return normalized;
}

function verificationForPath(path) {
  return PROVIDER_CONTROL_PATHS.has(path) ? "provider-control" : "http";
}

function fingerprintInventoryRecords(records, label = "artifact inventory") {
  if (!Array.isArray(records) || records.length < 1 || records.length > MAX_RELEASE_ARTIFACT_FILES) {
    throw new Error(
      `${label} must contain between 1 and ${MAX_RELEASE_ARTIFACT_FILES} file records.`,
    );
  }
  const inventory = records
    .map((record) => {
      if (!record || typeof record !== "object") throw new Error(`${label} records must be objects.`);
      const path = normalizeInventoryPath(record.path);
      if (
        !Number.isSafeInteger(record.bytes) ||
        record.bytes < 0 ||
        record.bytes > MAX_RELEASE_ARTIFACT_FILE_BYTES
      ) {
        throw new Error(`${label} has an invalid byte count for ${path}.`);
      }
      const verification = verificationForPath(path);
      if (record.verification !== undefined && record.verification !== verification) {
        throw new Error(`${label} has an invalid verification mode for ${path}.`);
      }
      return Object.freeze({
        path,
        bytes: record.bytes,
        sha256: normalizeArtifactSha256(record.sha256, `${label} ${path} SHA-256`),
        verification,
      });
    })
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const aggregate = createHash("sha256");
  let bytes = 0;
  for (let index = 0; index < inventory.length; index += 1) {
    const item = inventory[index];
    if (index > 0 && inventory[index - 1].path === item.path) {
      throw new Error(`${label} contains duplicate path ${item.path}.`);
    }
    bytes += item.bytes;
    if (bytes > MAX_RELEASE_ARTIFACT_BYTES) {
      throw new Error(`${label} exceeds the ${MAX_RELEASE_ARTIFACT_BYTES} byte safety limit.`);
    }
    aggregate.update(item.path).update("\0").update(item.sha256).update("\0");
  }

  return {
    inventory: Object.freeze(inventory),
    files: inventory.length,
    bytes,
    sha256: aggregate.digest("hex"),
  };
}

function contentBytes(content) {
  if (typeof content === "string") return Buffer.from(content, "utf8");
  if (content instanceof Uint8Array) return content;
  throw new Error("Artifact inventory content must be a string or Uint8Array.");
}

/**
 * Hashes a deterministic inventory, not a concatenated archive. Every item is
 * represented as `relative path + NUL + lowercase file SHA-256 + NUL` after a
 * locale-independent path sort.
 */
export function createArtifactFingerprint(entries) {
  if (!entries || typeof entries[Symbol.iterator] !== "function") {
    throw new Error("Artifact inventory entries must be iterable.");
  }

  const inventory = Array.from(entries, (entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Artifact inventory entries must be objects.");
    }
    const path = normalizeInventoryPath(entry.path);
    const content = contentBytes(entry.content);
    return {
      path,
      bytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      verification: verificationForPath(path),
    };
  });
  const fingerprint = fingerprintInventoryRecords(inventory);

  return Object.freeze({
    algorithm: "sha256",
    inventoryFormat: RELEASE_ARTIFACT_INVENTORY_FORMAT,
    excluded: Object.freeze([PUBLIC_RELEASE_MANIFEST_PATH]),
    inventory: fingerprint.inventory,
    files: fingerprint.files,
    bytes: fingerprint.bytes,
    sha256: fingerprint.sha256,
  });
}

function listDistributionFiles(directory, currentDirectory = directory) {
  const entries = [];
  for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
    const absolutePath = resolve(currentDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Release distributions must not contain symbolic links: ${absolutePath}`);
    }
    if (entry.isDirectory()) {
      entries.push(...listDistributionFiles(directory, absolutePath));
    } else if (entry.isFile()) {
      const path = relative(directory, absolutePath).replaceAll("\\", "/");
      if (path !== PUBLIC_RELEASE_MANIFEST_PATH) {
        entries.push({ path, content: readFileSync(absolutePath) });
      }
    }
  }
  return entries;
}

export function computeDistributionArtifactFingerprint(distributionDirectory) {
  const absoluteDirectory = resolve(distributionDirectory);
  if (!existsSync(absoluteDirectory)) {
    throw new Error(`Release distribution does not exist: ${absoluteDirectory}`);
  }
  return createArtifactFingerprint(listDistributionFiles(absoluteDirectory));
}

function normalizeArtifactFingerprint(candidate, label = "artifact fingerprint") {
  if (!candidate || typeof candidate !== "object") {
    throw new Error(`${label} must be an object.`);
  }
  if (
    candidate.algorithm !== "sha256" ||
    candidate.inventoryFormat !== RELEASE_ARTIFACT_INVENTORY_FORMAT ||
    !Array.isArray(candidate.excluded) ||
    candidate.excluded.length !== 1 ||
    candidate.excluded[0] !== PUBLIC_RELEASE_MANIFEST_PATH ||
    !Array.isArray(candidate.inventory)
  ) {
    throw new Error(`${label} has an unsupported or malformed inventory contract.`);
  }

  const fingerprint = fingerprintInventoryRecords(candidate.inventory, `${label} inventory`);
  const candidateSha256 = normalizeArtifactSha256(candidate.sha256, `${label} digest`);
  if (
    candidate.files !== fingerprint.files ||
    candidate.bytes !== fingerprint.bytes ||
    candidateSha256 !== fingerprint.sha256
  ) {
    throw new Error(`${label} does not match its file inventory.`);
  }

  return Object.freeze({
    algorithm: "sha256",
    inventoryFormat: RELEASE_ARTIFACT_INVENTORY_FORMAT,
    excluded: Object.freeze([PUBLIC_RELEASE_MANIFEST_PATH]),
    inventory: fingerprint.inventory,
    files: fingerprint.files,
    bytes: fingerprint.bytes,
    sha256: fingerprint.sha256,
  });
}

function readGitHead(repositoryRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readGitStatus(repositoryRoot) {
  try {
    return execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("Unable to inspect the Git worktree for release attribution.");
  }
}

export function resolveReleaseSha({
  env = process.env,
  repositoryRoot = process.cwd(),
  gitHead = () => readGitHead(repositoryRoot),
} = {}) {
  const explicitSha = env.EFFECTIME_RELEASE_SHA?.trim() || null;
  const githubSha = env.GITHUB_SHA?.trim() || null;
  const isCi = env.CI === "true" || env.GITHUB_ACTIONS === "true";

  if (isCi && !explicitSha && !githubSha) {
    throw new Error(
      "CI builds require EFFECTIME_RELEASE_SHA or GITHUB_SHA; refusing an unattributed artifact.",
    );
  }

  const normalizedExplicit = explicitSha
    ? normalizeReleaseSha(explicitSha, "EFFECTIME_RELEASE_SHA")
    : null;
  const normalizedGithub = githubSha ? normalizeReleaseSha(githubSha, "GITHUB_SHA") : null;

  if (normalizedExplicit && normalizedGithub && normalizedExplicit !== normalizedGithub) {
    throw new Error("EFFECTIME_RELEASE_SHA and GITHUB_SHA identify different commits.");
  }

  const localHead = gitHead();
  if (!localHead) {
    throw new Error(
      "Release attribution requires a Git checkout with a readable HEAD.",
    );
  }
  const normalizedHead = normalizeReleaseSha(localHead, "Git HEAD");
  const resolved = normalizedExplicit ?? normalizedGithub ?? normalizedHead;
  if (resolved !== normalizedHead) {
    throw new Error(`Resolved release SHA ${resolved} does not match Git HEAD ${normalizedHead}.`);
  }
  return resolved;
}

export function resolveReleaseSourceIdentity({
  env = process.env,
  repositoryRoot = process.cwd(),
  gitHead = () => readGitHead(repositoryRoot),
  gitStatus = () => readGitStatus(repositoryRoot),
} = {}) {
  const sha = resolveReleaseSha({ env, repositoryRoot, gitHead });
  const dirty = gitStatus().trim().length > 0;
  return Object.freeze({ sha, dirty, attestable: !dirty });
}

export function createPublicReleaseManifest({
  application,
  version,
  sha,
  dirty = false,
  artifact,
}) {
  if (typeof application !== "string" || application.trim().length === 0) {
    throw new Error("Release application name is required.");
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("Release application version is required.");
  }

  const normalizedSha = normalizeReleaseSha(sha);
  if (typeof dirty !== "boolean") throw new Error("Release dirty state must be boolean.");
  return {
    schemaVersion: 1,
    application: application.trim(),
    version: version.trim(),
    source: {
      sha: normalizedSha,
      shortSha: normalizedSha.slice(0, 12),
      dirty,
      attestable: !dirty,
    },
    artifact: normalizeArtifactFingerprint(artifact, "release artifact fingerprint"),
  };
}

export function writePublicReleaseManifest({
  distributionDirectory,
  application,
  version,
  sha,
  dirty = false,
}) {
  const absoluteDirectory = resolve(distributionDirectory);
  const artifact = computeDistributionArtifactFingerprint(absoluteDirectory);
  const manifest = createPublicReleaseManifest({ application, version, sha, dirty, artifact });
  const manifestPath = resolve(absoluteDirectory, PUBLIC_RELEASE_MANIFEST_PATH);
  const temporaryPath = `${manifestPath}.tmp-${process.pid}-${randomUUID()}`;
  mkdirSync(dirname(manifestPath), { recursive: true });
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    try {
      renameSync(temporaryPath, manifestPath);
    } catch (error) {
      // POSIX rename replaces atomically. Windows does not always replace an
      // existing file; Vite normally empties outDir, while this fallback keeps
      // repeat builds correct without ever writing a partial target file.
      if (error?.code !== "EEXIST" && error?.code !== "EPERM") throw error;
      rmSync(manifestPath, { force: true });
      renameSync(temporaryPath, manifestPath);
    }
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return manifest;
}

export function validatePublicReleaseManifest(
  candidate,
  {
    application,
    version,
    sha,
    artifactSha256,
    artifactFiles,
    artifactBytes,
    requireAttestable = false,
    label = "public release manifest",
  },
) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error(`${label} must be a JSON object.`);
  }
  if (candidate.schemaVersion !== 1) {
    throw new Error(`${label} has unsupported schemaVersion ${String(candidate.schemaVersion)}.`);
  }
  if (candidate.application !== application || candidate.version !== version) {
    throw new Error(`${label} does not identify ${application}@${version}.`);
  }

  const expectedSha = normalizeReleaseSha(sha, "expected release SHA");
  const artifactSha = normalizeReleaseSha(candidate.source?.sha, `${label} source SHA`);
  if (artifactSha !== expectedSha) {
    throw new Error(`${label} source SHA ${artifactSha} does not match ${expectedSha}.`);
  }
  if (candidate.source?.shortSha !== artifactSha.slice(0, 12)) {
    throw new Error(`${label} has an inconsistent short SHA.`);
  }
  if (
    typeof candidate.source?.dirty !== "boolean" ||
    typeof candidate.source?.attestable !== "boolean"
  ) {
    throw new Error(`${label} must declare boolean dirty and attestable states.`);
  }
  if (candidate.source.attestable !== !candidate.source.dirty) {
    throw new Error(`${label} has inconsistent dirty and attestable states.`);
  }
  if (requireAttestable && !candidate.source.attestable) {
    throw new Error(`${label} was built from a dirty worktree and is not attestable.`);
  }

  const artifact = normalizeArtifactFingerprint(candidate.artifact, `${label} artifact`);
  const expectedArtifactSha256 = normalizeArtifactSha256(
    artifactSha256,
    "expected artifact SHA-256",
  );
  if (artifact.sha256 !== expectedArtifactSha256) {
    throw new Error(
      `${label} artifact SHA-256 ${artifact.sha256} does not match ${expectedArtifactSha256}.`,
    );
  }
  if (artifactFiles !== undefined && artifact.files !== artifactFiles) {
    throw new Error(`${label} artifact file count does not match the tested distribution.`);
  }
  if (artifactBytes !== undefined && artifact.bytes !== artifactBytes) {
    throw new Error(`${label} artifact byte count does not match the tested distribution.`);
  }

  return Object.freeze({
    sha: artifactSha,
    dirty: candidate.source.dirty,
    attestable: candidate.source.attestable,
    artifact,
  });
}
