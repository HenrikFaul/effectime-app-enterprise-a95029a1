import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const EDGE_FUNCTIONS_DIRECTORY = "supabase/functions";
export const GENERATED_EDGE_IDENTITY_PATH = "supabase/functions/_shared/release-artifact.ts";

const GENERATED_EDGE_IDENTITY_RELATIVE_PATH = "_shared/release-artifact.ts";
const EDGE_SOURCE_EXTENSION_PATTERN = /\.(?:ts|tsx|json|lock)$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const GENERATED_CONSTANT_PATTERN =
  /export const EFFECTIME_EDGE_SOURCE_TREE_SHA256\s*=\s*"([0-9a-f]{64})"\s+as const;/u;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = resolve(scriptDirectory, "../..");

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Canonicalize text-file line endings without decoding or otherwise modifying
 * source bytes. This keeps the identity stable across Git checkouts using LF
 * or CRLF while preserving every non-line-ending byte exactly.
 */
export function normalizeSourceLineEndings(content) {
  const normalized = [];
  for (let index = 0; index < content.length; index += 1) {
    const byte = content[index];
    if (byte !== 0x0d) {
      normalized.push(byte);
      continue;
    }

    if (content[index + 1] === 0x0a) index += 1;
    normalized.push(0x0a);
  }
  return Buffer.from(normalized);
}

function normalizeRelativePath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//u, "");
}

export function isEdgeSourceIdentityInput(path) {
  const normalized = normalizeRelativePath(path);
  return (
    normalized !== GENERATED_EDGE_IDENTITY_RELATIVE_PATH &&
    EDGE_SOURCE_EXTENSION_PATTERN.test(normalized)
  );
}

export function selectEdgeSourceIdentityInputs(repositoryPaths) {
  const prefix = `${EDGE_FUNCTIONS_DIRECTORY}/`;
  return Array.from(
    new Set(
      repositoryPaths
        .map(normalizeRelativePath)
        .filter((path) => path.startsWith(prefix))
        .map((path) => path.slice(prefix.length))
        .filter(isEdgeSourceIdentityInput),
    ),
  ).sort();
}

export function listEdgeSourceIdentityInputs({ repositoryRoot = defaultRepositoryRoot } = {}) {
  const output = execFileSync(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      EDGE_FUNCTIONS_DIRECTORY,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  return selectEdgeSourceIdentityInputs(output.split("\0").filter(Boolean));
}

export function computeEdgeSourceTreeIdentity({
  repositoryRoot = defaultRepositoryRoot,
  relativePaths = listEdgeSourceIdentityInputs({ repositoryRoot }),
} = {}) {
  const functionsDirectory = resolve(repositoryRoot, EDGE_FUNCTIONS_DIRECTORY);
  const inputs = Array.from(
    new Set(relativePaths.map(normalizeRelativePath).filter(isEdgeSourceIdentityInput)),
  ).sort();

  if (inputs.length === 0) {
    throw new Error("No Edge source inputs were found; refusing to attest an empty tree.");
  }

  const aggregate = createHash("sha256");
  let bytes = 0;

  for (const input of inputs) {
    const absolutePath = resolve(functionsDirectory, ...input.split("/"));
    const containedPath = relative(functionsDirectory, absolutePath);
    if (containedPath.startsWith(`..${sep}`) || containedPath === "..") {
      throw new Error(`Edge source input escapes the functions directory: ${input}`);
    }

    const content = normalizeSourceLineEndings(readFileSync(absolutePath));
    const fileSha256 = sha256(content);
    bytes += content.length;
    aggregate.update(input, "utf8").update("\0").update(fileSha256).update("\0");
  }

  return {
    algorithm: "sha256",
    bytes,
    files: inputs.length,
    sha256: aggregate.digest("hex"),
  };
}

export function readGeneratedEdgeSourceTreeSha256({ repositoryRoot = defaultRepositoryRoot } = {}) {
  const generatedPath = resolve(repositoryRoot, GENERATED_EDGE_IDENTITY_PATH);
  const source = readFileSync(generatedPath, "utf8");
  const match = source.match(GENERATED_CONSTANT_PATTERN);
  if (!match || !SHA256_PATTERN.test(match[1])) {
    throw new Error(`Generated Edge identity is malformed: ${GENERATED_EDGE_IDENTITY_PATH}`);
  }
  return match[1];
}

export function verifyGeneratedEdgeSourceIdentity(options = {}) {
  const identity = computeEdgeSourceTreeIdentity(options);
  const generatedSha256 = readGeneratedEdgeSourceTreeSha256(options);
  if (generatedSha256 !== identity.sha256) {
    throw new Error(
      `Generated Edge identity drift: expected ${identity.sha256}, found ${generatedSha256}. ` +
        `Regenerate ${GENERATED_EDGE_IDENTITY_PATH} from the reviewed source tree.`,
    );
  }
  return identity;
}

function runCli() {
  const unsupportedArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== "--check" && argument !== "--print");
  if (unsupportedArguments.length > 0) {
    throw new Error(`Unsupported argument(s): ${unsupportedArguments.join(", ")}`);
  }

  if (process.argv.includes("--print")) {
    process.stdout.write(`${computeEdgeSourceTreeIdentity().sha256}\n`);
    return;
  }

  const identity = verifyGeneratedEdgeSourceIdentity();
  process.stdout.write(
    `[edge-source-identity] verified ${identity.sha256} (${identity.files} files, ${identity.bytes} canonical bytes)\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(`[edge-source-identity] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
