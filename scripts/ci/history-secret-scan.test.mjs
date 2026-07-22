import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { historyFindingLines, scanRepositoryHistory } from "./history-secret-scan.mjs";
import { MAX_FILE_BYTES, scanSecretBuffer } from "./secret-scan-core.mjs";

const temporaryRoots = new Set();
const historyScannerPath = fileURLToPath(new URL("./history-secret-scan.mjs", import.meta.url));

function temporaryDirectory(name) {
  const directory = mkdtempSync(join(tmpdir(), `effectime-${name}-`));
  temporaryRoots.add(directory);
  return directory;
}

function git(repositoryRoot, arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

function initializeRepository(repositoryRoot, objectFormat = "sha1") {
  git(repositoryRoot, [
    "init",
    "--quiet",
    "-b",
    "main",
    ...(objectFormat === "sha256" ? ["--object-format=sha256"] : []),
  ]);
  git(repositoryRoot, ["config", "user.email", "ci-secret-scan@effectime.test"]);
  git(repositoryRoot, ["config", "user.name", "Effectime CI"]);
  git(repositoryRoot, ["config", "commit.gpgsign", "false"]);
  git(repositoryRoot, ["config", "tag.gpgSign", "false"]);
  git(repositoryRoot, ["config", "core.autocrlf", "false"]);
  git(repositoryRoot, ["config", "gc.auto", "0"]);
}

function commitAll(repositoryRoot, message) {
  git(repositoryRoot, ["add", "--all"]);
  git(repositoryRoot, ["commit", "--quiet", "--no-gpg-sign", "--no-verify", "-m", message]);
}

function jwt(role, signature = "signature") {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.${Buffer.from(signature).toString("base64url")}`;
}

test.after(() => {
  for (const directory of temporaryRoots) {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("shared detectors reject service-role JWTs but allow anonymous JWTs", () => {
  const anonymous = scanSecretBuffer(Buffer.from(jwt("anon")), "anonymous.fixture");
  const serviceRole = scanSecretBuffer(Buffer.from(jwt("service_role")), "service.fixture");

  assert.equal(anonymous.findings.length, 0);
  assert.deepEqual(serviceRole.findings.map((finding) => finding.detector), [
    "supabase-service-role-jwt",
  ]);
  assert.equal(Object.hasOwn(serviceRole.findings[0], "value"), false);
});

test("shared high-confidence detector families remain covered", () => {
  const fixtures = new Map([
    ["private-key", "-----BEGIN " + "ENCRYPTED PRIVATE KEY-----"],
    ["aws-access-key", "AKIA" + "A".repeat(16)],
    ["github-token", "ghp_" + "B".repeat(40)],
    ["google-api-key", "AIza" + "C".repeat(35)],
    ["slack-token", "xoxb-" + "D".repeat(24)],
    ["stripe-live-key", "sk_live_" + "E".repeat(24)],
    ["openai-api-key", "sk-" + "F".repeat(36)],
    ["anthropic-api-key", "sk-ant-" + "G".repeat(36)],
    ["supabase-secret-key", "sb_secret_" + "H".repeat(24)],
  ]);

  for (const [expectedDetector, fixture] of fixtures) {
    const result = scanSecretBuffer(Buffer.from(fixture), `${expectedDetector}.fixture`);
    assert.equal(
      result.findings.some((finding) => finding.detector === expectedDetector),
      true,
      `Expected detector ${expectedDetector} to match its synthetic fixture.`,
    );
    assert.equal(JSON.stringify(result.findings).includes(fixture), false);
  }

  const pgp = scanSecretBuffer(
    Buffer.from("-----BEGIN " + "PGP PRIVATE KEY BLOCK-----"),
    "pgp.fixture",
  );
  assert.equal(pgp.findings.some((finding) => finding.detector === "private-key"), true);
});

test("history scan detects committed-then-deleted secrets without returning values", async () => {
  const repositoryRoot = temporaryDirectory("history-secret");
  initializeRepository(repositoryRoot);
  const providerToken = "ghp_" + "J".repeat(40);
  const commitMessageToken = "ghp_" + "K".repeat(40);
  const filenameToken = "ghp_" + "L".repeat(40);
  const serviceRoleToken = jwt("service_role");
  const tagServiceRoleToken = jwt("service_role", "tag-signature");
  const lineSentinel = "SECRET_LINE_MUST_NEVER_BE_LOGGED";
  const signingDirectory = join(repositoryRoot, "android");
  const signingPath = join(signingDirectory, "Árvíztűrő Release Candidate." + "keystore");
  const safeAliasDirectory = join(repositoryRoot, "fixtures");
  const safeAliasPath = join(safeAliasDirectory, "path=binary-sample.dat");
  const secretFilenameDirectory = join(repositoryRoot, "archive");
  const secretFilenamePath = join(secretFilenameDirectory, `${filenameToken}.txt`);
  mkdirSync(signingDirectory, { recursive: true });
  mkdirSync(safeAliasDirectory, { recursive: true });
  mkdirSync(secretFilenameDirectory, { recursive: true });
  writeFileSync(
    join(repositoryRoot, "provider.txt"),
    `${lineSentinel}:${providerToken}\n`,
    "utf8",
  );
  writeFileSync(join(repositoryRoot, "service.txt"), `${serviceRoleToken}\n`, "utf8");
  const binaryFixture = Buffer.from([0, 1, 2, 3, 4, 5]);
  writeFileSync(signingPath, binaryFixture);
  writeFileSync(safeAliasPath, binaryFixture);
  writeFileSync(secretFilenamePath, "clean filename fixture\n", "utf8");
  commitAll(repositoryRoot, `add synthetic credentials ${commitMessageToken}`);
  git(repositoryRoot, [
    "tag",
    "--annotate",
    "--message",
    `synthetic tag credential ${tagServiceRoleToken}`,
    "secret-fixture",
  ]);

  unlinkSync(join(repositoryRoot, "provider.txt"));
  unlinkSync(join(repositoryRoot, "service.txt"));
  unlinkSync(signingPath);
  unlinkSync(safeAliasPath);
  unlinkSync(secretFilenamePath);
  commitAll(repositoryRoot, "remove synthetic credentials");

  const result = await scanRepositoryHistory(repositoryRoot);
  const detectors = new Set(result.findings.map((finding) => finding.detector));
  assert.equal(detectors.has("github-token"), true);
  assert.equal(detectors.has("supabase-service-role-jwt"), true);
  assert.equal(detectors.has("mobile-signing-secret-file"), true);
  assert.equal(result.findings.some((finding) => finding.path.startsWith("[commit:")), true);
  assert.equal(result.findings.some((finding) => finding.path.startsWith("[tag:")), true);
  assert.equal(
    result.findings.some((finding) => finding.path.startsWith("[historical-path:")),
    true,
  );
  const serialized = JSON.stringify(result.findings);
  const diagnosticOutput = historyFindingLines(result).join("\n");
  for (const value of [
    providerToken,
    commitMessageToken,
    filenameToken,
    serviceRoleToken,
    tagServiceRoleToken,
    lineSentinel,
  ]) {
    assert.equal(serialized.includes(value), false);
    assert.equal(diagnosticOutput.includes(value), false);
  }
  assert.equal(result.findings.every((finding) => !Object.hasOwn(finding, "value")), true);

  const rerun = await scanRepositoryHistory(repositoryRoot);
  assert.deepEqual(rerun.findings, result.findings);

  const cli = spawnSync(
    process.execPath,
    [historyScannerPath, "--repository-root", repositoryRoot],
    { encoding: "utf8", timeout: 30_000, windowsHide: true },
  );
  const cliOutput = `${cli.stdout ?? ""}\n${cli.stderr ?? ""}`;
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /Values are intentionally omitted/);
  assert.match(cli.stderr, /github-token/);
  assert.match(cli.stderr, /supabase-service-role-jwt/);
  for (const value of [
    providerToken,
    commitMessageToken,
    filenameToken,
    serviceRoleToken,
    tagServiceRoleToken,
    lineSentinel,
  ]) {
    assert.equal(cliOutput.includes(value), false);
  }
});

test("history scan accepts clean history and anonymous public credentials", async () => {
  const repositoryRoot = temporaryDirectory("history-clean");
  initializeRepository(repositoryRoot);
  writeFileSync(join(repositoryRoot, "public-client.txt"), `${jwt("anon")}\n`, "utf8");
  writeFileSync(join(repositoryRoot, "empty.txt"), Buffer.alloc(0));
  commitAll(repositoryRoot, "add public client credential");

  const result = await scanRepositoryHistory(repositoryRoot);
  assert.equal(result.findings.length, 0);
  assert.equal(result.reachableCommitCount, 1);
  assert.equal(result.scannedTextBlobs > 0, true);
});

test("history scan supports SHA-256 repositories", async () => {
  const repositoryRoot = temporaryDirectory("history-sha256");
  initializeRepository(repositoryRoot, "sha256");
  writeFileSync(join(repositoryRoot, "clean.txt"), "clean\n", "utf8");
  commitAll(repositoryRoot, "add clean SHA-256 fixture");

  const result = await scanRepositoryHistory(repositoryRoot);
  assert.equal(result.objectFormat, "sha256");
  assert.equal(result.findings.length, 0);
  assert.equal(result.reachableCommitCount, 1);
});

test("history scan includes a detached HEAD that is absent from all refs", async () => {
  const repositoryRoot = temporaryDirectory("history-detached-head");
  initializeRepository(repositoryRoot);
  writeFileSync(join(repositoryRoot, "base.txt"), "base\n", "utf8");
  commitAll(repositoryRoot, "add referenced base");
  git(repositoryRoot, ["switch", "--detach", "--quiet", "HEAD"]);

  const detachedToken = "ghp_" + "Q".repeat(40);
  writeFileSync(join(repositoryRoot, "detached-secret.txt"), `${detachedToken}\n`, "utf8");
  commitAll(repositoryRoot, `add detached credential ${detachedToken}`);
  unlinkSync(join(repositoryRoot, "detached-secret.txt"));
  commitAll(repositoryRoot, "remove detached credential");

  const referencedObjects = git(repositoryRoot, ["rev-parse", "--all"])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  assert.equal(referencedObjects.length, 1);
  assert.notEqual(referencedObjects[0], git(repositoryRoot, ["rev-parse", "HEAD"]).trim());
  const result = await scanRepositoryHistory(repositoryRoot);
  assert.equal(result.reachableCommitCount, 3);
  assert.equal(
    result.findings.some((finding) => finding.detector === "github-token"),
    true,
  );
  assert.equal(JSON.stringify(result.findings).includes(detachedToken), false);
  assert.equal(historyFindingLines(result).join("\n").includes(detachedToken), false);
});

test("history scan fails closed for oversized reachable objects", async () => {
  const repositoryRoot = temporaryDirectory("history-oversized");
  initializeRepository(repositoryRoot);
  writeFileSync(join(repositoryRoot, "oversized.txt"), Buffer.alloc(MAX_FILE_BYTES + 1, 90));
  commitAll(repositoryRoot, "add oversized fixture");

  const result = await scanRepositoryHistory(repositoryRoot);
  assert.equal(
    result.findings.some((finding) => finding.detector === "secret-scan-history-size-limit"),
    true,
  );
});

test("history scan fails closed for shallow repositories", async () => {
  const sourceRoot = temporaryDirectory("history-source");
  const cloneParent = temporaryDirectory("history-shallow-parent");
  const shallowRoot = join(cloneParent, "clone");
  initializeRepository(sourceRoot);
  writeFileSync(join(sourceRoot, "first.txt"), "first\n", "utf8");
  commitAll(sourceRoot, "first commit");
  writeFileSync(join(sourceRoot, "second.txt"), "second\n", "utf8");
  commitAll(sourceRoot, "second commit");
  execFileSync(
    "git",
    ["clone", "--quiet", "--depth=1", "--no-local", pathToFileURL(sourceRoot).href, shallowRoot],
    { windowsHide: true },
  );
  assert.equal(git(shallowRoot, ["rev-parse", "--is-shallow-repository"]).trim(), "true");

  await assert.rejects(() => scanRepositoryHistory(shallowRoot), /Git history is shallow/);
});

test("history scan redacts externally sourced Git failures", async () => {
  const repositoryRoot = temporaryDirectory("history-broken-ref");
  initializeRepository(repositoryRoot);
  writeFileSync(join(repositoryRoot, "clean.txt"), "clean\n", "utf8");
  commitAll(repositoryRoot, "add clean fixture");
  const refToken = "ghp_" + "R".repeat(40);
  writeFileSync(
    join(repositoryRoot, ".git", "refs", "heads", refToken),
    `${"f".repeat(40)}\n`,
    "utf8",
  );

  await assert.rejects(
    () => scanRepositoryHistory(repositoryRoot),
    (error) => error instanceof Error && !error.message.includes(refToken),
  );
  const cli = spawnSync(
    process.execPath,
    [historyScannerPath, "--repository-root", repositoryRoot],
    { encoding: "utf8", timeout: 30_000, windowsHide: true },
  );
  const output = `${cli.stdout ?? ""}\n${cli.stderr ?? ""}`;
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /\[history-secret-scan\] FAIL:/);
  assert.equal(output.includes(refToken), false);
});

test("history scan rejects a missing reachable object", async () => {
  const repositoryRoot = temporaryDirectory("history-missing-object");
  initializeRepository(repositoryRoot);
  writeFileSync(join(repositoryRoot, "reachable.txt"), "reachable\n", "utf8");
  commitAll(repositoryRoot, "add reachable blob");
  const objectId = git(repositoryRoot, ["rev-parse", "HEAD:reachable.txt"]).trim();
  unlinkSync(join(repositoryRoot, ".git", "objects", objectId.slice(0, 2), objectId.slice(2)));

  await assert.rejects(() => scanRepositoryHistory(repositoryRoot));
});
