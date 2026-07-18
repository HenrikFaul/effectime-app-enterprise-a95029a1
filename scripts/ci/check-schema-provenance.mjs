import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCHEMA_KINDS,
  analyzeSchemaProvenance,
  compareSchemaProvenance,
  mergeSchemaSurfaces,
  parseGeneratedPublicSchema,
  parseMigrationDefinitions,
  validateSchemaProvenanceBaseline,
} from "./schema-provenance.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const typesPath = join(repositoryRoot, "src/integrations/supabase/types.ts");
const migrationsPath = join(repositoryRoot, "supabase/migrations");
const baselinePath = join(repositoryRoot, "scripts/ci/schema-provenance-baseline.json");

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const baselineProblems = validateSchemaProvenanceBaseline(baseline);
if (baselineProblems.length > 0) {
  console.error("Schema provenance baseline is invalid:");
  for (const problem of baselineProblems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  const migrationFiles = (await readdir(migrationsPath))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const generatedSurface = parseGeneratedPublicSchema(await readFile(typesPath, "utf8"));
  const migrationSurface = mergeSchemaSurfaces(
    await Promise.all(
      migrationFiles.map(async (file) =>
        parseMigrationDefinitions(await readFile(join(migrationsPath, file), "utf8")),
      ),
    ),
  );
  const actual = analyzeSchemaProvenance(generatedSurface, migrationSurface);
  const violations = compareSchemaProvenance(actual, baseline);

  console.log(`Schema provenance scanned ${migrationFiles.length} migration file(s).`);
  for (const kind of SCHEMA_KINDS) {
    const generated = actual.generatedSurface[kind].length;
    const debt = actual.unprovenGeneratedSurface[kind].length;
    console.log(`${kind}: ${generated} generated, ${generated - debt} migration-backed, ${debt} known unproven`);
  }

  if (violations.length === 0) {
    console.log("Schema provenance gate passed: generated surface and exact debt baseline are unchanged.");
  } else {
    console.error("Schema provenance gate failed; review the change and update the exact baseline intentionally:");
    for (const violation of violations) {
      const label = `${violation.section}.${violation.kind}`;
      if (violation.added.length) console.error(`- ${label} added: ${violation.added.join(", ")}`);
      if (violation.removed.length) console.error(`- ${label} removed: ${violation.removed.join(", ")}`);
    }
    process.exitCode = 1;
  }
}
