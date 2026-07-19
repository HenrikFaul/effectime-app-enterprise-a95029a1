import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const SAFE_SELECT_COLUMNS = new Set(["user_id", "display_name", "avatar_url"]);
const SAFE_UPDATE_COLUMNS = new Set(["display_name", "avatar_url", "preferred_locale"]);
const FORBIDDEN_MUTATIONS = new Set(["insert", "upsert", "delete"]);
const QUARANTINED_DEAD_CALLERS = new Set([
  "src/components/enterprise/CsvImportPanel.tsx",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test") return [];
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function repoPath(path: string): string {
  return relative(process.cwd(), path).replace(/\\/g, "/");
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
  if (ts.isPropertyAccessExpression(current)) {
    return isProfilesFromCall(current.expression);
  }
  return false;
}

function objectLiteralKeys(expression: ts.Expression | undefined): string[] | null {
  if (!expression) return null;
  const current = unwrapExpression(expression);
  if (!ts.isObjectLiteralExpression(current)) return null;
  const keys: string[] = [];
  for (const property of current.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      return null;
    }
    const name = property.name;
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
      keys.push(name.text);
    } else {
      return null;
    }
  }
  return keys;
}

describe("browser profiles caller contract", () => {
  it("keeps every reachable call inside the reviewed column and mutation boundary", () => {
    const violations: string[] = [];
    let profileSources = 0;

    for (const filePath of sourceFiles(SOURCE_ROOT)) {
      const file = repoPath(filePath);
      const sourceText = readFileSync(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );

      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(unwrapExpression(node.expression))
        ) {
          const method = unwrapExpression(node.expression) as ts.PropertyAccessExpression;
          if (method.name.text === "from" && isProfilesFromCall(node)) {
            profileSources += 1;
          }
          if (isProfilesFromCall(method.expression)) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const location = `${file}:${line}`;
            if (FORBIDDEN_MUTATIONS.has(method.name.text)) {
              violations.push(`${location} uses forbidden profiles.${method.name.text}`);
            } else if (method.name.text === "select") {
              const projection = node.arguments[0];
              if (!projection || !ts.isStringLiteralLike(projection)) {
                violations.push(`${location} has a non-literal profiles SELECT projection`);
              } else {
                const columns = projection.text.split(",").map((column) => column.trim());
                const unsafe = columns.filter((column) => !SAFE_SELECT_COLUMNS.has(column));
                if (unsafe.length > 0) {
                  violations.push(`${location} selects forbidden profile fields: ${unsafe.join(", ")}`);
                }
              }
            } else if (method.name.text === "update") {
              const keys = objectLiteralKeys(node.arguments[0]);
              if (!keys) {
                violations.push(`${location} has a non-literal profiles UPDATE payload`);
              } else {
                const unsafe = keys.filter((key) => !SAFE_UPDATE_COLUMNS.has(key));
                if (unsafe.length > 0) {
                  violations.push(`${location} updates forbidden profile fields: ${unsafe.join(", ")}`);
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      if (!QUARANTINED_DEAD_CALLERS.has(file)) visit(sourceFile);
    }

    const allSource = sourceFiles(SOURCE_ROOT)
      .filter((file) => !QUARANTINED_DEAD_CALLERS.has(repoPath(file)))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(allSource).not.toMatch(/(?:import|require)[^\n]*CsvImportPanel/);
    expect(profileSources).toBeGreaterThanOrEqual(35);
    expect(violations).toEqual([]);
  }, 15_000);
});
