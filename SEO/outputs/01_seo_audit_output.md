# SEO Audit Agent — Output
# effectime.app | 2026-05-23

## 1. audit_summary

**Site:** effectime.app — Hungarian-primary B2B SaaS (shift scheduling, capacity planning, leave management, CRM embed SDK)  
**Stack:** React 18 + Vite SPA, `HashRouter` (`/#/` URLs), Supabase backend, Cloudflare/Netlify deployment  
**Audit date:** 2026-05-23  
**Assessment:** The site has one crawlable page (the landing page at `https://effectime.app/`) and the entire application sits behind a `HashRouter`, making every protected route invisible to search engines by design. While the deployment, PWA infrastructure, and security headers are well-engineered, the SEO layer has been virtually untouched. The single biggest issue is structural (HashRouter), but several compounding weaknesses — missing canonical, wrong `html lang`, missing sitemap, no structured data, a 4.3 MB monolithic JS bundle, and content mismatch between static metadata and live i18n content — combine to make the site nearly invisible to organic search for its Hungarian B2B target audience. The landing page is the only page that matters for SEO; fixing it is the entire organic strategy until a BrowserRouter migration is done.

---

## 2. issues_table

| ID | Title | Severity | Impact | Evidence | Affected URLs | Root Cause | Fix | Verification Method |
|----|-------|----------|--------|----------|--------------|------------|-----|---------------------|
| A-01 | HashRouter makes all sub-routes uncrawlable | P0 | 100% of app routes are invisible to crawlers — only `/` is indexable | `App.tsx` line 5: `import { HashRouter … }`. All routes registered as `/#/auth`, `/#/app`, `/#/w/:workspaceId` — fragments are never sent to servers | `/#/auth`, `/#/app`, `/#/w/*`, `/#/profile`, `/#/book/*`, `/#/embed/*` | Architectural: `HashRouter` relies on the fragment identifier which HTTP servers and crawlers never receive | Migrate to `BrowserRouter` with server-side SPA fallback already in place (`_redirects: /* /index.html 200`) | Crawl with Screaming Frog; confirm `/#/app` returns no indexable URL in GSC |
| A-02 | `html lang="en"` but primary content is Hungarian | P0 | Google misclassifies language → wrong regional ranking signals, HU audience not targeted | `index.html` line 2: `<html lang="en">`. I18n bundle default is `'en'` yet all landing copy is Hungarian. The `I18nProvider` does dynamically update `document.documentElement.lang` but only after JS execution — the static HTML that crawlers see says `en` | `https://effectime.app/` | Static HTML declares English; JS corrects it post-hydration, too late for crawler | Change `<html lang="hu">` in `index.html`; add hreflang for `en` alternate | Fetch raw HTML via `curl https://effectime.app/` and confirm `lang="hu"`; also verify via GSC Language targeting report |
| A-03 | No canonical tag | P1 | Any URL variant (`http://`, `www.`, query strings) can produce duplicate indexation | Confirmed absent | `https://effectime.app/` | Omission | Add `<link rel="canonical" href="https://effectime.app/" />` to `index.html` | GSC Coverage → confirm canonical reported as self-referencing |
| A-04 | No sitemap.xml or Sitemap directive in robots.txt | P1 | Googlebot must discover and crawl the landing page without any hints about site structure | `find … sitemap*` returns no file. `robots.txt` has no `Sitemap:` line | `https://effectime.app/robots.txt` | Omission | Create `/public/sitemap.xml`; add `Sitemap: https://effectime.app/sitemap.xml` to `robots.txt` | Fetch `https://effectime.app/sitemap.xml` → 200 OK; submit in GSC |
| A-05 | `<title>` is bare brand name with no keyword | P1 | Google uses the title tag as a primary ranking and click signal; "Effectime" has zero search volume | `index.html` line 6: `<title>Effectime</title>` | `https://effectime.app/` | Omission | Change to: `<title>Effectime – Váltásterv, szabadság- és kapacitástervező \| Enterprise HR szoftver</title>` | Fetch raw HTML; check SERP appearance in GSC |
| A-06 | Meta description too short, no CTA | P1 | Description is 65 chars — too short to be compelling; lacks CTA or differentiator | `index.html` line 7: `content="Effectime – enterprise erőforrás-, szabadság- és kapacitástervezés."` | `https://effectime.app/` | Copy not optimized post-launch | Expand to 140–155 chars: `Váltásterv, szabadság-kezelés és kapacitástervezés valós időben. Egyetlen vállalati platform a teljes csapatnaptárhoz. Ingyenesen kipróbálható.` | Manual SERP check; GSC CTR by query |
| A-07 | `og:url` missing from Open Graph block | P2 | Social shares can attribute the page to any URL variant | Not present in `index.html` | `https://effectime.app/` | Omission | Add `<meta property="og:url" content="https://effectime.app/" />` | Facebook Debugger |
| A-08 | `og:locale` not set — defaults to en_US | P2 | Facebook/LinkedIn OG parser assumes `en_US` locale; content is Hungarian | No `og:locale` in `index.html` | `https://effectime.app/` | Omission | Add `<meta property="og:locale" content="hu_HU" />` | Facebook Sharing Debugger |
| A-09 | No JSON-LD structured data | P2 | Missed eligibility for rich results (SaaS/Software, Organization, FAQ) | Confirmed absent across entire `src/` codebase and `index.html` | `https://effectime.app/` | Never implemented | Add `SoftwareApplication`, `Organization`, `FAQPage` JSON-LD in `index.html` | Google Rich Results Test |
| A-10 | Monolithic 4.3 MB uncompressed JS bundle — no code splitting | P2 | LCP and TBT will fail Core Web Vitals thresholds on mobile | `dist/assets/index-EvqoLQkf.js` is 4,304,945 bytes (single chunk). No lazy imports found | `https://effectime.app/` | No `React.lazy()` or dynamic `import()` in `App.tsx` | Add `React.lazy()` + `Suspense`; configure Vite `build.rollupOptions.output.manualChunks` | Lighthouse CWV audit |
| A-11 | No hreflang — 8 supported locales, no alternate annotations | P2 | Google cannot identify the correct locale-country target for each language variant | `locales.ts` shows 8 locales (en, hu, cs, sk, pl, de, at, ro). No hreflang found anywhere | `https://effectime.app/` | Bilingual architecture exists in JS only | Add `<link rel="alternate" hreflang>` tags in `index.html` | GSC International Targeting |
| A-12 | Landing page content rendered by JS — Googlebot two-wave indexing delay | P2 | Content changes may not be reflected in index for days to weeks | `index.html` body contains only `<div id="root"></div>`; all landing copy is in React | `https://effectime.app/` | SPA with no SSR, SSG, or prerendering plugin | Use `vite-plugin-prerender` for `/` only | GSC URL Inspection → "View Tested Page" |
| A-13 | favicon URL has cache-busting query string (`?v=3`) | P3 | Some crawlers strip query strings from favicon URIs | `index.html`: `href="/effectime-favicon.svg?v=3"` | `https://effectime.app/` | Developer cache-bust approach | Use filename versioning instead | Check favicon display |
| A-14 | `manifest.webmanifest` `lang` is `"en"` but app is Hungarian-primary | P3 | PWA shortcut names are in English for a Hungarian app | `manifest.webmanifest` line 9: `"lang": "en"` | `/manifest.webmanifest` | Not localized | Set `"lang": "hu"` and localize shortcut names | Android Chrome shortcut display |
| A-15 | robots.txt has no `Sitemap:` directive | P3 | Googlebot must rely on GSC submission to find the sitemap | `robots.txt`: no `Sitemap:` line | `https://effectime.app/robots.txt` | Omission | Add `Sitemap: https://effectime.app/sitemap.xml` | Fetch robots.txt |
| A-16 | `og:image` references Cloudflare R2 dev preview URL (lovable.app) | P3 | The OG image may rotate or expire; not a branded marketing asset | `index.html` line 20: `https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/...lovable.app-...png` | `https://effectime.app/` | Auto-generated preview image never replaced | Host branded OG image at `https://effectime.app/og-image.jpg` | Facebook Sharing Debugger |
| A-17 | Footer lacks navigational links | P3 | Footer links exist in i18n (`footer_privacy`, `footer_terms`, `footer_contact`) but not rendered in `Landing.tsx` | `Landing.tsx` lines 211–219: footer renders only logo + copyright | `https://effectime.app/` | UI incomplete | Implement footer links for Privacy, Terms, Contact | Inspect rendered page source |
| A-18 | No `og:image:width`, `og:image:height` or `og:image:alt` | P3 | Social platforms display fallback or missize the image | Only `og:image` present | `https://effectime.app/` | Omission | Add dimension and alt meta tags | Facebook Sharing Debugger |

---

## 3. prioritized_fixes

**Phase 1 — Immediate (blocking organic visibility):**
1. A-02: Fix `html lang="hu"` — single-line change
2. A-05: Rewrite `<title>` with keywords (~60 chars)
3. A-06: Rewrite meta description (140–155 chars, Hungarian, CTA)
4. A-03: Add canonical tag
5. A-04 + A-15: Create sitemap.xml + Sitemap directive

**Phase 2 — High impact (within 2 weeks):**
6. A-12: Add prerendering for `/` (vite-plugin-prerender)
7. A-10: Implement code splitting (React.lazy + Vite manualChunks)
8. A-09: Add JSON-LD structured data
9. A-07 + A-08: Add og:url and og:locale
10. A-16: Replace temporary OG image with branded asset

**Phase 3 — Strategic (1–3 months):**
11. A-01: Migrate from HashRouter to BrowserRouter
12. A-11: Implement hreflang (post-BrowserRouter)
13. A-14: Localize PWA manifest
14. A-17: Render footer links
15. A-13 + A-18: Fix favicon query strings; add OG image dimensions

---

## 4. verification_plan

| ID | Tool | Pass Criteria |
|----|------|---------------|
| A-01 | Screaming Frog; GSC Coverage | After BrowserRouter migration: `/app`, `/auth` etc appear as crawled URLs |
| A-02 | curl; GSC International Targeting | Returns `<html lang="hu">` in raw HTML |
| A-03 | Screaming Frog | `https://effectime.app/` reported as self-canonicalized |
| A-04 | curl; Google Search Console | Sitemap submitted, URLs discovered |
| A-05 | curl; SERP manual check | Title includes keyword phrase |
| A-06 | GSC CTR | Description displays fully in SERP |
| A-09 | Google Rich Results Test | No errors; SoftwareApplication entity recognised |
| A-10 | Chrome DevTools Lighthouse | LCP < 2.5s, TBT < 200ms |
| A-12 | GSC URL Inspection | Full landing page copy visible in raw HTML without JS |

---

## 5. assumptions

**Confirmed from codebase:**
- HashRouter confirmed in `src/App.tsx` line 5
- `html lang="en"` confirmed in `index.html` line 2
- No canonical, no sitemap, no JSON-LD, no hreflang confirmed via grep
- 4.3 MB single JS bundle confirmed via `dist/assets/` file listing
- No lazy imports confirmed via grep across `src/`
- `manifest.webmanifest` `lang: "en"` confirmed
- OG image is a `lovable.app` R2 CDN URL confirmed
- Footer i18n keys exist in `hu.ts` but not rendered in `Landing.tsx`
- `I18nProvider` does update `document.documentElement.lang` via JS — but only post-hydration

**Inferred:**
- `_redirects` file is deployed and working as SPA fallback
- Googlebot JS rendering works but experiences second-wave indexing delay
- The `@Effectime` Twitter handle is active
- The `.at` locale is Austrian German (`de-AT` BCP 47)
