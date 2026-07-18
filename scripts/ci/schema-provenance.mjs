const SCHEMA_KINDS = ["tables", "views", "functions", "enums"];

function blankExceptNewlines(value) {
  return value.replace(/[^\r\n]/g, " ");
}

function maskTypeScriptNonCode(source) {
  let output = "";
  for (let index = 0; index < source.length;) {
    if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    const quote = source[index];
    if (quote === "\"" || quote === "'" || quote === "`") {
      let stop = index + 1;
      while (stop < source.length) {
        if (source[stop] === "\\") {
          stop += 2;
          continue;
        }
        if (source[stop++] === quote) break;
      }
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    output += source[index++];
  }
  return output;
}

function balancedBlock(source, openBrace) {
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) {
      return { start: openBrace + 1, end: index };
    }
  }
  throw new Error(`Unbalanced block beginning at offset ${openBrace}`);
}

function directPropertyNames(block) {
  const names = [];
  let depth = 0;
  for (const line of block.split(/\r?\n/)) {
    if (depth === 0) {
      const match = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
      if (match) names.push(match[1]);
    }
    for (const character of line) {
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
    }
    if (depth < 0) throw new Error("Unexpected closing brace in generated schema block");
  }
  return [...new Set(names)].sort();
}

export function parseGeneratedPublicSchema(source) {
  const masked = maskTypeScriptNonCode(source);
  const publicMatch = /\bpublic\s*:\s*\{/.exec(masked);
  if (!publicMatch) throw new Error("Generated types do not contain a public schema");
  const publicOpen = publicMatch.index + publicMatch[0].lastIndexOf("{");
  const publicBlock = balancedBlock(masked, publicOpen);
  const publicSource = masked.slice(publicBlock.start, publicBlock.end);
  const result = {};

  for (const kind of SCHEMA_KINDS) {
    const label = kind[0].toUpperCase() + kind.slice(1);
    const match = new RegExp(`\\b${label}\\s*:\\s*\\{`).exec(publicSource);
    if (!match) throw new Error(`Generated public schema does not contain ${label}`);
    const open = match.index + match[0].lastIndexOf("{");
    const block = balancedBlock(publicSource, open);
    result[kind] = directPropertyNames(publicSource.slice(block.start, block.end));
  }

  return result;
}

function sanitizeSql(source, includeDoBlockStatements = true) {
  let output = "";
  for (let index = 0; index < source.length;) {
    if (source.startsWith("--", index)) {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (source.startsWith("/*", index)) {
      let depth = 1;
      let stop = index + 2;
      while (stop < source.length && depth > 0) {
        if (source.startsWith("/*", stop)) {
          depth += 1;
          stop += 2;
        } else if (source.startsWith("*/", stop)) {
          depth -= 1;
          stop += 2;
        } else stop += 1;
      }
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (source[index] === "'") {
      let stop = index + 1;
      while (stop < source.length) {
        if (source[stop] === "'" && source[stop + 1] === "'") {
          stop += 2;
        } else if (source[stop++] === "'") break;
      }
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (source[index] === "$") {
      const delimiter = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (delimiter) {
        const end = source.indexOf(delimiter, index + delimiter.length);
        const stop = end === -1 ? source.length : end + delimiter.length;
        const prefix = output.slice(-120);
        const isDoBlock = /\bDO(?:\s+LANGUAGE\s+[A-Za-z_][\w$]*)?\s*$/i.test(prefix);
        output += includeDoBlockStatements && isDoBlock
          ? `${blankExceptNewlines(delimiter)}${sanitizeSql(source.slice(index + delimiter.length, end === -1 ? source.length : end), true)}${end === -1 ? "" : blankExceptNewlines(delimiter)}`
          : blankExceptNewlines(source.slice(index, stop));
        index = stop;
        continue;
      }
    }
    output += source[index++];
  }
  return output;
}

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_NAME = String.raw`(${IDENTIFIER})(?:\s*\.\s*(${IDENTIFIER}))?`;

function identifierValue(identifier) {
  return identifier.startsWith('"')
    ? identifier.slice(1, -1).replaceAll('""', '"')
    : identifier.toLowerCase();
}

function addPublicName(target, first, second, unqualifiedSchemaIsPublic) {
  const schema = second ? identifierValue(first) : unqualifiedSchemaIsPublic ? "public" : undefined;
  const name = identifierValue(second ?? first);
  if (schema === "public") target.add(name);
}

function stripSqlComments(source) {
  let output = "";
  for (let index = 0; index < source.length;) {
    if (source.startsWith("--", index)) {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (source.startsWith("/*", index)) {
      let depth = 1;
      let stop = index + 2;
      while (stop < source.length && depth > 0) {
        if (source.startsWith("/*", stop)) {
          depth += 1;
          stop += 2;
        } else if (source.startsWith("*/", stop)) {
          depth -= 1;
          stop += 2;
        } else stop += 1;
      }
      output += blankExceptNewlines(source.slice(index, stop));
      index = stop;
      continue;
    }
    const quote = source[index];
    if (quote === "'" || quote === '"') {
      let stop = index + 1;
      while (stop < source.length) {
        if (source[stop] === quote && source[stop + 1] === quote) {
          stop += 2;
        } else if (source[stop++] === quote) break;
      }
      output += source.slice(index, stop);
      index = stop;
      continue;
    }
    output += source[index++];
  }
  return output;
}

function firstSearchPathSchema(value) {
  const cleaned = stripSqlComments(value).trim();
  if (/^DEFAULT\b/i.test(cleaned)) return "public";

  let quote;
  let stop = 0;
  while (stop < cleaned.length) {
    const character = cleaned[stop];
    if (quote) {
      if (character === quote && cleaned[stop + 1] === quote) {
        stop += 2;
        continue;
      }
      if (character === quote) quote = undefined;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === ",") break;
    stop += 1;
  }

  let first = cleaned.slice(0, stop).trim();
  if (first.startsWith("'") && first.endsWith("'")) {
    first = first.slice(1, -1).replaceAll("''", "'").split(",", 1)[0].trim();
    return first;
  }
  if (first.startsWith('"') && first.endsWith('"')) return identifierValue(first);
  return first.split(/\s+/, 1)[0].toLowerCase();
}

function sqlStatementBounds(sql) {
  const bounds = [];
  let start = 0;
  let quotedIdentifier = false;
  for (let index = 0; index < sql.length; index += 1) {
    if (sql[index] === '"') {
      if (quotedIdentifier && sql[index + 1] === '"') index += 1;
      else quotedIdentifier = !quotedIdentifier;
    } else if (sql[index] === ";" && !quotedIdentifier) {
      bounds.push({ start, end: index });
      start = index + 1;
    }
  }
  bounds.push({ start, end: sql.length });
  return bounds;
}

function searchPathEvents(source) {
  // Dollar-quoted bodies are fully masked here so a function's own SET search_path
  // clause or procedural SET cannot mutate the migration session state we model.
  const controlSql = sanitizeSql(source, false);
  const events = [];
  for (const { start, end } of sqlStatementBounds(controlSql)) {
    const statement = controlSql.slice(start, end);
    const setPrefix = /^\s*SET\s+(?:(?:LOCAL|SESSION)\s+)?search_path\b\s*(?:=|TO)/i.exec(statement);
    if (setPrefix) {
      const value = source.slice(start + setPrefix[0].length, end);
      events.push({ index: end, unqualifiedSchemaIsPublic: firstSearchPathSchema(value) === "public" });
      continue;
    }
    if (/^\s*RESET\s+(?:search_path|ALL)\b/i.test(statement)) {
      events.push({ index: end, unqualifiedSchemaIsPublic: true });
    }
  }
  return events;
}

function unqualifiedSchemaIsPublicAt(events, index) {
  let isPublic = true;
  for (const event of events) {
    if (event.index >= index) break;
    isPublic = event.unqualifiedSchemaIsPublic;
  }
  return isPublic;
}

export function parseMigrationDefinitions(source) {
  const sql = sanitizeSql(source);
  const pathEvents = searchPathEvents(source);
  const result = Object.fromEntries(SCHEMA_KINDS.map((kind) => [kind, new Set()]));
  const patterns = {
    tables: {
      expression: new RegExp(
        String.raw`\bCREATE\s+(?:((?:(?:GLOBAL|LOCAL)\s+)?(?:TEMP|TEMPORARY)|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${QUALIFIED_NAME}`,
        "gi",
      ),
      modifierGroup: 1,
      nameGroup: 2,
    },
    views: {
      expression: new RegExp(
        String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?((?:TEMP|TEMPORARY)\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?${QUALIFIED_NAME}`,
        "gi",
      ),
      modifierGroup: 1,
      nameGroup: 2,
    },
    functions: {
      expression: new RegExp(
        String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+${QUALIFIED_NAME}`,
        "gi",
      ),
      nameGroup: 1,
    },
    enums: {
      expression: new RegExp(
        String.raw`\bCREATE\s+TYPE\s+${QUALIFIED_NAME}\s+AS\s+ENUM\b`,
        "gi",
      ),
      nameGroup: 1,
    },
  };

  for (const kind of SCHEMA_KINDS) {
    const { expression, modifierGroup, nameGroup } = patterns[kind];
    for (const match of sql.matchAll(expression)) {
      const modifier = modifierGroup ? match[modifierGroup] : undefined;
      if (/\bTEMP(?:ORARY)?\b/i.test(modifier ?? "")) continue;
      addPublicName(
        result[kind],
        match[nameGroup],
        match[nameGroup + 1],
        unqualifiedSchemaIsPublicAt(pathEvents, match.index),
      );
    }
  }
  return Object.fromEntries(SCHEMA_KINDS.map((kind) => [kind, [...result[kind]].sort()]));
}

export function mergeSchemaSurfaces(surfaces) {
  return Object.fromEntries(
    SCHEMA_KINDS.map((kind) => [kind, [...new Set(surfaces.flatMap((surface) => surface[kind]))].sort()]),
  );
}

export function analyzeSchemaProvenance(generatedSurface, migrationSurface) {
  return {
    generatedSurface,
    unprovenGeneratedSurface: Object.fromEntries(
      SCHEMA_KINDS.map((kind) => {
        const proven = new Set(migrationSurface[kind]);
        return [kind, generatedSurface[kind].filter((name) => !proven.has(name))];
      }),
    ),
  };
}

export function compareSchemaProvenance(actual, baseline) {
  const violations = [];
  for (const section of ["generatedSurface", "unprovenGeneratedSurface"]) {
    for (const kind of SCHEMA_KINDS) {
      const expected = new Set(baseline[section]?.[kind] ?? []);
      const observed = new Set(actual[section][kind]);
      const added = [...observed].filter((name) => !expected.has(name)).sort();
      const removed = [...expected].filter((name) => !observed.has(name)).sort();
      if (added.length || removed.length) violations.push({ section, kind, added, removed });
    }
  }
  return violations;
}

export function validateSchemaProvenanceBaseline(baseline) {
  const problems = [];
  if (baseline?.schemaVersion !== 1) problems.push("schemaVersion must be 1");
  for (const section of ["generatedSurface", "unprovenGeneratedSurface"]) {
    for (const kind of SCHEMA_KINDS) {
      const values = baseline?.[section]?.[kind];
      if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value)) {
        problems.push(`${section}.${kind} must be a non-empty-string array`);
      } else if (JSON.stringify(values) !== JSON.stringify([...new Set(values)].sort())) {
        problems.push(`${section}.${kind} must be unique and sorted`);
      }
    }
  }
  for (const kind of SCHEMA_KINDS) {
    const generated = new Set(baseline?.generatedSurface?.[kind] ?? []);
    for (const name of baseline?.unprovenGeneratedSurface?.[kind] ?? []) {
      if (!generated.has(name)) {
        problems.push(`unprovenGeneratedSurface.${kind} contains non-generated object: ${name}`);
      }
    }
  }
  return problems;
}

export { SCHEMA_KINDS };
