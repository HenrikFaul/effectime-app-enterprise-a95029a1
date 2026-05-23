# Technical SEO Agent — Output
# effectime.app | 2026-05-23

## 1. technical_issues.csv (markdown table)

| # | Issue | Root Cause | Affected Templates | Business Impact | Fix Recommendation | Test Recommendation | Est. Engineering Effort |
|---|-------|-----------|-------------------|----------------|-------------------|--------------------|-----------------------------|
| T-01 | **HashRouter — all routes use fragment identifiers, invisible to crawlers** | `HashRouter` in `src/App.tsx` line 5. The `#` fragment is never transmitted in HTTP requests; Googlebot only receives `GET /` regardless of what follows the `#`. Routes `/#/auth`, `/#/app`, `/#/w/:workspaceId`, `/#/book/:token`, `/#/embed/:view` are HTTP-invisible. | All templates except `/` (Landing page) | 100% of application routes unindexable. Even if product pages had SEO value, they cannot be crawled, indexed, or ranked. | Replace `HashRouter` with `BrowserRouter`. The `_redirects` file already implements `/* /index.html 200` SPA fallback, making BrowserRouter trivially deployable. Add `<meta name="robots" content="noindex">` on all authenticated routes after migration. | Deploy to staging; crawl with Screaming Frog; confirm `/auth`, `/book/*` return HTTP 200 with full HTML | 3–5 days |
| T-02 | **`html lang="en"` in static HTML — language signal incorrect at crawler-render time** | `index.html` line 2: `<html lang="en">`. `I18nProvider.tsx` does update `document.documentElement.lang` at runtime, but only after React hydration. Googlebot sees `lang="en"` in the raw HTTP response. | Landing page (`/`) | Google targets the site as an English-language site. Hungarian B2B search queries do not receive correct geolocation signals. | Change `<html lang="hu">` in `index.html`. Update `DEFAULT_LOCALE` to `'hu'` in `locales.ts`. | `curl -s https://effectime.app/ | grep 'lang='` → must return `hu` without executing JS | 15 minutes |
| T-03 | **No sitemap.xml** | No `sitemap.xml` file in `/public/`. No `Sitemap:` directive in `robots.txt`. | Landing page (`/`) | Googlebot must rely on organic discovery via backlinks only. New content changes may not be re-crawled promptly. | Create `/public/sitemap.xml` with one `<url>` entry for `https://effectime.app/`. Add `Sitemap:` directive to `robots.txt`. Submit in GSC. | `curl https://effectime.app/sitemap.xml` → HTTP 200 + valid XML | 30 minutes |
| T-04 | **SPA with zero prerendering — Googlebot sees only `<div id="root"></div>` in raw HTML** | `index.html` `<body>` contains only `<div id="root"></div>`. All content is rendered by React. `vite.config.ts` has no SSR, SSG, or prerendering plugin. | Landing page (`/`) | Google uses two-wave indexing. Wave 1: empty body stored. Wave 2: JS execution (days later). Any change to landing content is not reflected in index until wave 2 fires. | Implement prerendering for `/` using `vite-plugin-prerender`. Generates static snapshot at build time without requiring BrowserRouter migration. | GSC URL Inspection → "View Tested Page" → confirm full landing text visible without JS | 4–8 hours |
| T-05 | **Monolithic 4.3 MB JS bundle — no code splitting — TBT and LCP failure risk** | Single chunk: `dist/assets/index-EvqoLQkf.js` = 4,304,945 bytes. No `React.lazy()` or dynamic `import()` found anywhere in `src/`. All 12 page components bundled into one file. Even gzip (~75% reduction → ~1 MB) leaves massive parse/eval overhead on mobile. | All pages — Landing page most affected | LCP directly impacted: H1 and feature cards wait behind a 4.3 MB JS parse. TBT failure almost certain without splitting on mobile 4G. | Add `React.lazy()` + `Suspense` for every page except `Landing`. Configure Vite `manualChunks` to separate vendor, Supabase, i18n, and page chunks. Target landing route initial JS < 200 KB. | Lighthouse mobile audit before/after; PageSpeed Insights | 2–3 days |
| T-06 | **No canonical tag** | Not present in `index.html`. With `_redirects` catch-all, URLs like `https://effectime.app/anything` return 200 with the same `index.html` content. | `https://effectime.app/` and all path variants | Google may split PageRank across URL variants. Inbound links to path variants are not consolidated. | Add `<link rel="canonical" href="https://effectime.app/" />` to `index.html`. Ensure HTTPS and www-to-non-www redirects at CDN level. | Screaming Frog canonicals report | 5 minutes |
| T-07 | **`_redirects` catch-all returns 200 for all paths — Googlebot cannot distinguish 404s** | `/public/_redirects`: `/* /index.html 200`. Every URL returns 200. If HashRouter-internal route is `*` → `<NotFound />`, that 404 state is invisible to crawlers. | All URLs on the domain | Soft 404s waste crawl budget and dilute link equity. | After BrowserRouter migration, implement proper HTTP 404 responses. Interim: add `<meta name="robots" content="noindex">` dynamically in `NotFound` component. | GSC Coverage → check for "Soft 404" warnings | S (NotFound noindex) / L (proper 404 handling) |
| T-08 | **No hreflang — 8 language variants, no alternate annotations** | `locales.ts` confirms 8 supported locales (en, hu, cs, sk, pl, de, at, ro). Locale is detected from `localStorage` or `navigator.language` — invisible to crawlers. No hreflang tags anywhere. Note: `at` locale should be `de-AT` BCP 47. | `https://effectime.app/` | Google cannot determine which locale-country the site serves. HU, CS, SK, PL, DE, AT, RO markets get no locale-targeting signal. | Pre-BrowserRouter: add hreflang `<link>` tags in `index.html` for hu + en + x-default. Post-migration: path-based locale routing with correct hreflang per path. Fix `at` to BCP 47 `de-AT`. | hreflangchecker.com; GSC International Targeting | XS (static tags) / L (path-based routing) |
| T-09 | **Service Worker precaches `/` but may conflict with `Cache-Control: no-cache`** | `public/sw.js` precaches root files. `index.html` is served with `Cache-Control: no-cache, no-store, must-revalidate` (`_headers`). The SW fetch handler may serve stale `index.html` while new JS chunk hash has changed. | `https://effectime.app/` | If SW serves stale HTML, Google's JS renderer executes a stale bundle, producing incorrect indexed content. | Migrate to `vite-plugin-pwa` for proper Workbox cache manifest generation. Ensure navigation handler always fetches fresh `index.html`. | Chrome DevTools → Application → Service Workers | M |
| T-10 | **`manifest.webmanifest` shortcut URLs use `/#/` hash paths** | Shortcuts: `"url": "/#/app?tab=my-portal"` and `"url": "/#/app?tab=requests"`. On iOS Safari PWA, hash URLs in shortcuts may not navigate correctly within standalone context. | PWA install on iOS | PWA shortcuts may not navigate to correct tab on iOS. | Post-BrowserRouter migration: update shortcut URLs to `/app?tab=my-portal`. Pre-migration: test iOS PWA shortcut navigation. | Install as PWA on iOS Safari; tap shortcuts; verify navigation | XS (post-migration) |
| T-11 | **`og:image` is a third-party CDN URL (Cloudflare R2 / lovable.app dev preview)** | `index.html` line 20: URL contains `lovable.app` in path — a development platform preview screenshot that may rotate or be deleted. | `https://effectime.app/` | If image URL breaks, social share previews show no image — reducing click-through from social posts. Image is a dev screenshot, not a branded marketing asset. | Create branded OG image (1200×630px JPEG) at `/public/og-image.jpg`. Update all `og:image` and `twitter:image` in `index.html`. | Facebook Sharing Debugger; `curl -I <image-url>` | XS |
| T-12 | **No preconnect or DNS-prefetch for Supabase origins** | `index.html` has no `<link rel="preconnect">` or `<link rel="dns-prefetch">`. App connects to `*.supabase.co` (REST + WebSocket). DNS resolution delay blocks auth checks on initial load. | Landing page LCP | LCP delayed by DNS lookup + TCP + TLS handshake for Supabase. On mobile 4G adds 200–500ms. | Add: `<link rel="preconnect" href="https://[supabase-project].supabase.co" crossorigin />` and `<link rel="dns-prefetch" href="https://[supabase-project].supabase.co" />` | Chrome DevTools → Network → Timing; Lighthouse → Opportunities | XS |

---

## 2. engineering_fix_plan.md

### TIER 1: Zero-effort static file fixes (< 2 hours total)

**Step 1.1 — Fix `html lang` attribute**
- File: `/index.html` line 2
- Change: `<html lang="en">` → `<html lang="hu">`
- Commit scope: `index.html` only

**Step 1.2 — Rewrite `<title>` and `<meta name="description">`**
- New title (≤60 chars): `Effectime – Váltásterv, szabadság és kapacitástervező szoftver`
- New description (140–155 chars): `Valós idejű csapatnaptár, szabadságkezelés és erőforrás-tervezés egy platformon. Magyar KKV és enterprise csapatok számára. Ingyenes kipróbálás.`

**Step 1.3 — Add canonical, og:url, og:locale, hreflang, preconnect**
```html
<link rel="canonical" href="https://effectime.app/" />
<meta property="og:url" content="https://effectime.app/" />
<meta property="og:locale" content="hu_HU" />
<meta property="og:locale:alternate" content="en_GB" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Effectime – vállalati erőforrástervező platform" />
<link rel="alternate" hreflang="hu" href="https://effectime.app/" />
<link rel="alternate" hreflang="en" href="https://effectime.app/" />
<link rel="alternate" hreflang="x-default" href="https://effectime.app/" />
<link rel="preconnect" href="https://[supabase-project].supabase.co" crossorigin />
<link rel="dns-prefetch" href="https://[supabase-project].supabase.co" />
```

**Step 1.4 — Create `/public/sitemap.xml`**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://effectime.app/</loc>
    <lastmod>2026-05-23</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="hu" href="https://effectime.app/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://effectime.app/" />
  </url>
</urlset>
```

**Step 1.5 — Add Sitemap directive to `/public/robots.txt`**
Append: `Sitemap: https://effectime.app/sitemap.xml`

**Step 1.6 — Fix `/public/manifest.webmanifest`**
- Change `"lang": "en"` → `"lang": "hu"`
- Change shortcut names to Hungarian: `"Bejelentkezés"`, `"Szabadságkérelem"`

**Step 1.7 — Replace OG image**
- Create `/public/og-image.jpg` (1200×630px branded)
- Update all `og:image` and `twitter:image` from R2 URL

---

### TIER 2: Structured data + prerendering (4–8 hours)

**Step 2.1 — Add JSON-LD structured data to `/index.html`**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Effectime",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Vállalati váltásterv, szabadság- és kapacitástervező platform.",
  "url": "https://effectime.app/",
  "inLanguage": ["hu", "en"],
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "HUF" },
  "publisher": { "@type": "Organization", "name": "Effectime", "url": "https://effectime.app/" }
}
</script>
```

**Step 2.2 — Implement prerendering for `/` (landing only)**
```bash
npm install -D vite-plugin-prerender
```
In `vite.config.ts`:
```typescript
import { PrerenderPlugin } from 'vite-plugin-prerender';
plugins: [react(), PrerenderPlugin({ routes: ['/'] }), ...]
```

---

### TIER 3: Code splitting (2–3 days)

**Step 3.1 — React.lazy() for all non-landing pages in `App.tsx`**
```typescript
const Auth = React.lazy(() => import('./pages/Auth'));
const Enterprise = React.lazy(() => import('./pages/Enterprise'));
const Profile = React.lazy(() => import('./pages/Profile'));
// ... all other pages
```
Wrap `<Routes>` in `<Suspense fallback={<PageLoader />}>`.

**Step 3.2 — Configure Vite manual chunks**
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-radix': [/* all @radix-ui/* */],
        'vendor-tanstack': ['@tanstack/react-query'],
        'vendor-supabase': ['@supabase/supabase-js'],
      }
    }
  }
}
```

---

### TIER 4: HashRouter → BrowserRouter migration (3–5 days)

**Step 4.1 — Replace `HashRouter` with `BrowserRouter`**
- `src/App.tsx`: change import and component
- Remove `HashRouteBridge` component (lines 31–58) — no longer needed
- Remove `SpaRedirectHandler` — no longer needed
- Update PWA manifest shortcuts to `/app?tab=my-portal`

**Step 4.2 — Add noindex to all authenticated routes**
In each protected page component:
```typescript
useEffect(() => {
  const el = document.createElement('meta');
  el.name = 'robots'; el.content = 'noindex,nofollow';
  document.head.appendChild(el);
  return () => document.head.removeChild(el);
}, []);
```

**Step 4.3 — Add soft noindex to `NotFound` component**
Inject `<meta name="robots" content="noindex">` dynamically on mount.

**Step 4.4 — Post-migration: path-based locale routing**
Implement `/hu/`, `/en/` path prefixes with correct hreflang annotations.

---

## 3. crawl_risk_map.md

### What CAN be crawled (current state)

| URL | HTTP Status | Crawler sees | Indexability |
|-----|-------------|--------------|-------------|
| `https://effectime.app/` | 200 | `<div id="root"></div>` (raw) / Full landing (after JS) | YES — wave 2 only |
| `https://effectime.app/robots.txt` | 200 | Robots directives | N/A |
| `https://effectime.app/manifest.webmanifest` | 200 | PWA manifest JSON | N/A |

### What CANNOT be crawled (HashRouter)

| Hash Route | Purpose | Crawlability | Risk |
|-----------|---------|-------------|------|
| `/#/auth` | Auth / login | BLOCKED | Low risk — auth pages often better blocked |
| `/#/app` | Enterprise app (protected) | BLOCKED | Intentional — authenticated route |
| `/#/w/:workspaceId` | Workspace (protected) | BLOCKED | Intentional — workspace UUIDs in URL |
| `/#/profile` | User profile (protected) | BLOCKED | Intentional |
| `/#/admin`, `/#/superadmin`, `/#/reseller` | Admin (protected) | BLOCKED | Intentional — add noindex post-migration |
| `/#/unsubscribe` | Email unsubscribe | BLOCKED | Acceptable |
| `/#/reset-password` | Password reset | BLOCKED | Acceptable |
| `/#/book/:token` | Candidate booking (public) | BLOCKED | RISK: Public page external users receive links to. Post-migration, consider indexing the booking form page shell. |
| `/#/embed/:view` | CRM embed views (public) | BLOCKED | RISK: Embed views meant for external use are undiscoverable. A static documentation page at `/developer/embed` would capture developer search traffic. |

### What is crawled but should NOT be

| URL pattern | Current status | Risk |
|------------|----------------|------|
| `https://effectime.app/<any-path>` | Returns HTTP 200 (SPA catch-all) | Soft 404 risk — any backlink to a non-existent path returns 200 without noindex |

### Crawl risk severity summary

| Risk | Severity | Gap |
|------|---------|-----|
| All sub-routes inaccessible to crawlers | P0 Critical | HashRouter is root cause; BrowserRouter migration is the only resolution |
| Landing page content in JS only | P1 High | Prerendering for `/` eliminates this |
| Soft 404 proliferation via 200-catch-all | P1 High | Post-BrowserRouter: implement proper 404 status codes |
| Language mismatch (`lang="en"`) | P1 High | Static `index.html` fix required |
| Missing canonical | P1 High | Add canonical to `index.html` |
| Missing sitemap | P2 Medium | Create sitemap.xml |
| No hreflang for 8 locales | P2 Medium | Static hreflang tags as interim |
| OG image on third-party (lovable.app R2) | P2 Medium | Host branded OG image on own domain |
| 4.3 MB JS bundle | P2 Medium | Code splitting required for first-visit LCP |
| SW cache conflict with no-cache | P3 Low | SW should pass-through navigation requests |
