import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const TABLE_NAME = "workspace_installed_plugins";
const SAFE_SELECT_COLUMNS = new Set([
  "id",
  "workspace_id",
  "plugin_id",
  "enabled",
  "installed_at",
]);
const FORBIDDEN_MUTATIONS = new Set(["insert", "upsert", "update", "delete"]);

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

function isWorkspaceInstalledPluginsFromCall(expression: ts.Expression): boolean {
  const current = unwrapExpression(expression);
  if (ts.isCallExpression(current)) {
    const callee = unwrapExpression(current.expression);
    if (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "from" &&
      current.arguments.length === 1 &&
      ts.isStringLiteralLike(current.arguments[0]) &&
      current.arguments[0].text === TABLE_NAME
    ) {
      return true;
    }
    return isWorkspaceInstalledPluginsFromCall(current.expression);
  }
  if (ts.isPropertyAccessExpression(current)) {
    return isWorkspaceInstalledPluginsFromCall(current.expression);
  }
  return false;
}

describe("browser workspace installed plugins caller contract", () => {
  it("keeps config private and mutations behind reviewed RPCs", () => {
    const violations: string[] = [];
    let tableSources = 0;
    let selectCalls = 0;
    const sources = sourceFiles(SOURCE_ROOT).map((filePath) => ({
      filePath,
      file: repoPath(filePath),
      sourceText: readFileSync(filePath, "utf8"),
    }));

    for (const { filePath, file, sourceText } of sources) {
      if (!sourceText.includes(TABLE_NAME)) continue;
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
          if (method.name.text === "from" && isWorkspaceInstalledPluginsFromCall(node)) {
            tableSources += 1;
          }
          if (isWorkspaceInstalledPluginsFromCall(method.expression)) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const location = `${file}:${line}`;
            if (FORBIDDEN_MUTATIONS.has(method.name.text)) {
              violations.push(`${location} uses forbidden ${TABLE_NAME}.${method.name.text}`);
            } else if (method.name.text === "select") {
              selectCalls += 1;
              const projection = node.arguments[0];
              if (!projection || !ts.isStringLiteralLike(projection)) {
                violations.push(`${location} has a non-literal ${TABLE_NAME} SELECT projection`);
              } else {
                const columns = projection.text.split(",").map((column) => column.trim());
                const unsafe = columns.filter((column) => !SAFE_SELECT_COLUMNS.has(column));
                if (unsafe.length > 0) {
                  violations.push(
                    `${location} selects forbidden ${TABLE_NAME} fields: ${unsafe.join(", ")}`,
                  );
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(tableSources).toBeGreaterThanOrEqual(1);
    expect(selectCalls).toBeGreaterThanOrEqual(1);
    expect(selectCalls).toBe(tableSources);
    expect(violations).toEqual([]);
  }, 15_000);
});
