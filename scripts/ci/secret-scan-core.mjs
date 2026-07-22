export const MAX_FILE_BYTES = 8 * 1024 * 1024;

const privateKeyHeaderPattern =
  "-----BEGIN (?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED) )?" +
  "PRIVATE KEY-----|-----BEGIN PGP " +
  "PRIVATE KEY BLOCK-----";

const detectors = [
  ["private-key", new RegExp(privateKeyHeaderPattern, "g")],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["slack-token", /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g],
  ["stripe-live-key", /\bsk_live_[0-9A-Za-z]{20,}\b/g],
  ["openai-api-key", /\bsk-(?:proj-)?[0-9A-Za-z_-]{32,}\b/g],
  ["anthropic-api-key", /\bsk-ant-[0-9A-Za-z_-]{32,}\b/g],
  ["supabase-secret-key", /\bsb_secret_[0-9A-Za-z_-]{20,}\b/g],
];
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

const forbiddenSigningFiles = [
  /(?:^|\/)[^/]+\.(?:jks|keystore|p12|mobileprovision)$/i,
  /(?:^|\/)AuthKey_[^/]+\.p8$/i,
];

export function normalizeRepositoryPath(path) {
  return String(path).replaceAll("\\", "/");
}

export function isForbiddenSigningPath(path) {
  const normalizedPath = normalizeRepositoryPath(path);
  return forbiddenSigningFiles.some((pattern) => pattern.test(normalizedPath));
}

function isProbablyBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8_192);
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

export function scanSecretBuffer(buffer, path) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("Secret scanner input must be a Buffer.");
  if (isProbablyBinary(buffer)) return { findings: [], scanned: false };

  const normalizedPath = sanitizeSecretDiagnosticPath(path);
  const source = buffer.toString("utf8");
  const findings = [];

  for (const [detector, pattern] of detectors) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      findings.push({
        detector,
        path: normalizedPath,
        line: lineNumberAt(source, match.index),
      });
    }
  }

  JWT_PATTERN.lastIndex = 0;
  for (const match of source.matchAll(JWT_PATTERN)) {
    if (decodeJwtPayload(match[0])?.role !== "service_role") continue;
    findings.push({
      detector: "supabase-service-role-jwt",
      path: normalizedPath,
      line: lineNumberAt(source, match.index),
    });
  }

  return { findings, scanned: true };
}

export function sanitizeSecretDiagnosticPath(value) {
  let redacted = normalizeRepositoryPath(value);
  for (const [, pattern] of detectors) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  JWT_PATTERN.lastIndex = 0;
  redacted = redacted.replace(JWT_PATTERN, "[REDACTED-JWT]");
  return redacted.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 320);
}

export function formatSecretFinding(finding) {
  const path = JSON.stringify(sanitizeSecretDiagnosticPath(finding.path));
  const object = finding.objectId ? ` @ ${finding.objectId.slice(0, 12)}` : "";
  return `${path}:${finding.line} (${finding.detector}${object})`;
}
