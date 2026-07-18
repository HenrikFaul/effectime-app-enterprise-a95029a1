import { EFFECTIME_EDGE_SOURCE_TREE_SHA256 } from "./release-artifact.ts";

export const EFFECTIME_RELEASE_SHA_ENV = "EFFECTIME_RELEASE_SHA";
export const EFFECTIME_RELEASE_SHA_HEADER = "X-Effectime-Release-SHA";
export const EFFECTIME_EDGE_SOURCE_SHA256_HEADER = "X-Effectime-Edge-Source-SHA256";

export type EffectimeReleaseIdentity = Readonly<
  | {
      sha: string;
      sourceTreeSha256: typeof EFFECTIME_EDGE_SOURCE_TREE_SHA256;
      status: "identified";
    }
  | {
      sha: null;
      sourceTreeSha256: typeof EFFECTIME_EDGE_SOURCE_TREE_SHA256;
      status: "unknown";
    }
>;

const FULL_GIT_SHA_PATTERN = /^[0-9a-fA-F]{40}$/;

/**
 * Convert an exact, full Git commit SHA into the public release identity.
 *
 * Whitespace, abbreviated SHAs and non-hex values deliberately fail closed.
 * The raw environment value must never be logged by callers.
 */
export function resolveEffectimeReleaseIdentity(
  rawReleaseSha: string | null | undefined,
): EffectimeReleaseIdentity {
  if (typeof rawReleaseSha !== "string" || !FULL_GIT_SHA_PATTERN.test(rawReleaseSha)) {
    return {
      sha: null,
      sourceTreeSha256: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
      status: "unknown",
    };
  }

  return {
    sha: rawReleaseSha.toLowerCase(),
    sourceTreeSha256: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
    status: "identified",
  };
}

export function readEffectimeReleaseIdentity(
  readEnvironment: (name: string) => string | undefined = (name) => Deno.env.get(name),
): EffectimeReleaseIdentity {
  return resolveEffectimeReleaseIdentity(readEnvironment(EFFECTIME_RELEASE_SHA_ENV));
}

export function effectimeReleaseHeaders(release: EffectimeReleaseIdentity): Record<string, string> {
  const headers = {
    [EFFECTIME_EDGE_SOURCE_SHA256_HEADER]: release.sourceTreeSha256,
  };
  return release.status === "identified"
    ? { ...headers, [EFFECTIME_RELEASE_SHA_HEADER]: release.sha }
    : headers;
}
