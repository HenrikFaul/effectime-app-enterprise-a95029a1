/**
 * Request-authentication helpers shared by Supabase Edge Functions.
 *
 * Supabase's gateway JWT validation is still enabled where possible, but
 * privileged functions also compare the presented bearer credential with the
 * service-role key.  This keeps them fail-closed if deployment configuration
 * accidentally disables gateway verification.
 */

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return diff === 0;
}

export function hasServiceRoleCredential(
  req: Request,
  serviceRoleKey: string | undefined,
): boolean {
  const token = getBearerToken(req);
  return Boolean(token && serviceRoleKey && constantTimeEqual(token, serviceRoleKey));
}

export async function verifyHmacSha256(
  body: string,
  signatureHeader: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const digest = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqual(`sha256=${digest}`, signatureHeader);
}

/** Accept only an application-local path, never a protocol-relative URL. */
export function normalizeAppPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;

  try {
    const parsed = new URL(trimmed, "https://effectime.invalid");
    if (parsed.origin !== "https://effectime.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function safeAppOrigin(value: string | undefined): string {
  try {
    const parsed = new URL(value || "https://effectime.app");
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return "https://effectime.app";
    }
    return parsed.origin;
  } catch {
    return "https://effectime.app";
  }
}
