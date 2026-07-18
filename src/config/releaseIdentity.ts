const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SOURCE_SHA256_PATTERN = /^[0-9a-f]{64}$/;

declare const releaseShaBrand: unique symbol;
declare const sourceSha256Brand: unique symbol;

export type ReleaseSha = string & { readonly [releaseShaBrand]: true };
export type SourceSha256 = string & { readonly [sourceSha256Brand]: true };

export type ReleaseIdentity =
  | {
      readonly sha: ReleaseSha;
      readonly sourceTreeSha256: SourceSha256;
      readonly status: 'identified';
    }
  | { readonly sha: null; readonly sourceTreeSha256: null; readonly status: 'unknown' };

export type ReleaseAlignment = 'match' | 'mismatch' | 'unknown';

const UNKNOWN_RELEASE_IDENTITY: ReleaseIdentity = Object.freeze({
  sha: null,
  sourceTreeSha256: null,
  status: 'unknown',
});

/**
 * Converts untrusted build/runtime metadata to the canonical release identity.
 *
 * Git object names are deliberately accepted only in their normalized,
 * lowercase 40-character form. Abbreviated, uppercase or decorated values
 * cannot be used for deployment attestation.
 */
export function parseReleaseIdentity(
  candidate: unknown,
  sourceTreeSha256: unknown,
): ReleaseIdentity {
  if (
    typeof candidate !== 'string' ||
    !RELEASE_SHA_PATTERN.test(candidate) ||
    typeof sourceTreeSha256 !== 'string' ||
    !SOURCE_SHA256_PATTERN.test(sourceTreeSha256)
  ) {
    return UNKNOWN_RELEASE_IDENTITY;
  }

  return Object.freeze({
    sha: candidate as ReleaseSha,
    sourceTreeSha256: sourceTreeSha256 as SourceSha256,
    status: 'identified',
  });
}

/** Reads the SHA injected by Vite without making a missing define crash the UI. */
export function getWebReleaseIdentity(): ReleaseIdentity {
  const attestable =
    typeof __EFFECTIME_RELEASE_ATTESTABLE__ === 'undefined'
      ? false
      : __EFFECTIME_RELEASE_ATTESTABLE__ === true;
  if (!attestable) return UNKNOWN_RELEASE_IDENTITY;

  const candidate =
    typeof __EFFECTIME_RELEASE_SHA__ === 'undefined'
      ? undefined
      : __EFFECTIME_RELEASE_SHA__;
  const sourceTreeSha256 =
    typeof __EFFECTIME_EDGE_SOURCE_SHA256__ === 'undefined'
      ? undefined
      : __EFFECTIME_EDGE_SOURCE_SHA256__;

  return parseReleaseIdentity(candidate, sourceTreeSha256);
}

/** Parses only the canonical, status-bearing Edge response. */
export function getEdgeReleaseIdentity(payload: unknown): ReleaseIdentity {
  if (!payload || typeof payload !== 'object') {
    return UNKNOWN_RELEASE_IDENTITY;
  }

  const record = payload as Record<string, unknown>;
  const release = record.release;
  if (release && typeof release === 'object') {
    const canonical = release as Record<string, unknown>;
    if (canonical.status !== 'identified') {
      return UNKNOWN_RELEASE_IDENTITY;
    }
    return parseReleaseIdentity(canonical.sha, canonical.sourceTreeSha256);
  }

  return UNKNOWN_RELEASE_IDENTITY;
}

export function compareReleaseIdentities(
  web: ReleaseIdentity,
  edge: ReleaseIdentity,
): ReleaseAlignment {
  if (web.status !== 'identified' || edge.status !== 'identified') {
    return 'unknown';
  }

  return web.sha === edge.sha && web.sourceTreeSha256 === edge.sourceTreeSha256
    ? 'match'
    : 'mismatch';
}
