import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const EDGE_ROOT = join(ROOT, "supabase", "functions");
const MIGRATIONS_ROOT = join(ROOT, "supabase", "migrations");
const PROFILE_MUTATIONS = new Set(["insert", "upsert", "update"]);

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

function isProfilesFromCall(expression: ts.Expression): boolean {
  const current = unwrapExpression(expression);
  if (ts.isCallExpression(current)) {
    const callee = unwrapExpression(current.expression);
    if (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "from" &&
      current.arguments.length === 1 &&
      ts.isStringLiteralLike(current.arguments[0]) &&
      current.arguments[0].text === "profiles"
    ) {
      return true;
    }
    return isProfilesFromCall(current.expression);
  }
  return ts.isPropertyAccessExpression(current) ? isProfilesFromCall(current.expression) : false;
}

function displayNameInitializer(
  expression: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
): string | null | "unreviewable" {
  if (!expression) return "unreviewable";
  const payload = unwrapExpression(expression);
  if (!ts.isObjectLiteralExpression(payload)) return "unreviewable";

  for (const property of payload.properties) {
    if (ts.isSpreadAssignment(property)) return "unreviewable";
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === "display_name") {
      return property.name.text;
    }
    if (ts.isPropertyAssignment(property)) {
      const name = property.name;
      if ((ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text === "display_name") {
        return property.initializer.getText(sourceFile).replace(/\s+/g, " ").trim();
      }
    }
  }

  return null;
}

function edgeProfileDisplayNameWriters(): { writers: string[]; violations: string[] } {
  const writers: string[] = [];
  const violations: string[] = [];

  for (const path of sourceFiles(EDGE_ROOT, /\.ts$/).filter((file) => !file.endsWith(".test.ts"))) {
    const sourceText = readFileSync(path, "utf8");
    if (!sourceText.includes("profiles") || !sourceText.includes("display_name")) continue;
    const file = repoPath(path);
    const sourceFile = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(unwrapExpression(node.expression))
      ) {
        const method = unwrapExpression(node.expression) as ts.PropertyAccessExpression;
        if (PROFILE_MUTATIONS.has(method.name.text) && isProfilesFromCall(method.expression)) {
          const initializer = displayNameInitializer(node.arguments[0], sourceFile);
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          if (initializer === "unreviewable") {
            violations.push(
              `${file}:${line} has a non-literal profiles.${method.name.text} payload`,
            );
          } else if (initializer !== null) {
            writers.push(`${file}|${method.name.text}|${initializer}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return { writers: writers.sort(), violations: violations.sort() };
}

function actionSlice(source: string, action: string, nextAction: string): string {
  const startMarker = `if (action === '${action}')`;
  const endMarker = `if (action === '${nextAction}')`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing join-event action boundary: ${action}`);
  return source.slice(start, end);
}

function expectBefore(source: string, guard: string, mutation: string): void {
  expect(source.indexOf(guard), `missing guard ${guard}`).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(mutation), `missing mutation ${mutation}`).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(guard), `${guard} must precede ${mutation}`).toBeLessThan(
    source.indexOf(mutation),
  );
}

describe("profiles.display_name service-writer inventory", () => {
  it("requires every Edge display-name writer to remain explicitly reviewed", () => {
    const inventory = edgeProfileDisplayNameWriters();

    expect(inventory.violations).toEqual([]);
    expect(inventory.writers).toEqual([
      "supabase/functions/create-instant-enterprise-member/index.ts|upsert|displayName",
      "supabase/functions/join-event/index.ts|update|normalizedDisplayName",
      "supabase/functions/join-event/index.ts|update|normalizedName",
      "supabase/functions/join-event/index.ts|upsert|canonicalDisplayName",
      "supabase/functions/join-event/index.ts|upsert|displayName",
      "supabase/functions/join-event/index.ts|upsert|finalizedDisplayName",
      "supabase/functions/join-event/index.ts|upsert|normalizedDisplayName",
      "supabase/functions/seed-demo-workspace/index.ts|upsert|persona.display_name",
    ]);
  });

  it("keeps all SQL display-name writers and the atomic indirect writer inventoried", () => {
    const writers: string[] = [];
    for (const path of sourceFiles(MIGRATIONS_ROOT, /\.sql$/)) {
      const source = readFileSync(path, "utf8");
      const file = repoPath(path);
      const insertCount = (
        source.match(/\bINSERT\s+INTO\s+public\.profiles\s*\([^)]*\bdisplay_name\b[^)]*\)/gi) || []
      ).length;
      const updateCount = (
        source.match(/\bUPDATE\s+public\.profiles(?:\s+AS\s+\w+)?\s+SET\s+display_name\s*=/gi) || []
      ).length;
      const indirectCount = (
        source.match(/\bPERFORM\s+public\.update_my_workspace_profile_display_name_v1\s*\(/gi) || []
      ).length;

      for (let index = 0; index < insertCount; index += 1) writers.push(`${file}|insert`);
      for (let index = 0; index < updateCount; index += 1) writers.push(`${file}|update`);
      for (let index = 0; index < indirectCount; index += 1)
        writers.push(`${file}|indirect-update`);
    }

    expect(writers.sort()).toEqual(
      [
        "supabase/migrations/20260307083255_dd987419-9352-4576-96df-2fb55441f983.sql|insert",
        "supabase/migrations/20260719123000_v3_51_5_profiles_tenant_privacy.sql|update",
        "supabase/migrations/20260719143000_v3_51_6_atomic_member_profile_save.sql|indirect-update",
        "supabase/migrations/20260719143000_v3_51_6_atomic_member_profile_save.sql|insert",
        "supabase/migrations/20260719143000_v3_51_6_atomic_member_profile_save.sql|update",
      ].sort(),
    );
  });

  it("gates caller and stored candidates before each join-event mutation path", () => {
    const source = readFileSync(join(EDGE_ROOT, "join-event", "index.ts"), "utf8");

    expectBefore(
      actionSlice(source, "anonymous-join", "temp-sign-in"),
      "resolveRequiredCallerDisplayName(display_name)",
      "admin.auth.admin.createUser",
    );
    expectBefore(
      actionSlice(source, "update-temp-name", "prepare-temp-google-upgrade"),
      "resolveRequiredCallerDisplayName(display_name)",
      ".update({ display_name: normalizedDisplayName })",
    );
    expectBefore(
      actionSlice(source, "prepare-temp-google-upgrade", "finalize-temp-google-upgrade"),
      "resolveRequiredCallerDisplayName(display_name)",
      ".update({",
    );
    expectBefore(
      actionSlice(source, "finalize-temp-google-upgrade", "delete-event"),
      "canonicalizeDisplayName(tempProfile.display_name)",
      ".from('votes')",
    );
    expectBefore(
      actionSlice(source, "upgrade-temp-user", "search-user"),
      "resolveOptionalCallerDisplayName(body)",
      "admin.auth.admin.createUser",
    );
  });

  it("keeps temporary display names profile-authoritative until finalize", () => {
    const edgeSource = readFileSync(join(EDGE_ROOT, "join-event", "index.ts"), "utf8");
    const profileMenuSource = readFileSync(
      join(ROOT, "src", "components", "ProfileMenu.tsx"),
      "utf8",
    );
    const updateAction = actionSlice(
      edgeSource,
      "update-temp-name",
      "prepare-temp-google-upgrade",
    );
    const prepareAction = actionSlice(
      edgeSource,
      "prepare-temp-google-upgrade",
      "finalize-temp-google-upgrade",
    );
    const finalizeAction = actionSlice(
      edgeSource,
      "finalize-temp-google-upgrade",
      "delete-event",
    );

    expect(updateAction).not.toContain("updateUserById");
    expect(prepareAction).not.toContain("updateUserById");
    expect(updateAction).toContain("temp_upgrade_in_progress");
    expect(prepareAction).toContain("temp_upgrade_in_progress");
    expect(finalizeAction).toContain("canonicalizeDisplayName(tempProfile.display_name)");
    expect(finalizeAction).toContain("verifyAuthAdminUpdate");
    expect(finalizeAction.indexOf("verifyAuthAdminUpdate")).toBeLessThan(
      finalizeAction.indexOf("cleanupTemporaryUserAuthFirst"),
    );
    expect(profileMenuSource).not.toContain("supabase.auth.updateUser");

    const passwordUpgradeAction = actionSlice(edgeSource, "upgrade-temp-user", "search-user");
    expect(passwordUpgradeAction.indexOf("profile.display_name")).toBeLessThan(
      passwordUpgradeAction.indexOf("user.user_metadata?.display_name"),
    );
  });
});
