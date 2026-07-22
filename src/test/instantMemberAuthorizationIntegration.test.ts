import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const EDGE_ROOT = join(ROOT, "supabase", "functions");
const PRODUCT_WRITERS = [
  "create-instant-enterprise-member",
  "join-event",
] as const;

function readEdgeFunction(name: (typeof PRODUCT_WRITERS)[number]): string {
  return readFileSync(join(EDGE_ROOT, name, "index.ts"), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function authorizationBranch(source: string): string {
  const start = source.indexOf("if (!authorization.allowed) {");
  if (start < 0) throw new Error("Missing fail-closed authorization branch");
  const lineStart = source.lastIndexOf("\n", start) + 1;
  const indentation = source.slice(lineStart, start);
  const end = source.indexOf(`\n${indentation}}\n`, start);
  if (end < 0) throw new Error("Missing authorization branch boundary");
  return source.slice(start, end + indentation.length + 3);
}

describe("instant enterprise-member Edge authorization integration", () => {
  it("gates every product role-allocation writer before service-role reads or identity creation", () => {
    for (const functionName of PRODUCT_WRITERS) {
      const source = readEdgeFunction(functionName);
      const authorization = source.indexOf(
        "checkInstantMemberCreationAuthorization(",
      );
      const workspaceRead = source.indexOf(".from(\"enterprise_memberships\")", authorization) >= 0
        ? source.indexOf(".from(\"enterprise_memberships\")", authorization)
        : source.indexOf(".from('enterprise_memberships')", authorization);
      const identityCreation = source.indexOf(".auth.admin.createUser", authorization);
      const allocationWrite = Math.max(
        source.indexOf('.from("enterprise_member_role_allocations")', identityCreation),
        source.indexOf(".from('enterprise_member_role_allocations')", identityCreation),
      );

      expect(source).toContain(
        'import { checkInstantMemberCreationAuthorization } from "../_shared/instant-member-authorization.ts";',
      );
      expect(authorization, functionName).toBeGreaterThan(-1);
      expect(workspaceRead, functionName).toBeGreaterThan(authorization);
      expect(identityCreation, functionName).toBeGreaterThan(authorization);
      expect(allocationWrite, functionName).toBeGreaterThan(identityCreation);
      expect(source).not.toMatch(
        /\[['"]owner['"],\s*['"]resourceAssistant['"]\]\.includes\([^)]*role/,
      );
    }
  });

  it("keeps permission, membership and both entitlement requirements canonical", () => {
    const helper = readFileSync(
      join(EDGE_ROOT, "_shared", "instant-member-authorization.ts"),
      "utf8",
    );

    expect(helper).toContain('permissionClient.rpc("has_workspace_permission"');
    expect(helper).toContain('_feature_key: "members"');
    expect(helper).toContain('_minimum_access: "edit"');
    expect(helper).toContain('["members_list", "instant_member_create"]');
    expect(helper).toContain("checkWorkspaceFeature(");
    expect(helper).not.toMatch(/console\.(?:debug|info|log|warn|error)/);
  });

  it("binds the permission RPC contract to auth.uid and an active workspace membership", () => {
    const permissionMigration = readFileSync(
      join(
        ROOT,
        "supabase",
        "migrations",
        "20260717132000_v3_51_3_reproducibility_and_atomic_settings.sql",
      ),
      "utf8",
    );
    const start = permissionMigration.indexOf(
      "CREATE OR REPLACE FUNCTION public.has_workspace_permission(",
    );
    const end = permissionMigration.indexOf("$function$;", start);
    const contract = permissionMigration.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(contract).toContain("_user_id = auth.uid()");
    expect(contract).toContain("membership.status = 'active'");
    expect(contract).toContain("permission.feature_key = _feature_key");
    expect(contract).toContain("WHEN 'edit' THEN 2");
  });

  it("returns sanitized fail-closed 403/503 responses before writes", () => {
    for (const functionName of PRODUCT_WRITERS) {
      const source = readEdgeFunction(functionName);
      const branch = authorizationBranch(source);

      expect(branch, functionName).toContain("authorization.status === 503");
      expect(branch, functionName).toContain(", 503)");
      expect(branch, functionName).toContain(", 403)");
      expect(branch, functionName).not.toContain("user.id");
      expect(branch, functionName).not.toContain("workspaceId");
      expect(branch, functionName).not.toContain("authorization.error");
      expect(branch, functionName).not.toMatch(/console\.\w+\([^)]*(?:Error|error)/);
    }
  });
});
