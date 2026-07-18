const MOBILE_CSP_META_PATTERN = /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi;
const JSON_LD_PATTERN = /\s*<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi;
const NOSCRIPT_PATTERN = /\s*<noscript\b[^>]*>[\s\S]*?<\/noscript>\s*/gi;
const WEB_ONLY_LINK_PATTERN =
  /\s*<link\s+[^>]*rel=["'](?:manifest|icon|alternate icon|apple-touch-icon|preconnect|dns-prefetch)["'][^>]*>\s*/gi;

function normalizeMobileSupabaseOrigin(candidate: string): URL {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("The mobile build requires an absolute Supabase URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("The mobile build requires a credential-free Supabase HTTPS origin.");
  }
  return url;
}

export function createMobileCsp(supabaseUrl: string): string {
  const url = normalizeMobileSupabaseOrigin(supabaseUrl);
  const websocketOrigin = `wss://${url.host}`;

  return [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "script-src-elem 'self'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${url.origin} ${websocketOrigin}`,
    "frame-src 'self'",
    "child-src 'self'",
    "worker-src 'none'",
    "manifest-src 'none'",
    "media-src 'none'",
    "form-action 'self'",
  ].join("; ");
}

/** Produces the native-only HTML shell without changing the public web artifact. */
export function transformMobileIndexHtml(source: string, csp: string): string {
  const withoutExistingPolicy = source.replace(MOBILE_CSP_META_PATTERN, "");
  const withoutInlineSeo = withoutExistingPolicy
    .replace(JSON_LD_PATTERN, "\n")
    .replace(NOSCRIPT_PATTERN, "\n")
    .replace(WEB_ONLY_LINK_PATTERN, "\n");
  const cspMeta = `    <meta http-equiv="Content-Security-Policy" content="${csp}">\n`;

  if (!withoutInlineSeo.includes("<head>")) {
    throw new Error("Mobile index transformation could not find the document head.");
  }

  return withoutInlineSeo.replace("<head>", `<head>\n${cspMeta}`);
}
