export const PUBLIC_API_RATE_LIMIT = 1000;

type ApiKeyState = {
  revoked_at: string | null;
  expires_at: string | null;
};

function validRawKey(value: string | null): string | null {
  const key = value?.trim() ?? "";
  return key.length > 0 && key.length <= 512 ? key : null;
}

/**
 * The public gateway uses a custom API-key credential, not a Supabase JWT.
 * If Authorization is present it is authoritative, preventing ambiguous
 * credential smuggling between it and X-API-Key.
 */
export function extractPublicApiKey(req: Request): string | null {
  const authorization = req.headers.get("Authorization");
  if (authorization !== null) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return validRawKey(match?.[1] ?? null);
  }
  return validRawKey(req.headers.get("X-API-Key"));
}

export function isApiKeyActive(key: ApiKeyState, nowMs = Date.now()): boolean {
  if (key.revoked_at !== null) return false;
  if (!key.expires_at) return true;
  const expiresAt = Date.parse(key.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

/** Count includes the current durable usage-log reservation. */
export function evaluatePublicApiRateLimit(rollingHourCount: number): {
  allowed: boolean;
  remaining: number;
} {
  if (!Number.isFinite(rollingHourCount) || rollingHourCount < 0) {
    return { allowed: false, remaining: 0 };
  }
  const normalized = Math.max(0, Math.floor(rollingHourCount));
  return {
    allowed: normalized <= PUBLIC_API_RATE_LIMIT,
    remaining: Math.max(0, PUBLIC_API_RATE_LIMIT - normalized),
  };
}

export function resolvePublicApiRoute(rawUrl: string): string {
  const segments = new URL(rawUrl).pathname.split("/").filter(Boolean);
  const functionIndex = segments.findIndex((segment) => segment === "public-api");
  const tail = functionIndex >= 0 ? segments.slice(functionIndex + 1) : segments;
  return "/" + tail.join("/");
}
