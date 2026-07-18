export const DELIVERY_CLAIM_TTL_MS = 30_000;
const DELIVERY_CLAIM_PREFIX = "__effectime_webhook_claim__:";

function isPublicIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return true;

  if (/^\d+(?:\.\d+){3}$/.test(host)) return !isPublicIpv4(host);
  if (host.includes(":")) {
    return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") ||
      host.startsWith("fe") || host.startsWith("ff") || host.startsWith("::ffff:");
  }

  const blockedNames = new Set([
    "localhost",
    "metadata.google.internal",
    "metadata.azure.internal",
    "instance-data.ec2.internal",
  ]);
  if (blockedNames.has(host)) return true;
  if (!host.includes(".")) return true;

  return [
    ".localhost", ".local", ".internal", ".home", ".lan", ".test", ".invalid", ".example",
    ".nip.io", ".sslip.io", ".localtest.me",
  ].some((suffix) => host.endsWith(suffix));
}

/**
 * Enforce the documented HTTPS contract and reject obvious local/metadata
 * targets. Redirects are separately disabled at fetch time.
 */
export function safeWebhookUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > 2048) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password || isBlockedHostname(url.hostname)) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function createDeliveryClaim(
  nowMs = Date.now(),
  nonce: string = crypto.randomUUID(),
): string {
  return `${DELIVERY_CLAIM_PREFIX}${nowMs}:${nonce}`;
}

export function isActiveDeliveryClaim(value: string | null, nowMs = Date.now()): boolean {
  if (!value?.startsWith(DELIVERY_CLAIM_PREFIX)) return false;
  const timestampText = value.slice(DELIVERY_CLAIM_PREFIX.length).split(":", 1)[0];
  const timestamp = Number(timestampText);
  return Number.isFinite(timestamp) && timestamp > nowMs - DELIVERY_CLAIM_TTL_MS;
}
