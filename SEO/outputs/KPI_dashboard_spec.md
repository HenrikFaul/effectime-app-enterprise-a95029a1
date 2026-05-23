# KPI Dashboard Specification — effectime.app SEO
# Agent 09 — Reporting & Action Plan | 2026-05-23

---

## Overview

This specification defines 12 KPIs organized across 4 measurement domains: organic visibility, engagement quality, technical health, and business conversion. Each KPI includes: what to measure, data source, measurement frequency, baseline method, success threshold, and the specific agent-finding that justifies tracking it.

All KPIs should be reviewed in a single dashboard view. Recommended tool stack: Google Search Console (primary organic data) + Google Analytics 4 (conversion + engagement) + Ahrefs or Semrush (competitor benchmarking + DR + backlinks) + PageSpeed Insights (CWV automation). A lightweight dashboard in Google Looker Studio connecting GSC and GA4 is sufficient for Phase 1–2.

---

## Domain 1: Organic Visibility

### KPI 1 — Organic Impressions (Total + by Language)

**What to measure:** Total Google Search impressions for effectime.app per week, segmented by HU-language queries vs. non-HU. Track separately before and after `html lang="hu"` fix (SEO-01).

**Data source:** Google Search Console → Performance → Search Type: Web → Date range: weekly, compare to prior period

**Measurement frequency:** Weekly review; monthly trend analysis

**Baseline:** Set in Week 1 after GSC property is verified (SEO-18). Current baseline is effectively 0 measurable HU impressions due to `lang="en"` misclassification.

**Success thresholds:**
- Month 1: Baseline established; GSC Language Targeting report shows HU
- Month 3: ≥ 500 impressions/week for HU-language queries
- Month 6: ≥ 2,000 impressions/week HU queries
- Month 12: ≥ 10,000 impressions/week HU queries (aligns with 5-pillar content architecture)

**Evidence basis:** Agent 01 (lang="en" misclassification), Agent 02 (top HU keyword clusters), Agent 04 (Tier 1 fix: 15 min change)

**Alert trigger:** Week-over-week decline > 20% — investigate GSC Coverage errors or Google algorithm update impact

---

### KPI 2 — Keyword Rankings (Primary HU Terms)

**What to measure:** Google position for 10 tracked keywords, checked weekly. Minimum tracking set:
1. műszakbeosztás szoftver
2. kapacitástervezés platform
3. szabadságkezelő rendszer
4. HR szoftver Magyar
5. jelenléti ív digitalizálás
6. excel helyett HR szoftver
7. CRM embed SDK (global EN)
8. workforce management szoftver
9. vállalati szabadságkezelés
10. Effectime (branded)

**Data source:** Ahrefs Rank Tracker or Semrush Position Tracking (weekly auto-report); cross-validate with GSC Queries tab

**Measurement frequency:** Weekly snapshot; compare to 4-week rolling average

**Baseline:** All 10 terms likely unranked (position > 100) at project start. Branded term may show position 1–5 already.

**Success thresholds:**
- Month 1: Branded term stable at position 1; non-branded terms enter top 100
- Month 3: At least 2 primary terms in top 30
- Month 6: At least 3 primary terms in top 10
- Month 12: At least 5 primary terms in top 10; 1 term in position 1–3

**Evidence basis:** Agent 02 (composite score ranking of keyword clusters), Agent 06 (Factorial expanding CEE — window is closing), Agent 07 (12-month content calendar)

**Alert trigger:** Primary branded term drops below position 5 — check for new competitor or Google penalty

---

### KPI 3 — Indexed URL Count

**What to measure:** Number of URLs from effectime.app indexed in Google, tracked monthly. Pre-BrowserRouter migration this should be 1 (homepage only). Post-migration, it should grow as content pages are published.

**Data source:** Google Search Console → Index → Pages → "Indexed" count; also `site:effectime.app` in Google Search (rough count)

**Measurement frequency:** Monthly

**Baseline:** 1 URL indexed (homepage) at project start

**Success thresholds:**
- End of Phase 1 (Week 1): 1 URL (homepage), confirmed indexed and canonical correct
- End of Phase 2 (Week 4): 1 URL (homepage), but full content visible in GSC URL Inspection
- End of Phase 3 (Month 4): ≥ 12 URLs indexed (homepage + 5 hub pages + Security + Pricing + About + CRM SDK + Partner + Comparison pages)
- End of Phase 4 (Month 12): ≥ 50 URLs indexed

**Evidence basis:** Agent 01 (HashRouter — 1 indexable page), Agent 04 (T-01 root cause), Agent 05 (IA with 7 hubs + 40+ spokes)

**Alert trigger:** Indexed count drops — check GSC Coverage for "Excluded" pages, check for noindex tags erroneously applied to public URLs

---

### KPI 4 — Click-Through Rate (CTR) from SERP

**What to measure:** Average CTR for non-branded queries in Google Search, measured weekly. This is the primary signal that page titles and meta descriptions are persuasive.

**Data source:** Google Search Console → Performance → filter by "Queries: does not contain effectime" → CTR column

**Measurement frequency:** Weekly; compare 4-week rolling average

**Baseline:** Unmeasurable before GSC is set up; will be low (< 1%) until title/description rewrite ships (SEO-02, SEO-03)

**Success thresholds:**
- After Phase 1 title/description rewrite: non-branded CTR baseline established
- Month 3: Non-branded CTR ≥ 2% (average for B2B SaaS in position 5–10 range)
- Month 6: Non-branded CTR ≥ 3.5%
- Month 12: Non-branded CTR ≥ 5% (indicates strong title/description relevance for keyword intent)

**Evidence basis:** Agent 03 (title zero keyword signal, description 65 chars no CTA), Agent 04 (Tier 1: title + description fix is highest-ROI action)

**Alert trigger:** CTR drops > 15% week-over-week for a stable ranking position — SERP feature (competitor's FAQ snippet, ad) may be displacing the organic result; revisit title/description

---

## Domain 2: Engagement Quality

### KPI 5 — Organic Landing Page Engagement Rate

**What to measure:** GA4 "Engaged sessions" from organic channel on the landing page (`/`). GA4 defines an engaged session as: ≥ 10 seconds duration, OR 2+ pageviews, OR a conversion event. This replaces bounce rate as the primary quality signal.

**Data source:** GA4 → Reports → Acquisition → Traffic Acquisition → filter by "Session source / medium: google / organic" → Engagement rate column

**Measurement frequency:** Weekly; compare monthly

**Baseline:** Set in Week 1 after GA4 is configured (SEO-19)

**Success thresholds:**
- Month 1: Baseline established
- Month 3: Organic landing page engagement rate ≥ 45%
- Month 6: ≥ 55% (content expansion and FAQ sections should improve this)
- Month 12: ≥ 65%

**Evidence basis:** Agent 03 (landing page ~400 words — far below 1,500–2,500 word target; low content = high bounce)

**Alert trigger:** Engagement rate drops > 10 percentage points — check landing page content integrity (prerender snapshot may be stale), check page speed regression

---

### KPI 6 — Average Scroll Depth on Landing Page (Organic Sessions)

**What to measure:** How far organic visitors scroll on the homepage. Measured as % of page height reached at the 25%, 50%, 75%, and 90% thresholds using GA4 custom scroll events.

**Data source:** GA4 → configure `scroll` event with `percent_scrolled` parameter (25/50/75/90); filter by organic source

**Measurement frequency:** Monthly

**Baseline:** Set after Phase 2 landing page expansion completes (SEO-17)

**Success thresholds:**
- Month 3: ≥ 50% of organic sessions reach 50% scroll depth
- Month 6: ≥ 40% of organic sessions reach 75% scroll depth
- Month 12: ≥ 30% of organic sessions reach 90% scroll depth (FAQ + pricing CTA section)

**Evidence basis:** Agent 03 (content gap — no FAQ, no pricing, no use-case sections below the fold; these must be added and then measured)

---

## Domain 3: Technical Health

### KPI 7 — Core Web Vitals (Mobile) — LCP, TBT/INP, CLS

**What to measure:** Three Core Web Vitals for the landing page on mobile:
- LCP (Largest Contentful Paint): time until main content is visible — target < 2.5s
- INP (Interaction to Next Paint, replaces FID): responsiveness — target < 200ms
- CLS (Cumulative Layout Shift): visual stability — target < 0.1

**Data source:** Google PageSpeed Insights (run weekly); GSC → Core Web Vitals report (field data, 28-day rolling); Chrome UX Report

**Measurement frequency:** Weekly automated PSI run; monthly GSC field data review

**Baseline:** Run PSI on effectime.app before any Phase 1 changes are deployed to establish current state. Expected: LCP failing (4.3 MB JS bundle), TBT failing

**Success thresholds:**
- After Phase 1 (preconnect added — SEO-15): DNS timing improvement visible in PSI Opportunities
- After Phase 2 (prerendering — SEO-12): LCP improvement as content is server-rendered
- After Phase 3 code splitting (SEO-20): LCP < 2.5s mobile; TBT/INP < 200ms; CLS < 0.1
- Month 12: All three CWV in "Good" range for both mobile and desktop in GSC field data

**Evidence basis:** Agent 01 (4.3 MB monolithic JS), Agent 04 (T-05: TBT and LCP failure risk), Agent 04 (T-12: no preconnect → 200–500ms DNS delay)

**Alert trigger:** LCP or INP regresses to "Needs Improvement" in GSC field data — investigate new large components, new third-party scripts, or bundle size regression

---

### KPI 8 — Structured Data Coverage + Rich Result Eligibility

**What to measure:** Number of pages with valid structured data schemas, and whether Google is surfacing rich results (FAQ accordions, SoftwareApplication rating, Knowledge Panel) in SERPs.

**Data source:** GSC → Enhancements tab (shows schema types detected + errors); Google Rich Results Test (manual monthly run); SERP screenshot archive for branded query "Effectime"

**Measurement frequency:** Monthly validation run; alert on GSC Enhancement errors

**Baseline:** 0 schemas, 0 rich results at project start (Agent 08: zero structured data)

**Success thresholds:**
- End of Phase 2: Organization + SoftwareApplication + FAQPage all passing Rich Results Test; GSC Enhancements shows 3 enhancement types
- Month 3: FAQ rich results appearing in SERP for at least 1 branded query
- Month 6: SoftwareApplication enhancement detected; Knowledge Panel triggered for "Effectime" branded query
- Month 12: Breadcrumbs + HowTo + FAQPage rich results active across 10+ pages

**Evidence basis:** Agent 08 (zero structured data; DEAR framework; entity consistency for Knowledge Panel), Agent 06 (SERP feature opportunities: FAQ rich results, Knowledge Panel)

---

### KPI 9 — Sitemap Health (Submitted vs. Indexed vs. Excluded)

**What to measure:** In GSC Sitemaps report: the ratio of URLs submitted in sitemap.xml to URLs confirmed indexed by Google, and the count of excluded URLs with reasons.

**Data source:** Google Search Console → Sitemaps → click on submitted sitemap → see "Discovered URLs," "Indexed," "Excluded" breakdown

**Measurement frequency:** Weekly (auto-monitored in GSC); monthly review of excluded URL reasons

**Baseline:** 0 submitted URLs before sitemap is created (SEO-05)

**Success thresholds:**
- Week 1: 1 URL submitted, 1 indexed, 0 excluded, 0 errors
- Month 4 (post-BrowserRouter): ≥ 12 URLs submitted, ≥ 10 indexed (80%+ indexation rate)
- Month 12: ≥ 50 URLs submitted, ≥ 45 indexed (90%+ indexation rate), 0 sitemap errors

**Evidence basis:** Agent 01 (no sitemap), Agent 04 (T-03: sitemap absent), Agent 07 (50+ cluster URL architecture)

**Alert trigger:** Sitemap error count > 0 OR indexed rate drops below 75% — investigate GSC Coverage errors, canonical mismatches, noindex tags on public content

---

## Domain 4: Authority + Conversion

### KPI 10 — Referring Domains (HU Authority Sites)

**What to measure:** Number of unique referring root domains, with specific tracking of HU-language authority domains: hrportal.hu, adozona.hu, MKIK.hu, MMSZ, portfolio.hu, hrblog.hu. DR (Domain Rating) from Ahrefs as summary metric.

**Data source:** Ahrefs → Site Explorer → effectime.app → Referring Domains (filter: HU TLD or HU-language content) + Ahrefs DR (checked monthly)

**Measurement frequency:** Monthly

**Baseline:** Near-zero HU referring domains at project start (Agent 08: E-E-A-T absent; no backlinks from authoritative HU sources)

**Success thresholds:**
- Month 6: ≥ 3 total referring domains (any); Ahrefs DR ≥ 10
- Month 9: ≥ 1 referring domain from {hrportal.hu OR adozona.hu}; DR ≥ 15
- Month 12: ≥ 3 referring HU authority domains; DR ≥ 25

**Evidence basis:** Agent 07 (hrportal.hu, MKIK.hu, MMSZ, adozona.hu as primary targets), Agent 06 (Factorial expanding CEE — backlinks from HU authority sites create defensible moat)

**Alert trigger:** Loss of an existing referring domain — investigate removed content or changed partner relationships; replace with alternative outreach

---

### KPI 11 — Organic Trial Signups (Organic → Conversion Rate)

**What to measure:** Number of trial/registration events attributed to the organic channel in GA4, and the organic conversion rate (organic sessions → signup events).

**Data source:** GA4 → Reports → Acquisition → Traffic Acquisition → filter: Session source/medium: google/organic → Conversions column (requires signup event configured in SEO-19)

**Measurement frequency:** Weekly count; monthly rate calculation

**Baseline:** 0 measurable organic conversions before GA4 is configured (SEO-19). Will remain low until content expansion drives non-branded organic traffic (Phases 2–3).

**Success thresholds:**
- Month 1: Organic conversion tracking baseline established
- Month 3: ≥ 5 organic trial signups/month
- Month 6: ≥ 20 organic trial signups/month
- Month 12: Organic channel contributes ≥ 15% of all new trial starts; organic → trial conversion rate ≥ 2%

**Evidence basis:** Agent 02 (high-intent BOFU keywords: comparison queries, pricing queries), Agent 06 (no pricing page, no comparison pages — high bounce from commercial intent queries)

**Alert trigger:** Organic conversion rate drops > 30% month-over-month with stable traffic — landing page test may have introduced a regression; investigate GA4 funnel dropoff point

---

### KPI 12 — Topical Authority Score (Semrush/Ahrefs Topic Coverage)

**What to measure:** The percentage of target keywords (from the 50+ tracked keyword list) for which effectime.app has at least one indexed page. This measures content coverage velocity — the rate at which the content architecture is built out.

**Data source:** Ahrefs → Keyword Explorer → export tracked 50-keyword list → "Has ranking page on effectime.app?" → count coverage %; OR Semrush → Topic Research → effectime.app subtopic coverage

**Measurement frequency:** Monthly

**Baseline:** ~2% coverage (only homepage, only for branded and tangentially related queries) at project start

**Success thresholds:**
- End of Phase 2 (Month 1): 5% coverage (homepage content expansion covers more sub-topics)
- End of Phase 3 (Month 4): 30% coverage (5 hub pages + 8 product/feature pages)
- Month 9: 60% coverage (15+ spoke articles published)
- Month 12: ≥ 80% coverage (40+ cluster pages published; glossary complete)

**Evidence basis:** Agent 07 (5-pillar, 50+ cluster page architecture; 12-month content calendar), Agent 06 (Factorial actively expanding CEE content — topical coverage gap is time-sensitive)

**Alert trigger:** Coverage velocity drops to 0 for 4+ consecutive weeks — content production pipeline stalled; escalate to founder

---

## Dashboard Review Cadence

| Frequency | Reviewer | KPIs Reviewed | Action Threshold |
|-----------|----------|---------------|-----------------|
| Weekly | Marketing / Dev | KPI 1 (impressions), KPI 4 (CTR), KPI 7 (CWV), KPI 9 (sitemap health) | Any alert trigger fired → same-week investigation |
| Monthly | Founder + Marketing | All 12 KPIs | KPIs off-target by > 20% → prioritize corrective action in next sprint |
| Quarterly | Founder | KPI 2 (rankings), KPI 10 (backlinks), KPI 11 (conversions), KPI 12 (topical coverage) | Strategic review: is Phase 4 link acquisition on track? Is content calendar being followed? |

---

## Reporting Stack (Recommended Tools)

| Tool | Purpose | Cost |
|------|---------|------|
| Google Search Console | KPI 1, 3, 4, 8, 9 | Free |
| Google Analytics 4 | KPI 5, 6, 11 | Free |
| Google PageSpeed Insights API | KPI 7 (automated weekly run) | Free |
| Ahrefs Lite | KPI 2, 10, 12 | ~$99/month |
| Google Looker Studio | Dashboard connecting GSC + GA4 | Free |
| hreflangchecker.com | KPI 8 hreflang validation | Free |
| Facebook Sharing Debugger | OG/social validation | Free |
| Google Rich Results Test | KPI 8 schema validation | Free |

Ahrefs Lite is the only paid addition. If budget is constrained, substitute Semrush Free tier for KPI 2 (limited to 10 tracked keywords) and use GSC as the sole backlink proxy until DR measurement becomes needed.

---

*All KPI thresholds calibrated against: Agent 02 keyword volume data, Agent 06 competitor benchmarks, Agent 07 12-month content calendar, and Agent 04 engineering effort estimates. Revise thresholds after Month 3 based on actual baseline performance.*
