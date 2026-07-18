import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateDiagnosticRatchet,
  evaluateUnpinnedImportRatchet,
} from "./edge-diagnostic-ratchet.mjs";

const baseline = {
  schemaVersion: 1,
  denoVersion: "2.9.3",
  totalErrorCeiling: 1,
  moduleErrorCeilings: { alpha: 1 },
  fileErrorCeilings: { "supabase/functions/alpha/index.ts": 1 },
  allowedUnpinnedImports: [
    { file: "supabase/functions/alpha/index.ts", specifier: "npm:legacy@1" },
  ],
};
const knownDiagnostic = {
  code: "TS0001",
  file: "supabase/functions/alpha/index.ts",
  module: "alpha",
  line: 1,
  column: 1,
};

test("ratchet accepts the approved diagnostic ceiling and reductions", () => {
  assert.equal(
    evaluateDiagnosticRatchet({
      baseline,
      diagnostics: [knownDiagnostic],
      functionNames: ["alpha"],
    }).violations.length,
    0,
  );
  assert.equal(
    evaluateDiagnosticRatchet({ baseline, diagnostics: [], functionNames: ["alpha"] }).violations
      .length,
    0,
  );
});

test("ratchet rejects a diagnostic above the file, module and total baseline", () => {
  const result = evaluateDiagnosticRatchet({
    baseline,
    diagnostics: [knownDiagnostic, { ...knownDiagnostic, line: 2 }],
    functionNames: ["alpha"],
  });

  assert.deepEqual(
    new Set(result.violations.map(({ kind }) => kind)),
    new Set(["file-ceiling", "module-ceiling", "total-ceiling"]),
  );
});

test("ratchet rejects a module that is not in the reviewed baseline", () => {
  const result = evaluateDiagnosticRatchet({
    baseline,
    diagnostics: [],
    functionNames: ["alpha", "beta"],
  });

  assert.deepEqual(result.violations, [{ kind: "new-module", modules: ["beta"] }]);
});

test("ratchet rejects a new unpinned import but allows removal", () => {
  assert.deepEqual(
    evaluateUnpinnedImportRatchet({ baseline, unpinnedImports: [] }),
    [],
  );
  assert.deepEqual(
    evaluateUnpinnedImportRatchet({
      baseline,
      unpinnedImports: [
        { file: "supabase/functions/alpha/index.ts", specifier: "npm:legacy@1" },
      ],
    }),
    [],
  );
  assert.deepEqual(
    evaluateUnpinnedImportRatchet({
      baseline,
      unpinnedImports: [
        { file: "supabase/functions/alpha/index.ts", specifier: "npm:new-floating" },
      ],
    }),
    [{ file: "supabase/functions/alpha/index.ts", specifier: "npm:new-floating" }],
  );
});
