import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  computeDistributionArtifactFingerprint,
  createArtifactFingerprint,
  createPublicReleaseManifest,
  normalizeArtifactSha256,
  normalizeReleaseSha,
  resolveReleaseSha,
  resolveReleaseSourceIdentity,
  validatePublicReleaseManifest,
} from "./release-identity.mjs";

const SHA_A = "A".repeat(40);
const SHA_B = "b".repeat(40);
const ARTIFACT = createArtifactFingerprint([
  { path: "index.html", content: "<main>Effectime</main>" },
  { path: "assets/app.js", content: "console.log('effectime')" },
]);

test("normalizes an exact Git commit SHA", () => {
  assert.equal(normalizeReleaseSha(` ${SHA_A} `), "a".repeat(40));
});

test("normalizes an exact artifact SHA-256", () => {
  assert.equal(normalizeArtifactSha256(` ${"A".repeat(64)} `), "a".repeat(64));
});

test("rejects malformed artifact SHA-256", () => {
  assert.throws(() => normalizeArtifactSha256("a".repeat(63)), /64-character hexadecimal/);
});

for (const invalid of [undefined, null, "", "abc", "g".repeat(40), "a".repeat(39), "a".repeat(41)]) {
  test(`rejects malformed release SHA ${String(invalid)}`, () => {
    assert.throws(() => normalizeReleaseSha(invalid), /40-character hexadecimal/);
  });
}

test("requires an attributable SHA in CI", () => {
  assert.throws(
    () => resolveReleaseSha({ env: { CI: "true" }, gitHead: () => SHA_A }),
    /CI builds require/,
  );
});

test("rejects conflicting CI and deployment SHAs", () => {
  assert.throws(
    () =>
      resolveReleaseSha({
        env: { CI: "true", GITHUB_SHA: SHA_A, EFFECTIME_RELEASE_SHA: SHA_B },
        gitHead: () => null,
      }),
    /different commits/,
  );
});

test("uses Git HEAD only for attributable local builds", () => {
  assert.equal(resolveReleaseSha({ env: {}, gitHead: () => SHA_A }), "a".repeat(40));
});

test("rejects an asserted SHA that does not match the checkout HEAD", () => {
  assert.throws(
    () =>
      resolveReleaseSha({
        env: { EFFECTIME_RELEASE_SHA: SHA_A },
        gitHead: () => SHA_B,
      }),
    /does not match Git HEAD/,
  );
});

test("marks dirty development artifacts as non-attestable", () => {
  assert.deepEqual(
    resolveReleaseSourceIdentity({
      env: {},
      gitHead: () => SHA_A,
      gitStatus: () => " M src/example.ts",
    }),
    { sha: "a".repeat(40), dirty: true, attestable: false },
  );
});

test("artifact fingerprint is deterministic and locale-independent by relative path", () => {
  const forward = createArtifactFingerprint([
    { path: "z-last.txt", content: "last" },
    { path: "assets/a-first.js", content: "first" },
  ]);
  const reverse = createArtifactFingerprint([
    { path: "assets/a-first.js", content: "first" },
    { path: "z-last.txt", content: "last" },
  ]);

  assert.deepEqual(forward, reverse);
  assert.match(forward.sha256, /^[0-9a-f]{64}$/);
  assert.equal(forward.files, 2);
  assert.equal(forward.bytes, Buffer.byteLength("lastfirst"));
});

test("distribution fingerprint excludes only its own public release manifest", () => {
  const directory = mkdtempSync(join(tmpdir(), "effectime-release-fingerprint-"));
  try {
    mkdirSync(join(directory, "assets"), { recursive: true });
    mkdirSync(join(directory, ".well-known"), { recursive: true });
    writeFileSync(join(directory, "index.html"), "index-v1");
    writeFileSync(join(directory, "assets", "app.js"), "app-v1");
    writeFileSync(join(directory, ".well-known", "effectime-release.json"), "manifest-v1");
    const first = computeDistributionArtifactFingerprint(directory);

    writeFileSync(join(directory, ".well-known", "effectime-release.json"), "manifest-v2");
    const onlyManifestChanged = computeDistributionArtifactFingerprint(directory);
    assert.deepEqual(onlyManifestChanged, first);

    writeFileSync(join(directory, "assets", "app.js"), "app-v2");
    const applicationChanged = computeDistributionArtifactFingerprint(directory);
    assert.notEqual(applicationChanged.sha256, first.sha256);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("creates a deterministic public release manifest", () => {
  const first = createPublicReleaseManifest({
    application: "effectime",
    version: "1.2.3",
    sha: SHA_A,
    artifact: ARTIFACT,
  });
  const second = createPublicReleaseManifest({
    application: "effectime",
    version: "1.2.3",
    sha: SHA_A,
    artifact: ARTIFACT,
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first.source, {
    sha: "a".repeat(40),
    shortSha: "a".repeat(12),
    dirty: false,
    attestable: true,
  });
  assert.equal(JSON.stringify(first).includes("generatedAt"), false);
});

test("makes dirty state explicit in the public manifest", () => {
  const manifest = createPublicReleaseManifest({
    application: "effectime",
    version: "1.2.3",
    sha: SHA_A,
    dirty: true,
    artifact: ARTIFACT,
  });
  assert.equal(manifest.source.dirty, true);
  assert.equal(manifest.source.attestable, false);
});

test("validates an exact clean public artifact identity", () => {
  const manifest = createPublicReleaseManifest({
    application: "effectime",
    version: "1.2.3",
    sha: SHA_A,
    artifact: ARTIFACT,
  });
  assert.deepEqual(
    validatePublicReleaseManifest(manifest, {
      application: "effectime",
      version: "1.2.3",
      sha: SHA_A,
      artifactSha256: ARTIFACT.sha256,
      artifactFiles: ARTIFACT.files,
      artifactBytes: ARTIFACT.bytes,
      requireAttestable: true,
    }),
    { sha: "a".repeat(40), dirty: false, attestable: true, artifact: ARTIFACT },
  );
});

test("rejects a reused dirty artifact in a clean release evidence run", () => {
  const dirtyArtifact = createPublicReleaseManifest({
    application: "effectime",
    version: "1.2.3",
    sha: SHA_A,
    dirty: true,
    artifact: ARTIFACT,
  });
  assert.throws(
    () =>
      validatePublicReleaseManifest(dirtyArtifact, {
        application: "effectime",
        version: "1.2.3",
        sha: SHA_A,
        artifactSha256: ARTIFACT.sha256,
        requireAttestable: true,
      }),
    /dirty worktree.*not attestable/,
  );
});

test("rejects malformed or internally inconsistent public artifact metadata", () => {
  const manifest = createPublicReleaseManifest({
    application: "effectime",
    version: "1.2.3",
    sha: SHA_A,
    artifact: ARTIFACT,
  });
  const options = {
    application: "effectime",
    version: "1.2.3",
    sha: SHA_A,
    artifactSha256: ARTIFACT.sha256,
  };

  assert.throws(
    () => validatePublicReleaseManifest({ ...manifest, schemaVersion: 2 }, options),
    /unsupported schemaVersion/,
  );
  assert.throws(
    () =>
      validatePublicReleaseManifest(
        { ...manifest, source: { ...manifest.source, shortSha: "b".repeat(12) } },
        options,
      ),
    /inconsistent short SHA/,
  );
  assert.throws(
    () =>
      validatePublicReleaseManifest(
        { ...manifest, source: { ...manifest.source, dirty: true, attestable: true } },
        options,
      ),
    /inconsistent dirty and attestable/,
  );
  assert.throws(
    () =>
      validatePublicReleaseManifest(manifest, {
        ...options,
        artifactSha256: "c".repeat(64),
      }),
    /artifact SHA-256 .* does not match/,
  );
  assert.throws(
    () =>
      validatePublicReleaseManifest(
        { ...manifest, artifact: { ...manifest.artifact, inventoryFormat: "other" } },
        options,
      ),
    /malformed inventory contract/,
  );
});
