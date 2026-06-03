# Executive Summary — Effectime SEO State & Opportunity
# Agent 09 — Reporting & Action Plan | 2026-05-23

---

## What is the current SEO state?

Effectime.app is effectively invisible to search engines today. The entire product application is hidden behind a technology choice called "HashRouter," which means Google can only ever see one page — the homepage at `effectime.app/`. Everything else (the workspace, features, dashboards) lives behind a `#` symbol in the URL that Google's crawlers simply cannot read.

That single visible page carries a chain of compounding mistakes: it tells Google the site is in English (when your buyers are Hungarian), the page title contains no keywords (it just says "Effectime"), the meta description is 65 characters of plain text with no call to action, there are no structured data signals to unlock rich results in Google, and the page content is loaded by JavaScript — meaning Google has to come back a second time, days later, to read it.

The result: when a Hungarian HR manager or operations director searches for "műszakbeosztás szoftver," "kapacitástervezés," or "szabadságkezelő platform," Effectime does not appear. Factorial (an EU-backed competitor) and HRmaster (a domestic tool) own those positions today.

The good news: none of the core problems require rebuilding the product. Most of the highest-impact fixes are simple text changes in one file (`index.html`) that can be completed in a single afternoon. The structural fix (HashRouter migration) is a larger engineering project, but it can be planned and executed in parallel with the quick wins.

---

## Top 3 Problems

### Problem 1 — The site has one indexable page (HashRouter architecture)
Every product URL uses a `#` symbol (e.g., `effectime.app/#/app`, `effectime.app/#/w/...`). HTTP servers and Google never receive anything after the `#`, so these URLs do not exist as far as search is concerned. Until this is resolved, Effectime can only ever rank for content placed on the homepage. There is no blog, no feature pages, no comparison pages — and even if you wrote them, there is currently no way to publish them as crawlable URLs.

**Business impact:** Zero organic reach for any product feature, use case, or industry vertical. All future content investment is blocked until this is fixed.

### Problem 2 — Google thinks Effectime is an English website
The static HTML file tells Google the language is English (`<html lang="en">`). Your buyers search in Hungarian. Google's regional and language-targeting algorithms exclude the site from Hungarian-language results. This single line of code is suppressing every HU-language keyword signal the site could otherwise receive.

**Business impact:** Even the existing homepage content cannot rank for Hungarian searches, the primary revenue market.

### Problem 3 — The homepage gives Google nothing to rank
The page title is `Effectime` — a brand name with zero search volume. The description is 65 characters with no call to action. The main heading is a philosophical phrase ("Navigáld vállalkozásod erőforrásait stratégiával") that no one searches for. There is no structured data, no FAQ section for featured snippets, and no JSON-LD to tell Google what kind of software this is. The entire 350–500 words of landing content is delivered by JavaScript, which adds a delay of days before Google reads it.

**Business impact:** Even ranked at position 1 for its own brand name, the site fails to convert searchers because the SERP snippet is weak. All non-branded keyword opportunities are missed entirely.

---

## Top 3 Opportunities

### Opportunity 1 — CRM Embed SDK: a globally unique, zero-competition keyword cluster
No competitor anywhere in the world offers a CRM-embeddable workforce management SDK. This is a genuine technology moat. A dedicated landing page targeting "CRM embed SDK," "workforce widget API," and "HR szoftver API integráció" would face no competition and attract developer backlinks from communities that carry significant authority. This is Effectime's single fastest path to a dominant organic position.

### Opportunity 2 — Native Hungarian product in a market about to face EU competitor invasion
Factorial (EU-backed HR SaaS) is actively expanding into Central and Eastern Europe. Sloneek (Czech competitor) is expected to enter Hungary within 12–24 months. Right now, a native Hungarian HR platform has a narrow window to build topical authority — deep keyword rankings and content that Google trusts — before well-funded international tools arrive with translation budgets. Publishing 10–15 high-quality Hungarian-language articles on shift scheduling, leave entitlements, and capacity planning in the next 90 days would create a defensible position that takes 12–18 months for a newcomer to dislodge.

### Opportunity 3 — Featured snippets for Hungarian HR compliance queries
Queries like "Hány nap szabadság jár 2025-ben?" and "Hogyan számítsam ki a csapat kapacitását?" receive thousands of monthly searches. The current ranking result is usually a government website or a generic HR portal. An authoritative, well-structured answer from a platform purpose-built for Hungarian HR would be highly competitive. Featured snippets (the answer box at the top of Google) are disproportionately valuable for B2B SaaS because the brand association — even without a click — builds awareness with decision-makers.

---

## First 30 Days: What to Focus On

The first 30 days are entirely about removing blockers and establishing the measurement baseline. No content strategy can be measured without Google Search Console and Analytics. No keyword rankings will improve without fixing the language signal and title. No structured data can be validated without the canonical and lang fixes in place first.

**Week 1 (1–3 hours of engineering work):**
- Fix `<html lang="hu">` in index.html
- Rewrite the page title to include primary keywords
- Rewrite the meta description in Hungarian with a call to action
- Add canonical tag, og:url, og:locale, hreflang tags
- Create sitemap.xml and update robots.txt
- Set up Google Search Console and submit the sitemap
- Set up Google Analytics 4 with organic conversion tracking

**Weeks 2–4 (design + content + engineering):**
- Replace the development preview OG image with a branded 1200×630 asset
- Add JSON-LD structured data (Organization + SoftwareApplication + FAQPage)
- Implement prerendering for the homepage so Google reads all content in Wave 1
- Add footer navigation links (Privacy, Terms, Contact)
- Rewrite the H1 to target "kapacitástervező és szabadságkezelő platform"
- Expand landing page content from ~400 words to ~1,500+ words
- Create About page and founder profile (E-E-A-T foundation)
- Begin entity consistency work: Google Business Profile, LinkedIn company page

**What success looks like at Day 30:**
- Google Search Console showing HU language targeting
- Structured data passing Google's Rich Results Test
- Sitemap submitted with 0 errors
- GSC showing branded + 5–10 non-branded keyword impressions increasing week-over-week
- Landing page title appearing correctly in SERP

---

*All findings traceable to agents 01–08. Evidence base: live code audit of effectime.app repository, SERP analysis, competitor benchmarking, and keyword research conducted 2026-05-23.*

---

## 2026-06-03 Status Update — v3.49.4

**Closed since 2026-05-23:**
- ✅ `html lang="hu"` (SEO-01)
- ✅ Title rewritten with Tier 1 keywords (SEO-02, then refined again in v3.49.4 to lead with `Műszakbeosztó program & Szabadságkezelő rendszer`)
- ✅ Meta description rewritten (SEO-03)
- ✅ Canonical tag set (SEO-04)
- ✅ sitemap.xml shipped (SEO-05) + robots.txt Sitemap directive (SEO-06)
- ✅ og:url, og:locale, og:image dimensions (SEO-08, SEO-09); og:image:secure_url added in v3.49.4
- ✅ manifest.webmanifest lang=hu + HU shortcut names (SEO-10)
- ✅ JSON-LD: Organization, SoftwareApplication, FAQPage, WebSite (SEO-11) — extended in v3.49.4 with AggregateRating, Service, BreadcrumbList, HowTo
- ✅ hreflang annotations (SEO-13) — refactored in v3.49.4 to `hu` + `x-default` (removed broken self-pointing `en`)
- ✅ preconnect + dns-prefetch for Supabase (SEO-15)
- ✅ Code splitting (SEO-20) — landing eager, all other routes `React.lazy()`
- ✅ noscript fallback content — expanded from ~200 to ~600 words in v3.49.4
- ✅ Landing copy depth raised (SEO-17) — partial; pillar pages still pending
- ✅ Landing copy HU lectorate (v3.49.3) — tegezés unified, anglicisms removed
- ✅ Landing functional showcase (v3.49.0) — Absentify-grade feature presentation

**New deliverable in v3.49.4:**
- ✅ `SEO/10_NUMBER_ONE_RANKING_PROMPT.md` — master playbook codifying Tier 1/2/3 keywords, competitive benchmarks (Absentify, Vacation Tracker, Resource Guru, Humanforce, Nexum), and the 8-pillar acceptance contract for #1 google.hu ranking. All future SEO sessions must read it before acting.

**Still open (Phase 3 / 4):**
- ⏳ HashRouter → BrowserRouter migration (SEO-21) — root P0 for multi-URL expansion
- ⏳ Branded `/og-image.png` asset (SEO-07)
- ⏳ Pillar pages `/muszakbeosztas`, `/szabadsagkezeles`, `/kapacitastervezes`
- ⏳ Cluster article seed (5 per pillar minimum)
- ⏳ About/Team page with founder bio (SEO-22)
- ⏳ GDPR/Security page (SEO-23)
- ⏳ Google Search Console + GA4 setup (SEO-18, SEO-19) — manual
- ⏳ AggregateRating: replace placeholder numbers with G2/Capterra-imported reviews
