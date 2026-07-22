import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DENO_VERSION } from "../ci/deno-runtime.mjs";
import {
  buildEdgeSbom,
  buildEdgeSbomWithRemoteRetry,
  DEFAULT_DENO_GRAPH_ATTEMPTS,
  DEFAULT_EXPECTED_EDGE_ENTRYPOINTS,
  DENO_INFO_FLAGS,
  discoverEntrypoints,
  isRetryableRemoteGraphError,
} from "./create-edge-sbom.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("default Edge SBOM inventory matches every current entrypoint", () => {
  assert.equal(
    discoverEntrypoints(resolve(repositoryRoot, "supabase/functions")).length,
    DEFAULT_EXPECTED_EDGE_ENTRYPOINTS,
  );
});

function property(component, name) {
  return component.properties.find((entry) => entry.name === name)?.value;
}

test("buildEdgeSbom records direct and transitive npm, JSR and HTTP components", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "edge-sbom-test-"));
  const cachedHttpModule = join(temporaryDirectory, "remote-module");
  writeFileSync(cachedHttpModule, "export const remote = true;\n", "utf8");

  try {
    const entrypoint = "file:///repo/supabase/functions/example/index.ts";
    const helper = "file:///repo/supabase/functions/_shared/helper.ts";
    const httpModule = "https://example.test/library@1/mod.ts";
    const jsrModule = "https://jsr.io/@std/path/1.0.9/mod.ts";
    const graph = {
      version: 1,
      roots: ["file:///tmp/all-edge-functions.ts"],
      redirects: {
        "npm:direct@1.0.0": "npm:/direct@1.0.0",
        "jsr:@std/path@1.0.9": jsrModule,
      },
      packages: { "@std/path@1.0.9": "@std/path@1.0.9" },
      npmPackages: {
        "direct@1.0.0": {
          name: "direct",
          version: "1.0.0",
          dependencies: ["transitive@2.0.0"],
          registryUrl: "https://registry.npmjs.org/",
        },
        "transitive@2.0.0": {
          name: "transitive",
          version: "2.0.0",
          dependencies: [],
          registryUrl: "https://registry.npmjs.org/",
        },
      },
      modules: [
        {
          kind: "esm",
          specifier: entrypoint,
          dependencies: [
            { specifier: "../_shared/helper.ts", code: { specifier: helper } },
            {
              specifier: "npm:direct@1.0.0",
              code: { specifier: "npm:direct@1.0.0" },
              npmPackage: "direct@1.0.0",
            },
            {
              specifier: "jsr:@std/path@1.0.9",
              code: { specifier: jsrModule },
            },
          ],
        },
        {
          kind: "esm",
          specifier: helper,
          dependencies: [{ specifier: httpModule, code: { specifier: httpModule } }],
        },
        {
          kind: "npm",
          specifier: "npm:/direct@1.0.0",
          npmPackage: "direct@1.0.0",
        },
        {
          kind: "npm",
          specifier: "npm:/transitive@2.0.0",
          npmPackage: "transitive@2.0.0",
        },
        {
          kind: "esm",
          specifier: jsrModule,
          dependencies: [],
          local: cachedHttpModule,
          size: 28,
          mediaType: "TypeScript",
        },
        {
          kind: "esm",
          specifier: httpModule,
          dependencies: [],
          local: cachedHttpModule,
          size: 28,
          mediaType: "TypeScript",
        },
      ],
    };

    const sbom = buildEdgeSbom(graph, {
      applicationName: "example",
      applicationVersion: "1.2.3",
      entrypointUrls: [entrypoint],
      generatedAt: "2026-07-17T00:00:00.000Z",
      serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000000",
    });

    assert.equal(sbom.bomFormat, "CycloneDX");
    assert.equal(sbom.specVersion, "1.6");
    assert.equal(sbom.metadata.tools.components[0].version, DENO_VERSION);
    assert.ok(DENO_INFO_FLAGS.includes("--node-modules-dir=none"));
    assert.equal(
      property(sbom.metadata.component, "effectime:deno-info-flags"),
      DENO_INFO_FLAGS.join(" "),
    );
    assert.equal(sbom.components.length, 4);
    assert.deepEqual(
      Object.fromEntries(
        ["npm", "jsr", "http"].map((kind) => [
          kind,
          sbom.components.filter(
            (component) => property(component, "effectime:source-kind") === kind,
          ).length,
        ]),
      ),
      { npm: 2, jsr: 1, http: 1 },
    );

    const direct = sbom.components.filter(
      (component) => property(component, "effectime:dependency-scope") === "direct",
    );
    assert.deepEqual(direct.map((component) => component.name).sort(), [
      "direct",
      "mod.ts",
      "path",
    ]);
    assert.equal(
      property(
        sbom.components.find((component) => component.name === "transitive"),
        "effectime:dependency-scope",
      ),
      "transitive",
    );

    const componentRefs = new Set(sbom.components.map((component) => component["bom-ref"]));
    const rootDependency = sbom.dependencies.find(
      (dependency) => dependency.ref === sbom.metadata.component["bom-ref"],
    );
    assert.equal(rootDependency.dependsOn.length, 3);
    assert.ok(rootDependency.dependsOn.every((ref) => componentRefs.has(ref)));
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("buildEdgeSbom fails closed when a resolved npm dependency is missing", () => {
  assert.throws(
    () =>
      buildEdgeSbom(
        {
          version: 1,
          redirects: {},
          modules: [{ kind: "esm", specifier: "file:///entry.ts", dependencies: [] }],
          npmPackages: {
            "parent@1.0.0": {
              name: "parent",
              version: "1.0.0",
              dependencies: ["missing@1.0.0"],
            },
          },
        },
        {
          applicationName: "example",
          applicationVersion: "1.0.0",
          entrypointUrls: ["file:///entry.ts"],
        },
      ),
    /unresolved dependency/,
  );
});

test("remote Deno graph resolution is retried with a bounded attempt count", () => {
  const entrypoint = "file:///repo/supabase/functions/example/index.ts";
  let attempts = 0;
  const retries = [];

  const sbom = buildEdgeSbomWithRemoteRetry(
    () => {
      attempts += 1;
      return attempts === 1
        ? {
            version: 1,
            modules: [
              { kind: "esm", specifier: entrypoint, dependencies: [] },
              {
                kind: "error",
                specifier: "https://esm.sh/@supabase/supabase-js@2.39.0",
              },
            ],
          }
        : {
            version: 1,
            modules: [{ kind: "esm", specifier: entrypoint, dependencies: [] }],
          };
    },
    {
      applicationName: "example",
      applicationVersion: "1.0.0",
      entrypointUrls: [entrypoint],
    },
    { onRetry: (retry) => retries.push(retry) },
  );

  assert.equal(attempts, 2);
  assert.equal(retries.length, 1);
  assert.equal(retries[0].attempt, 1);
  assert.equal(retries[0].maxAttempts, DEFAULT_DENO_GRAPH_ATTEMPTS);
  assert.equal(sbom.metadata.component.name, "example-edge-functions");
});

test("persistent remote Deno graph failures remain fail-closed", () => {
  const entrypoint = "file:///repo/supabase/functions/example/index.ts";
  let attempts = 0;

  assert.throws(
    () =>
      buildEdgeSbomWithRemoteRetry(
        () => {
          attempts += 1;
          return {
            version: 1,
            modules: [
              { kind: "esm", specifier: entrypoint, dependencies: [] },
              { kind: "error", specifier: "https://example.test/unavailable.ts" },
            ],
          };
        },
        {
          applicationName: "example",
          applicationVersion: "1.0.0",
          entrypointUrls: [entrypoint],
        },
      ),
    /unresolved module/,
  );
  assert.equal(attempts, DEFAULT_DENO_GRAPH_ATTEMPTS);
});

test("local graph errors are never retried", () => {
  const entrypoint = "file:///repo/supabase/functions/example/index.ts";
  let attempts = 0;

  assert.throws(
    () =>
      buildEdgeSbomWithRemoteRetry(
        () => {
          attempts += 1;
          return {
            version: 1,
            modules: [
              { kind: "esm", specifier: entrypoint, dependencies: [] },
              { kind: "error", specifier: "file:///repo/missing.ts" },
            ],
          };
        },
        {
          applicationName: "example",
          applicationVersion: "1.0.0",
          entrypointUrls: [entrypoint],
        },
      ),
    /unresolved module/,
  );
  assert.equal(attempts, 1);
  assert.equal(
    isRetryableRemoteGraphError(new Error("Deno graph contains an unresolved module: file:///x")),
    false,
  );
});

test("retry classification follows the unresolved target rather than its source", () => {
  assert.equal(
    isRetryableRemoteGraphError(
      new Error(
        "Deno graph contains an unresolved dependency from file:///repo/index.ts to https://example.test/module.ts: unavailable",
      ),
    ),
    true,
  );
  assert.equal(
    isRetryableRemoteGraphError(
      new Error(
        "Deno graph contains an unresolved dependency from https://example.test/remote.ts to file:///repo/missing.ts: not found",
      ),
    ),
    false,
  );
});
