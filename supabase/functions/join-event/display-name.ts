export const DISPLAY_NAME_MAX_CODE_POINTS = 200;

export type InvalidDisplayNameReason = "invalid_type" | "blank" | "too_long" | "control_character";

export type CanonicalDisplayNameResult =
  { ok: true; value: string } | { ok: false; reason: InvalidDisplayNameReason };

export type OptionalCallerDisplayNameResult =
  | { ok: true; provided: true; value: string }
  | { ok: true; provided: false; value: null }
  | { ok: false; provided: true; reason: InvalidDisplayNameReason };

export type DisplayNameCandidateResult =
  { ok: true; value: string | null } | { ok: false; reason: InvalidDisplayNameReason };

function containsC0OrDel(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (
      codePoint <= 0x1f
      || (codePoint >= 0x7f && codePoint <= 0x9f)
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) return true;
  }
  return false;
}

/**
 * Canonical Edge boundary for public.profiles.display_name.
 *
 * Length is measured in JavaScript code points rather than UTF-16 code units,
 * matching PostgreSQL char_length for astral characters. The function trims
 * caller padding but deliberately performs no Unicode normalization or silent
 * character replacement.
 */
export function canonicalizeDisplayName(value: unknown): CanonicalDisplayNameResult {
  if (typeof value !== "string") return { ok: false, reason: "invalid_type" };

  const canonical = value.trim();
  if (canonical.length === 0) return { ok: false, reason: "blank" };
  if ([...canonical].length > DISPLAY_NAME_MAX_CODE_POINTS) {
    return { ok: false, reason: "too_long" };
  }
  if (containsC0OrDel(canonical)) {
    return { ok: false, reason: "control_character" };
  }

  return { ok: true, value: canonical };
}

export function resolveRequiredCallerDisplayName(value: unknown): CanonicalDisplayNameResult {
  return canonicalizeDisplayName(value);
}

/**
 * An omitted optional caller field may use an authoritative fallback later.
 * Once the caller explicitly supplies the field, however, an invalid value is
 * an error and must never be converted to absence or replaced by a fallback.
 */
export function resolveOptionalCallerDisplayName(
  body: unknown,
  field = "display_name",
): OptionalCallerDisplayNameResult {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const provided = record !== null && Object.prototype.hasOwnProperty.call(record, field);

  if (!provided) return { ok: true, provided: false, value: null };

  const result = canonicalizeDisplayName(record![field]);
  if (!result.ok) return { ok: false, provided: true, reason: result.reason };
  return { ok: true, provided: true, value: result.value };
}

/**
 * Resolves server-held fallback candidates in priority order. Null/undefined
 * mean "absent" and may fall through (or resolve to null). A present invalid
 * candidate fails closed instead of being silently skipped.
 */
export function resolveDisplayNameCandidates(
  candidates: readonly unknown[],
): DisplayNameCandidateResult {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const result = canonicalizeDisplayName(candidate);
    if (!result.ok) return result;
    return result;
  }

  return { ok: true, value: null };
}
