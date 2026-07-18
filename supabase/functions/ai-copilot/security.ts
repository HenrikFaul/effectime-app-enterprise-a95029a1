export const DEFAULT_COPILOT_MODEL = "gemini-2.5-flash";

const ALLOWED_COPILOT_MODELS = new Set([DEFAULT_COPILOT_MODEL]);
const REDACTION_MARKER = "[PERSONAL DETAIL REDACTED]";

export class WorkspaceContextUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceContextUnavailableError";
  }
}

export function assertRequiredWorkspaceContext(
  results: ReadonlyArray<{ name: string; error?: { message?: string } | null }>,
): void {
  const failures = results.filter((result) => result.error);
  if (failures.length === 0) return;
  throw new WorkspaceContextUnavailableError(
    failures
      .map((failure) => `${failure.name}: ${failure.error?.message?.trim() || "query failed"}`)
      .join("; "),
  );
}

/**
 * Resolve a caller-supplied Gemini model without allowing arbitrary model-path
 * selection. An omitted/blank value keeps the documented default.
 */
export function resolveCopilotModel(requestedModel: unknown): string | null {
  if (requestedModel === undefined || requestedModel === null || requestedModel === "") {
    return DEFAULT_COPILOT_MODEL;
  }
  if (typeof requestedModel !== "string") return null;
  return ALLOWED_COPILOT_MODELS.has(requestedModel) ? requestedModel : null;
}

/** Build a longest-first list so full names are removed before name parts. */
export function collectSensitiveNameTerms(displayNames: readonly string[]): string[] {
  const terms = new Set<string>();
  for (const displayName of displayNames) {
    const normalized = displayName.trim().replace(/\s+/g, " ");
    if (normalized.length < 3) continue;
    terms.add(normalized);
    for (const part of normalized.split(/[\s,;()]+/u)) {
      if (part.length >= 3) terms.add(part);
    }
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove identifiable prompt segments before they leave Effectime. The raw
 * message remains in the workspace-scoped conversation table; only the text
 * sent to the external AI provider is redacted.
 */
export function redactExternalPromptText(
  text: string,
  sensitiveNameTerms: readonly string[],
): string {
  let sanitized = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, REDACTION_MARKER)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, REDACTION_MARKER);

  for (const term of sensitiveNameTerms) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegex(term)}\\p{L}{0,12}(?=$|[^\\p{L}\\p{N}])`,
      "giu",
    );
    sanitized = sanitized.replace(pattern, (_match, prefix: string) => prefix + REDACTION_MARKER);
  }

  // A marker can still be linked to an individual's leave/HR details if the
  // surrounding sentence is retained, so remove the complete prompt segment.
  const segments = sanitized.split(/(\r?\n+|(?<=[.!?])\s+)/u);
  return segments
    .map((segment) => segment.includes(REDACTION_MARKER) ? REDACTION_MARKER : segment)
    .join("")
    .replace(new RegExp(`(?:${escapeRegex(REDACTION_MARKER)}\\s*){2,}`, "g"), REDACTION_MARKER + " ")
    .trim();
}

/** The inserted request is allowed while the rolling-hour total is <= limit. */
export function isRateLimitExceeded(hitCount: number, limit = 20): boolean {
  return hitCount > limit;
}
