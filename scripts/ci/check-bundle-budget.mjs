import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const assetsDirectory = resolve(repositoryRoot, "dist/assets");
const baseline = JSON.parse(
  readFileSync(resolve(repositoryRoot, "scripts/ci/bundle-baseline.json"), "utf8"),
);

if (baseline.schemaVersion !== 1 || !baseline.ceilings) {
  throw new Error("Unsupported or malformed bundle baseline");
}

function summarize(extension) {
  const files = readdirSync(assetsDirectory)
    .filter((name) => name.endsWith(`.${extension}`))
    .map((name) => {
      const content = readFileSync(resolve(assetsDirectory, name));
      return {
        name,
        rawBytes: content.length,
        gzipBytes: gzipSync(content, { level: 9 }).length,
      };
    })
    .sort((left, right) => right.rawBytes - left.rawBytes);
  const largestGzipFile = files.toSorted((left, right) => right.gzipBytes - left.gzipBytes)[0];

  return {
    files: files.length,
    totalRawBytes: files.reduce((total, file) => total + file.rawBytes, 0),
    totalGzipBytes: files.reduce((total, file) => total + file.gzipBytes, 0),
    largestRawBytes: files[0]?.rawBytes ?? 0,
    largestGzipBytes: largestGzipFile?.gzipBytes ?? 0,
    largestRawFile: files[0]?.name ?? null,
    largestGzipFile: largestGzipFile?.name ?? null,
  };
}

const current = {
  javascript: summarize("js"),
  css: summarize("css"),
};
const failures = [];

for (const [assetType, ceilings] of Object.entries(baseline.ceilings)) {
  for (const [metric, ceiling] of Object.entries(ceilings)) {
    const actual = current[assetType]?.[metric];
    if (typeof actual !== "number" || actual > ceiling) {
      failures.push(`${assetType}.${metric}: ${actual ?? "missing"} > ${ceiling}`);
    }
  }
}

console.log(
  `[bundle-budget] JS ${current.javascript.totalRawBytes} raw / ${current.javascript.totalGzipBytes} gzip bytes; ` +
    `largest raw ${current.javascript.largestRawFile} (${current.javascript.largestRawBytes}), ` +
    `largest gzip ${current.javascript.largestGzipFile} (${current.javascript.largestGzipBytes}).`,
);
console.log(
  `[bundle-budget] CSS ${current.css.totalRawBytes} raw / ${current.css.totalGzipBytes} gzip bytes.`,
);

if (failures.length > 0) {
  console.error("[bundle-budget] Bundle debt ceiling exceeded:");
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error("[bundle-budget] Optimize the bundle or update the baseline in a reviewed change.");
  process.exit(1);
}

console.log("[bundle-budget] PASS: bundle size did not exceed the reviewed baseline.");
