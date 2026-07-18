import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  buildDenoTestArguments,
  buildDenoTestCommand,
  discoverEdgeTestFiles,
} from "./run-edge-tests.mjs";

function entry(name, type) {
  return {
    name,
    isDirectory: () => type === "directory",
    isFile: () => type === "file",
  };
}

test("discovers only Edge .test.ts files recursively in deterministic order", () => {
  const root = resolve("test-fixtures/edge-functions");
  const shared = join(root, "_shared");
  const payroll = join(root, "payroll-export");
  const tree = new Map([
    [root, [
      entry("payroll-export", "directory"),
      entry("ignored.test.tsx", "file"),
      entry("_shared", "directory"),
      entry("root.test.ts", "file"),
      entry("linked.test.ts", "symlink"),
    ]],
    [shared, [entry("structured-logger.test.ts", "file")]],
    [payroll, [
      entry("support.ts", "file"),
      entry("payroll-contract.test.ts", "file"),
    ]],
  ]);

  const discovered = discoverEdgeTestFiles(root, (directory) => {
    const entries = tree.get(directory);
    if (!entries) throw new Error(`Unexpected directory: ${directory}`);
    return entries;
  });

  assert.deepEqual(discovered, [
    join(shared, "structured-logger.test.ts"),
    join(payroll, "payroll-contract.test.ts"),
    join(root, "root.test.ts"),
  ]);
});

test("builds one sorted, duplicate-free and isolated Deno test argument list", () => {
  const root = resolve("repository");
  const payroll = join(root, "supabase/functions/payroll/payroll.test.ts");
  const logger = join(root, "supabase/functions/_shared/logger.test.ts");

  assert.deepEqual(buildDenoTestArguments(root, [payroll, logger, payroll]), [
    "test",
    "--node-modules-dir=none",
    "--no-lock",
    "supabase/functions/_shared/logger.test.ts",
    "supabase/functions/payroll/payroll.test.ts",
  ]);
  assert.throws(
    () => buildDenoTestArguments(root, []),
    /No Edge Deno test files found/,
  );
  assert.throws(
    () => buildDenoTestArguments(root, [resolve(root, "../outside.test.ts")]),
    /escapes the repository root/,
  );
});

test("combines the resolved runtime prefix and Deno arguments without a shell rewrite", () => {
  assert.deepEqual(
    buildDenoTestCommand(
      { command: "node", prefix: ["npm-cli.js", "exec", "--", "deno"], shell: false },
      ["test", "--node-modules-dir=none", "--no-lock", "one.test.ts"],
    ),
    {
      command: "node",
      args: [
        "npm-cli.js",
        "exec",
        "--",
        "deno",
        "test",
        "--node-modules-dir=none",
        "--no-lock",
        "one.test.ts",
      ],
      shell: false,
    },
  );
});
