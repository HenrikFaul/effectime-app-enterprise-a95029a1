export const MAX_DELETION_REASON_LENGTH = 1000;
export const MAX_REAUTHENTICATION_AGE_SECONDS = 10 * 60;
const MAX_CLOCK_SKEW_SECONDS = 60;

/**
 * Local migrations that reference auth.users without an ON DELETE action.
 * They must be resolved by a retention-aware, transactional deletion workflow;
 * until then the Edge Function blocks before making any destructive change.
 */
export const BLOCKING_AUTH_USER_REFERENCES = [
  { table: "enterprise_agile_sync_log", column: "triggered_by" },
  { table: "enterprise_open_shift_requests", column: "created_by" },
  { table: "enterprise_shift_cancellations", column: "user_id" },
  { table: "enterprise_embed_tokens", column: "created_by" },
] as const;

export type DeletionRequestValidation =
  | { ok: true; reason: string }
  | { ok: false; code: "INVALID_REQUEST_BODY" | "INVALID_DELETION_REASON"; error: string };

export type ReauthenticationStatus = "invalid" | "not-asserted" | "recent" | "required";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateDeletionRequestBody(body: unknown): DeletionRequestValidation {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      code: "INVALID_REQUEST_BODY",
      error: "Request body must be a JSON object",
    };
  }

  if (typeof body.reason !== "string") {
    return {
      ok: false,
      code: "INVALID_DELETION_REASON",
      error: "Reason is required",
    };
  }

  const reason = body.reason.trim();
  if (reason.length === 0 || reason.length > MAX_DELETION_REASON_LENGTH) {
    return {
      ok: false,
      code: "INVALID_DELETION_REASON",
      error: `Reason must contain between 1 and ${MAX_DELETION_REASON_LENGTH} characters`,
    };
  }

  return { ok: true, reason };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) return null;

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return isPlainObject(payload) ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Uses only the standard OIDC `auth_time` claim. The JWT signature and identity
 * are verified separately by Supabase Auth; `iat` is deliberately not treated
 * as proof of a recent interactive authentication because token refresh changes it.
 */
export function getReauthenticationStatus(
  authorizationHeader: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = MAX_REAUTHENTICATION_AGE_SECONDS,
): ReauthenticationStatus {
  const bearerMatch = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  if (!bearerMatch) return "invalid";

  const payload = decodeJwtPayload(bearerMatch[1]);
  if (!payload) return "invalid";

  if (!("auth_time" in payload)) return "not-asserted";
  if (typeof payload.auth_time !== "number" || !Number.isFinite(payload.auth_time)) {
    return "invalid";
  }

  const ageSeconds = nowSeconds - payload.auth_time;
  if (ageSeconds < -MAX_CLOCK_SKEW_SECONDS || ageSeconds > maxAgeSeconds) {
    return "required";
  }

  return "recent";
}

export function findWorkspacesWithoutAnotherActiveOwner(
  activeOwnerWorkspaceIds: readonly string[],
  createdWorkspaceIds: readonly string[],
  otherActiveOwnerWorkspaceIds: readonly string[],
): string[] {
  const candidateWorkspaceIds = new Set([
    ...activeOwnerWorkspaceIds,
    ...createdWorkspaceIds,
  ]);
  const coveredWorkspaceIds = new Set(otherActiveOwnerWorkspaceIds);

  return [...candidateWorkspaceIds].filter((workspaceId) => !coveredWorkspaceIds.has(workspaceId));
}
