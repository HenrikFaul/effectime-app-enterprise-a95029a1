import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMobileCsp, transformMobileIndexHtml } from "@/lib/platform/mobileCsp";

const ROOT = process.cwd();

describe("native WebView CSP artifact", () => {
  it("builds an exact-origin policy without executable inline scripts or wildcards", () => {
    const csp = createMobileCsp("https://project-ref.supabase.co");

    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("connect-src 'self' https://project-ref.supabase.co wss://project-ref.supabase.co");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain("*.supabase.co");
    expect(csp).not.toContain("api.anthropic.com");
  });

  it("rejects unsafe or non-origin backend URLs", () => {
    for (const candidate of [
      "http://project-ref.supabase.co",
      "https://user:password@project-ref.supabase.co",
      "https://project-ref.supabase.co/rest/v1",
      "https://project-ref.supabase.co?query=1",
    ]) {
      expect(() => createMobileCsp(candidate)).toThrow();
    }
  });

  it("removes web-only inline/PWA content and injects one early CSP meta", () => {
    const source = readFileSync(join(ROOT, "index.html"), "utf8");
    const result = transformMobileIndexHtml(
      source,
      createMobileCsp("https://project-ref.supabase.co"),
    );

    expect(result.match(/http-equiv=["']Content-Security-Policy["']/g)).toHaveLength(1);
    expect(result).not.toContain('type="application/ld+json"');
    expect(result).not.toContain("<noscript");
    expect(result).not.toMatch(/rel=["']manifest["']/);
    expect(result).not.toMatch(/rel=["'](?:alternate )?icon["']/);
    expect(result).not.toMatch(/rel=["']apple-touch-icon["']/);
    expect(result).not.toMatch(/rel=["'](?:preconnect|dns-prefetch)["']/);
    expect(result.match(/<script\b/g)).toHaveLength(1);
    expect(result).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(result.indexOf("Content-Security-Policy")).toBeLessThan(result.indexOf("<script"));
  });
});
