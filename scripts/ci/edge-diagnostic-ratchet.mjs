import { relative } from "node:path";
import { fileURLToPath } from "node:url";

const ANSI_ESCAPE = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const LOCATION = /^\s*at (file:\/\/\/.*):(\d+):(\d+)\s*$/m;
const DIAGNOSTIC_START = /^TS(\d+) \[ERROR\]:(.*)$/gm;

function posixPath(path) {
  return path.replaceAll("\\", "/");
}

function diagnosticModule(file) {
  return file.match(/^supabase\/functions\/([^/]+)\//)?.[1] ?? "<external>";
}

export function parseDenoDiagnostics(output, repositoryRoot) {
  const cleanOutput = output.replace(ANSI_ESCAPE, "");
  const starts = [...cleanOutput.matchAll(DIAGNOSTIC_START)];

  return starts.map((start, index) => {
    const blockEnd = starts[index + 1]?.index ?? cleanOutput.length;
    const block = cleanOutput.slice(start.index, blockEnd);
    const location = block.match(LOCATION);
    let file = "<unknown>";

    if (location) {
      try {
        const absolutePath = fileURLToPath(location[1]);
        const repositoryPath = relative(repositoryRoot, absolutePath);
        file = repositoryPath.startsWith("..")
          ? `<external>/${posixPath(absolutePath)}`
          : posixPath(repositoryPath);
      } catch {
        file = "<invalid-file-url>";
      }
    }

    return {
      code: `TS${start[1]}`,
      message: start[2].trim(),
      file,
      module: diagnosticModule(file),
      line: location ? Number(location[2]) : null,
      column: location ? Number(location[3]) : null,
    };
  });
}

export function reportedDenoErrorCount(output) {
  const cleanOutput = output.replace(ANSI_ESCAPE, "");
  const match = cleanOutput.match(/\bFound (\d+) errors?\./);
  return match ? Number(match[1]) : null;
}

export function validateDiagnosticBaseline(baseline) {
  const problems = [];
  if (baseline?.schemaVersion !== 1) problems.push("schemaVersion must be 1");
  if (!/^\d+\.\d+\.\d+$/.test(baseline?.denoVersion ?? "")) {
    problems.push("denoVersion must be an exact semantic version");
  }
  if (!Number.isInteger(baseline?.totalErrorCeiling) || baseline.totalErrorCeiling < 0) {
    problems.push("totalErrorCeiling must be a non-negative integer");
  }

  const modules = baseline?.moduleErrorCeilings;
  if (!modules || Array.isArray(modules) || typeof modules !== "object") {
    problems.push("moduleErrorCeilings must be an object");
  } else {
    for (const [module, ceiling] of Object.entries(modules)) {
      if (!module || !Number.isInteger(ceiling) || ceiling < 0) {
        problems.push(`invalid module ceiling: ${module || "<empty>"}`);
      }
    }
  }

  const files = baseline?.fileErrorCeilings;
  if (!files || Array.isArray(files) || typeof files !== "object") {
    problems.push("fileErrorCeilings must be an object");
  } else {
    for (const [file, ceiling] of Object.entries(files)) {
      if (!file.startsWith("supabase/functions/") || !Number.isInteger(ceiling) || ceiling < 0) {
        problems.push(`invalid file ceiling: ${file || "<empty>"}`);
      }
    }
  }

  const allowedUnpinnedImports = baseline?.allowedUnpinnedImports;
  if (!Array.isArray(allowedUnpinnedImports)) {
    problems.push("allowedUnpinnedImports must be an array");
  } else {
    const keys = new Set();
    for (const item of allowedUnpinnedImports) {
      if (
        typeof item?.file !== "string" ||
        !item.file.startsWith("supabase/functions/") ||
        typeof item?.specifier !== "string" ||
        item.specifier.length === 0
      ) {
        problems.push("allowedUnpinnedImports contains a malformed entry");
        continue;
      }
      const key = `${item.file}\0${item.specifier}`;
      if (keys.has(key)) problems.push(`duplicate allowed unpinned import: ${item.file}`);
      keys.add(key);
    }
  }

  if (problems.length > 0) return problems;

  const moduleTotal = Object.values(modules).reduce((sum, ceiling) => sum + ceiling, 0);
  const fileTotal = Object.values(files).reduce((sum, ceiling) => sum + ceiling, 0);
  if (moduleTotal !== baseline.totalErrorCeiling) {
    problems.push(`module ceilings total ${moduleTotal}, expected ${baseline.totalErrorCeiling}`);
  }
  if (fileTotal !== baseline.totalErrorCeiling) {
    problems.push(`file ceilings total ${fileTotal}, expected ${baseline.totalErrorCeiling}`);
  }
  for (const [module, ceiling] of Object.entries(modules)) {
    const moduleFileTotal = Object.entries(files)
      .filter(([file]) => diagnosticModule(file) === module)
      .reduce((sum, [, fileCeiling]) => sum + fileCeiling, 0);
    if (moduleFileTotal !== ceiling) {
      problems.push(
        `${module} file ceilings total ${moduleFileTotal}, expected module ceiling ${ceiling}`,
      );
    }
  }
  for (const file of Object.keys(files)) {
    const module = diagnosticModule(file);
    if (!Object.hasOwn(modules, module)) {
      problems.push(`${file} belongs to module missing from moduleErrorCeilings`);
    }
  }

  return problems;
}

export function evaluateUnpinnedImportRatchet({ baseline, unpinnedImports }) {
  const allowed = new Set(
    baseline.allowedUnpinnedImports.map((item) => `${item.file}\0${item.specifier}`),
  );
  return unpinnedImports.filter(
    (item) => !allowed.has(`${item.file}\0${item.specifier}`),
  );
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  return counts;
}

export function evaluateDiagnosticRatchet({ baseline, diagnostics, functionNames }) {
  const violations = [];
  const baselineModules = new Set(Object.keys(baseline.moduleErrorCeilings));
  const inventoryModules = new Set(functionNames);
  const newModules = functionNames.filter((module) => !baselineModules.has(module));
  const removedModules = [...baselineModules].filter((module) => !inventoryModules.has(module));

  if (newModules.length > 0) {
    violations.push({ kind: "new-module", modules: newModules });
  }
  if (removedModules.length > 0) {
    violations.push({ kind: "removed-module", modules: removedModules });
  }

  const moduleCounts = countBy(diagnostics, "module");
  const fileCounts = countBy(diagnostics, "file");

  for (const [module, actual] of [...moduleCounts].sort(([a], [b]) => a.localeCompare(b))) {
    const ceiling = baseline.moduleErrorCeilings[module] ?? 0;
    if (actual > ceiling) {
      violations.push({ kind: "module-ceiling", module, actual, ceiling });
    }
  }
  for (const [file, actual] of [...fileCounts].sort(([a], [b]) => a.localeCompare(b))) {
    const ceiling = baseline.fileErrorCeilings[file] ?? 0;
    if (actual > ceiling) {
      violations.push({ kind: "file-ceiling", file, actual, ceiling });
    }
  }
  if (diagnostics.length > baseline.totalErrorCeiling) {
    violations.push({
      kind: "total-ceiling",
      actual: diagnostics.length,
      ceiling: baseline.totalErrorCeiling,
    });
  }

  return {
    violations,
    moduleCounts: Object.fromEntries([...moduleCounts].sort(([a], [b]) => a.localeCompare(b))),
    fileCounts: Object.fromEntries([...fileCounts].sort(([a], [b]) => a.localeCompare(b))),
  };
}
