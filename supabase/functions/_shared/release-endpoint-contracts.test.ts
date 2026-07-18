import {
  buildPublicApiHealthContract,
  PUBLIC_API_EXPOSE_HEADERS,
} from "../public-api/health-contract.ts";
import { buildPlatformVersionContract } from "../superadmin-hub/platform-version-contract.ts";
import { EFFECTIME_EDGE_SOURCE_TREE_SHA256 } from "./release-artifact.ts";
import {
  EFFECTIME_EDGE_SOURCE_SHA256_HEADER,
  EFFECTIME_RELEASE_SHA_HEADER,
  resolveEffectimeReleaseIdentity,
} from "./release-identity.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function assertReleaseHeaders(
  headers: Record<string, string>,
  identified: boolean,
): void {
  const exposed = headers["Access-Control-Expose-Headers"].split(",").map((
    value,
  ) => value.trim());
  if (
    !exposed.includes(EFFECTIME_RELEASE_SHA_HEADER) ||
    !exposed.includes(EFFECTIME_EDGE_SOURCE_SHA256_HEADER)
  ) {
    throw new Error("Both release identity headers must be CORS-exposed");
  }
  assertEquals(
    headers[EFFECTIME_EDGE_SOURCE_SHA256_HEADER],
    EFFECTIME_EDGE_SOURCE_TREE_SHA256,
  );
  assertEquals(EFFECTIME_RELEASE_SHA_HEADER in headers, identified);
}

Deno.test("public-api health contract carries the canonical identified release body and headers", () => {
  const release = resolveEffectimeReleaseIdentity("a".repeat(40));
  const contract = buildPublicApiHealthContract({
    keyName: "integration",
    release,
    requestId: "request-1",
    workspaceId: "workspace-1",
  });

  assertEquals(contract.body, {
    data: {
      ok: true,
      workspace_id: "workspace-1",
      key_name: "integration",
      release,
    },
    meta: { request_id: "request-1" },
  });
  assertEquals(
    contract.headers["Access-Control-Expose-Headers"],
    PUBLIC_API_EXPOSE_HEADERS,
  );
  assertEquals(contract.headers[EFFECTIME_RELEASE_SHA_HEADER], "a".repeat(40));
  assertReleaseHeaders(contract.headers, true);
});

Deno.test("public-api health contract keeps an unknown release fail-visible", () => {
  const release = resolveEffectimeReleaseIdentity(undefined);
  const contract = buildPublicApiHealthContract({
    keyName: null,
    release,
    requestId: "request-2",
    workspaceId: "workspace-2",
  });

  assertEquals(contract.body.data.release, {
    sha: null,
    sourceTreeSha256: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
    status: "unknown",
  });
  assertReleaseHeaders(contract.headers, false);
});

Deno.test("superadmin platform-version contract carries canonical release evidence", () => {
  const release = resolveEffectimeReleaseIdentity("b".repeat(40));
  const contract = buildPlatformVersionContract({
    knownFunctions: ["public-api", "superadmin-hub"],
    release,
    supabaseProjectUrl: "https://example.supabase.co",
    timestamp: "2026-07-18T12:00:00.000Z",
  });

  assertEquals(contract.body.release, release);
  assertEquals(contract.body.function_count, 2);
  assertEquals(contract.body.functions, ["public-api", "superadmin-hub"]);
  assertReleaseHeaders(contract.headers, true);
});

Deno.test("superadmin platform-version contract keeps an unknown release fail-visible", () => {
  const release = resolveEffectimeReleaseIdentity("not-a-sha");
  const contract = buildPlatformVersionContract({
    knownFunctions: [],
    release,
    supabaseProjectUrl: null,
    timestamp: "2026-07-18T12:00:00.000Z",
  });

  assertEquals(contract.body.release, {
    sha: null,
    sourceTreeSha256: EFFECTIME_EDGE_SOURCE_TREE_SHA256,
    status: "unknown",
  });
  assertReleaseHeaders(contract.headers, false);
});
