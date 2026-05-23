# Implementation Roadmap — effectime.app SEO
# Agent 09 — Reporting & Action Plan | 2026-05-23

---

## Overview

Four phases cover a 12-month execution horizon. Phases 1 and 2 focus exclusively on removing blockers and establishing measurement infrastructure. Phase 3 builds the content foundation. Phase 4 executes the full topical authority and link acquisition strategy. Each phase gate requires verifiable outputs before the next phase begins.

**Dependency chain (non-negotiable):**
- GSC + GA4 setup must complete in Week 1 (all measurement depends on it)
- lang/title/canonical fixes must precede structured data (SEO-01, SEO-04 are dependencies of SEO-11)
- Prerendering must precede content expansion (no point writing content that JS-renders too slowly)
- BrowserRouter migration must precede multi-URL content strategy (all feature/blog pages are blocked without it)

---

## Phase 1 — Days 1–7: Remove Blockers, Establish Measurement

### Goal
Ensure that Google can correctly identify, classify, and read the homepage. Install measurement tools so all future work is attributable. These changes require approximately 3–5 hours of engineering and 30 minutes of tool setup.

### Actions

| # | Action | Owner | Effort | Success Metric | Backlog Ref |
|---|--------|-------|--------|----------------|-------------|
| 1.1 | Change `<html lang="en">` to `<html lang="hu">` in index.html | Dev (Frontend) | XS (15 min) | `curl https://effectime.app/` returns `lang="hu"` | SEO-01 |
| 1.2 | Rewrite `<title>` to `Effectime – Kapacitástervező, Szabadságkezelő és Műszakbeosztó Platform` | Dev (Frontend) | XS (15 min) | SERP snippet shows keyword-rich title in GSC Performance | SEO-02 |
| 1.3 | Rewrite meta description: `Valós idejű csapatnaptár, szabadságkezelés és kapacitástervezés közép- és nagyvállalatoknak. Próbálja ki díjmentesen – regisztráció 2 perc.` (140–155 chars) | Dev (Frontend) / Copywriter | XS (15 min) | GSC CTR baseline established; description visible in SERP | SEO-03 |
| 1.4 | Add `<link rel="canonical" href="https://effectime.app/" />` to index.html | Dev (Frontend) | XS (5 min) | GSC Coverage shows self-referencing canonical | SEO-04 |
| 1.5 | Add `og:url`, `og:locale` (hu_HU), `og:locale:alternate` (en_GB), `og:image:width` (1200), `og:image:height` (630), `og:image:alt` tags | Dev (Frontend) | XS (20 min) | Facebook Sharing Debugger passes; og:locale shows hu_HU | SEO-08, SEO-09, SEO-30 |
| 1.6 | Add hreflang tags for `hu`, `en`, and `x-default` to index.html | Dev (Frontend) | XS (20 min) | hreflangchecker.com passes; GSC International Targeting shows 0 errors | SEO-13 |
| 1.7 | Add `<link rel="preconnect">` + `<link rel="dns-prefetch">` for Supabase project URL | Dev (Frontend) | XS (10 min) | Lighthouse "Eliminate render-blocking resources" no longer flags Supabase; LCP improvement measurable in DevTools | SEO-15 |
| 1.8 | Create `/public/sitemap.xml` with one URL entry for `https://effectime.app/` | Dev (Frontend) | XS (20 min) | `curl https://effectime.app/sitemap.xml` returns valid XML | SEO-05 |
| 1.9 | Add `Sitemap: https://effectime.app/sitemap.xml` to `robots.txt` | Dev (Frontend) | XS (5 min) | `curl https://effectime.app/robots.txt` includes Sitemap directive | SEO-06 |
| 1.10 | Update `manifest.webmanifest` `lang` from `"en"` to `"hu"`; localize shortcut names in Hungarian | Dev (Frontend) | XS (20 min) | Android Chrome PWA shortcut shows Hungarian names | SEO-10 |
| 1.11 | Update favicon reference to use filename versioning (`effectime-favicon-v3.svg`) instead of query string (`?v=3`) | Dev (Frontend) | XS (10 min) | Favicon visible in all tested browsers without query string | SEO-29 |
| 1.12 | Set up Google Search Console property for effectime.app; submit sitemap; verify property ownership | Marketing / Founder | XS (30 min) | GSC property verified; Sitemaps report shows 1 URL submitted, 0 errors | SEO-18 |
| 1.13 | Set up Google Analytics 4 data stream; configure organic conversion event for signup/trial start | Marketing / Founder | XS (30 min) | GA4 data stream active; organic channel visible; signup event fires on registration | SEO-19 |

**Phase 1 exit gate:** All 13 items shipped and verified. GSC showing HU language targeting. Sitemap submitted with 0 errors.

---

## Phase 2 — Weeks 2–4: Structured Data, Content Foundation, Performance

### Goal
Make the homepage eligible for rich results (FAQ snippets, SoftwareApplication knowledge panel), fix the two-wave indexing delay, establish the E-E-A-T foundation (About page, entity graph), and replace the dev-preview OG image with a branded asset. Begin addressing Core Web Vitals.

### Actions

| # | Action | Owner | Effort | Success Metric | Backlog Ref |
|---|--------|-------|--------|----------------|-------------|
| 2.1 | Create branded OG image (1200×630 JPEG) and host at `/public/og-image.jpg`; update og:image + twitter:image in index.html | Designer / Dev | S (2–3 hrs) | Facebook Sharing Debugger shows branded image; no expiry risk | SEO-07 |
| 2.2 | Add JSON-LD: `Organization` schema (name, url, logo, contactPoint, sameAs links) | Dev (Frontend) | S (1–2 hrs) | Google Rich Results Test passes Organization schema | SEO-11 |
| 2.3 | Add JSON-LD: `SoftwareApplication` schema (name, applicationCategory, operatingSystem, offers, featureList) | Dev (Frontend) | S (1–2 hrs) | Google Rich Results Test passes SoftwareApplication; GSC Enhancements detects application | SEO-11 |
| 2.4 | Add JSON-LD: `FAQPage` schema with 8 question/answer pairs targeting HU HR queries (szabadság, kapacitástervezés, műszakbeosztás, CRM integráció, GDPR, pricing signal, M365, digitalizáció) | Dev (Frontend) / Copywriter | S (2–3 hrs) | GSC Enhancements → FAQ rich results detected; Google Rich Results Test passes | SEO-11 |
| 2.5 | Add `<noscript>` fallback with H1, product description, and CTA text for non-JS crawlers | Dev (Frontend) | XS (30 min) | Screaming Frog detects noscript body text in raw HTML | SEO-31 |
| 2.6 | Implement `vite-plugin-prerender` for `/` route to generate static HTML snapshot at build time | Dev (Frontend) | M (4–8 hrs) | GSC URL Inspection "View Tested Page" shows full landing text without JS execution | SEO-12 |
| 2.7 | Rewrite landing page H1 to: `Vállalati kapacitástervező, szabadságkezelő és műszakbeosztó platform közép- és nagyvállalatoknak` | Copywriter / Dev | S (1–2 hrs) | GSC queries matching H1 keyword fragments start appearing | SEO-16 |
| 2.8 | Expand landing page from ~400 words to ~1,500–2,000 words: add feature pillar sections (műszakbeosztás, kapacitástervezés, szabadságkezelés, CRM SDK, M365), FAQ HTML section (8 pairs), social proof signals, GDPR/security callout, pricing CTA | Copywriter | L (1–2 days) | GSC rendered word count > 1,500; avg. time on page increases; bounce rate decreases | SEO-17 |
| 2.9 | Implement footer navigation links: Privacy Policy, Terms of Service, Contact; link to future /about | Dev (Frontend) | S (2–3 hrs) | Screaming Frog confirms footer links crawled; Privacy/Terms/Contact return 200 | SEO-14 |
| 2.10 | Create About page: company story, mission, founder profile (Faul Henrik — name, LinkedIn, role, photo, brief bio) | Copywriter / Founder | M (1 day) | GSC brand query impressions; About page indexed | SEO-22 |
| 2.11 | Begin entity consistency: create/claim Google Business Profile, LinkedIn company page, Crunchbase profile; ensure NAP (name, address, phone) + description is identical across all | Founder / Marketing | M (3–4 hrs) | GBP claimed; LinkedIn company page live; Crunchbase profile published | SEO-28 |

**Phase 2 exit gate:** Rich Results Test passing for all 3 JSON-LD schemas. Prerendering deployed and confirmed via GSC URL Inspection. Landing page H1 and expanded content live. Footer navigation renders. About page indexed.

---

## Phase 3 — Months 2–4: BrowserRouter Migration + Core Content Build

### Goal
Execute the root technical fix (BrowserRouter migration) that unlocks multi-URL publishing. Build the first batch of keyword-targeted content pages. Implement code splitting to fix Core Web Vitals. Begin link acquisition outreach.

### Actions

| # | Action | Owner | Effort | Success Metric | Backlog Ref |
|---|--------|-------|--------|----------------|-------------|
| 3.1 | Implement `React.lazy()` + `Suspense` for all non-Landing routes; configure Vite `manualChunks` (vendor, supabase, i18n, page chunks); target initial JS bundle < 200 KB | Dev (Frontend) | L (2–3 days) | Lighthouse mobile LCP < 2.5s; TBT < 200ms; PSI passes Core Web Vitals | SEO-20 |
| 3.2 | Migrate `HashRouter` → `BrowserRouter`; add `<meta name="robots" content="noindex">` on all authenticated routes (`/app`, `/w/:id`, `/auth`); verify `_redirects` SPA fallback | Dev (Frontend) | XL (3–5 days) | Screaming Frog confirms public routes return HTTP 200 with content; authenticated routes return noindex | SEO-21 |
| 3.3 | Migrate `vite-plugin-pwa` (Workbox) to replace manual service worker; ensure SW never serves stale `index.html` while new JS chunk hashes exist | Dev (Frontend) | M (1–2 days) | Chrome DevTools SW inspection; Lighthouse PWA audit passes | SEO-32 |
| 3.4 | Fix soft-404 handling: implement proper HTTP 404 responses post-BrowserRouter migration; dynamic noindex on NotFound component as interim | Dev (Frontend) | S (3–4 hrs) | GSC Coverage → 0 "Soft 404" warnings | SEO-21 dep. |
| 3.5 | Publish Security & GDPR page at `/hu/biztonsag-gdpr/`: data residency (EU), encryption, access controls, GDPR compliance statement, DPA availability | Copywriter / Legal | M (1 day) | Page indexed; organic impressions for "effectime GDPR"; enterprise bounce rate decreases | SEO-23 |
| 3.6 | Publish Pricing page at `/hu/arak/`: tier structure, per-workspace pricing, enterprise CTA, pricing FAQ (3–5 pairs) | Founder / Copywriter | M (1 day) | Organic impressions for "effectime ár", "HR szoftver ár"; pricing page trial conversion tracked | SEO-24 |
| 3.7 | Publish CRM Embed SDK page at `/hu/crm-embed-sdk/`: what it is, iframe API, webhook events, npm install snippet, use-case scenarios, developer FAQ, GitHub/docs CTA | Copywriter / Dev | M (1–2 days) | Impressions for "CRM embed SDK", "workforce widget API"; developer referral traffic | SEO-36 |
| 3.8 | Publish Reseller/Partner Program page at `/hu/partneri-program/`: partner tiers, revenue share, onboarding, application form | Founder / Business Dev | M (1 day) | Impressions for "HR szoftver viszonteladó"; partner inquiry form submissions | SEO-37 |
| 3.9 | Update sitemap.xml to include all new public URLs from BrowserRouter migration | Dev (Frontend) | XS (30 min per release cycle) | GSC Sitemaps → 0 errors; all new URLs submitted | SEO-05 dep. |
| 3.10 | Publish 2–3 initial comparison pages: "Effectime vs. Excel," "Effectime vs. Personio," "Effectime vs. HRmaster" at `/hu/osszehasonlitas/...` | Copywriter | L (2–3 days) | Organic impressions for comparison queries; comparison page trial conversion tracked | SEO-25 |
| 3.11 | Create Wikidata entity for Effectime (organization, founder, product, URL, country); link from Wikipedia if eligible | Founder / Marketing | S (2–3 hrs) | Knowledge Panel appears or improves for branded query "Effectime" | SEO-28 dep. |
| 3.12 | Publish 5 pillar hub pages (one per content cluster): Műszakbeosztás Hub, Kapacitástervezés Hub, Szabadságkezelés Hub, HR Szoftver Hub, CRM Integráció Hub | Copywriter | XL (1 week) | Hub pages indexed; GSC shows impressions for pillar keywords; internal linking from spokes | SEO-26 |

**Phase 3 exit gate:** BrowserRouter migration deployed and smoke-tested. Core Web Vitals passing on mobile. At least 8 new public URLs indexed in GSC. Pillar hub pages live.

---

## Phase 4 — Months 5–12: Topical Authority + Link Acquisition + Conversion Optimization

### Goal
Publish the full 50+ page content architecture, execute link acquisition from authoritative HU domains, build case studies for E-E-A-T, launch the HR glossary, and optimize conversion from organic traffic. By month 12, Effectime should be the highest-authority HU-native HR SaaS in Google's understanding.

### Actions

| # | Action | Owner | Effort | Success Metric | Backlog Ref |
|---|--------|-------|--------|----------------|-------------|
| 4.1 | Publish 30+ spoke/cluster articles aligned to the 5 pillar hubs; minimum 1,200 words each; DEAR framework (Definition → Explanation → Application → Resource); all HU-language | Copywriter (ongoing) | XL | 30 cluster pages indexed; topical authority score (Semrush) increases 20+ points | SEO-26 |
| 4.2 | Publish Hungarian HR glossary (`/hu/fogalomtar/`) with 30+ entries covering műszakbeosztás, kapacitástervezés, szabadságkezelés, Mt. törvény definitions; internal links from every relevant article | Copywriter | L (3–4 days) | Featured snippets captured for 3+ glossary terms within 90 days; glossary pages indexed | SEO-33 |
| 4.3 | Publish HU labor law compliance content: "Hány nap szabadság jár 2025-ben?", "Hogyan számítsam a csapat kapacitását?", "Munkatörvény könyv vs. Effectime automáció" | Copywriter / Legal | L (2–3 days) | Impressions for Mt. törvény / szabadság queries; seasonal traffic spikes Q1/Q4 | SEO-34 |
| 4.4 | Publish 4 industry vertical pages: Healthcare (`/hu/egeszsegugy/`), IT services (`/hu/it-cegek/`), Financial services (`/hu/penzugyi-szolgaltatok/`), Holdings (`/hu/holding-vallalatok/`) | Copywriter | L (3–4 days) | Impressions for vertical-specific queries; vertical page trial conversion tracked | SEO-27 |
| 4.5 | Publish 2–3 case studies with real customer data (company type, size, before/after metrics); PDF version for sales team use | Founder / Marketing | L (1 week) | Case study pages indexed; enterprise trial conversion rate increases; E-E-A-T "Experience" signal present | SEO-38 |
| 4.6 | Outreach to hrportal.hu for editorial mention or guest post (target: "Hogyan digitalizáljuk a jelenléti ívet?" article) | Founder / Marketing | M (ongoing) | 1+ dofollow backlink from hrportal.hu; Ahrefs DR increase | SEO-35 |
| 4.7 | Outreach to adozona.hu for mention in HR software context (szabadságkezelés or Mt. törvény article) | Founder / Marketing | M (ongoing) | 1+ dofollow backlink from adozona.hu | SEO-35 |
| 4.8 | Submit Effectime to MKIK.hu (Hungarian Chamber of Commerce) partner directory and MMSZ (Magyar Marketing Szövetség) member listings | Founder / Marketing | S (2–3 hrs) | Directory listing live; referral traffic in GA4 | SEO-35 |
| 4.9 | Publish author bio pages for Faul Henrik and any HU HR expert contributors; add author schema to all editorial content | Founder / Copywriter | M (1 day) | Author pages indexed; Google author entity association visible | SEO-08 dep. |
| 4.10 | Implement breadcrumb schema on all hub and spoke pages | Dev (Frontend) | S (3–4 hrs) | GSC Enhancements → Breadcrumbs detected on 20+ URLs | SEO-11 dep. |
| 4.11 | Implement `HowTo` schema on step-by-step process articles | Dev (Frontend) | S (3–4 hrs) | GSC Enhancements → HowTo rich results detected | SEO-11 dep. |
| 4.12 | Quarterly content audit: refresh articles with declining impressions; update annual stats (szabadság nap 2026, Mt. törvény changes); add internal links from new articles to older ones | Copywriter / Marketing | M (quarterly) | Declining articles recover to within 20% of peak; no article below 100 impressions/month at 6 months | SEO-26 dep. |
| 4.13 | Expand comparison pages: add Sloneek, Nexon HR, Recont, Kenexa as new comparison targets as HU market evolves | Copywriter | M (as needed) | Organic impressions for new comparison queries | SEO-25 dep. |
| 4.14 | Publish M365 integration deep-dive page: Outlook calendar sync, Teams notifications, SharePoint leave calendar; target "Effectime Outlook integráció" | Copywriter / Dev | M (1 day) | Impressions for M365/Outlook integration queries; developer referral traffic | SEO-26 |

**Phase 4 exit gate (Month 12 target state):**
- 50+ URLs indexed with non-zero GSC impressions
- Domain Rating (Ahrefs) ≥ 25
- 3+ referring HU domains (hrportal.hu or equivalent authority)
- Top-10 ranking for at least 3 of the 5 primary HU keywords (műszakbeosztás szoftver, kapacitástervezés platform, szabadságkezelő rendszer)
- Featured snippet captured for at least 2 FAQ/how-to queries
- Organic trial signups contributing ≥ 15% of total new trial starts
- Knowledge Panel triggered for branded query "Effectime"

---

## Owner Definitions

| Owner Label | Role |
|-------------|------|
| Dev (Frontend) | React/Vite engineer with access to `src/` and `index.html` |
| Copywriter | Hungarian-fluent content writer with B2B SaaS and HR domain knowledge |
| Designer | Graphic/UX designer for branded assets (OG image, screenshots) |
| Founder | Faul Henrik — decisions on pricing, case studies, entity profiles, partnerships |
| Marketing | Marketing team member or contractor handling GSC, GA4, social profiles |
| Legal | HR legal advisor for labor law compliance content |

---

*All phase timelines assume single-engineer availability at ~50% of sprint capacity for technical work. Content items assume 1 copywriter. Dates will shift if resources are constrained — reprioritize by evidence-backed impact, not by ease.*
