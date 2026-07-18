import {
  EFFECTIME_EDGE_SOURCE_SHA256_HEADER,
  EFFECTIME_RELEASE_SHA_HEADER,
  effectimeReleaseHeaders,
  type EffectimeReleaseIdentity,
} from "./release-identity.ts";

export const EFFECTIME_RELEASE_EXPOSE_HEADERS =
  `${EFFECTIME_RELEASE_SHA_HEADER}, ${EFFECTIME_EDGE_SOURCE_SHA256_HEADER}`;

export function effectimeReleaseResponseHeaders(
  release: EffectimeReleaseIdentity,
  exposeHeaders = EFFECTIME_RELEASE_EXPOSE_HEADERS,
): Record<string, string> {
  return {
    "Access-Control-Expose-Headers": exposeHeaders,
    ...effectimeReleaseHeaders(release),
  };
}
