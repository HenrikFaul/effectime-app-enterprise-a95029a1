import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  normalizeArtifactSha256,
  normalizeReleaseSha,
  resolveReleaseSha,
  validatePublicReleaseManifest,
} from "./release-identity.mjs";

const RELEASE_HEADER = "x-effectime-release-sha";
const EDGE_SOURCE_HEADER = "x-effectime-edge-source-sha256";
const PROVIDER_DEPLOYMENT_HEADER = "x-deployment-id";
const EXPLICIT_HTTP_LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

function readArgument(name, argv = process.argv.slice(2)) {
  const prefix = `--${name}=`;
  return argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || null;
}

function withCacheBuster(rawUrl, expectedSha, expectedWebArtifactSha256 = null) {
  const url = new URL(rawUrl);
  url.searchParams.set("effectime_release", expectedSha);
  if (expectedWebArtifactSha256) {
    url.searchParams.set("effectime_web_artifact", expectedWebArtifactSha256);
  }
  return url;
}

function parseWebUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("webUrl must be an absolute HTTP(S) URL.");
  }

  const isHttps = url.protocol === "https:";
  const isExplicitHttpLoopback =
    url.protocol === "http:" && EXPLICIT_HTTP_LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  if (!isHttps && !isExplicitHttpLoopback) {
    throw new Error(
      "Web deployment verification requires HTTPS except for explicit localhost loopback URLs.",
    );
  }

  return url;
}

function isLoopbackUrl(url) {
  return EXPLICIT_HTTP_LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
}

function normalizeProviderDeploymentId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value.trim())) {
    throw new Error("expectedProviderDeploymentId is required for remote web verification.");
  }
  return value.trim();
}

function artifactFileUrl(baseUrl, path, expectedSha, expectedWebArtifactSha256) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return withCacheBuster(
    new URL(`/${encodedPath}`, baseUrl.origin),
    expectedSha,
    expectedWebArtifactSha256,
  );
}

async function readJson(response, label) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${label} did not return application/json.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned malformed JSON.`);
  }
}

function releaseIdentityFromEdgeBody(body) {
  if (!body || typeof body !== "object") return null;
  const record = body;
  const release = record.release ?? record.data?.release;
  if (!release || typeof release !== "object" || release.status !== "identified") return null;
  try {
    return {
      sha: normalizeReleaseSha(release.sha, "Edge release SHA"),
      sourceTreeSha256: normalizeArtifactSha256(
        release.sourceTreeSha256,
        "Edge source-tree SHA-256",
      ),
    };
  } catch {
    return null;
  }
}

function parseExpectedEdgeOrigin(rawOrigin) {
  if (!rawOrigin) {
    throw new Error("EFFECTIME_EDGE_ORIGIN is required when --edge-url is provided.");
  }
  let url;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new Error("EFFECTIME_EDGE_ORIGIN must be an absolute HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("EFFECTIME_EDGE_ORIGIN must be an absolute HTTPS origin.");
  }
  return url.origin;
}

export async function verifyDeployment({
  expectedSha,
  expectedWebArtifactSha256,
  expectedApplication = packageJson.name,
  expectedVersion = packageJson.version,
  expectedProviderDeploymentId,
  expectedEdgeSourceSha256,
  expectedEdgeOrigin,
  webUrl,
  edgeUrl,
  edgeApiKey,
  fetchImpl = globalThis.fetch,
}) {
  const expected = normalizeReleaseSha(expectedSha, "expected deployment SHA");
  const expectedWebArtifact = normalizeArtifactSha256(
    expectedWebArtifactSha256,
    "expected web artifact SHA-256",
  );
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  if (!webUrl) throw new Error("webUrl is required.");
  const parsedWebUrl = parseWebUrl(webUrl);
  let parsedEdgeUrl = null;
  let expectedEdgeSource = null;
  if (edgeUrl) {
    parsedEdgeUrl = new URL(edgeUrl);
    if (parsedEdgeUrl.protocol !== "https:") {
      throw new Error("Edge deployment verification requires an HTTPS URL.");
    }
    const allowedEdgeOrigin = parseExpectedEdgeOrigin(expectedEdgeOrigin);
    if (parsedEdgeUrl.origin !== allowedEdgeOrigin) {
      throw new Error(
        `Edge URL origin ${parsedEdgeUrl.origin} does not match the configured allowed origin.`,
      );
    }
    expectedEdgeSource = normalizeArtifactSha256(
      expectedEdgeSourceSha256,
      "expected Edge source-tree SHA-256",
    );
    if (!edgeApiKey) {
      throw new Error("EFFECTIME_PUBLIC_API_KEY is required when --edge-url is provided.");
    }
  }
  const expectedProviderId = isLoopbackUrl(parsedWebUrl)
    ? expectedProviderDeploymentId
      ? normalizeProviderDeploymentId(expectedProviderDeploymentId)
      : null
    : normalizeProviderDeploymentId(expectedProviderDeploymentId);

  const manifestUrl = new URL("/.well-known/effectime-release.json", parsedWebUrl);
  const webResponse = await fetchImpl(
    withCacheBuster(manifestUrl, expected, expectedWebArtifact),
    {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!webResponse.ok) {
    throw new Error(`Web release manifest returned HTTP ${webResponse.status}.`);
  }
  if (
    expectedProviderId &&
    webResponse.headers.get(PROVIDER_DEPLOYMENT_HEADER) !== expectedProviderId
  ) {
    throw new Error(
      `Web provider deployment ID mismatch: expected ${expectedProviderId}, observed ${webResponse.headers.get(PROVIDER_DEPLOYMENT_HEADER) ?? "<missing>"}.`,
    );
  }
  const webBody = await readJson(webResponse, "Web release manifest");
  const webIdentity = validatePublicReleaseManifest(webBody, {
    application: expectedApplication,
    version: expectedVersion,
    sha: expected,
    artifactSha256: expectedWebArtifact,
    requireAttestable: true,
    label: "Web release manifest",
  });
  const webSha = webIdentity.sha;
  let verifiedWebFiles = 0;
  for (const file of webIdentity.artifact.inventory) {
    if (file.verification === "provider-control") continue;
    const fileResponse = await fetchImpl(
      artifactFileUrl(parsedWebUrl, file.path, expected, expectedWebArtifact),
      {
        headers: { Accept: "*/*", "Cache-Control": "no-cache" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!fileResponse.ok) {
      throw new Error(`Web artifact ${file.path} returned HTTP ${fileResponse.status}.`);
    }
    if (
      expectedProviderId &&
      fileResponse.headers.get(PROVIDER_DEPLOYMENT_HEADER) !== expectedProviderId
    ) {
      throw new Error(`Web artifact ${file.path} was served by a different provider deployment.`);
    }
    const content = Buffer.from(await fileResponse.arrayBuffer());
    if (content.byteLength !== file.bytes) {
      throw new Error(
        `Web artifact ${file.path} byte mismatch: expected ${file.bytes}, observed ${content.byteLength}.`,
      );
    }
    const observedSha256 = createHash("sha256").update(content).digest("hex");
    if (observedSha256 !== file.sha256) {
      throw new Error(
        `Web artifact ${file.path} SHA-256 mismatch: expected ${file.sha256}, observed ${observedSha256}.`,
      );
    }
    verifiedWebFiles += 1;
  }

  let edgeSha = null;
  let edgeSourceSha256 = null;
  if (edgeUrl) {
    const edgeResponse = await fetchImpl(withCacheBuster(parsedEdgeUrl, expected), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${edgeApiKey}`,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!edgeResponse.ok) {
      throw new Error(`Edge release health returned HTTP ${edgeResponse.status}.`);
    }
    const edgeBody = await readJson(edgeResponse, "Edge release health");
    const edgeIdentity = releaseIdentityFromEdgeBody(edgeBody);
    if (!edgeIdentity) {
      throw new Error(
        "Edge release body must contain status 'identified', a valid release SHA and source-tree SHA-256.",
      );
    }
    edgeSha = edgeIdentity.sha;
    edgeSourceSha256 = edgeIdentity.sourceTreeSha256;
    const headerSha = normalizeReleaseSha(
      edgeResponse.headers.get(RELEASE_HEADER),
      "Edge release header SHA",
    );
    const headerSourceSha256 = normalizeArtifactSha256(
      edgeResponse.headers.get(EDGE_SOURCE_HEADER),
      "Edge source-tree header SHA-256",
    );
    if (
      edgeSha !== expected ||
      headerSha !== expected ||
      edgeSourceSha256 !== expectedEdgeSource ||
      headerSourceSha256 !== expectedEdgeSource
    ) {
      throw new Error(
        `Edge release identity mismatch: expected SHA ${expected} and source ${expectedEdgeSource}; observed body ${edgeSha}/${edgeSourceSha256}, headers ${headerSha}/${headerSourceSha256}.`,
      );
    }
  }

  return {
    expectedSha: expected,
    expectedWebArtifactSha256: expectedWebArtifact,
    webSha,
    webArtifactSha256: webIdentity.artifact.sha256,
    verifiedWebFiles,
    providerDeploymentId: expectedProviderId,
    edgeSha,
    edgeSourceSha256,
  };
}

async function main() {
  const expectedSha = readArgument("expected-sha") ?? resolveReleaseSha();
  const expectedWebArtifactSha256 = readArgument("expected-web-sha256");
  const expectedProviderDeploymentId = readArgument("expected-provider-deployment-id");
  const expectedEdgeSourceSha256 = readArgument("expected-edge-source-sha256");
  const webUrl = readArgument("web-url");
  const edgeUrl = readArgument("edge-url");
  if (!webUrl) {
    throw new Error(
      "Usage: npm run release:verify:deployment -- --web-url=https://effectime.app --expected-web-sha256=<64-hex> --expected-provider-deployment-id=<provider-id> [--edge-url=https://.../public-api/v1/health --expected-edge-source-sha256=<64-hex>] [--expected-sha=<40-hex>]",
    );
  }

  const result = await verifyDeployment({
    expectedSha,
    expectedWebArtifactSha256,
    expectedProviderDeploymentId,
    expectedEdgeSourceSha256,
    expectedEdgeOrigin: process.env.EFFECTIME_EDGE_ORIGIN,
    webUrl,
    edgeUrl,
    edgeApiKey: process.env.EFFECTIME_PUBLIC_API_KEY,
  });
  console.log(
    `[release-verify] PASS web=${result.webSha} webArtifact=${result.webArtifactSha256} edge=${result.edgeSha ?? "not-requested"} edgeSource=${result.edgeSourceSha256 ?? "not-requested"} expected=${result.expectedSha}`,
  );
}

const invokedAsScript = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedAsScript && import.meta.url === invokedAsScript) {
  main().catch((error) => {
    console.error(`[release-verify] FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
