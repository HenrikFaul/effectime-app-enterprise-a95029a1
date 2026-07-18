import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  computeEdgeSourceTreeIdentity,
  isEdgeSourceIdentityInput,
  normalizeSourceLineEndings,
  selectEdgeSourceIdentityInputs,
  verifyGeneratedEdgeSourceIdentity,
} from "./edge-source-identity.mjs";

function fixture() {
  const repositoryRoot = mkdtempSync(resolve(tmpdir(), "effectime-edge-identity-"));
  const functionsRoot = resolve(repositoryRoot, "supabase/functions");
  mkdirSync(resolve(functionsRoot, "_shared"), { recursive: true });
  mkdirSync(resolve(functionsRoot, "alpha"), { recursive: true });
  writeFileSync(resolve(functionsRoot, "alpha/index.ts"), "export const alpha = true;\n");
  writeFileSync(resolve(functionsRoot, "_shared/helper.ts"), "export const helper = 1;\n");
  writeFileSync(
    resolve(functionsRoot, "_shared/release-artifact.ts"),
    'export const EFFECTIME_EDGE_SOURCE_TREE_SHA256 = "0" as const;\n',
  );
  return repositoryRoot;
}

test("source identity input selection is deterministic and excludes generated or irrelevant files", () => {
  const selected = selectEdgeSourceIdentityInputs([
    "supabase/functions/alpha/index.ts",
    "supabase/functions/_shared/release-artifact.ts",
    "supabase/functions/alpha/deno.lock",
    "supabase/functions/alpha/README.md",
    "src/unrelated.ts",
    "supabase\\functions\\_shared\\helper.ts",
    "supabase/functions/alpha/index.ts",
  ]);

  assert.deepEqual(selected, ["_shared/helper.ts", "alpha/deno.lock", "alpha/index.ts"]);
  assert.equal(isEdgeSourceIdentityInput("_shared/release-artifact.ts"), false);
  assert.equal(isEdgeSourceIdentityInput("alpha/config.json"), true);
});

test("line-ending normalization preserves non-line-ending bytes", () => {
  const source = Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62, 0x0d, 0x63]);
  assert.deepEqual(
    normalizeSourceLineEndings(source),
    Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0x0a, 0x62, 0x0a, 0x63]),
  );
});

test("source tree identity is stable across input order and checkout line endings", () => {
  const repositoryRoot = fixture();
  try {
    const paths = ["alpha/index.ts", "_shared/helper.ts"];
    const first = computeEdgeSourceTreeIdentity({ repositoryRoot, relativePaths: paths });

    writeFileSync(
      resolve(repositoryRoot, "supabase/functions/alpha/index.ts"),
      "export const alpha = true;\r\n",
    );
    const second = computeEdgeSourceTreeIdentity({
      repositoryRoot,
      relativePaths: paths.toReversed(),
    });

    assert.deepEqual(second, first);
    assert.match(first.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(first.files, 2);
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("source path and content changes produce a different identity", () => {
  const repositoryRoot = fixture();
  try {
    const initial = computeEdgeSourceTreeIdentity({
      repositoryRoot,
      relativePaths: ["alpha/index.ts", "_shared/helper.ts"],
    });
    writeFileSync(
      resolve(repositoryRoot, "supabase/functions/_shared/helper.ts"),
      "export const helper = 2;\n",
    );
    const contentChanged = computeEdgeSourceTreeIdentity({
      repositoryRoot,
      relativePaths: ["alpha/index.ts", "_shared/helper.ts"],
    });
    const pathChanged = computeEdgeSourceTreeIdentity({
      repositoryRoot,
      relativePaths: ["alpha/index.ts"],
    });

    assert.notEqual(contentChanged.sha256, initial.sha256);
    assert.notEqual(pathChanged.sha256, contentChanged.sha256);
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("source tree identity refuses an empty attestation", () => {
  const repositoryRoot = fixture();
  try {
    assert.throws(
      () => computeEdgeSourceTreeIdentity({ repositoryRoot, relativePaths: [] }),
      /refusing to attest an empty tree/u,
    );
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("generated identity verification fails closed on source drift", () => {
  const repositoryRoot = fixture();
  try {
    const relativePaths = ["alpha/index.ts", "_shared/helper.ts"];
    const identity = computeEdgeSourceTreeIdentity({ repositoryRoot, relativePaths });
    writeFileSync(
      resolve(repositoryRoot, "supabase/functions/_shared/release-artifact.ts"),
      `export const EFFECTIME_EDGE_SOURCE_TREE_SHA256 = "${identity.sha256}" as const;\n`,
    );

    assert.deepEqual(
      verifyGeneratedEdgeSourceIdentity({ repositoryRoot, relativePaths }),
      identity,
    );

    writeFileSync(
      resolve(repositoryRoot, "supabase/functions/alpha/index.ts"),
      "export const alpha = false;\n",
    );
    assert.throws(
      () => verifyGeneratedEdgeSourceIdentity({ repositoryRoot, relativePaths }),
      /Generated Edge identity drift/u,
    );
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});
