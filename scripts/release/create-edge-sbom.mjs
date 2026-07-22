import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildDenoInvocation,
  DENO_VERSION,
  parseDenoVersion,
} from "../ci/deno-runtime.mjs";

export const DENO_INFO_FLAGS = Object.freeze([
  "--quiet",
  "--json",
  "--no-config",
  "--node-modules-dir=none",
  "--no-lock",
]);

export const DEFAULT_EXPECTED_EDGE_ENTRYPOINTS = 31;
const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableRef(kind, value) {
  return `urn:effectime:deno:${kind}:${sha256(value)}`;
}

function parsePackageId(packageId) {
  const match = /^(?<name>@[^/]+\/[^@]+|[^@]+)@(?<version>.+)$/.exec(packageId);
  if (!match?.groups) throw new Error(`Unsupported Deno package identifier: ${packageId}`);

  const { name, version } = match.groups;
  if (name.startsWith("@")) {
    const separator = name.indexOf("/");
    return { group: name.slice(0, separator), name: name.slice(separator + 1), version };
  }
  return { group: null, name, version };
}

function packageUrl(ecosystem, packageId) {
  const parsed = parsePackageId(packageId);
  const path = parsed.group
    ? `${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`
    : encodeURIComponent(parsed.name);
  return `pkg:${ecosystem}/${path}@${encodeURIComponent(parsed.version)}`;
}

function dependencyTargets(dependency) {
  const targets = [dependency.code?.specifier, dependency.type?.specifier].filter(Boolean);
  if (targets.length === 0 && dependency.specifier) targets.push(dependency.specifier);
  return [...new Set(targets)];
}

function addProperty(properties, name, value) {
  properties.push({ name, value: String(value) });
}

function sortProperties(properties) {
  return properties.sort((left, right) => left.name.localeCompare(right.name));
}

export function buildEdgeSbom(graph, options) {
  const {
    applicationName,
    applicationVersion,
    entrypointUrls,
    generatedAt = new Date().toISOString(),
    serialNumber = `urn:uuid:${randomUUID()}`,
    readModule = readFileSync,
  } = options;

  if (graph?.version !== 1 || !Array.isArray(graph.modules)) {
    throw new Error("Deno returned an unsupported dependency graph");
  }
  if (!Array.isArray(entrypointUrls) || entrypointUrls.length === 0) {
    throw new Error("At least one Edge Function entrypoint is required");
  }

  const redirects = graph.redirects ?? {};
  const resolveRedirect = (specifier) => {
    let current = specifier;
    const seen = new Set();
    while (redirects[current]) {
      if (seen.has(current)) throw new Error(`Redirect cycle in Deno graph: ${specifier}`);
      seen.add(current);
      current = redirects[current];
    }
    return current;
  };

  const moduleBySpecifier = new Map(graph.modules.map((module) => [module.specifier, module]));
  for (const entrypoint of entrypointUrls) {
    if (!moduleBySpecifier.has(entrypoint)) {
      const fileModuleSample = graph.modules
        .filter((module) => module.specifier?.startsWith("file:"))
        .slice(0, 3)
        .map((module) => module.specifier)
        .join(", ");
      const moduleSample = graph.modules
        .slice(0, 3)
        .map((module) => `${module.kind}:${module.specifier}`)
        .join(", ");
      throw new Error(
        `Deno graph omitted Edge Function entrypoint: ${entrypoint}; modules=${graph.modules.length}; file module sample: ${fileModuleSample || "<none>"}; module sample: ${moduleSample || "<none>"}`,
      );
    }
  }

  for (const module of graph.modules) {
    if (module.kind === "error" || module.error) {
      throw new Error(`Deno graph contains an unresolved module: ${module.specifier}`);
    }
    for (const dependency of module.dependencies ?? []) {
      for (const branch of [dependency.code, dependency.type]) {
        if (branch?.error) {
          throw new Error(
            `Deno graph contains an unresolved dependency from ${module.specifier}: ${branch.error}`,
          );
        }
      }
    }
  }

  const npmPackages = graph.npmPackages ?? {};
  const npmRefs = new Map(
    Object.keys(npmPackages)
      .sort()
      .map((packageId) => [packageId, stableRef("npm", packageId)]),
  );

  const jsrPackageIds = [...new Set(Object.values(graph.packages ?? {}))].sort();
  const jsrRefs = new Map(
    jsrPackageIds.map((packageId) => [packageId, stableRef("jsr", packageId)]),
  );
  const jsrPrefixes = jsrPackageIds
    .map((packageId) => {
      const parsed = parsePackageId(packageId);
      const packageName = parsed.group ? `${parsed.group}/${parsed.name}` : parsed.name;
      return {
        packageId,
        prefix: `https://jsr.io/${packageName}/${parsed.version}/`,
      };
    })
    .sort((left, right) => right.prefix.length - left.prefix.length);

  const jsrPackageForUrl = (specifier) =>
    jsrPrefixes.find(({ prefix }) => specifier.startsWith(prefix))?.packageId ?? null;

  const httpModules = graph.modules
    .filter(
      (module) =>
        /^https?:\/\//.test(module.specifier) && !jsrPackageForUrl(module.specifier),
    )
    .sort((left, right) => left.specifier.localeCompare(right.specifier));
  const httpRefs = new Map(
    httpModules.map((module) => [module.specifier, stableRef("http", module.specifier)]),
  );

  const moduleRefs = new Map();
  for (const module of graph.modules) {
    if (module.kind === "npm") {
      const ref = npmRefs.get(module.npmPackage);
      if (!ref) {
        throw new Error(`Deno graph omitted npm package metadata for ${module.specifier}`);
      }
      moduleRefs.set(module.specifier, ref);
      continue;
    }

    if (/^https?:\/\//.test(module.specifier)) {
      const jsrPackageId = jsrPackageForUrl(module.specifier);
      const ref = jsrPackageId ? jsrRefs.get(jsrPackageId) : httpRefs.get(module.specifier);
      if (!ref) throw new Error(`Unable to classify remote module: ${module.specifier}`);
      moduleRefs.set(module.specifier, ref);
    }
  }

  const refForDependency = (dependency, target) => {
    if (dependency.npmPackage) {
      const npmRef = npmRefs.get(dependency.npmPackage);
      if (!npmRef) {
        throw new Error(`Unresolved npm dependency instance: ${dependency.npmPackage}`);
      }
      return npmRef;
    }

    const resolved = resolveRedirect(target);
    if (moduleRefs.has(resolved)) return moduleRefs.get(resolved);
    if (moduleRefs.has(target)) return moduleRefs.get(target);
    if (/^(?:node:|data:)/.test(resolved)) return null;
    if (/^(?:npm:|jsr:|https?:\/\/)/.test(resolved)) {
      throw new Error(`Remote dependency has no resolved component: ${resolved}`);
    }
    return null;
  };

  const externalBoundary = new Set();
  const visitedLocalModules = new Set();
  const visitLocalModule = (specifier) => {
    const resolved = resolveRedirect(specifier);
    if (visitedLocalModules.has(resolved)) return;
    visitedLocalModules.add(resolved);
    const module = moduleBySpecifier.get(resolved);
    if (!module) throw new Error(`Deno graph omitted local dependency: ${resolved}`);

    for (const dependency of module.dependencies ?? []) {
      for (const target of dependencyTargets(dependency)) {
        const dependencyRef = refForDependency(dependency, target);
        if (dependencyRef) {
          externalBoundary.add(dependencyRef);
          continue;
        }
        const resolvedTarget = resolveRedirect(target);
        if (resolvedTarget.startsWith("file:")) visitLocalModule(resolvedTarget);
      }
    }
  };
  for (const entrypoint of entrypointUrls) visitLocalModule(entrypoint);

  const dependencyMap = new Map();
  const allComponentRefs = new Set([
    ...npmRefs.values(),
    ...jsrRefs.values(),
    ...httpRefs.values(),
  ]);
  for (const ref of allComponentRefs) dependencyMap.set(ref, new Set());

  for (const [packageId, packageInfo] of Object.entries(npmPackages)) {
    const sourceRef = npmRefs.get(packageId);
    for (const dependencyId of packageInfo.dependencies ?? []) {
      const dependencyRef = npmRefs.get(dependencyId);
      if (!dependencyRef) {
        throw new Error(`npm package ${packageId} has unresolved dependency ${dependencyId}`);
      }
      dependencyMap.get(sourceRef).add(dependencyRef);
    }
  }

  for (const module of graph.modules) {
    const sourceRef = moduleRefs.get(module.specifier);
    if (!sourceRef) continue;
    for (const dependency of module.dependencies ?? []) {
      for (const target of dependencyTargets(dependency)) {
        const dependencyRef = refForDependency(dependency, target);
        if (dependencyRef && dependencyRef !== sourceRef) {
          dependencyMap.get(sourceRef).add(dependencyRef);
        }
      }
    }
  }

  const dependencyScope = (ref) => (externalBoundary.has(ref) ? "direct" : "transitive");
  const components = [];

  for (const [packageId, packageInfo] of Object.entries(npmPackages).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!packageInfo.name || !packageInfo.version) {
      throw new Error(`Deno npm package metadata is incomplete for ${packageId}`);
    }
    const canonicalPackageId = `${packageInfo.name}@${packageInfo.version}`;
    const parsed = parsePackageId(canonicalPackageId);
    const properties = [];
    addProperty(properties, "effectime:deno-package-key", packageId);
    addProperty(properties, "effectime:dependency-scope", dependencyScope(npmRefs.get(packageId)));
    addProperty(properties, "effectime:source-kind", "npm");
    components.push({
      type: "library",
      "bom-ref": npmRefs.get(packageId),
      ...(parsed.group ? { group: parsed.group } : {}),
      name: parsed.name,
      version: parsed.version,
      scope: "required",
      purl: packageUrl("npm", canonicalPackageId),
      ...(packageInfo.registryUrl
        ? {
            externalReferences: [
              { type: "distribution", url: packageInfo.registryUrl },
            ],
          }
        : {}),
      properties: sortProperties(properties),
    });
  }

  for (const packageId of jsrPackageIds) {
    const parsed = parsePackageId(packageId);
    const properties = [];
    addProperty(properties, "effectime:dependency-scope", dependencyScope(jsrRefs.get(packageId)));
    addProperty(properties, "effectime:source-kind", "jsr");
    components.push({
      type: "library",
      "bom-ref": jsrRefs.get(packageId),
      ...(parsed.group ? { group: parsed.group } : {}),
      name: parsed.name,
      version: parsed.version,
      scope: "required",
      purl: packageUrl("jsr", packageId),
      externalReferences: [
        {
          type: "distribution",
          url: `https://jsr.io/${parsed.group ? `${parsed.group}/` : ""}${parsed.name}/${parsed.version}/`,
        },
      ],
      properties: sortProperties(properties),
    });
  }

  for (const module of httpModules) {
    if (!module.local || !existsSync(module.local)) {
      throw new Error(`Deno did not provide cached content for ${module.specifier}`);
    }
    const cachedContent = readModule(module.local);
    if (Number.isInteger(module.size) && cachedContent.length < module.size) {
      throw new Error(`Cached module is truncated for ${module.specifier}`);
    }
    // Deno may append cache metadata after the source bytes; module.size is the source boundary.
    const content = Number.isInteger(module.size)
      ? cachedContent.subarray(0, module.size)
      : cachedContent;
    const properties = [];
    addProperty(properties, "effectime:dependency-scope", dependencyScope(httpRefs.get(module.specifier)));
    addProperty(properties, "effectime:deno-media-type", module.mediaType ?? "unknown");
    addProperty(properties, "effectime:resolved-specifier", module.specifier);
    addProperty(properties, "effectime:source-kind", "http");
    components.push({
      type: "library",
      "bom-ref": httpRefs.get(module.specifier),
      name: basename(new URL(module.specifier).pathname) || new URL(module.specifier).hostname,
      scope: "required",
      hashes: [{ alg: "SHA-256", content: sha256(content) }],
      externalReferences: [{ type: "distribution", url: module.specifier }],
      properties: sortProperties(properties),
    });
  }

  components.sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]));
  const rootRef = `urn:effectime:edge-functions:${applicationVersion}`;
  const dependencies = [
    { ref: rootRef, dependsOn: [...externalBoundary].sort() },
    ...[...dependencyMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort() })),
  ];

  const referenced = new Set([rootRef, ...allComponentRefs]);
  for (const dependency of dependencies) {
    if (!referenced.has(dependency.ref)) {
      throw new Error(`CycloneDX dependency source has no component: ${dependency.ref}`);
    }
    for (const target of dependency.dependsOn) {
      if (!referenced.has(target)) {
        throw new Error(`CycloneDX dependency target has no component: ${target}`);
      }
    }
  }

  const directCount = components.filter((component) =>
    component.properties.some(
      (property) => property.name === "effectime:dependency-scope" && property.value === "direct",
    ),
  ).length;
  const metadataProperties = [];
  addProperty(metadataProperties, "effectime:component-count:http", httpRefs.size);
  addProperty(metadataProperties, "effectime:component-count:jsr", jsrRefs.size);
  addProperty(metadataProperties, "effectime:component-count:npm", npmRefs.size);
  addProperty(metadataProperties, "effectime:dependency-count:direct", directCount);
  addProperty(metadataProperties, "effectime:dependency-count:transitive", components.length - directCount);
  addProperty(metadataProperties, "effectime:deno-info-flags", DENO_INFO_FLAGS.join(" "));
  addProperty(metadataProperties, "effectime:edge-entrypoint-count", entrypointUrls.length);
  addProperty(
    metadataProperties,
    "effectime:sbom-coverage",
    "Resolved npm, JSR and HTTP dependencies reachable from Supabase Edge Function index.ts entrypoints; excludes the web/package-lock graph and deployment-platform components.",
  );
  addProperty(metadataProperties, "effectime:sbom-scope", "edge-deno-runtime-dependencies");

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber,
    version: 1,
    metadata: {
      timestamp: generatedAt,
      tools: {
        components: [{ type: "application", name: "Deno", version: DENO_VERSION }],
      },
      component: {
        type: "application",
        "bom-ref": rootRef,
        name: `${applicationName}-edge-functions`,
        version: applicationVersion,
        properties: sortProperties(metadataProperties),
      },
    },
    components,
    dependencies,
  };
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

function resolveDenoInvocation() {
  const configured = process.env.DENO_BIN;
  const installed = configured ? null : run("deno", ["--version"]);
  return buildDenoInvocation({
    configuredBin: configured,
    nativeDenoAvailable: Boolean(installed && !installed.error && installed.status === 0),
    npmExecPath: process.env.npm_execpath,
    nodeExecutable: process.execPath,
    platform: process.platform,
  });
}

function assertDenoVersion(invocation) {
  const result = run(invocation.command, [...invocation.prefix, "--version"], {
    shell: invocation.shell,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || "Unable to determine Deno version");
  }
  const actualVersion = parseDenoVersion(result.stdout);
  if (actualVersion !== DENO_VERSION) {
    throw new Error(`Edge SBOM requires Deno ${DENO_VERSION}; received: ${result.stdout.trim()}`);
  }
}

export function discoverEntrypoints(functionsDirectory) {
  return readdirSync(functionsDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "_shared" &&
        existsSync(resolve(functionsDirectory, entry.name, "index.ts")),
    )
    .map((entry) => resolve(functionsDirectory, entry.name, "index.ts"))
    .sort((left, right) => left.localeCompare(right));
}

async function main() {
  const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
  const expectedArgument = process.argv.find((argument) =>
    argument.startsWith("--expected-entrypoints="),
  );
  const outputPath = resolve(
    repositoryRoot,
    outputArgument?.slice("--output=".length) || "artifacts/edge-sbom.cdx.json",
  );
  const expectedEntrypoints = Number(
    expectedArgument?.slice("--expected-entrypoints=".length) ||
      DEFAULT_EXPECTED_EDGE_ENTRYPOINTS,
  );
  if (!Number.isInteger(expectedEntrypoints) || expectedEntrypoints <= 0) {
    throw new Error("--expected-entrypoints must be a positive integer");
  }

  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  const functionsDirectory = resolve(repositoryRoot, "supabase/functions");
  const entrypoints = discoverEntrypoints(functionsDirectory);
  if (entrypoints.length !== expectedEntrypoints) {
    throw new Error(
      `Expected ${expectedEntrypoints} Edge Function entrypoints, discovered ${entrypoints.length}`,
    );
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "effectime-edge-sbom-"));
  try {
    const aggregateEntrypoint = resolve(temporaryDirectory, "all-edge-functions.ts");
    const entrypointUrls = entrypoints.map((entrypoint) => pathToFileURL(entrypoint).href);
    writeFileSync(
      aggregateEntrypoint,
      `${entrypointUrls.map((url) => `import ${JSON.stringify(url)};`).join("\n")}\n`,
      "utf8",
    );

    const invocation = resolveDenoInvocation();
    assertDenoVersion(invocation);
    const graphResult = run(
      invocation.command,
      [
        ...invocation.prefix,
        "info",
        ...DENO_INFO_FLAGS,
        pathToFileURL(aggregateEntrypoint).href,
      ],
      { shell: invocation.shell },
    );
    if (graphResult.error) throw graphResult.error;
    if (graphResult.status !== 0) {
      throw new Error(graphResult.stderr || "deno info failed without diagnostics");
    }

    let graph;
    try {
      graph = JSON.parse(graphResult.stdout);
    } catch (error) {
      throw new Error(`Deno returned malformed JSON: ${error.message}`);
    }

    const sbom = buildEdgeSbom(graph, {
      applicationName: packageJson.name,
      applicationVersion: packageJson.version,
      entrypointUrls,
    });

    mkdirSync(dirname(outputPath), { recursive: true });
    const temporaryOutput = `${outputPath}.tmp-${process.pid}`;
    writeFileSync(temporaryOutput, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
    if (existsSync(outputPath)) unlinkSync(outputPath);
    renameSync(temporaryOutput, outputPath);

    const counts = Object.fromEntries(
      ["npm", "jsr", "http"].map((kind) => [
        kind,
        sbom.components.filter((component) =>
          component.properties.some(
            (property) => property.name === "effectime:source-kind" && property.value === kind,
          ),
        ).length,
      ]),
    );
    console.log(
      JSON.stringify({
        event: "release-edge-sbom-created",
        output: relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
        entrypoints: entrypoints.length,
        components: sbom.components.length,
        counts,
      }),
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[release-edge-sbom] ${error.message}`);
    process.exitCode = 1;
  });
}
