import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const importer = readFileSync(join(root, "supabase/functions/import-entity-data/index.ts"), "utf8");
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
    const auth = importer.indexOf("await userClient.auth.getUser()");
    const actorLookup = importer.indexOf(".from('enterprise_memberships')", auth);
    const actorRole = importer.indexOf("const actorRole =", actorLookup);
    const preflight = importer.indexOf(
      "const csvImportEntitlement = await resolveCsvImportEntitlement(",
      actorRole,
    );
    const blocked = importer.indexOf("if (csvImportAccess.kind === 'blocked')", preflight);
    const audit = importer.indexOf("action: 'import.started'", preflight);
    const dryRunAuditBranch = importer.indexOf("if (!dry_run)", preflight);
    const dispatch = importer.indexOf("switch (entity)", preflight);

    expect(auth).toBeGreaterThan(-1);
    expect(actorLookup).toBeGreaterThan(auth);
    expect(actorRole).toBeGreaterThan(actorLookup);
    expect(preflight).toBeGreaterThan(actorRole);
    expect(blocked).toBeGreaterThan(preflight);
    expect(dryRunAuditBranch).toBeGreaterThan(blocked);
    expect(audit).toBeGreaterThan(dryRunAuditBranch);
    expect(dispatch).toBeGreaterThan(audit);

    const guardedImportPath = importer.slice(preflight, dispatch);
    expect(guardedImportPath).toContain("return jsonResponse(");
    expect(guardedImportPath).not.toContain("summary.created++");
    expect(guardedImportPath).not.toContain("summary.updated++");
  });

  it("returns stable sanitized 403 and 503 responses", () => {
    expect(entitlement).toContain("status: 403");
    expect(entitlement).toContain('code: "FEATURE_DISABLED"');
    expect(entitlement).toContain('message: "CSV import is not enabled for this workspace"');
    expect(entitlement).toContain("status: 503");
    expect(entitlement).toContain('code: "ENTITLEMENT_UNAVAILABLE"');
    expect(entitlement).toContain('message: "CSV import entitlement is temporarily unavailable"');
    expect(importer).toContain(
      "return jsonResponse({ error: csvImportAccess.message }, csvImportAccess.status)",
    );
  });

  it("logs only bounded entitlement context and never raw lookup details", () => {
    const preflight = importer.indexOf(
      "const csvImportEntitlement = await resolveCsvImportEntitlement(",
    );
    const audit = importer.indexOf("// Audit: import.started", preflight);
    const gate = importer.slice(preflight, audit);

    expect(gate).toContain("console.error('csv_import entitlement lookup failed', {");
    expect(gate).toContain("workspaceId: workspace_id");
    expect(gate).toContain("step: csvImportEntitlement.step");
    expect(gate).toContain("features: CSV_IMPORT_REQUIRED_FEATURE_KEYS");
    expect(gate).not.toContain("csvImportEntitlement.error");
    expect(gate).not.toMatch(/console\.error\([^)]*,\s*(?:error|e)\s*\)/u);
    expect(gate).not.toContain("missingFeatureKeys");
  });

  it("keeps the separate members_invite row gate for invitation candidates", () => {
    expect(importer).toContain("resolveMembersInviteEntitlement(client, workspaceId)");
    expect(importer).toContain("planMembersInviteInvitation(");
    expect(importer).toContain("hasMemberInvitationCandidate(");
  });
});
