import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatSecretFinding,
  isForbiddenSigningPath,
  MAX_FILE_BYTES,
  sanitizeSecretDiagnosticPath,
  scanSecretBuffer,
} from "./secret-scan-core.mjs";

const defaultRepositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

class HistorySecretScanError extends Error {
  constructor(message) {
    super(message);
    this.name = "HistorySecretScanError";
  }
}

function isolatedGitEnvironment() {
  const environment = { ...process.env, GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0" };
  for (const variable of [
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CEILING_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_DIR",
    "GIT_INDEX_FILE",
    "GIT_NAMESPACE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_WORK_TREE",
  ]) {
    delete environment[variable];
  }
  return environment;
}

function gitBuffer(repositoryRoot, arguments_, options = {}) {
  try {
    return execFileSync("git", arguments_, {
      cwd: repositoryRoot,
      env: isolatedGitEnvironment(),
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      ...options,
    });
  } catch {
    throw new HistorySecretScanError("A required Git history inventory command failed closed.");
  }
}

function gitText(repositoryRoot, arguments_, options = {}) {
  return gitBuffer(repositoryRoot, arguments_, { encoding: "utf8", ...options });
}

function canonicalPath(path) {
  const canonical = realpathSync.native(resolve(path)).replaceAll("\\", "/");
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

function repositoryContract(repositoryRoot) {
  const topLevel = gitText(repositoryRoot, ["--no-replace-objects", "rev-parse", "--show-toplevel"])
    .trim();
  if (canonicalPath(topLevel) !== canonicalPath(repositoryRoot)) {
    throw new HistorySecretScanError(
      "The requested history scan root is not the repository top level.",
    );
  }

  const objectFormat = gitText(repositoryRoot, [
    "--no-replace-objects",
    "rev-parse",
    "--show-object-format",
  ]).trim();
  const objectIdLength = objectFormat === "sha1" ? 40 : objectFormat === "sha256" ? 64 : 0;
  if (objectIdLength === 0) {
    throw new HistorySecretScanError("The repository uses an unsupported Git object format.");
  }
  return { objectFormat, objectIdPattern: new RegExp(`^[0-9a-f]{${objectIdLength}}$`) };
}

function assertCompleteHistory(repositoryRoot) {
  const shallow = gitText(repositoryRoot, [
    "--no-replace-objects",
    "rev-parse",
    "--is-shallow-repository",
  ]).trim();
  if (shallow !== "false") {
    throw new HistorySecretScanError(
      "Git history is shallow; fetch the complete reachable history before running the history secret scan.",
    );
  }
}

function splitNulBuffer(buffer) {
  const fields = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) continue;
    if (index > start) fields.push(buffer.subarray(start, index).toString("utf8"));
    start = index + 1;
  }
  if (start !== buffer.length) {
    throw new HistorySecretScanError("Git returned a truncated NUL-delimited inventory.");
  }
  return fields;
}

function reachableObjectIds(repositoryRoot, objectIdPattern) {
  const objectIds = splitNulBuffer(
    gitBuffer(repositoryRoot, [
      "--no-replace-objects",
      "rev-list",
      "--objects",
      "--no-object-names",
      "-z",
      "--all",
      "--missing=error",
    ]),
  );
  if (objectIds.length === 0) {
    throw new HistorySecretScanError("Git history contains no reachable objects to scan.");
  }
  if (objectIds.some((objectId) => !objectIdPattern.test(objectId))) {
    throw new HistorySecretScanError("Git returned a malformed reachable object identifier.");
  }
  return [...new Set(objectIds)];
}

function historicalPaths(repositoryRoot) {
  return new Set(
    splitNulBuffer(
      gitBuffer(repositoryRoot, [
        "--no-replace-objects",
        "log",
        "--all",
        "--full-history",
        "--root",
        "--diff-merges=separate",
        "--format=",
        "--name-only",
        "-z",
        "--",
      ]),
    ).map((path) => path.replaceAll("\\", "/")),
  );
}

function objectMetadata(repositoryRoot, objectIds, objectIdPattern) {
  const output = gitText(
    repositoryRoot,
    [
      "--no-replace-objects",
      "cat-file",
      "--batch-check=%(objectname)\t%(objecttype)\t%(objectsize)",
    ],
    { input: `${objectIds.join("\n")}\n` },
  );
  const metadata = new Map();

  for (const line of output.trimEnd().split("\n")) {
    const [objectId, type, sizeText] = line.split("\t");
    const size = Number(sizeText);
    if (!objectIdPattern.test(objectId) || !type || !Number.isSafeInteger(size) || size < 0) {
      throw new HistorySecretScanError(
        "Git returned malformed object metadata during the history secret scan.",
      );
    }
    metadata.set(objectId, { objectId, size, type });
  }

  if (metadata.size !== objectIds.length) {
    throw new HistorySecretScanError("Git returned an incomplete object metadata inventory.");
  }
  return metadata;
}

function scanObjectBatch(repositoryRoot, objects, objectIdPattern) {
  if (objects.length === 0) {
    return Promise.resolve({ binaryByType: {}, findings: [], scannedTextByType: {} });
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", ["--no-replace-objects", "cat-file", "--batch"], {
      cwd: repositoryRoot,
      env: isolatedGitEnvironment(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let pending = Buffer.alloc(0);
    let current = null;
    let objectIndex = 0;
    let parseError = null;
    const scannedTextByType = {};
    const binaryByType = {};
    const findings = [];

    const fail = (safeMessage) => {
      if (parseError) return;
      parseError = new HistorySecretScanError(
        typeof safeMessage === "string"
          ? safeMessage
          : "The Git object stream process failed closed.",
      );
      child.kill();
    };

    const consume = () => {
      while (!parseError) {
        if (!current) {
          const newlineIndex = pending.indexOf(10);
          if (newlineIndex < 0) return;
          const header = pending.subarray(0, newlineIndex).toString("utf8");
          pending = pending.subarray(newlineIndex + 1);
          const parts = header.split(" ");
          const expected = objects[objectIndex];
          const size = Number(parts[2]);
          if (
            parts.length !== 3 ||
            !objectIdPattern.test(parts[0]) ||
            parts[1] !== expected?.type ||
            !Number.isSafeInteger(size) ||
            !expected ||
            parts[0] !== expected.objectId ||
            size !== expected.size
          ) {
            fail("Git returned an unexpected object frame during the history secret scan.");
            return;
          }
          current = { ...expected, chunks: [], remaining: expected.size };
        }

        if (current.remaining > 0) {
          if (pending.length === 0) return;
          const consumedBytes = Math.min(current.remaining, pending.length);
          current.chunks.push(Buffer.from(pending.subarray(0, consumedBytes)));
          pending = pending.subarray(consumedBytes);
          current.remaining -= consumedBytes;
          if (current.remaining > 0) return;
        }

        if (pending.length === 0) return;
        if (pending[0] !== 10) {
          fail("Git returned a malformed object delimiter during the history secret scan.");
          return;
        }
        pending = pending.subarray(1);

        const buffer = Buffer.concat(current.chunks, current.size);
        const result = scanSecretBuffer(buffer, current.path);
        const countTarget = result.scanned ? scannedTextByType : binaryByType;
        countTarget[current.type] = (countTarget[current.type] ?? 0) + 1;
        findings.push(
          ...result.findings.map((finding) => ({ ...finding, objectId: current.objectId })),
        );
        current = null;
        objectIndex += 1;
      }
    };

    child.on("error", (error) => fail(error));
    child.stdout.on("data", (chunk) => {
      pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
      consume();
    });
    child.stdout.on("error", (error) => fail(error));
    child.stderr.resume();
    child.stdin.on("error", (error) => {
      if (!parseError) fail(error);
    });
    child.on("close", (code) => {
      if (parseError) {
        rejectPromise(parseError);
        return;
      }
      if (code !== 0 || current || pending.length > 0 || objectIndex !== objects.length) {
        rejectPromise(
          new HistorySecretScanError("Git object streaming did not complete cleanly."),
        );
        return;
      }
      resolvePromise({ binaryByType, findings, scannedTextByType });
    });

    child.stdin.end(`${objects.map((object) => object.objectId).join("\n")}\n`);
  });
}

function historicalPathLabel(path) {
  const digest = createHash("sha256").update(path, "utf8").digest("hex").slice(0, 12);
  return `[historical-path:${digest}]`;
}

async function scanRepositoryHistoryInternal(repositoryRoot) {
  const resolvedRoot = resolve(repositoryRoot);
  const contract = repositoryContract(resolvedRoot);
  assertCompleteHistory(resolvedRoot);
  const objectIds = reachableObjectIds(resolvedRoot, contract.objectIdPattern);
  const paths = historicalPaths(resolvedRoot);
  const metadata = objectMetadata(resolvedRoot, objectIds, contract.objectIdPattern);
  const findings = [];
  const objectsToScan = [];
  let reachableBlobCount = 0;
  let reachableCommitObjectCount = 0;
  let reachableTagObjectCount = 0;
  let streamedBlobBytes = 0;
  let streamedBytes = 0;

  for (const path of paths) {
    if (isForbiddenSigningPath(path)) {
      findings.push({
        detector: "mobile-signing-secret-file",
        line: 1,
        path: sanitizeSecretDiagnosticPath(path),
      });
    }
    const pathResult = scanSecretBuffer(Buffer.from(path, "utf8"), historicalPathLabel(path));
    findings.push(...pathResult.findings);
  }

  for (const objectId of objectIds) {
    const object = metadata.get(objectId);
    if (!object || !["blob", "commit", "tag"].includes(object.type)) continue;
    if (object.type === "blob") reachableBlobCount += 1;
    else if (object.type === "commit") reachableCommitObjectCount += 1;
    else reachableTagObjectCount += 1;
    const path = `[${object.type}:${objectId.slice(0, 12)}]`;
    if (object.size > MAX_FILE_BYTES) {
      findings.push({
        detector: "secret-scan-history-size-limit",
        line: 1,
        objectId,
        path,
      });
      continue;
    }
    streamedBytes += object.size;
    if (object.type === "blob") streamedBlobBytes += object.size;
    objectsToScan.push({ objectId, path, size: object.size, type: object.type });
  }

  const streamed = await scanObjectBatch(resolvedRoot, objectsToScan, contract.objectIdPattern);
  findings.push(...streamed.findings);
  findings.sort((left, right) => {
    const leftKey = `${left.path}\0${left.line}\0${left.detector}\0${left.objectId ?? ""}`;
    const rightKey = `${right.path}\0${right.line}\0${right.detector}\0${right.objectId ?? ""}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });

  const reachableCommitCount = Number(
    gitText(resolvedRoot, ["--no-replace-objects", "rev-list", "--count", "--all"]).trim(),
  );
  if (!Number.isSafeInteger(reachableCommitCount) || reachableCommitCount < 1) {
    throw new HistorySecretScanError("Git returned an invalid reachable commit count.");
  }

  return {
    binaryBlobs: streamed.binaryByType.blob ?? 0,
    binaryCommitObjects: streamed.binaryByType.commit ?? 0,
    binaryTagObjects: streamed.binaryByType.tag ?? 0,
    findings,
    historicalPathCount: paths.size,
    objectFormat: contract.objectFormat,
    reachableBlobCount,
    reachableCommitObjectCount,
    reachableCommitCount,
    reachableTagObjectCount,
    scannedCommitObjects: streamed.scannedTextByType.commit ?? 0,
    scannedTagObjects: streamed.scannedTextByType.tag ?? 0,
    scannedTextBlobs: streamed.scannedTextByType.blob ?? 0,
    streamedBlobBytes,
    streamedBytes,
  };
}

export async function scanRepositoryHistory(repositoryRoot = defaultRepositoryRoot) {
  try {
    return await scanRepositoryHistoryInternal(repositoryRoot);
  } catch (error) {
    if (error instanceof HistorySecretScanError) throw error;
    throw new HistorySecretScanError("The Git history secret scan failed closed.");
  }
}

export function historyFindingLines(result) {
  return result.findings.map((finding) => `  - ${formatSecretFinding(finding)}`);
}

function commandRepositoryRoot(arguments_) {
  if (arguments_.length === 0) return defaultRepositoryRoot;
  if (arguments_.length === 2 && arguments_[0] === "--repository-root") {
    return resolve(arguments_[1]);
  }
  throw new HistorySecretScanError("Unsupported history secret scan arguments.");
}

async function main(repositoryRoot) {
  const result = await scanRepositoryHistory(repositoryRoot);
  if (result.findings.length > 0) {
    console.error(
      `[history-secret-scan] Found ${result.findings.length} high-confidence history security finding(s):`,
    );
    for (const line of historyFindingLines(result)) console.error(line);
    console.error("[history-secret-scan] Values are intentionally omitted from output.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `[history-secret-scan] PASS: ${result.reachableCommitCount} commits (${result.scannedCommitObjects} commit objects), ${result.reachableTagObjectCount} annotated tag objects, ${result.reachableBlobCount} unique blobs, ${result.historicalPathCount} historical paths, ${result.scannedTextBlobs} text blobs and ${result.binaryBlobs} binary blobs inspected (${result.streamedBytes} bytes streamed, ${result.objectFormat}).`,
  );
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  Promise.resolve()
    .then(() => main(commandRepositoryRoot(process.argv.slice(2))))
    .catch((error) => {
      const message =
        error instanceof HistorySecretScanError
          ? error.message
          : "The Git history secret scan failed closed.";
      console.error(`[history-secret-scan] FAIL: ${message}`);
      process.exitCode = 1;
    });
}
