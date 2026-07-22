import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const importer = readFileSync(join(root, "supabase/functions/import-entity-data/index.ts"), "utf8");
const handler = readFileSync(
  join(root, "supabase/functions/import-entity-data/handler.ts"),
  "utf8",
);
const entitlement = readFileSync(
  join(root, "supabase/functions/import-entity-data/entitlement.ts"),
  "utf8",
);
const featureCatalog = readFileSync(join(root, "docs/tiering/features.csv"), "utf8");
const tiersMatrix = readFileSync(join(root, "docs/tiering/tiers_matrix.csv"), "utf8");

describe("CSV import Edge entitlement contract", () => {
  it("requires exact csv_import plus its documented members_list dependency", () => {
    const csvImportRow = featureCatalog
      .split(/\r?\n/u)
      .find((row) => row.startsWith("csv_import,"));

    expect(csvImportRow).toBeDefined();
    expect(csvImportRow?.split(",").at(-1)?.split(";")).toContain("members_list");
    expect(
      tiersMatrix
        .split(/\r?\n/u)
        .find((row) => row.startsWith("csv_import,"))
        ?.split(","),
    ).toEqual(["csv_import", "settings", "0", "1", "1"]);
    expect(entitlement).toMatch(
      /CSV_IMPORT_REQUIRED_FEATURE_KEYS\s*=\s*\[\s*"csv_import",\s*"members_list",?\s*\]\s*as const/,
    );
    expect(entitlement).toContain("resolveTenantFeatureEntitlement(");
    expect(entitlement).toContain("new Set(requiredFeatureKeys)");
    expect(entitlement).toContain("!enabledFeatureKeys.has(featureKey)");
    expect(entitlement).toContain("!featureResult.data.every(isEnabledFeatureRow)");
    expect(entitlement).toContain("ENABLED_FEATURE_SOURCES.has(value.source)");
  });

  it("preflights after authentication and RBAC but before audit, dry-run, or import reads and writes", () => {
    expect(importer).toContain("Deno.serve(createImportEntityDataHandler({");
    expect(handler).toContain("logger: ImportEntityDataLogger;");
    expect(handler).not.toContain("console.warn");
    expect(handler).not.toContain("console.error");
    expect(importer).toContain("executeAuthorizedImport: (command: AuthorizedImportCommand) =>");
    expect(importer).toContain("executeAuthorizedImport(serviceClient, command)");

    const auth = handler.indexOf("await dependencies.authenticate()");
    const parse = handler.indexOf("parseImportRequest(rawBody)", auth);
    const actorLookup = handler.indexOf(
      "await dependencies.resolveActor(",
      parse,
    );
    const preflight = handler.indexOf(
      "await dependencies.resolveCsvImportEntitlement(",
      actorLookup,
    );
    const blocked = handler.indexOf('if (access.kind === "blocked")', preflight);
    const dispatch = handler.indexOf(
      "await dependencies.executeAuthorizedImport({",
      preflight,
    );
    const audit = importer.indexOf("action: 'import.started'");

    expect(auth).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(auth);
    expect(actorLookup).toBeGreaterThan(parse);
    expect(preflight).toBeGreaterThan(actorLookup);
    expect(blocked).toBeGreaterThan(preflight);
    expect(dispatch).toBeGreaterThan(blocked);
    expect(audit).toBeGreaterThan(-1);

    const guardedImportPath = handler.slice(preflight, dispatch);
    expect(guardedImportPath).toContain("return errorResponse({");
    expect(guardedImportPath).not.toContain("summary.created++");
    expect(guardedImportPath).not.toContain("summary.updated++");
    expect(guardedImportPath).not.toContain("enterprise_audit_events");
  });

  it("returns stable sanitized 403 and 503 responses", () => {
    expect(entitlement).toContain("status: 403");
    expect(entitlement).toContain('code: "FEATURE_DISABLED"');
    expect(entitlement).toContain('message: "CSV import is not enabled for this workspace"');
    expect(entitlement).toContain("status: 503");
    expect(entitlement).toContain('code: "ENTITLEMENT_UNAVAILABLE"');
    expect(entitlement).toContain('message: "CSV import entitlement is temporarily unavailable"');
    expect(handler).toContain("status: access.status");
    expect(handler).toContain("error: access.message");
    expect(handler).toContain("code: access.code");
  });

  it("logs only bounded entitlement context and never raw lookup details", () => {
    const preflight = handler.indexOf(
      "await dependencies.resolveCsvImportEntitlement(",
    );
    const executor = handler.indexOf(
      "await dependencies.executeAuthorizedImport({",
      preflight,
    );
    const gate = handler.slice(preflight, executor);

    expect(gate).toContain('logger.error("csv_import_entitlement_unavailable", {');
    expect(gate).toContain("entitlement_step: entitlement.step");
    expect(gate).toContain("required_features: CSV_IMPORT_REQUIRED_FEATURE_KEYS");
    expect(gate).not.toContain("entitlement.error");
    expect(gate).not.toMatch(/console\.error\([^)]*,\s*(?:error|e)\s*\)/u);
    expect(gate).not.toContain("missingFeatureKeys");
  });

  it("keeps the separate members_invite row gate for invitation candidates", () => {
    expect(importer).toContain("resolveMembersInviteEntitlement(client, workspaceId)");
    expect(importer).toContain("planMembersInviteInvitation(");
    expect(importer).toContain("hasMemberInvitationCandidate(");
  });
});
