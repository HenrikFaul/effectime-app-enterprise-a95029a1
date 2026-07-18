import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDenoInvocation,
  DENO_VERSION,
  parseDenoVersion,
} from "./deno-runtime.mjs";

const baseline = JSON.parse(
  readFileSync(new URL("./edge-diagnostics-baseline.json", import.meta.url), "utf8"),
);

test("Deno runtime version comes from the reviewed diagnostic baseline", () => {
  assert.equal(DENO_VERSION, baseline.denoVersion);
  assert.equal(parseDenoVersion(`deno ${DENO_VERSION} (stable, release, x86_64)\nv8 1.0`), DENO_VERSION);
  assert.equal(parseDenoVersion("not deno output"), null);
});

test("configured DENO_BIN takes precedence over every discovered runtime", () => {
  assert.deepEqual(
    buildDenoInvocation({
      configuredBin: "/opt/effectime/deno",
      nativeDenoAvailable: true,
      npmExecPath: "/opt/npm/npm-cli.js",
      nodeExecutable: "/opt/node",
      platform: "linux",
    }),
    { command: "/opt/effectime/deno", prefix: [], shell: false },
  );
});

test("native Deno takes precedence over npm fallbacks", () => {
  assert.deepEqual(
    buildDenoInvocation({
      nativeDenoAvailable: true,
      npmExecPath: "/opt/npm/npm-cli.js",
      nodeExecutable: "/opt/node",
      platform: "linux",
    }),
    { command: "deno", prefix: [], shell: false },
  );
});

test("npm_execpath fallback is shell-free on Windows and POSIX and pins the reviewed version", () => {
  assert.deepEqual(
    buildDenoInvocation({
      nativeDenoAvailable: false,
      npmExecPath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
      nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
      platform: "win32",
    }),
    {
      command: "C:\\Program Files\\nodejs\\node.exe",
      prefix: [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "exec",
        "--yes",
        "--package",
        `deno@${DENO_VERSION}`,
        "--",
        "deno",
      ],
      shell: false,
    },
  );

  assert.deepEqual(
    buildDenoInvocation({
      nativeDenoAvailable: false,
      npmExecPath: "/opt/node/lib/node_modules/npm/bin/npm-cli.js",
      nodeExecutable: "/opt/node/bin/node",
      platform: "linux",
    }),
    {
      command: "/opt/node/bin/node",
      prefix: [
        "/opt/node/lib/node_modules/npm/bin/npm-cli.js",
        "exec",
        "--yes",
        "--package",
        `deno@${DENO_VERSION}`,
        "--",
        "deno",
      ],
      shell: false,
    },
  );
});

test("npx fallback uses the platform-appropriate shell behavior", () => {
  const windows = buildDenoInvocation({
    nativeDenoAvailable: false,
    platform: "win32",
  });
  const posix = buildDenoInvocation({
    nativeDenoAvailable: false,
    platform: "linux",
  });

  assert.deepEqual(windows, {
    command: "npx",
    prefix: ["--yes", `deno@${DENO_VERSION}`],
    shell: true,
  });
  assert.deepEqual(posix, {
    command: "npx",
    prefix: ["--yes", `deno@${DENO_VERSION}`],
    shell: false,
  });
});
