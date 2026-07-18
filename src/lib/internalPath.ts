const DEFAULT_INTERNAL_PATH = '/app';
const MAX_INTERNAL_PATH_LENGTH = 4096;

const STATIC_APP_PATHS = new Set([
  '/',
  '/muszakbeosztas',
  '/szabadsagkezeles',
  '/kapacitastervezes',
  '/app',
  '/enterprise',
  '/profile',
  '/auth',
  '/reset-password',
  '/admin',
  '/superadmin',
  '/unsubscribe',
  '/reseller',
]);

const UUID_SEGMENT = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const WORKSPACE_PATH = new RegExp(`^/w/${UUID_SEGMENT}$`);
const CANDIDATE_BOOKING_PATH = new RegExp(`^/book/${UUID_SEGMENT}$`);
const EMBED_PATH = /^\/embed\/(?:capacity_planner|shift_roster|leave_calendar|member_schedule|multi)$/;

const PROTOCOL_SYNTAX = /(?:^|[/?#&=])\s*[a-z][a-z0-9+.-]*:/i;
const DOT_PATH_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

function decodeForInspection(value: string): string | null {
  let decoded = value;

  try {
    // Two nested encodings are enough to catch the common parser-confusion
    // variants without ever treating a decoded value as the navigation target.
    for (let pass = 0; pass < 2; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }

  return decoded;
}

function hasUnsafeSyntax(value: string): boolean {
  return (
    containsControlCharacter(value) ||
    value.includes('\\') ||
    value.includes('//') ||
    PROTOCOL_SYNTAX.test(value)
  );
}

function isKnownRoutePath(pathname: string): boolean {
  const canonicalPath = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  return (
    STATIC_APP_PATHS.has(canonicalPath) ||
    WORKSPACE_PATH.test(canonicalPath) ||
    CANDIDATE_BOOKING_PATH.test(canonicalPath) ||
    EMBED_PATH.test(canonicalPath)
  );
}

/**
 * Accepts only canonical, same-origin application paths.
 *
 * Query strings and fragments are preserved for documented internal flows
 * (workspace tabs, invites, OAuth/email activation, embeds), but the path
 * itself must match a route registered in App.tsx. Unsafe URL syntax is
 * rejected before React Router or window.location sees it.
 */
export function isSafeInternalPath(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false;
  if (!candidate || candidate.length > MAX_INTERNAL_PATH_LENGTH) return false;
  if (candidate !== candidate.trim()) return false;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return false;

  const decoded = decodeForInspection(candidate);
  if (!decoded) return false;
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return false;
  if (hasUnsafeSyntax(candidate) || hasUnsafeSyntax(decoded)) return false;

  const rawPathname = candidate.split(/[?#]/, 1)[0];
  const decodedPathname = decoded.split(/[?#]/, 1)[0];
  if (DOT_PATH_SEGMENT.test(decodedPathname)) return false;

  // Requiring both forms to match prevents percent-encoded route or separator
  // tricks while still allowing ordinary encoded query values.
  return isKnownRoutePath(rawPathname) && isKnownRoutePath(decodedPathname);
}

/**
 * Fail-closed redirect resolution. An invalid caller-provided fallback cannot
 * widen the route allowlist; it collapses to the workspace picker instead.
 */
export function resolveInternalPath(
  candidate: unknown,
  fallback: string = DEFAULT_INTERNAL_PATH,
): string {
  const safeFallback = isSafeInternalPath(fallback) ? fallback : DEFAULT_INTERNAL_PATH;
  return isSafeInternalPath(candidate) ? candidate : safeFallback;
}
