import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
let cachedTypeScript = null;

export function loadTypeScriptParser(loader = () => require("typescript")) {
  try {
    const parser = loader();
    if (!parser?.createSourceFile || !parser?.forEachChild) {
      throw new Error("module does not expose the TypeScript compiler API");
    }
    return parser;
  } catch (error) {
    throw new Error(
      "[edge-log-safety] TypeScript parser unavailable; run `npm ci --no-audit --no-fund` before the gate.",
      { cause: error },
    );
  }
}

function typeScript() {
  cachedTypeScript ??= loadTypeScriptParser();
  return cachedTypeScript;
}

export const piiSensitiveFunctions = Object.freeze([
  "supabase/functions/auth-email-hook/index.ts",
  "supabase/functions/import-entity-data/index.ts",
  "supabase/functions/send-transactional-email/index.ts",
]);

const createdIdentityFields = Object.freeze({
  correlationId: { optional: false, type: "string", value: "correlation" },
  code: { optional: true, type: "string", value: "execution-code" },
  claimed: { optional: true, type: "number", value: "summary.claimed" },
  completed: { optional: true, type: "number", value: "summary.completed" },
  pending: { optional: true, type: "number", value: "summary.pending" },
  receiptFailures: { optional: true, type: "number", value: "summary.receiptFailures" },
});

const temporaryUserFields = Object.freeze({
  code: { optional: false, type: "string", value: "static-code" },
  scanned: { optional: true, type: "number", value: "profiles.length" },
  eligible: { optional: true, type: "number", value: "eligible" },
  retained: { optional: true, type: "number", value: "retained-count" },
  deleted: { optional: true, type: "number", value: "deleted" },
  failed: { optional: true, type: "number", value: "failed" },
});

export const cleanupLogContracts = Object.freeze([
  Object.freeze({
    path: "supabase/functions/cleanup-created-identities/handler.ts",
    fields: createdIdentityFields,
    events: Object.freeze({
      "cleanup-created-identities.configuration-failed": "error",
      "cleanup-created-identities.client-failed": "error",
      "cleanup-created-identities.overlap-skipped": "info",
      "cleanup-created-identities.run-failed": "error",
      "cleanup-created-identities.run-succeeded": "info",
    }),
    provenance: "created-identities",
  }),
  Object.freeze({
    path: "supabase/functions/cleanup-temp-users/handler.ts",
    fields: temporaryUserFields,
    events: Object.freeze({
      "cleanup-temp-users.configuration-failed": "error",
      "cleanup-temp-users.client-failed": "error",
      "cleanup-temp-users.run-incomplete": "error",
      "cleanup-temp-users.run-completed": "info",
    }),
    provenance: "temporary-users",
  }),
]);

function parseSource(source, path, ts = typeScript()) {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function lineAt(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function unwrap(expression, ts) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression?.(current)
  )
    current = current.expression;
  return current;
}

function expressionPath(expression, ts) {
  const current = unwrap(expression, ts);
  if (ts.isIdentifier(current)) return current.text;
  if (ts.isPropertyAccessExpression(current) && !current.questionDotToken) {
    const base = expressionPath(current.expression, ts);
    return base ? `${base}.${current.name.text}` : null;
  }
  return null;
}

function isSafeCodeLiteral(node, ts) {
  return ts.isStringLiteral(node) && /^[a-z][a-z0-9_]*$/u.test(node.text);
}

function isBoundedStaticCode(node, ts) {
  const current = unwrap(node, ts);
  return (
    isSafeCodeLiteral(current, ts) ||
    (ts.isConditionalExpression(current) &&
      isBoundedStaticCode(current.whenTrue, ts) &&
      isBoundedStaticCode(current.whenFalse, ts))
  );
}

function isNonNegativeInteger(node, ts) {
  return ts.isNumericLiteral(node) && /^(?:0|[1-9]\d*)$/u.test(node.text);
}

function declarationName(node, ts) {
  const parent = node.parent;
  return (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isBindingElement(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent)) &&
    parent.name === node
  );
}

function rootSink(expression, sinkNames, ts) {
  const current = unwrap(expression, ts);
  if (ts.isIdentifier(current)) return sinkNames.has(current.text) ? current.text : null;
  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    const owner = unwrap(current.expression, ts);
    const property = ts.isPropertyAccessExpression(current)
      ? current.name.text
      : current.argumentExpression && ts.isStringLiteral(unwrap(current.argumentExpression, ts))
        ? unwrap(current.argumentExpression, ts).text
        : null;
    if (
      ts.isIdentifier(owner) &&
      ["globalThis", "self", "window"].includes(owner.text) &&
      property &&
      sinkNames.has(property)
    )
      return property;

    const outputPath = expressionPath(current, ts);
    if (
      outputPath &&
      ["Deno.stderr", "Deno.stdout", "process.stderr", "process.stdout"].includes(outputPath) &&
      sinkNames.has("console")
    )
      return "console";
  }
  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    return rootSink(current.expression, sinkNames, ts);
  }
  return null;
}

function collectSinkUsage(sourceFile, sinkNames, ts) {
  const directCalls = [];
  const findings = [];
  const recorded = new Set();
  const record = (node, reason) => {
    const key = `${node.pos}:${reason}`;
    if (recorded.has(key)) return;
    recorded.add(key);
    findings.push({ line: lineAt(sourceFile, node), reason });
  };

  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const sink = rootSink(node, sinkNames, ts);
      const nestedReceiver =
        (ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) &&
        node.parent.expression === node;
      if (sink && !nestedReceiver) {
        if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
          directCalls.push({ sink, access: node, call: node.parent });
        } else {
          record(node, `${sink} methods may not be computed, aliased, destructured or escaped`);
        }
      }
    }
    if (ts.isIdentifier(node) && sinkNames.has(node.text)) {
      const parent = node.parent;
      const isReceiver =
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === node;
      const isPropertyName = ts.isPropertyAccessExpression(parent) && parent.name === node;
      if (!isReceiver && !isPropertyName && !declarationName(node, ts)) {
        record(node, `${node.text} may not be passed, returned, reassigned or destructured`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { directCalls, findings };
}

function typeFieldKind(typeNode, ts) {
  if (typeNode?.kind === ts.SyntaxKind.StringKeyword) return "string";
  if (typeNode?.kind === ts.SyntaxKind.NumberKeyword) return "number";
  return null;
}

function validateExactContextType(sourceFile, contract, ts) {
  const findings = [];
  const aliases = sourceFile.statements.filter(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === "SafeLogContext",
  );
  if (aliases.length !== 1 || !ts.isTypeLiteralNode(aliases[0].type)) {
    return [{ line: 1, reason: "SafeLogContext must be one exact object type alias" }];
  }
  const actual = new Map();
  for (const member of aliases[0].type.members) {
    if (!ts.isPropertySignature(member) || !member.name || !ts.isIdentifier(member.name)) {
      findings.push({
        line: lineAt(sourceFile, member),
        reason: "SafeLogContext may contain only named scalar fields",
      });
      continue;
    }
    actual.set(member.name.text, {
      optional: Boolean(member.questionToken),
      type: typeFieldKind(member.type, ts),
    });
  }
  const expectedNames = Object.keys(contract.fields).sort();
  const actualNames = [...actual.keys()].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    findings.push({
      line: lineAt(sourceFile, aliases[0]),
      reason: `SafeLogContext fields must be exactly ${expectedNames.join(", ")}; found ${actualNames.join(", ") || "none"}`,
    });
    return findings;
  }
  for (const name of expectedNames) {
    const field = actual.get(name);
    const expected = contract.fields[name];
    if (field.type !== expected.type || field.optional !== expected.optional) {
      findings.push({
        line: lineAt(sourceFile, aliases[0]),
        reason: `SafeLogContext.${name} must be ${expected.optional ? "optional " : "required "}${expected.type}`,
      });
    }
  }
  return findings;
}

function validateFieldValue(name, initializer, contract, ts) {
  const value = contract.fields[name].value;
  const node = unwrap(initializer, ts);
  if (value === "correlation") return expressionPath(node, ts) === "correlationId";
  if (value === "execution-code") {
    return isSafeCodeLiteral(node, ts) || expressionPath(node, ts) === "executionErrorCode";
  }
  if (value === "static-code") return isBoundedStaticCode(node, ts);
  if (value === "retained-count") return isNonNegativeInteger(node, ts);
  if (value.includes(".")) return expressionPath(node, ts) === value;
  return expressionPath(node, ts) === value || isNonNegativeInteger(node, ts);
}

function validateLogContext(sourceFile, expression, contract, ts) {
  const findings = [];
  const context = unwrap(expression, ts);
  if (!ts.isObjectLiteralExpression(context)) {
    return [
      {
        line: lineAt(sourceFile, expression),
        reason: "logger context must be an inline object literal",
      },
    ];
  }
  const seen = new Set();
  for (const property of context.properties) {
    if (ts.isSpreadAssignment(property)) {
      findings.push({
        line: lineAt(sourceFile, property),
        reason: "logger context spreads are forbidden",
      });
      continue;
    }
    let name = null;
    let initializer = null;
    if (ts.isShorthandPropertyAssignment(property)) {
      name = property.name.text;
      initializer = property.name;
    } else if (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    ) {
      name = property.name.text;
      initializer = property.initializer;
    } else {
      findings.push({
        line: lineAt(sourceFile, property),
        reason: "logger context may contain only fixed data properties",
      });
      continue;
    }
    if (!Object.hasOwn(contract.fields, name)) {
      findings.push({
        line: lineAt(sourceFile, property),
        reason: `logger context field is not allowlisted: ${name}`,
      });
      continue;
    }
    if (seen.has(name))
      findings.push({
        line: lineAt(sourceFile, property),
        reason: `logger context field is duplicated: ${name}`,
      });
    seen.add(name);
    if (!validateFieldValue(name, initializer, contract, ts)) {
      findings.push({
        line: lineAt(sourceFile, property),
        reason: `logger context field ${name} does not use its exact safe aggregate/correlation source`,
      });
    }
  }
  for (const [name, field] of Object.entries(contract.fields)) {
    if (!field.optional && !seen.has(name)) {
      findings.push({
        line: lineAt(sourceFile, context),
        reason: `required logger context field is missing: ${name}`,
      });
    }
  }
  return findings;
}

function callMethod(access, ts) {
  if (!ts.isPropertyAccessExpression(access) || access.questionDotToken) return null;
  return access.name.text;
}

function validateLoggerAndConsoleCalls(sourceFile, contract, ts) {
  const findings = [];
  const usage = collectSinkUsage(sourceFile, new Set(["logger", "console"]), ts);
  findings.push(...usage.findings);
  const observedEvents = new Set();
  const consoleForwarding = { info: 0, error: 0 };

  for (const { sink, access, call } of usage.directCalls) {
    const method = callMethod(access, ts);
    if (call.questionDotToken || !method) {
      findings.push({
        line: lineAt(sourceFile, call),
        reason: `${sink} optional/computed calls are forbidden`,
      });
      continue;
    }
    if (sink === "console") {
      const exactForward =
        (method === "info" || method === "error") &&
        call.arguments.length === 2 &&
        expressionPath(call.arguments[0], ts) === "event" &&
        expressionPath(call.arguments[1], ts) === "context";
      if (!exactForward) {
        findings.push({
          line: lineAt(sourceFile, call),
          reason: `raw console.${method} logging is forbidden`,
        });
      } else {
        consoleForwarding[method] += 1;
      }
      continue;
    }
    if (method !== "info" && method !== "error") {
      findings.push({
        line: lineAt(sourceFile, call),
        reason: `unsupported logger method: ${method}`,
      });
      continue;
    }
    if (call.arguments.length !== 2 || !ts.isStringLiteral(unwrap(call.arguments[0], ts))) {
      findings.push({
        line: lineAt(sourceFile, call),
        reason: "logger calls require one static event and one inline context",
      });
      continue;
    }
    const event = unwrap(call.arguments[0], ts).text;
    if (!Object.hasOwn(contract.events, event)) {
      findings.push({
        line: lineAt(sourceFile, call),
        reason: `logger event is not allowlisted: ${event}`,
      });
    } else {
      observedEvents.add(event);
      if (contract.events[event] !== method) {
        findings.push({
          line: lineAt(sourceFile, call),
          reason: `${event} must use logger.${contract.events[event]}`,
        });
      }
    }
    if (call.arguments[1])
      findings.push(...validateLogContext(sourceFile, call.arguments[1], contract, ts));
  }
  for (const event of Object.keys(contract.events)) {
    if (!observedEvents.has(event))
      findings.push({ line: 1, reason: `required safe logger event is missing: ${event}` });
  }
  for (const method of ["info", "error"]) {
    if (consoleForwarding[method] !== 1) {
      findings.push({
        line: 1,
        reason: `default SafeLogger must forward exactly once through console.${method}(event, context)`,
      });
    }
  }
  return findings;
}

function validateDefaultSafeLogger(sourceFile, ts) {
  const declarations = variableDeclarations(sourceFile, "defaultLogger", ts);
  if (declarations.length !== 1) {
    return [{ line: 1, reason: "defaultLogger must have one exact SafeLogger declaration" }];
  }
  const declaration = declarations[0];
  const typedAsSafeLogger =
    declaration.type &&
    ts.isTypeReferenceNode(declaration.type) &&
    expressionPath(declaration.type.typeName, ts) === "SafeLogger";
  const initializer = declaration.initializer && unwrap(declaration.initializer, ts);
  if (!typedAsSafeLogger || !initializer || !ts.isObjectLiteralExpression(initializer)) {
    return [
      {
        line: lineAt(sourceFile, declaration),
        reason: "defaultLogger must be an exact SafeLogger object literal",
      },
    ];
  }

  const findings = [];
  const expected = new Set(["info", "error"]);
  for (const property of initializer.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isIdentifier(property.name) ||
      !expected.has(property.name.text)
    ) {
      findings.push({
        line: lineAt(sourceFile, property),
        reason: "defaultLogger may expose only exact info/error forwarders",
      });
      continue;
    }
    expected.delete(property.name.text);
    const forwarder = unwrap(property.initializer, ts);
    const validParameters =
      ts.isArrowFunction(forwarder) &&
      forwarder.parameters.length === 2 &&
      ts.isIdentifier(forwarder.parameters[0].name) &&
      forwarder.parameters[0].name.text === "event" &&
      ts.isIdentifier(forwarder.parameters[1].name) &&
      forwarder.parameters[1].name.text === "context";
    const body = validParameters ? unwrap(forwarder.body, ts) : null;
    const validBody =
      body &&
      ts.isCallExpression(body) &&
      expressionPath(body.expression, ts) === `console.${property.name.text}` &&
      body.arguments.length === 2 &&
      expressionPath(body.arguments[0], ts) === "event" &&
      expressionPath(body.arguments[1], ts) === "context";
    if (!validParameters || !validBody) {
      findings.push({
        line: lineAt(sourceFile, property),
        reason: `defaultLogger.${property.name.text} must only forward event/context to console.${property.name.text}`,
      });
    }
  }
  if (expected.size > 0) {
    findings.push({
      line: lineAt(sourceFile, declaration),
      reason: `defaultLogger is missing exact forwarders: ${[...expected].join(", ")}`,
    });
  }
  return findings;
}

function collectNodes(sourceFile, predicate, ts) {
  const nodes = [];
  const visit = (node) => {
    if (predicate(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return nodes;
}

function variableDeclarations(sourceFile, name, ts) {
  return collectNodes(
    sourceFile,
    (node) =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name,
    ts,
  );
}

function assignmentOperator(kind, ts) {
  return new Set([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
  ]).has(kind);
}

function assignmentsTo(sourceFile, path, ts) {
  return collectNodes(
    sourceFile,
    (node) =>
      ts.isBinaryExpression(node) &&
      assignmentOperator(node.operatorToken.kind, ts) &&
      expressionPath(node.left, ts) === path,
    ts,
  );
}

function safeCorrelationInitializer(initializer, ts) {
  const outer = unwrap(initializer, ts);
  if (!ts.isCallExpression(outer) || outer.arguments.length !== 0) return false;
  const selection = unwrap(outer.expression, ts);
  if (
    !ts.isBinaryExpression(selection) ||
    selection.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken
  )
    return false;
  if (expressionPath(selection.left, ts) !== "options.randomCorrelationId") return false;
  const fallback = unwrap(selection.right, ts);
  if (!ts.isArrowFunction(fallback)) return false;
  const allowedIdentifiers = new Set([
    "options",
    "randomCorrelationId",
    "crypto",
    "getRandomValues",
    "Uint8Array",
    "reduce",
    "value",
    "byte",
    "toString",
    "padStart",
  ]);
  let hasCrypto = false;
  let safe = true;
  const visit = (node) => {
    if (expressionPath(node, ts) === "crypto.getRandomValues") hasCrypto = true;
    if (ts.isIdentifier(node) && !allowedIdentifiers.has(node.text) && !declarationName(node, ts))
      safe = false;
    ts.forEachChild(node, visit);
  };
  visit(fallback.body);
  return safe && hasCrypto;
}

function validateCreatedIdentityProvenance(sourceFile, ts) {
  const findings = [];
  const correlation = variableDeclarations(sourceFile, "correlationId", ts);
  if (
    correlation.length !== 1 ||
    !correlation[0].initializer ||
    !safeCorrelationInitializer(correlation[0].initializer, ts)
  ) {
    findings.push({
      line: correlation[0] ? lineAt(sourceFile, correlation[0]) : 1,
      reason: "correlationId must come only from the bounded random correlation generator",
    });
  }
  if (assignmentsTo(sourceFile, "correlationId", ts).length > 0) {
    findings.push({ line: 1, reason: "correlationId may not be reassigned" });
  }

  const executionCode = variableDeclarations(sourceFile, "executionErrorCode", ts);
  if (
    executionCode.length !== 1 ||
    !executionCode[0].initializer ||
    executionCode[0].initializer.kind !== ts.SyntaxKind.NullKeyword
  )
    findings.push({
      line: executionCode[0] ? lineAt(sourceFile, executionCode[0]) : 1,
      reason: "executionErrorCode must initialize to null",
    });
  for (const assignment of assignmentsTo(sourceFile, "executionErrorCode", ts)) {
    const right = unwrap(assignment.right, ts);
    const safeCall =
      ts.isCallExpression(right) &&
      expressionPath(right.expression, ts) === "safeErrorCode" &&
      right.arguments.length === 1 &&
      expressionPath(right.arguments[0], ts) === "error";
    if (!isSafeCodeLiteral(right, ts) && !safeCall) {
      findings.push({
        line: lineAt(sourceFile, assignment),
        reason: "executionErrorCode accepts only static codes or safeErrorCode(error)",
      });
    }
  }
  const safeErrorFunctions = sourceFile.statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "safeErrorCode",
  );
  if (safeErrorFunctions.length !== 1 || !safeErrorFunctions[0].body) {
    findings.push({ line: 1, reason: "safeErrorCode must have one exact bounded implementation" });
  } else {
    const returns = collectNodes(
      safeErrorFunctions[0].body,
      (node) => ts.isReturnStatement(node),
      ts,
    );
    const value =
      returns.length === 1 && returns[0].expression ? unwrap(returns[0].expression, ts) : null;
    const safeConditional =
      value &&
      ts.isConditionalExpression(value) &&
      ts.isBinaryExpression(value.condition) &&
      value.condition.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
      expressionPath(value.condition.left, ts) === "error" &&
      expressionPath(value.condition.right, ts) === "WorkerError" &&
      expressionPath(value.whenTrue, ts) === "error.code" &&
      isSafeCodeLiteral(unwrap(value.whenFalse, ts), ts);
    if (!safeConditional) {
      findings.push({
        line: lineAt(sourceFile, safeErrorFunctions[0]),
        reason: "safeErrorCode may expose only a static code or a bounded WorkerError code",
      });
    }
  }
  for (const creation of collectNodes(
    sourceFile,
    (node) => ts.isNewExpression(node) && expressionPath(node.expression, ts) === "WorkerError",
    ts,
  )) {
    if (
      creation.arguments?.length !== 1 ||
      !isSafeCodeLiteral(unwrap(creation.arguments[0], ts), ts)
    ) {
      findings.push({
        line: lineAt(sourceFile, creation),
        reason: "WorkerError codes must be static bounded codes",
      });
    }
  }

  const summary = variableDeclarations(sourceFile, "summary", ts).find(
    (node) =>
      node.type &&
      ts.isTypeReferenceNode(node.type) &&
      expressionPath(node.type.typeName, ts) === "WorkerSummary",
  );
  const expectedSummaryFields = ["claimed", "completed", "pending", "receiptFailures"];
  if (!summary?.initializer || !ts.isObjectLiteralExpression(unwrap(summary.initializer, ts))) {
    findings.push({
      line: summary ? lineAt(sourceFile, summary) : 1,
      reason: "WorkerSummary must start from one exact object literal",
    });
  } else {
    const fields = unwrap(summary.initializer, ts).properties;
    const names = fields.map((property) =>
      ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)
        ? property.name.text
        : null,
    );
    if (
      JSON.stringify(names.sort()) !== JSON.stringify([...expectedSummaryFields].sort()) ||
      fields.some(
        (property) =>
          !ts.isPropertyAssignment(property) ||
          !isNonNegativeInteger(unwrap(property.initializer, ts), ts),
      )
    )
      findings.push({
        line: lineAt(sourceFile, summary),
        reason: "WorkerSummary initializer must contain only zeroed aggregate fields",
      });
  }

  const safeSummaryWrite = (assignment) => {
    const left = expressionPath(assignment.left, ts);
    const operator = assignment.operatorToken.kind;
    const right = unwrap(assignment.right, ts);
    if (left === "summary.claimed" && operator === ts.SyntaxKind.EqualsToken)
      return expressionPath(right, ts) === "jobs.length";
    if (
      ["summary.completed", "summary.receiptFailures"].includes(left) &&
      operator === ts.SyntaxKind.PlusEqualsToken
    )
      return isNonNegativeInteger(right, ts);
    if (left === "summary.pending" && operator === ts.SyntaxKind.PlusEqualsToken) {
      return (
        isNonNegativeInteger(right, ts) ||
        (ts.isBinaryExpression(right) &&
          right.operatorToken.kind === ts.SyntaxKind.MinusToken &&
          expressionPath(right.left, ts) === "jobs.length" &&
          expressionPath(right.right, ts) === "index")
      );
    }
    if (left === "summary.pending" && operator === ts.SyntaxKind.EqualsToken) {
      const difference =
        ts.isCallExpression(right) && right.arguments[1] ? unwrap(right.arguments[1], ts) : null;
      return (
        ts.isCallExpression(right) &&
        expressionPath(right.expression, ts) === "Math.max" &&
        right.arguments.length === 2 &&
        expressionPath(right.arguments[0], ts) === "summary.pending" &&
        difference &&
        ts.isBinaryExpression(difference) &&
        difference.operatorToken.kind === ts.SyntaxKind.MinusToken &&
        expressionPath(difference.left, ts) === "summary.claimed" &&
        expressionPath(difference.right, ts) === "summary.completed"
      );
    }
    return false;
  };
  for (const assignment of collectNodes(
    sourceFile,
    (node) =>
      ts.isBinaryExpression(node) &&
      assignmentOperator(node.operatorToken.kind, ts) &&
      expressionPath(node.left, ts)?.startsWith("summary."),
    ts,
  )) {
    if (!safeSummaryWrite(assignment))
      findings.push({
        line: lineAt(sourceFile, assignment),
        reason: "WorkerSummary write is not an allowlisted aggregate update",
      });
  }
  return findings;
}

function validateTemporaryUserProvenance(sourceFile, ts) {
  const findings = [];
  for (const name of ["eligible", "deleted", "failed"]) {
    const declarations = variableDeclarations(sourceFile, name, ts);
    if (
      declarations.length !== 1 ||
      !declarations[0].initializer ||
      !isNonNegativeInteger(unwrap(declarations[0].initializer, ts), ts)
    ) {
      findings.push({
        line: declarations[0] ? lineAt(sourceFile, declarations[0]) : 1,
        reason: `${name} must initialize as a numeric aggregate`,
      });
    }
    for (const assignment of assignmentsTo(sourceFile, name, ts)) {
      const right = unwrap(assignment.right, ts);
      const safeIncrement =
        assignment.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken &&
        (isNonNegativeInteger(right, ts) || expressionPath(right, ts) === "unprocessed");
      if (!safeIncrement)
        findings.push({
          line: lineAt(sourceFile, assignment),
          reason: `${name} accepts only bounded aggregate increments`,
        });
    }
  }
  const unprocessed = variableDeclarations(sourceFile, "unprocessed", ts);
  if (unprocessed.length !== 1 || !unprocessed[0].initializer) {
    findings.push({ line: 1, reason: "unprocessed aggregate must have one bounded initializer" });
  } else {
    const value = unwrap(unprocessed[0].initializer, ts);
    if (
      !ts.isBinaryExpression(value) ||
      value.operatorToken.kind !== ts.SyntaxKind.MinusToken ||
      expressionPath(value.left, ts) !== "profiles.length" ||
      expressionPath(value.right, ts) !== "index"
    )
      findings.push({
        line: lineAt(sourceFile, unprocessed[0]),
        reason: "unprocessed must be profiles.length - index",
      });
  }
  return findings;
}

export function analyzeCleanupHandlerSource(source, contract, ts = typeScript()) {
  const sourceFile = parseSource(source, contract.path, ts);
  const findings = [];
  if (sourceFile.parseDiagnostics.length > 0) {
    return sourceFile.parseDiagnostics.map((diagnostic) => ({
      line: sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
      reason: `TypeScript parse failure: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
    }));
  }
  findings.push(...validateExactContextType(sourceFile, contract, ts));
  findings.push(...validateDefaultSafeLogger(sourceFile, ts));
  findings.push(...validateLoggerAndConsoleCalls(sourceFile, contract, ts));
  findings.push(
    ...(contract.provenance === "created-identities"
      ? validateCreatedIdentityProvenance(sourceFile, ts)
      : validateTemporaryUserProvenance(sourceFile, ts)),
  );
  return findings;
}

export function analyzeStructuredLoggerSource(
  source,
  path = "edge-function.ts",
  ts = typeScript(),
) {
  const sourceFile = parseSource(source, path, ts);
  const findings = [];
  if (sourceFile.parseDiagnostics.length > 0) {
    return [{ line: 1, reason: "TypeScript source cannot be parsed" }];
  }
  const imports = sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      /\/_shared\/structured-logger\.ts$/u.test(statement.moduleSpecifier.text) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) =>
          element.name.text === "createStructuredLogger" &&
          (!element.propertyName || element.propertyName.text === "createStructuredLogger"),
      ),
  );
  if (imports.length !== 1)
    findings.push({ line: 1, reason: "createStructuredLogger must have one exact named import" });
  const calls = collectNodes(
    sourceFile,
    (node) =>
      ts.isCallExpression(node) && expressionPath(node.expression, ts) === "createStructuredLogger",
    ts,
  );
  if (calls.length < 1) findings.push({ line: 1, reason: "createStructuredLogger must be called" });
  const loggerBindings = variableDeclarations(sourceFile, "logger", ts).filter((declaration) => {
    if (!declaration.initializer) return false;
    const initializer = unwrap(declaration.initializer, ts);
    return (
      ts.isCallExpression(initializer) &&
      expressionPath(initializer.expression, ts) === "createStructuredLogger"
    );
  });
  if (loggerBindings.length !== 1) {
    findings.push({
      line: 1,
      reason: "logger must have one exact createStructuredLogger(...) binding",
    });
  }
  const consoleUsage = collectSinkUsage(sourceFile, new Set(["console"]), ts);
  findings.push(...consoleUsage.findings);
  for (const { call } of consoleUsage.directCalls) {
    findings.push({ line: lineAt(sourceFile, call), reason: "raw console logging" });
  }
  return findings;
}

export function collectEdgeLogSafetyFindings(root = repositoryRoot) {
  const ts = typeScript();
  const findings = [];
  for (const relativePath of piiSensitiveFunctions) {
    const source = readFileSync(resolve(root, relativePath), "utf8");
    for (const finding of analyzeStructuredLoggerSource(source, relativePath, ts)) {
      findings.push({ path: relativePath, ...finding });
    }
  }
  for (const contract of cleanupLogContracts) {
    const source = readFileSync(resolve(root, contract.path), "utf8");
    for (const finding of analyzeCleanupHandlerSource(source, contract, ts)) {
      findings.push({ path: contract.path, ...finding });
    }
  }
  return findings;
}

export function runEdgeLogSafetyGate(root = repositoryRoot) {
  const findings = collectEdgeLogSafetyFindings(root);
  if (findings.length > 0) {
    console.error("[edge-log-safety] Unsafe Edge logging contract detected:");
    for (const finding of findings)
      console.error(`  - ${finding.path}:${finding.line} (${finding.reason})`);
    return false;
  }
  console.log(
    `[edge-log-safety] PASS: ${piiSensitiveFunctions.length} PII-sensitive functions use the structured logger and ${cleanupLogContracts.length} cleanup handlers satisfy the AST-verified aggregate/correlation logger contract with direct runtime output sinks restricted.`,
  );
  return true;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  if (!runEdgeLogSafetyGate()) process.exitCode = 1;
}
