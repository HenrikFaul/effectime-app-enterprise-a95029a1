import {
  EFFECTIME_EDGE_SOURCE_SHA256_HEADER,
  EFFECTIME_RELEASE_SHA_ENV,
  EFFECTIME_RELEASE_SHA_HEADER,
  effectimeReleaseHeaders,
  readEffectimeReleaseIdentity,
  resolveEffectimeReleaseIdentity,
} from "./release-identity.ts";
import { EFFECTIME_EDGE_SOURCE_TREE_SHA256 } from "./release-artifact.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("release identity accepts only a full Git SHA and normalizes its case", () => {
  const uppercaseSha = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";
  const release = resolveEffectimeReleaseIdentity(uppercaseSha);

  assertEquals(release, {
    sha: uppercaseSha.toLowerCase(),
    sourceTreeSha256: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
    status: "identified",
  });
  assertEquals(effectimeReleaseHeaders(release), {
    [EFFECTIME_EDGE_SOURCE_SHA256_HEADER]: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
    [EFFECTIME_RELEASE_SHA_HEADER]: uppercaseSha.toLowerCase(),
  });
});

Deno.test("release identity fails closed without exposing malformed environment values", () => {
  for (const value of [
    undefined,
    null,
    "",
    "a".repeat(39),
    "a".repeat(41),
    "g".repeat(40),
    ` ${"a".repeat(40)}`,
    `${"a".repeat(40)}\n`,
  ]) {
    const release = resolveEffectimeReleaseIdentity(value);
    assertEquals(release, {
      sha: null,
      sourceTreeSha256: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
      status: "unknown",
    });
    assertEquals(effectimeReleaseHeaders(release), {
      [EFFECTIME_EDGE_SOURCE_SHA256_HEADER]: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
    });
  }
});

Deno.test("release identity reads only the documented Edge environment key", () => {
  const requestedNames: string[] = [];
  const release = readEffectimeReleaseIdentity((name) => {
    requestedNames.push(name);
    return "0".repeat(40);
  });

  assertEquals(requestedNames, [EFFECTIME_RELEASE_SHA_ENV]);
  assertEquals(release, {
    sha: "0".repeat(40),
    sourceTreeSha256: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
    status: "identified",
  });
});

Deno.test("release identity always exposes a lower-hex immutable Edge source hash", () => {
  if (!/^[0-9a-f]{64}$/.test(EFFECTIME_EDGE_SOURCE_TREE_SHA256)) {
    throw new Error("Edge source identity must be a lower-hex SHA-256 digest");
  }

  assertEquals(
    resolveEffectimeReleaseIdentity(undefined).sourceTreeSha256,
    EFFECTIME_EDGE_SOURCE_TREE_SHA256,
  );
});
