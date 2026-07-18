import assert from "node:assert/strict";
import test from "node:test";
import { createArtifactFingerprint, createPublicReleaseManifest } from "./release-identity.mjs";
import { verifyDeployment } from "./verify-deployment.mjs";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const EDGE_SOURCE_SHA256 = "d".repeat(64);
const OTHER_EDGE_SOURCE_SHA256 = "e".repeat(64);
const PROVIDER_DEPLOYMENT_ID = "deployment-123";
const WEB_INDEX_CONTENT = "<main>Effectime</main>";
const WEB_ARTIFACT = createArtifactFingerprint([
  { path: "index.html", content: WEB_INDEX_CONTENT },
]);
const OTHER_WEB_ARTIFACT_SHA256 = "c".repeat(64);

function webManifest({
  sha = SHA,
  dirty = false,
  application = "effectime-app-enterprise",
  version = "3.51.3",
  artifact = WEB_ARTIFACT,
} = {}) {
  return createPublicReleaseManifest({ application, version, sha, dirty, artifact });
}

function verify(options) {
  return verifyDeployment({
    expectedWebArtifactSha256: WEB_ARTIFACT.sha256,
    expectedProviderDeploymentId: PROVIDER_DEPLOYMENT_ID,
    expectedEdgeSourceSha256: EDGE_SOURCE_SHA256,
    expectedEdgeOrigin: "https://example.supabase.co",
    ...options,
  });
}

function jsonResponse(
  body,
  {
    status = 200,
    releaseHeader,
    edgeSourceHeader,
    deploymentId = PROVIDER_DEPLOYMENT_ID,
  } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (releaseHeader) headers.set("x-effectime-release-sha", releaseHeader);
  if (edgeSourceHeader) headers.set("x-effectime-edge-source-sha256", edgeSourceHeader);
  if (deploymentId) headers.set("x-deployment-id", deploymentId);
  return new Response(JSON.stringify(body), { status, headers });
}

function artifactResponse(content = WEB_INDEX_CONTENT, deploymentId = PROVIDER_DEPLOYMENT_ID) {
  return new Response(content, { headers: { "x-deployment-id": deploymentId } });
}

function matchingFetch(
  edgeBody = {
    data: {
      release: {
        sha: SHA,
        sourceTreeSha256: EDGE_SOURCE_SHA256,
        status: "identified",
      },
    },
  },
) {
  return async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("effectime_release"), SHA);
    if (parsed.pathname.endsWith("effectime-release.json")) {
      assert.equal(parsed.searchParams.get("effectime_web_artifact"), WEB_ARTIFACT.sha256);
      return jsonResponse(webManifest());
    }
    if (parsed.pathname === "/index.html") return artifactResponse();
    assert.equal(options.headers.Authorization, "Bearer test-key");
    return jsonResponse(edgeBody, {
      releaseHeader: SHA,
      edgeSourceHeader: EDGE_SOURCE_SHA256,
    });
  };
}

test("accepts the data.release Edge response shape when it identifies the expected commit", async () => {
  assert.deepEqual(
    await verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app/workspace",
      edgeUrl: "https://example.supabase.co/functions/v1/public-api/v1/health",
      edgeApiKey: "test-key",
      fetchImpl: matchingFetch(),
    }),
    {
      expectedSha: SHA,
      expectedWebArtifactSha256: WEB_ARTIFACT.sha256,
      webSha: SHA,
      webArtifactSha256: WEB_ARTIFACT.sha256,
      verifiedWebFiles: 1,
      providerDeploymentId: PROVIDER_DEPLOYMENT_ID,
      edgeSha: SHA,
      edgeSourceSha256: EDGE_SOURCE_SHA256,
    },
  );
});

test("accepts the top-level release Edge response shape when it identifies the expected commit", async () => {
  assert.deepEqual(
    await verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "https://example.supabase.co/functions/v1/superadmin-hub",
      edgeApiKey: "test-key",
      fetchImpl: matchingFetch({
        release: {
          sha: SHA,
          sourceTreeSha256: EDGE_SOURCE_SHA256,
          status: "identified",
        },
      }),
    }),
    {
      expectedSha: SHA,
      expectedWebArtifactSha256: WEB_ARTIFACT.sha256,
      webSha: SHA,
      webArtifactSha256: WEB_ARTIFACT.sha256,
      verifiedWebFiles: 1,
      providerDeploymentId: PROVIDER_DEPLOYMENT_ID,
      edgeSha: SHA,
      edgeSourceSha256: EDGE_SOURCE_SHA256,
    },
  );
});

test("fails closed when the web artifact identifies a different commit", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      fetchImpl: async () => jsonResponse(webManifest({ sha: OTHER_SHA })),
    }),
    /source SHA .* does not match/,
  );
});

test("requires the expected web artifact digest before making a request", async () => {
  let fetchCalled = false;
  await assert.rejects(
    verifyDeployment({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse(webManifest());
      },
    }),
    /expected web artifact SHA-256 must be a 64-character hexadecimal/,
  );
  assert.equal(fetchCalled, false);
});

test("fails closed when a same-commit web deployment has a different artifact digest", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      expectedWebArtifactSha256: OTHER_WEB_ARTIFACT_SHA256,
      webUrl: "https://effectime.app",
      fetchImpl: async () => jsonResponse(webManifest()),
    }),
    /artifact SHA-256 .* does not match/,
  );
});

test("requires a provider deployment ID for remote web verification", async () => {
  let fetchCalled = false;
  await assert.rejects(
    verifyDeployment({
      expectedSha: SHA,
      expectedWebArtifactSha256: WEB_ARTIFACT.sha256,
      webUrl: "https://effectime.app",
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse(webManifest());
      },
    }),
    /expectedProviderDeploymentId is required/,
  );
  assert.equal(fetchCalled, false);
});

test("fails closed when a declared live artifact file has stale bytes", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      fetchImpl: async (url) => {
        const path = new URL(url).pathname;
        if (path.endsWith("effectime-release.json")) return jsonResponse(webManifest());
        assert.equal(path, "/index.html");
        return artifactResponse("<main>Staletime</main>");
      },
    }),
    /index\.html SHA-256 mismatch/,
  );
});

test("fails closed when the provider deployment ID does not match retained evidence", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      fetchImpl: async () =>
        jsonResponse(webManifest(), { deploymentId: "different-deployment" }),
    }),
    /provider deployment ID mismatch/,
  );
});

for (const [label, body, expectedMessage] of [
  ["schema", { ...webManifest(), schemaVersion: 2 }, /unsupported schemaVersion/],
  ["application", webManifest({ application: "other-app" }), /does not identify/],
  ["version", webManifest({ version: "0.0.0" }), /does not identify/],
  ["dirty state", webManifest({ dirty: true }), /dirty worktree.*not attestable/],
  [
    "attestable state",
    { ...webManifest(), source: { ...webManifest().source, attestable: false } },
    /inconsistent dirty and attestable/,
  ],
]) {
  test(`fails closed on unexpected web manifest ${label}`, async () => {
    await assert.rejects(
      verify({
        expectedSha: SHA,
        webUrl: "https://effectime.app",
        fetchImpl: async () => jsonResponse(body),
      }),
      expectedMessage,
    );
  });
}

test("fails closed when Edge header and body do not match", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "https://example.supabase.co/functions/v1/public-api/v1/health",
      edgeApiKey: "test-key",
      fetchImpl: async (url) => {
        const path = new URL(url).pathname;
        if (path.endsWith("effectime-release.json")) return jsonResponse(webManifest());
        if (path === "/index.html") return artifactResponse();
        return jsonResponse(
          {
            data: {
              release: {
                sha: SHA,
                sourceTreeSha256: EDGE_SOURCE_SHA256,
                status: "identified",
              },
            },
          },
          { releaseHeader: OTHER_SHA, edgeSourceHeader: EDGE_SOURCE_SHA256 },
        );
      },
    }),
    /Edge release identity mismatch/,
  );
});

for (const [label, release] of [
  ["unknown", { sha: SHA, status: "unknown" }],
  ["missing", { sha: SHA }],
  ["malformed", { sha: SHA, status: 42 }],
]) {
  test(`rejects an Edge release with ${label} status`, async () => {
    await assert.rejects(
      verify({
        expectedSha: SHA,
        webUrl: "https://effectime.app",
        edgeUrl: "https://example.supabase.co/functions/v1/public-api/v1/health",
        edgeApiKey: "test-key",
        fetchImpl: matchingFetch({ data: { release } }),
      }),
      /status 'identified'.*valid release SHA and source-tree SHA-256/,
    );
  });
}

test("rejects an identified Edge release with a malformed SHA", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "https://example.supabase.co/functions/v1/public-api/v1/health",
      edgeApiKey: "test-key",
      fetchImpl: matchingFetch({
        data: {
          release: {
            sha: "not-a-commit",
            sourceTreeSha256: EDGE_SOURCE_SHA256,
            status: "identified",
          },
        },
      }),
    }),
    /status 'identified'.*valid release SHA and source-tree SHA-256/,
  );
});

test("rejects a stale Edge source tree even when the runtime SHA label matches", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "https://example.supabase.co/functions/v1/public-api/v1/health",
      edgeApiKey: "test-key",
      fetchImpl: matchingFetch({
        data: {
          release: {
            sha: SHA,
            sourceTreeSha256: OTHER_EDGE_SOURCE_SHA256,
            status: "identified",
          },
        },
      }),
    }),
    /Edge release identity mismatch/,
  );
});

test("rejects an Edge source-tree header that differs from the attested body", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "https://example.supabase.co/functions/v1/public-api/v1/health",
      edgeApiKey: "test-key",
      fetchImpl: async (url) => {
        const path = new URL(url).pathname;
        if (path.endsWith("effectime-release.json")) return jsonResponse(webManifest());
        if (path === "/index.html") return artifactResponse();
        return jsonResponse(
          {
            data: {
              release: {
                sha: SHA,
                sourceTreeSha256: EDGE_SOURCE_SHA256,
                status: "identified",
              },
            },
          },
          { releaseHeader: SHA, edgeSourceHeader: OTHER_EDGE_SOURCE_SHA256 },
        );
      },
    }),
    /Edge release identity mismatch/,
  );
});

test("rejects an Edge URL outside the configured secret-bearing origin before fetching", async () => {
  let fetchCalled = false;
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "https://attacker.example/functions/v1/public-api/v1/health",
      edgeApiKey: "test-key",
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse({});
      },
    }),
    /does not match the configured allowed origin/,
  );
  assert.equal(fetchCalled, false);
});

test("requires the Edge API key without exposing it", async () => {
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "https://example.supabase.co/functions/v1/public-api/v1/health",
      fetchImpl: matchingFetch(),
    }),
    /EFFECTIME_PUBLIC_API_KEY is required/,
  );
});

test("never sends an Edge API key over plaintext HTTP", async () => {
  let edgeCalled = false;
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "https://effectime.app",
      edgeUrl: "http://example.supabase.co/functions/v1/public-api/v1/health",
      edgeApiKey: "test-key",
      fetchImpl: async (url) => {
        const parsed = new URL(url);
        if (parsed.hostname === "effectime.app") {
          if (parsed.pathname.endsWith("effectime-release.json")) {
            return jsonResponse(webManifest());
          }
          if (parsed.pathname === "/index.html") return artifactResponse();
        }
        edgeCalled = true;
        return jsonResponse({});
      },
    }),
    /requires an HTTPS URL/,
  );
  assert.equal(edgeCalled, false);
});

test("rejects a remote plaintext web URL before making a request", async () => {
  let fetchCalled = false;
  await assert.rejects(
    verify({
      expectedSha: SHA,
      webUrl: "http://effectime.app",
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse(webManifest());
      },
    }),
    /requires HTTPS except for explicit localhost loopback URLs/,
  );
  assert.equal(fetchCalled, false);
});

for (const loopbackUrl of [
  "http://localhost:4173/workspace",
  "http://127.0.0.1:4173/workspace",
  "http://[::1]:4173/workspace",
]) {
  test(`allows explicit plaintext loopback web URL ${loopbackUrl}`, async () => {
    assert.deepEqual(
      await verify({
        expectedSha: SHA,
        webUrl: loopbackUrl,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname;
          if (path === "/.well-known/effectime-release.json") {
            return jsonResponse(webManifest());
          }
          assert.equal(path, "/index.html");
          return artifactResponse();
        },
      }),
      {
        expectedSha: SHA,
        expectedWebArtifactSha256: WEB_ARTIFACT.sha256,
        webSha: SHA,
        webArtifactSha256: WEB_ARTIFACT.sha256,
        verifiedWebFiles: 1,
        providerDeploymentId: PROVIDER_DEPLOYMENT_ID,
        edgeSha: null,
        edgeSourceSha256: null,
      },
    );
  });
}
