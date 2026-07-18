/**
 * Stored document HTML is untrusted: it can contain workspace template data,
 * user-provided substitutions, and model output. The iframe sandbox is the
 * primary boundary; this CSP is a second, independent network/content boundary.
 */
export const DOCUMENT_PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "navigate-to 'none'",
].join('; ');

const DOCUMENT_PREVIEW_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 1rem;
    background: #ffffff;
    color: #0f172a;
    font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow-wrap: anywhere;
  }
  main { max-width: 72rem; margin: 0 auto; }
  img, svg, video { max-width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 0.5rem; text-align: left; }
  a { color: #0f766e; }
  pre { white-space: pre-wrap; }
`;

export function buildDocumentPreviewSrcDoc(untrustedHtml: string): string {
  // The policy is deliberately emitted before untrusted markup. A malicious
  // closing tag can change document structure, but cannot remove the already
  // applied policy or the iframe's outer sandbox flags.
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${DOCUMENT_PREVIEW_CSP}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${DOCUMENT_PREVIEW_STYLES}</style>
  </head>
  <body><main>${untrustedHtml}</main></body>
</html>`;
}
