export const RELEASE_SHA_PATTERN: RegExp;
export const RELEASE_ARTIFACT_SHA256_PATTERN: RegExp;
export const PUBLIC_RELEASE_MANIFEST_PATH: ".well-known/effectime-release.json";
export const RELEASE_ARTIFACT_INVENTORY_FORMAT: "relative-path-nul-file-sha256-nul-v1";
export const MAX_RELEASE_ARTIFACT_FILES: number;
export const MAX_RELEASE_ARTIFACT_BYTES: number;
export const MAX_RELEASE_ARTIFACT_FILE_BYTES: number;

export function normalizeReleaseSha(value: unknown, label?: string): string;
export function normalizeArtifactSha256(value: unknown, label?: string): string;

export interface ReleaseArtifactFingerprint {
  algorithm: "sha256";
  inventoryFormat: "relative-path-nul-file-sha256-nul-v1";
  excluded: readonly [".well-known/effectime-release.json"];
  inventory: readonly Readonly<{
    path: string;
    bytes: number;
    sha256: string;
    verification: "http" | "provider-control";
  }>[];
  files: number;
  bytes: number;
  sha256: string;
}

export function createArtifactFingerprint(
  entries: Iterable<{ path: string; content: string | Uint8Array }>,
): Readonly<ReleaseArtifactFingerprint>;

export function computeDistributionArtifactFingerprint(
  distributionDirectory: string,
): Readonly<ReleaseArtifactFingerprint>;

export function resolveReleaseSha(options?: {
  env?: Record<string, string | undefined>;
  repositoryRoot?: string;
  gitHead?: () => string | null;
}): string;

export function resolveReleaseSourceIdentity(options?: {
  env?: Record<string, string | undefined>;
  repositoryRoot?: string;
  gitHead?: () => string | null;
  gitStatus?: () => string;
}): Readonly<{ sha: string; dirty: boolean; attestable: boolean }>;

export function createPublicReleaseManifest(options: {
  application: string;
  version: string;
  sha: string;
  dirty?: boolean;
  artifact: ReleaseArtifactFingerprint;
}): {
  schemaVersion: 1;
  application: string;
  version: string;
  source: { sha: string; shortSha: string; dirty: boolean; attestable: boolean };
  artifact: Readonly<ReleaseArtifactFingerprint>;
};

export function writePublicReleaseManifest(options: {
  distributionDirectory: string;
  application: string;
  version: string;
  sha: string;
  dirty?: boolean;
}): ReturnType<typeof createPublicReleaseManifest>;

export function validatePublicReleaseManifest(
  candidate: unknown,
  options: {
    application: string;
    version: string;
    sha: string;
    artifactSha256: string;
    artifactFiles?: number;
    artifactBytes?: number;
    requireAttestable?: boolean;
    label?: string;
  },
): Readonly<{
  sha: string;
  dirty: boolean;
  attestable: boolean;
  artifact: Readonly<ReleaseArtifactFingerprint>;
}>;
