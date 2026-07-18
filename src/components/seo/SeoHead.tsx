import { Helmet } from "react-helmet-async";
import { isNativeRuntime } from "@/lib/platform/mobile";

const SITE_URL = "https://effectime.app";

export interface BreadcrumbItem {
  name: string;
  path: string; // relative, e.g. "/muszakbeosztas"
}

export interface SeoHeadProps {
  title: string;
  description: string;
  path: string; // canonical path, e.g. "/muszakbeosztas"
  keywords?: string;
  ogImage?: string;
  breadcrumbs?: BreadcrumbItem[];
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noIndex?: boolean;
}

/**
 * Per-route SEO head. Sets <title>, meta description, canonical, OG, Twitter
 * and (optionally) BreadcrumbList + additional JSON-LD schemas.
 *
 * Use exactly ONE <SeoHead /> per route at the top of the route component.
 * The static <link rel="canonical"> was removed from index.html (v3.49.5) so
 * each route owns its own canonical via Helmet — no duplicate-canonical risk.
 */
export function SeoHead({
  title,
  description,
  path,
  keywords,
  ogImage = `${SITE_URL}/og-image.png`,
  breadcrumbs,
  jsonLd,
  noIndex = false,
}: SeoHeadProps) {
  const url = `${SITE_URL}${path}`;

  const breadcrumbSchema = breadcrumbs && breadcrumbs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: b.name,
          item: `${SITE_URL}${b.path}`,
        })),
      }
    : null;

  const extraJsonLd = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const structuredDataEnabled = !isNativeRuntime();

  return (
    <Helmet>
      <html lang="hu" />
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noIndex
        ? <meta name="robots" content="noindex, nofollow" />
        : <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />}
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="hu" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Effectime" />
      <meta property="og:locale" content="hu_HU" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {structuredDataEnabled && breadcrumbSchema && (
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      )}
      {structuredDataEnabled && extraJsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
      ))}
    </Helmet>
  );
}

export default SeoHead;
