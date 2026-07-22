import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "src");
const EDGE_ROOT = join(ROOT, "supabase", "functions");
const MIGRATIONS_ROOT = join(ROOT, "supabase", "migrations");
const MUTATIONS = new Set(["delete", "insert", "update", "upsert"]);

interface AllocationWriter {
  file: string;
  method: string;
  payload: Record<string, string> | null;
}

function sourceFiles(directory: string, extension: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path, extension);
    return extension.test(entry.name) ? [path] : [];
  });
}

function repoPath(path: string): string {
  return relative(ROOT, path).replace(/\\/g, "/");
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isAllocationFromCall(expression: ts.Expression): boolean {
  const current = unwrapExpression(expression);
  if (ts.isCallExpression(current)) {
    const callee = unwrapExpression(current.expression);
    if (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "from" &&
      current.arguments.length === 1 &&
      ts.isStringLiteralLike(current.arguments[0]) &&
      current.arguments[0].text === "enterprise_member_role_allocations"
    ) {
      return true;
    }
    return isAllocationFromCall(current.expression);
  }
  return ts.isPropertyAccessExpression(current)
    ? isAllocationFromCall(current.expression)
    : false;
}

function literalPayload(
  expression: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
): Record<string, string> | null {
  if (!expression) return null;
  const payload = unwrapExpression(expression);
  if (!ts.isObjectLiteralExpression(payload)) return null;
  const properties: Record<string, string> = {};
  for (const property of payload.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (!ts.isIdentifier(property.name) && !ts.isStringLiteralLike(property.name)) continue;
    properties[property.name.text] = property.initializer
      .getText(sourceFile)
      .replace(/\s+/g, " ")
      .trim();
  }
  return properties;
}

function allocationWriters(directory: string): AllocationWriter[] {
  const writers: AllocationWriter[] = [];
  for (const path of sourceFiles(directory, /\.(?:ts|tsx)$/).filter(
    (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"),
  )) {
    const source = readFileSync(path, "utf8");
    if (!source.includes("enterprise_member_role_allocations")) continue;
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(unwrapExpression(node.expression))
      ) {
        const method = unwrapExpression(node.expression) as ts.PropertyAccessExpression;
        if (MUTATIONS.has(method.name.text) && isAllocationFromCall(method.expression)) {
          writers.push({
            file: repoPath(path),
            method: method.name.text,
            payload: literalPayload(node.arguments[0], sourceFile),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return writers.sort((left, right) =>
    `${left.file}|${left.method}`.localeCompare(`${right.file}|${right.method}`)
  );
}

function allocationFailureSlice(source: string): string {
  const start = source.indexOf("if (allocationError) {");
  if (start < 0) throw new Error("Missing fail-closed allocation error branch");
  const end = source.indexOf("\n      }", start);
  if (end < 0) throw new Error("Missing allocation error branch boundary");
  return source.slice(start, end + 8);
}

describe("enterprise member role-allocation writer inventory", () => {
  it("keeps browser runtime free of direct allocation-table mutations", () => {
    expect(allocationWriters(SRC_ROOT)).toEqual([]);
  }, 15_000);

  it("inventories product and controlled-seed Edge writers", () => {
    const writers = allocationWriters(EDGE_ROOT);
    expect(writers.map(({ file, method }) => `${file}|${method}`)).toEqual([
      "supabase/functions/create-instant-enterprise-member/index.ts|insert",
      "supabase/functions/join-event/index.ts|insert",
      "supabase/functions/seed-demo-workspace/index.ts|insert",
    ]);

    const productWriters = writers.filter(({ file }) =>
      file.includes("create-instant-enterprise-member") || file.includes("join-event")
    );
    expect(productWriters).toHaveLength(2);
    for (const writer of productWriters) {
      expect(writer.payload?.percentage, writer.file).toBe("100");
      expect(writer.payload?.is_priority, writer.file).toBe("true");
    }

    const seedWriter = writers.find(({ file }) => file.includes("seed-demo-workspace"));
    expect(seedWriter).toEqual({
      file: "supabase/functions/seed-demo-workspace/index.ts",
      method: "insert",
      payload: null,
    });
  }, 15_000);

  it("requires both product Edge writers to register the saga before Auth creation", () => {
    for (const functionName of ["create-instant-enterprise-member", "join-event"]) {
      const source = readFileSync(join(EDGE_ROOT, functionName, "index.ts"), "utf8");
      const failureBranch = allocationFailureSlice(source);
      const registrationIndex = source.indexOf(
        "register_created_enterprise_identity_provisioning_v1",
      );
      const createUserIndex = source.indexOf(
        "admin.auth.admin.createUser",
        registrationIndex,
      );
      const provisioningCompletionIndex = source.indexOf(
        "complete_created_enterprise_identity_provisioning_v1",
        createUserIndex,
      );
      const successIndex = source.indexOf("success: true", provisioningCompletionIndex);
      const createFailureIndex = source.indexOf("if (createUserError", createUserIndex);
      const boundUserIndex = source.indexOf("const instantUserId", createFailureIndex);

      expect(registrationIndex, functionName).toBeGreaterThan(-1);
      expect(createUserIndex, functionName).toBeGreaterThan(registrationIndex);
      expect(
        source.slice(registrationIndex, createUserIndex),
        functionName,
      ).toContain("parseRegisteredCreatedIdentityProvisioningReceipt");
      expect(source).toContain("cleanupRegisteredCreatedIdentity");
      expect(source).toContain("completeCreatedIdentityProvisioningVerified");
      expect(source).toContain("prepare_created_enterprise_identity_cleanup_v1");
      expect(source).toContain("effectime_cleanup_intent_id");
      expect(source).toContain("app_metadata");
      expect(
        source.slice(createFailureIndex, boundUserIndex),
        functionName,
      ).toContain("cleanupCreatedIdentity(createdUser.user?.id ?? null, null)");
      expect(provisioningCompletionIndex, functionName).toBeGreaterThan(createUserIndex);
      expect(successIndex, functionName).toBeGreaterThan(provisioningCompletionIndex);
      expect(
        source.slice(provisioningCompletionIndex, successIndex),
        functionName,
      ).toContain("if (!provisioningCompleted)");
      expect(
        source.slice(provisioningCompletionIndex, successIndex),
        functionName,
      ).not.toContain("cleanupCreatedIdentity(");
      if (functionName === "join-event") {
        const auditInsertIndex = source.indexOf(
          ".from('enterprise_audit_events').insert",
          createUserIndex,
        );
        expect(auditInsertIndex).toBeGreaterThan(provisioningCompletionIndex);
      }
      expect(failureBranch).not.toMatch(
        /from\(["']enterprise_memberships["']\)[\s\S]{0,160}\.delete\(/,
      );
      expect(failureBranch).not.toMatch(
        /from\(["']profiles["']\)[\s\S]{0,160}\.delete\(/,
      );
      expect(failureBranch).toContain("await cleanupCreatedIdentity(");
      expect(failureBranch).toContain("return jsonRes(");
      expect(failureBranch).not.toMatch(/console\.error\([^)]*allocationError/);
    }
  });

  it("makes the worker prepare provisioning jobs before exact Auth deletion", () => {
    const source = readFileSync(
      join(EDGE_ROOT, "cleanup-temp-users", "index.ts"),
      "utf8",
    );
    const claimIndex = source.indexOf(
      "claim_created_enterprise_identity_cleanup_jobs_v1",
    );
    const legacyCleanupIndex = source.indexOf("// Find all temporary profiles");
    const sagaWorker = source.slice(claimIndex, legacyCleanupIndex);

    expect(claimIndex).toBeGreaterThan(-1);
    expect(legacyCleanupIndex).toBeGreaterThan(claimIndex);
    expect(sagaWorker).toContain("prepare_created_enterprise_identity_cleanup_v1");
    expect(sagaWorker).toContain("reconcileCreatedIdentityCleanupJobs");
    expect(sagaWorker).toContain("deleteAuthUser:");
    expect(sagaWorker).toContain("isFailedCreatedIdentityCleanupReceipt");
    expect(sagaWorker).not.toMatch(
      /from\(["'](?:enterprise_memberships|profiles)["']\)[\s\S]{0,160}\.delete\(/,
    );
  });

  it("keeps the generic data migration separately classified and operator-gated", () => {
    const source = readFileSync(join(EDGE_ROOT, "data-migration", "index.ts"), "utf8");
    expect(source).toContain('"enterprise_member_role_allocations"');
    expect(source).toContain("hasServiceRoleCredential(req, serviceRoleKey)");
    expect(source).toContain('body.confirm !== "MIGRATE"');
    expect(source).toContain('const dryRun = body.mode !== "execute"');
    expect(source).toContain("INSERT INTO ${quoteIdent(tgtSchema)}.${quoteIdent(tgtTable)}");
  });

  it("inventories one-time migration and authoritative SQL writers separately", () => {
    const inventory: string[] = [];
    for (const path of sourceFiles(MIGRATIONS_ROOT, /\.sql$/)) {
      const source = readFileSync(path, "utf8");
      const file = repoPath(path);
      const insertCount = (
        source.match(/\bINSERT\s+INTO\s+public\.enterprise_member_role_allocations\b/gi) || []
      ).length;
      const updateCount = (
        source.match(/\bUPDATE\s+public\.enterprise_member_role_allocations\b/gi) || []
      ).length;
      const deleteCount = (
        source.match(/\bDELETE\s+FROM\s+public\.enterprise_member_role_allocations\b/gi) || []
      ).length;
      for (let index = 0; index < insertCount; index += 1) inventory.push(`${file}|insert`);
      for (let index = 0; index < updateCount; index += 1) inventory.push(`${file}|update`);
      for (let index = 0; index < deleteCount; index += 1) inventory.push(`${file}|delete`);
    }

    expect(inventory.sort()).toEqual([
      "supabase/migrations/20260418073641_f99dcde9-2792-455c-b992-a2c227a39d74.sql|insert",
      "supabase/migrations/20260418110935_53a2db7d-0621-453e-b072-7c7cfb91d843.sql|update",
      "supabase/migrations/20260717133000_v3_51_3_atomic_invitation_acceptance.sql|delete",
      "supabase/migrations/20260717133000_v3_51_3_atomic_invitation_acceptance.sql|insert",
      "supabase/migrations/20260719143000_v3_51_6_atomic_member_profile_save.sql|delete",
      "supabase/migrations/20260719143000_v3_51_6_atomic_member_profile_save.sql|insert",
      "supabase/migrations/20260721233000_v3_51_7_atomic_business_role_delete.sql|delete",
      "supabase/migrations/20260721233000_v3_51_7_atomic_business_role_delete.sql|update",
    ].sort());

    const invitationRpc = readFileSync(
      join(MIGRATIONS_ROOT, "20260717133000_v3_51_3_atomic_invitation_acceptance.sql"),
      "utf8",
    );
    const profileRpc = readFileSync(
      join(MIGRATIONS_ROOT, "20260719143000_v3_51_6_atomic_member_profile_save.sql"),
      "utf8",
    );
    expect(invitationRpc).toContain("accept_enterprise_invitation(text, uuid, jsonb)");
    expect(profileRpc).toContain("save_workspace_member_profile_v1");
    expect(profileRpc).toContain("Role allocation percentages must total 100");
    expect(profileRpc).toContain("Role allocations require exactly one priority entry");
  });
});
