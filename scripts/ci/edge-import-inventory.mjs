const REMOTE_SPECIFIER = String.raw`((?:npm:|jsr:|https?:\/\/)[^"']+)`;

const IMPORT_PATTERNS = [
  new RegExp(String.raw`\bfrom\s*["']${REMOTE_SPECIFIER}["']`, "g"),
  new RegExp(String.raw`\bimport\s*["']${REMOTE_SPECIFIER}["']`, "g"),
  new RegExp(String.raw`\bimport\s*\(\s*["']${REMOTE_SPECIFIER}["']\s*\)`, "g"),
  new RegExp(String.raw`<reference\s+types=["']${REMOTE_SPECIFIER}["']\s*\/?>`, "g"),
];

export function collectRemoteImportSpecifiers(source) {
  const specifiers = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}
